# Hermes Agent Azure — As Built

## Purpose
Deploy NousResearch Hermes Agent on Azure Container Apps with Telegram integration for personal use.

## Decisions & Rationale

### Container Apps over VMs
Azure subscription (91bd0fcb-95b8-4a45-b69e-f9556190dd29) has no VM capacity in any region — all Standard_D* and B* SKUs return `SkuNotAvailable`. Container Apps (Consumption mode) was the only viable compute option.

### ACR Build over local Docker push
Docker daemon on macOS hangs on large image pushes. Used `az acr build` instead — builds and pushes in Azure, bypasses local daemon entirely.

### Image rebuilds causing startup hangs (UNRESOLVED)
New image builds (v16, v17, v18) consistently fail the health check with TCP timeout, despite identical Dockerfiles to v14 which works. Workaround: use v14 image with env vars added via `az containerapp update --set-env-vars`. Root cause not identified — Azure ACR may be producing non-functional images for this project.

### Hermes installed via official installer
Used the official `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup` instead of pip install. This installs Node.js, Playwright, and all TUI/browser dependencies.

## Deployment Log

| Date | Image | Rev | Notes |
|------|-------|-----|-------|
| 2026-04-17 | v6-v9 | various | Failed — ImportError in gateway |
| 2026-04-17 | v10 | 0000017 | First working image, ImportError fixed |
| 2026-04-18 | v12 | 0000021 | Added pairing/.hermes structure to Dockerfile |
| 2026-04-18 | v14 | 0000025 | Current working image (used for rev 0000030 via env-var update) |
| 2026-04-18 | v15 | 0000026 | Failed — heremes tools enable in Dockerfile hung at startup |
| 2026-04-18 | v16-v18 | 0000027-0000029 | Timeout on health check — ACR build issue, cause unknown |
| 2026-04-18 | v14 + keys | 0000030 | Working — v14 image with GROQ_API_KEY + OPENROUTER_API_KEY added via az containerapp update |

## Current Status (2026-04-18)

### Fully Operational
- Container App running rev 0000030 (v14 image + new env vars) ✅
- Telegram bot responding ✅
- Sunjay Soma (222335742) authenticated via `TELEGRAM_ALLOWED_USERS=222335742` ✅
- MiniMax API key valid ✅
- Groq API key loaded (`GROQ_API_KEY` env var) ✅
- OpenRouter API key loaded (`OPENROUTER_API_KEY` env var) ✅
- Hermes Agent accessible at: https://hermes-agent.orangehill-e65ae777.southeastasia.azurecontainerapps.io ✅

### Active Revisions
- `hermes-agent--0000025` (v14, no extra keys) — inactive
- `hermes-agent--0000030` (v14 + Groq + OpenRouter, 100% traffic) — ACTIVE

## LLM Providers Configured

| Provider | Env Var | Status |
|----------|---------|--------|
| MiniMax M2.7 | `MINIMAX_API_KEY` | Primary ✅ |
| Groq (free tier) | `GROQ_API_KEY` | Loaded ✅ |
| OpenRouter (free tier) | `OPENROUTER_API_KEY` | Loaded ✅ |

### Free Models Available
- **Groq**: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`
- **OpenRouter**: `google/gemini-2.0-flash-thinking`, `deepseek/deepseek-chat-v3-0324`, `meta-llama/llama-4-Maverick`

Switch model mid-conversation: `/model <model-name>`

## Secrets in Key Vault

| Secret | Name in Key Vault |
|--------|------------------|
| MiniMax API key | `minimax-api-key` |
| Telegram bot token | `telegram-bot-token` |
| Groq API key | `groq-api-key` |
| OpenRouter API key | `openrouter-api-key` |

## Resolved Issues
- **MiniMax 401**: Was wrong endpoint — MiniMax uses `/anthropic/v1/messages`
- **Telegram pairing code**: Fixed by adding `TELEGRAM_ALLOWED_USERS=222335742` env var
- **Image rebuild hangs**: Workaround — use v14 image + env-var updates instead of rebuilding

## Pending Work
1. **Toolsets**: Cannot pre-enable toolsets in Dockerfile (requires TTY). User must run `/tools` in Telegram chat after connecting.
2. **Skills**: Cannot pre-install skills in Dockerfile (requires interactive TTY). User must run `/skills install <name>` in Telegram chat.
3. **Image rebuild issue**: v16-v18 timeout on health check — Azure ACR may have a build problem for this project. Using v14 + env-var workaround for now.
4. **GitHub Actions CI/CD**: Not yet functional — needs service principal created via Azure Portal.
5. **Multi-agent**: Additional Container Apps (one per business idea) not yet deployed.
