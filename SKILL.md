---
name: hermes-agent-azure-deploy
category: devops
description: Deploy Hermes Agent to Azure Container Apps with Telegram — pitfalls and patterns
---

# Hermes Agent Azure Deployment

## ACR Build + Async Push Pattern

**Problem:** `docker push` to ACR hangs on macOS (Docker daemon issue). `az acr build` times out in CLI but build still completes in Azure.

**Solution:**
```bash
# Use --no-wait, then poll for image tag
az acr build \
  --registry <acr-name> \
  --image hermes-agent:<tag> \
  --file Dockerfile \
  --no-wait \
  /path/to/project/

# Poll until image appears (may take 2-5 minutes)
while true; do
  az acr repository show-tags \
    --name <acr-name> \
    --repository hermes-agent \
    --orderby time_desc --top 3
  sleep 30
done
```

**Known ACR registries (subscription):**
- `hermesagentacr.azurecr.io` — hermes-agent images
- `moonbeamacr.azurecr.io`
- `careexchangenewacr.azurecr.io`
- `vvacri6en5hucfd3re.azurecr.io`

**Cloud Shell issues:** ACR builds in Azure Cloud Shell can fail with "Unable to get AAD authorization tokens" credential error. Retry or use a different environment.

**Key insight:** The image IS in the registry even when CLI returns timeout or "not found" immediately after. Just poll every 30s.

## Pairing Data Path — Critical Gotcha

**Problem:** Pre-approved pairing data baked into Docker image at `/app/.hermes/pairing/` but Hermes reads from `~/.hermes/pairing/` which maps to `/root/.hermes/pairing/`.

**Fix in Dockerfile:**
```dockerfile
# Copy pairing data to /root/.hermes/pairing/ (where Hermes actually reads it)
COPY pairing/.hermes /root/.hermes
# NOT: COPY pairing/.hermes /app/.hermes

# Also set HERMES_HOME explicitly if needed
ENV HERMES_HOME=/root/.hermes
```

**Verify pairing structure:**
```bash
# Inside container, pairing must be at:
# /root/.hermes/pairing/telegram-approved.json
# /root/.hermes/pairing/telegram-pending.json

# Format:
# telegram-approved.json: {"222335742": {"user_name": "Name", "approved_at": <unix_ts>}}
```

## Container Apps Revision Management

**IMPORTANT:** Resource group is `hermes-agent-rg` NOT `hermes-rg`.

**Every `az containerapp update` creates a new revision** even if image tag is unchanged. Traffic routing does NOT auto-follow.

**Always do after update:**
```bash
# 1. Update image
az containerapp update \
  --name hermes-agent \
  --resource-group hermes-agent-rg \
  --image <acr>.azurecr.io/hermes-agent:<tag>

# 2. Immediately route traffic to new revision
# Note: --traffic flag does NOT work; use --revision-weight
az containerapp ingress traffic set \
  --name hermes-agent \
  --resource-group hermes-agent-rg \
  --revision-weight hermes-agent--<new-rev>=100
```

**Check current traffic:**
```bash
az containerapp show --name hermes-agent --resource-group hermes-agent-rg \
  --query "properties.configuration.ingress.traffic"
```

## Min Replicas = 1 (Prevent Cold Start Silence)

**Problem:** Scale 0-1 means container goes cold and takes ~30s to wake. During cold start, HTTP requests timeout.

**Fix:**
```bash
az containerapp update \
  --name hermes-agent \
  --resource-group hermes-agent-rg \
  --min-replicas 1
```

## Health Check — Gateway Returns 404

**Problem:** `curl /health` times out, leading to belief container is unhealthy.

**Actually:** Gateway IS running. The `/health` path just doesn't exist. A 404 response = gateway is healthy and responding.

```
curl -s --max-time 10 https://<fqdn>/
# Should return: <html><title>404: Not Found</title>...
# This = gateway IS running and responding
```

**Azure health probe:** TCP socket probe on port 8000 — it only checks if port is open, not if HTTP routes exist. Container can be "Healthy" while serving 404 on all paths.

## Azure CLI Exec — Works, But With Quirks

**Reality:** `az containerapp exec` NOW works reliably. The old "always timeout" issue appears resolved or environment-dependent.

**Quirks:**
- No shell chaining with `&&` — each command must be separate invocations
- No `cat` — use `head -N /path/to/file` instead
- Multi-command exec calls can produce garbled/duplicated output in the session
- Rate limited: HTTP 429 after ~5-6 uses (10-min cooldown)

**Working pattern:**
```bash
# Single command works:
az containerapp exec \
  --name hermes-agent \
  --resource-group hermes-agent-rg \
  --command "ls -la /app/"

# Use head instead of cat:
az containerapp exec \
  --name hermes-agent \
  --resource-group hermes-agent-rg \
  --command "head -50 /app/config.yaml"

# Resource group name is hermes-agent-rg NOT hermes-rg
az containerapp list --query "[].{name:name, resourceGroup:resourceGroup}"
```

## Hermes Agent Config (Telegram + MiniMax)

```yaml
model:
  default: MiniMax-M2.7
  provider: minimax
  base_url: https://api.minimax.io/anthropic   # CRITICAL: must be /anthropic, not /v1
  api_key: ${MINIMAX_API_KEY}
  context_length: 100000

agent:
  max_turns: 90

terminal:
  backend: local
  timeout: 180

gateway:
  platforms:
    - telegram
  telegram:
    enabled: true
    bot_token: ${TELEGRAM_BOT_TOKEN}
```

### Why `/anthropic` vs `/v1` Matters — MiniMax Auth Method

Hermes determines auth method from the `base_url` path:
- **`/anthropic`** → uses `Authorization: Bearer <key>` → MiniMax accepts ✅
- **`/v1`** → uses `x-api-key <key>` → MiniMax rejects with HTTP 401 ❌

The MiniMax API key format is `sk-cp-...` — Hermes checks for the `sk-ant-` prefix to decide between OAuth token vs API key. MiniMax's keys don't have the `sk-ant-` prefix, so without the `/anthropic` base URL, Hermes misroutes auth and MiniMax returns `{"error": "login fail: Please carry the API secret key in the 'Authorization' field (1004)"}`.

**Verify inside container:**
```bash
az containerapp exec --name hermes-agent --resource-group hermes-agent-rg \
  --command "python3 -c \"import os; print(os.environ.get('MINIMAX_API_KEY', 'NOT SET'))\""
```

### `.env` File — Container Apps Env Var Substitution

The `.env` file is loaded via `python-dotenv` and OVERRIDES process env vars. If the `.env` file has empty values, those override the injected Container Apps secrets.

**Problem pattern — causes "No LLM provider configured":**
```bash
OPENROUTER_API_KEY=       # empty — overrides the Container Apps env var
GROQ_API_KEY=             # empty — overrides the Container Apps env var
```

**Fix — use literal `${VAR_NAME}` substitution:**
```bash
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}   # resolves to the injected value at runtime
GROQ_API_KEY=${GROQ_API_KEY}
```

Always verify the `.env` file in the cloned repo before building. If building in Cloud Shell (ephemeral), check the repo `.env` before each build since Cloud Shell is wiped on session end.

## Cloud Shell Constraints

- `/tmp` is **ephemeral** — wiped on session end. Push config fixes to GitHub to persist.
- `az containerapp exec` rate-limits with HTTP 429 after ~5-6 uses (10-min cooldown)
- `hermes-agent` may be flagged as "misspelled" by Azure CLI in Cloud Shell — command still works
- ACR auth: `az acr login` times out; use `az acr login -n hermesagentacr --expose-token`
- `az acr build` can appear to hang with no output — let it run, poll for image tag to confirm completion

**Session persistence:** Create `PROJECT_STATE.md` in the repo and push after every significant change. Re-clone from GitHub at start of new session.

## Approved Telegram Users — Two Options

### Option 1: TELEGRAM_ALLOWED_USERS env var (preferred, simpler)

```bash
az containerapp update \
  --name hermes-agent \
  --resource-group hermes-agent-rg \
  --set-env-vars "TELEGRAM_ALLOWED_USERS=222335742"
```

To add multiple users, comma-separate:
```bash
--set-env-vars "TELEGRAM_ALLOWED_USERS=222335742,111222333,444555666"
```

User ID can be obtained by: (1) checking Telegram's @userinfobot, (2) from `telegram-approved.json` after first approval.

### Option 2: Pre-bake pairing files into image

Copy pre-approved pairing data to `/root/.hermes/pairing/` in Dockerfile (see Pairing Data Path section above).

Note: Even with pre-baked pairing files, Hermes may still request pairing code on first use. Use Option 1 to guarantee approval.

## OpenRouter Model ID — "not a valid model ID" Error

**Symptom:** `HTTP 400: OpenRouter is not a valid model ID`
**Root cause:** `config.yaml` has `default: OpenRouter` but OpenRouter needs a specific model ID like `openai/gpt-4o-mini`.
**Fix:** Set `default: openai/gpt-4o-mini` (or another valid OpenRouter model). Valid model IDs are provider/model combinations, not just "OpenRouter".

## MiniMax API Endpoint — Confirmed Working

**Correct endpoint:** `https://api.minimax.io/anthropic`

**Wrong endpoint (causes HTTP 401):** `https://api.minimax.io/v1`

The `/v1` path is for MiniMax's OpenAI-compatible API and uses different auth. The native Anthropic-compatible endpoint is `/anthropic`. When the Azure config has the wrong base_url, MiniMax returns:
```
HTTP 401: login fail: Please carry the API secret key in the 'Authorization' field (1004)
```

**Local Mac config uses:** `https://api.minimax.io/anthropic` (correct)
**Azure config default had:** `https://api.minimax.io/v1` (wrong — causes 401)

If MiniMax returns 401 after deployment, check `base_url` in the cloned config and fix with:
```bash
sed -i 's|https://api.minimax.io/v1|https://api.minimax.io/anthropic|' /tmp/hermes-agent-azure/config.yaml
```
Then rebuild and redeploy.

## Removing a Pushed Secret from Git History

```bash
# 1. Remove/fix the secret from the file
# 2. Amend the last commit
git commit --amend
# 3. Force push to overwrite remote
git push --force origin main
```

## Container Filesystem Structure

**HERMES_HOME=/app** — main working directory:
```
/app/
  config.yaml      # Main config
  .env             # API keys
  SOUL.md
  bin/
  cache/
  skills/
  sessions/
  memories/
  state.db
  .hermes/
```

**Also:** `/root/.hermes/` — separate hermes installation (node_modules, etc.)

**Profiles:** No `/app/profiles/` directory exists in the container. The container runs a flat, single-profile config. Multi-profile requires rebuilding with profiles baked in.

## Multi-Profile + Multi-Bot Architecture (Recommended)

**Recommended pattern: One profile = one bot = one project = one Container App**

Each project gets its own isolated container with credentials scoped only to that project:

```
hermes-agent-rg/
└── hermes-agent (container)
    ├── Managed Identity (RBAC: hermes-agent-rg only)
    └── GitHub PAT (hermes-agent-azure repo only)

care-exchange-rg/
└── care-exchange-agent (container)
    ├── Managed Identity (RBAC: care-exchange-rg only)
    └── GitHub PAT (care-exchange repo only)
```

**Why this pattern:**
- Cross-project contamination is the primary risk to prevent
- One compromised container cannot affect another project
- RBAC scoped to resource group = bot can only manage its own resources
- GitHub PAT scoped to repo = bot can only push to its own repo

**Setup for each new project:**
1. Create resource group: `<project>-rg`
2. Deploy Container App with system-assigned managed identity
3. Grant RBAC `Contributor` on `<project>-rg` only
4. Add GitHub PAT as secret (scoped to project's repo only)
5. Clone project's profile from GitHub into container

## Managed Identity Setup (Enabling Azure Management)

**Step 1: Enable system-assigned managed identity on container app:**
```bash
az containerapp identity assign \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --system-assigned
```

Returns `principalId` and `tenantId` — note these for RBAC assignment.

**Step 2: Grant RBAC scoped to resource group:**
```bash
az role assignment create \
  --assignee <principalId> \
  --role "Contributor" \
  --scope "/subscriptions/<sub-id>/resourceGroups/<resource-group>"
```

**Verification:**
```bash
az containerapp show --name hermes-agent --resource-group hermes-agent-rg \
  --query "identity"
```

This gives the container Azure AD identity without storing credentials in code. The container can now use `az` CLI (if installed) to manage resources in its scoped resource group.

**Current hermes-agent identity (as of 2026-04-19):**
- principalId: `e2c4176a-2e38-4099-a3e7-4530876c1321`
- tenantId: `9ad1a1b0-e855-415c-930a-b4fa489a0f9d`
- RBAC: Contributor on `hermes-agent-rg` granted

## Session Persistence (Cloud Shell is Ephemeral)

Cloud Shell `/tmp` is wiped on session end. Critical state MUST be pushed to GitHub:

**Create PROJECT_STATE.md in the repo:**
```markdown
# Project State — update on each session
## Current deployment info
## Pending work
## Resolved issues
```

**Push after every significant change:**
```bash
git add PROJECT_STATE.md && git commit -m "chore: update state" && git push
```

**Always re-clone from GitHub at start of new session** — do not rely on `/tmp` contents surviving.

**Memory entries survive context resets** — use `memory` tool to store critical facts (resource IDs, principal IDs, deployment state) that are needed in future sessions.
