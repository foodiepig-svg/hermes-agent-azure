# Hermes Agent Azure — Architecture

## Overview
Self-hosted AI agent (NousResearch Hermes) deployed on Azure Container Apps, connected to Telegram. Supports multiple LLM providers (MiniMax, Groq, OpenRouter) with free tier models. This is the first isolated tenant deployed under the Care Exchange multi-project architecture.

## Infrastructure

```
Internet → Azure Container Apps → hermes-agent container (port 8000)
                              ↓
                    Azure Key Vault (secrets)
                    hermesagentacr.azurecr.io (images)
```

### Azure Resources
| Resource | Name | Region |
|----------|------|--------|
| Container Apps Environment | hermes-env | Southeast Asia |
| Container App | hermes-agent | Southeast Asia |
| Container Registry | hermesagentacr | Southeast Asia |
| Key Vault | hermes-keyvault | Southeast Asia |

### Container App Endpoints
- **App URL**: https://hermes-agent.orangehill-e65ae777.southeastasia.azurecontainerapps.io
- **Active Revision**: hermes-agent--0000035 (v24 image) — 100% traffic
- **Target Port**: 8000 (HTTP)
- **Traffic**: 100% routed to rev 0000035

## Image & Deployment

### ACR Image
- **Image**: `hermesagentacr.azurecr.io/hermes-agent:<tag>`
- **Tags in registry**: v6 through v24 (use `az acr repository show-tags --order time_desc` to list)
- **Active deployed image**: v24
- **Build**: `az acr build` from local Dockerfile (python:3.11-slim base)

### Dockerfile Steps
1. `python:3.11-slim` base
2. Install curl, git, xz-utils
3. Install Hermes Agent via official installer script (--skip-setup)
4. `pip install pyyaml python-dotenv`
5. Copy config.yaml, .env to /app
6. Copy pairing/.hermes/ → /app/.hermes and /root/.hermes (pre-approved Telegram users)
7. Expose port 8000
8. CMD: `/root/.local/bin/hermes gateway run`

### Environment Variables (in Container App)
| Variable | Source | Status |
|----------|--------|--------|
| MINIMAX_API_KEY | Key Vault secret (referenced) | ✅ |
| TELEGRAM_BOT_TOKEN | Key Vault secret (referenced) | ✅ |
| TELEGRAM_WEBHOOK_URL | Set via container app env | ✅ |
| TELEGRAM_WEBHOOK_PORT | Set via container app env (8000) | ✅ |
| TELEGRAM_WEBHOOK_SECRET | Set via container app env | ✅ |
| TELEGRAM_ALLOWED_USERS | Set via container app env (222335742) | ✅ |
| OPENROUTER_API_KEY | Key Vault secret (referenced) | ✅ |
| GROQ_API_KEY | Key Vault secret (referenced) | ✅ |
| DEEPSEEK_API_KEY | Set via container app env (empty) | — |

### Container App Config
- **CPU**: 0.5 cores
- **Memory**: 1Gi
- **Ephemeral Storage**: 2Gi
- **Scale**: 0-1 replicas (Consumption mode)
- **Ingress**: External, HTTP on port 8000
- **Health Check**: TCP socket on port 8000, 10s delay, 3 retries
- **Active Revisions Mode**: Multiple

## LLM Providers

### Configured Providers
| Provider | Free Tier Models | API Key |
|----------|-----------------|---------|
| MiniMax M2.7 (default) | N/A (paid) | `MINIMAX_API_KEY` |
| OpenRouter (fallback) | google/gemini-2.0-flash-thinking, deepseek/deepseek-chat-v3-0324, meta-llama/llama-4-Maverick | `OPENROUTER_API_KEY` |
| Groq | llama-3.3-70b-versatile, mixtral-8x7b-32768 | `GROQ_API_KEY` |

Switch model: `/model <name>` inside Telegram chat.

### Provider Configuration (config.yaml)
```yaml
model:
  default: MiniMax-M2.7
  provider: minimax
  base_url: https://api.minimax.io/anthropic
  api_key: ${MINIMAX_API_KEY}
  context_length: 100000
```

**Critical**: MiniMax requires `base_url: https://api.minimax.io/anthropic` — NOT `/v1`. Hermes uses the base_url to determine auth method:
- `/anthropic` → sends `Authorization: Bearer` header (correct for MiniMax)
- `/v1` → sends `x-api-key` header (MiniMax rejects with 401)

## Configuration

### config.yaml (/app/config.yaml)
```yaml
model:
  default: MiniMax-M2.7
  provider: minimax
  base_url: https://api.minimax.io/anthropic
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

### .env (/app/.env)
```
MINIMAX_API_KEY=${MINI...KEY}
TELEGRAM_BOT_TOKEN=${TELE...KEN}
OPENROUTER_API_KEY=${OPEN...KEY}
GROQ_API_KEY=***
DEEPSEEK_API_KEY=***
Note: `.env` uses `${VAR}` substitution so Container Apps env vars override at runtime.

### Pairing Data (/app/.hermes/pairing/)
Pre-approved Telegram users copied into container at build time:
- `telegram-approved.json`: Contains approved user IDs
- `telegram-pending.json`: Empty
- `_rate_limits.json`: Rate limit config

### Approved Telegram Users
| User ID | Name | Approved At |
|---------|------|-------------|
| 222335742 | Sunjay Soma | 1746483806 (Unix timestamp) |

## Toolsets & Skills

### Toolsets
Toolsets are NOT pre-enabled in the container. To enable:
1. Message the Telegram bot
2. Send `/tools` to open the interactive tool manager
3. Enable desired toolsets (web, browser, terminal, file, etc.)

### Skills
Skills are NOT pre-installed in the container. To install:
1. Message the Telegram bot
2. Send `/skills browse` to see available skills
3. Send `/skills install <skill-name>` to install

## Known Issues

1. ~~Image rebuilds timeout on health check~~ — RESOLVED: v20+ builds succeeded
2. ~~MiniMax API key returns 401~~ — RESOLVED: correct base_url is `/anthropic` not `/v1`
3. ~~OpenRouter 400 "not a valid model ID"~~ — RESOLVED: use real model ID like `openai/gpt-4o-mini`
4. ~~Health check returns 504/timeout~~ — Resolved in current deployment

## Project Structure
```
hermes-agent-azure/
├── Dockerfile
├── config.yaml
├── .env                    # Uses ${VAR} for Container Apps env var substitution
├── pairing/
│   └── .hermes/
│       └── pairing/
│           ├── telegram-approved.json
│           ├── telegram-pending.json
│           └── _rate_limits.json
├── ARCHITECTURE.md
├── AS-BUILT.md
└── .github/
    └── workflows/          # GitHub Actions CI/CD (not yet tested)
```

## Secrets Reference
| Secret Name | Key Vault | Used By |
|-------------|-----------|---------|
| minimax-api-key | hermes-keyvault | Container App env → MINIMAX_API_KEY |
| telegram-bot-token | hermes-keyvault | Container App env → TELEGRAM_BOT_TOKEN |
| groq-api-key | hermes-keyvault | Container App env → GROQ_API_KEY |
| openrouter-api-key | hermes-keyvault | Container App env → OPENROUTER_API_KEY |
| github-pat | hermes-keyvault | GitHub API access for provisioning |

## Telegram Setup
- **Bot Token**: `8555328062:***`
- **Mode**: Webhook (receiving messages via webhook, not polling)
- **Pairing**: Sunjay Soma (ID: 222335742) is pre-approved via `TELEGRAM_ALLOWED_USERS` env var
- **Home channel**: Configured ✅

## Provisioning New Projects

New tenant projects are provisioned using the `azure-tenant-project-provision` skill, not via a control-plane API. This skill-based approach replaces the abandoned hermes-control-plane.

See: `azure-tenant-project-provision` skill for the full provisioning workflow.

## ACR Auth Workaround
If `az acr login` times out, use:
```bash
az acr login -n hermesagentacr --expose-token
```
This returns a refresh token that can be exchanged for an access token for docker operations.
