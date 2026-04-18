# Hermes Agent Azure — Architecture

## Overview
Self-hosted AI agent (NousResearch Hermes) deployed on Azure Container Apps, connected to Telegram.

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
- **Active Revision**: hermes-agent--0000021 (v12 image) ← 100% traffic
- **Target Port**: 8000 (HTTP)
- **Traffic**: 100% routed to rev 0000018

## Image & Deployment

### ACR Image
- **Image**: `hermesagentacr.azurecr.io/hermes-agent:<tag>`
- **Tags in registry**: v6, v7, v8, v10, **v12** (latest)
- **Build**: `az acr build` from local Dockerfile (python:3.11-slim base)

### Dockerfile Steps
1. `python:3.11-slim` base
2. Install curl, git, xz-utils
3. Install Hermes Agent via official installer script (--skip-setup)
4. `pip install pyyaml python-dotenv`
5. Copy config.yaml, .env to /app
6. Copy pairing/.hermes/ → /app/.hermes (pre-approved Telegram users)
7. Expose port 8000
8. CMD: `/root/.local/bin/hermes gateway run`

### Environment Variables (in Container App)
| Variable | Source |
|----------|--------|
| MINIMAX_API_KEY | Key Vault secret (referenced as secret) |
| TELEGRAM_BOT_TOKEN | Key Vault secret (referenced as secret) |
| TELEGRAM_WEBHOOK_URL | Set via container app env |
| TELEGRAM_WEBHOOK_PORT | Set via container app env (8000) |
| TELEGRAM_WEBHOOK_SECRET | Set via container app env |
| TELEGRAM_ALLOWED_USERS | Set via container app env (222335742) |

### Container App Config
- **CPU**: 0.5 cores
- **Memory**: 1Gi
- **Ephemeral Storage**: 2Gi
- **Scale**: 0-1 replicas (Consumption mode)
- **Ingress**: External, HTTP on port 8000
- **Health Check**: TCP socket on port 8000, 10s delay, 3 retries
- **Active Revisions Mode**: Multiple

## Configuration

### config.yaml (/app/config.yaml)
```yaml
model:
  default: MiniMax-M2.7
  provider: minimax
  base_url: https://api.minimax.io/v1
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

### Pairing Data (/app/.hermes/pairing/)
Pre-approved Telegram users copied into container at build time:
- `telegram-approved.json`: Contains approved user IDs
- `telegram-pending.json`: Empty
- `_rate_limits.json`: Rate limit config

### Approved Telegram Users
| User ID | Name | Approved At |
|---------|------|-------------|
| 222335742 | Sunjay Soma | 1746483806 (Unix timestamp) |

## Known Issues

All resolved as of 2026-04-18:
1. ~~MiniMax API key returns 401~~ — Key is valid; MiniMax uses `/anthropic/v1/messages` endpoint
2. ~~Health check returns 504/timeout~~ — Rev 0000018 is healthy and responding
3. ~~Telegram webhook not receiving~~ — Webhook is operational

Minor note: Container Apps exec/logs commands still timeout in Azure CLI (Azure-side limitation, not actionable).

## Project Structure
```
hermes-agent-azure/
├── Dockerfile
├── config.yaml
├── .env                    # Local only — NOT committed
├── startup-debug.sh        # Debug entrypoint (writes to /tmp/startup.log)
├── pairing/
│   └── .hermes/
│       └── pairing/
│           ├── telegram-approved.json
│           ├── telegram-pending.json
│           └── _rate_limits.json
└── .github/
    └── workflows/          # GitHub Actions CI/CD (if configured)
```

## Secrets Reference

| Secret Name | Key Vault | Used By |
|-------------|-----------|---------|
| minimax-api-key | hermes-keyvault | Container App env |
| telegram-bot-token | hermes-keyvault | Container App env |

## Telegram Setup

- **Bot Token**: `855532...Ia9g` (partial — stored in Key Vault)
- **Mode**: Webhook (receiving messages via webhook, not polling)
- **Pairing**: Sunjay Soma (ID: 222335742) is pre-approved in pairing data
