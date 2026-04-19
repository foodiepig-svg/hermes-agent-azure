# Hermes Agent Azure — As Built

## Purpose
Deploy NousResearch Hermes Agent on Azure Container Apps with Telegram integration for personal use.

## Decisions & Rationale

### Container Apps over VMs
Azure subscription (91bd0fcb-95b8-4a45-b69e-f9556190dd29) has no VM capacity in any region — all Standard_D* and B* SKUs return `SkuNotAvailable`. Container Apps (Consumption mode) was the only viable compute option.

### ACR Build over local Docker push
Docker daemon on macOS hangs on large image pushes. Used `az acr build` instead — builds and pushes in Azure, bypasses local daemon entirely.

### Image rebuilds causing startup hangs (RESOLVED)
New image builds (v16, v17, v18) consistently failed the health check with TCP timeout, despite identical Dockerfiles to v14 which worked. Root cause was intermittent Azure ACR infrastructure issues — subsequent builds (v20+) succeeded. Keep at least one working image tag available.

### Hermes installed via official installer
Used the official `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup` instead of pip install. This installs Node.js, Playwright, and all TUI/browser dependencies.

## Deployment Log

| Date | Image | Rev | Notes |
|------|-------|-----|-------|
| 2026-04-17 | v6-v9 | various | Failed — ImportError in gateway |
| 2026-04-17 | v10 | 0000017 | First working image, ImportError fixed |
| 2026-04-18 | v12 | 0000021 | Added pairing/.hermes structure to Dockerfile |
| 2026-04-18 | v14 | 0000025 | Working — used for rev 0000030 via env-var update |
| 2026-04-18 | v15 | 0000026 | Failed — hermes tools enable in Dockerfile hung at startup |
| 2026-04-18 | v16-v18 | 0000027-0000029 | Timeout on health check — ACR build issue, cause unknown |
| 2026-04-18 | v14 + keys | 0000030 | Working — v14 image with GROQ_API_KEY + OPENROUTER_API_KEY added |
| 2026-04-18 | v20-v23 | 0000031-0000034 | Intermittent build success; OpenRouter model name issue (400) |
| 2026-04-18 | v24 | 0000035 | **Current** — MiniMax base_url fixed to /anthropic; OpenRouter working as fallback |

## Current Status (2026-04-18)

### Fully Operational
- Container App running rev 0000035 (v24 image) ✅
- Telegram bot responding ✅
- MiniMax M2.7 as primary LLM ✅
- OpenRouter as fallback ✅
- Home channel configured ✅
- Sunjay Soma (222335742) authenticated via `TELEGRAM_ALLOWED_USERS=222335742` ✅
- Hermes Agent accessible at: https://hermes-agent.orangehill-e65ae777.southeastasia.azurecontainerapps.io ✅

### Active Revisions
- `hermes-agent--0000035` (v24, 100% traffic) — ACTIVE ✅

## LLM Providers Configured

| Provider | Env Var | Status |
|----------|---------|--------|
| MiniMax M2.7 (primary) | `MINIMAX_API_KEY` | ✅ Working |
| OpenRouter (fallback) | `OPENROUTER_API_KEY` | ✅ Working |
| Groq | `GROQ_API_KEY` | ✅ Loaded |

### Free Models Available
- **OpenRouter**: `google/gemini-2.0-flash-thinking`, `deepseek/deepseek-chat-v3-0324`, `meta-llama/llama-4-Maverick`
- **Groq**: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`

Switch model mid-conversation: `/model <model-name>`

## Secrets in Key Vault

| Secret | Name in Key Vault |
|--------|------------------|
| MiniMax API key | `minimax-api-key` |
| Telegram bot token | `telegram-bot-token` |
| Groq API key | `groq-api-key` |
| OpenRouter API key | `openrouter-api-key` |

## Resolved Issues

1. **MiniMax 401 (ROOT CAUSE FOUND)**:
   - Wrong `base_url` in config.yaml: was `https://api.minimax.io/v1`
   - Hermes sends `x-api-key` header to `/v1` endpoints, but MiniMax expects `Authorization: Bearer` header
   - MiniMax's `/anthropic` endpoint requires Bearer auth — Hermes detects this and routes appropriately
   - **Fix**: `base_url: https://api.minimax.io/anthropic` — committed to GitHub (commit 37661f3)

2. **OpenRouter 400 "not a valid model ID"**:
   - Config had `default: OpenRouter` — OpenRouter needs a real model ID like `openai/gpt-4o-mini`
   - **Fix**: Use `openai/gpt-4o-mini` or similar as the model name when switching to OpenRouter

3. **Telegram pairing code**: Fixed by adding `TELEGRAM_ALLOWED_USERS=222335742` env var

4. **Image rebuild hangs**: Intermittent ACR infrastructure issue — v20+ builds succeeded consistently

## hermes-control-plane Deployment (2026-04-19)
| Image | Rev | Notes |
|-------|-----|-------|
| v6 | — | **Current** — Next.js 16 + Prisma5/SQLite, health check polling fix |

- **Repo**: github.com/foodiepig-svg/hermes-control-plane
- **Image**: hermesagentacr.azurecr.io/control-plane:v6
- **URL**: https://control-plane.thankfulhill-a8e49df7.southeastasia.azurecontainerapps.io
- **Container App env**: control-plane-env
- **Stack**: Next.js 16, Prisma 5, SQLite, shadcn/ui v5 (Base UI)

### control-plane API Routes (as of v6)
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | /api/projects | ✅ Implemented |
| POST | /api/projects | ⚠️ Skeleton only — Azure/GitHub/Telegram wiring pending |
| GET | /api/projects/[name] | ✅ Implemented |
| DELETE | /api/projects/[name] | ✅ Implemented (DELETE teardown Azure RG) |
| GET | /api/projects/[name]/health | ✅ Implemented (polls FQDN, sets Telegram webhook) |
| GET | /api/health | ✅ Implemented (clean, no errors) |

### control-plane Pending Wiring
- [ ] POST /api/projects: Azure provisioning (create RG, Container App, MI, RBAC)
- [ ] POST /api/projects: GitHub API calls (add secrets to repo)
- [ ] POST /api/projects: Telegram Bot API (set webhook)
- [ ] Auth: bcrypt password check, httpOnly session cookie, rate limiting
- [ ] README with setup instructions

## Pending Work
1. **Toolsets**: Cannot pre-enable toolsets in Dockerfile (requires TTY). User must run `/tools` in Telegram chat after connecting.
2. **Skills**: Cannot pre-install skills in Dockerfile (requires interactive TTY). User must run `/skills install <name>` in Telegram chat.
3. **GitHub Actions CI/CD**: Not yet functional — needs service principal created via Azure Portal.
4. **Multi-agent**: Additional Container Apps (one per business idea) not yet deployed.
5. **Control plane wiring**: Azure provisioning, GitHub API, Telegram webhook all need implementing in POST /api/projects.
6. **Control plane auth**: Login form exists but no password check is wired.
