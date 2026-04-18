# Hermes Agent Azure — As Built

## Purpose
Deploy NousResearch Hermes Agent on Azure Container Apps with Telegram integration for personal use.

## Decisions & Rationale

### Container Apps over VMs
Azure subscription (91bd0fcb-95b8-4a45-b69e-f9556190dd29) has no VM capacity in any region — all Standard_D* and B* SKUs return `SkuNotAvailable`. Container Apps (Consumption mode) was the only viable compute option.

### ACR Build over local Docker push
Docker daemon on macOS hangs on large image pushes. Used `az acr build` instead — builds and pushes in Azure, bypasses local daemon entirely. Build ID cmh produced v12 successfully.

### Pre-approved pairing data in image
Instead of running pairing flow, Telegram approved user list (Sunjay Soma, ID 222335742) is baked into the Docker image at `/app/.hermes/pairing/`. This means new deployments don't need re-pairing.

### Hermes installed via official installer
Used the official `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup` instead of pip install. This installs Node.js, Playwright, and all TUI/browser dependencies.

## Deployment Log

| Date | Image | Rev | Notes |
|------|-------|-----|-------|
| 2026-04-17 | v6-v9 | various | Failed — ImportError in gateway |
| 2026-04-17 | v10 | 0000017 | First working image, ImportError fixed |
| 2026-04-18 | v12 | 0000021 | Added pairing/.hermes structure to Dockerfile, currently deployed |

## Current Status (2026-04-18)

### Fully Operational ✅
- Container App running rev 0000025 (v14 image) ✅
- Telegram bot responding ✅
- Sunjay Soma (222335742) authenticated via `TELEGRAM_ALLOWED_USERS=222335742` ✅
- MiniMax API key valid ✅
- Hermes Agent accessible at: https://hermes-agent.orangehill-e65ae777.southeastasia.azurecontainerapps.io ✅

### How Pairing Works
Hermes supports two approaches:
1. **Pre-approved users via env var**: `TELEGRAM_ALLOWED_USERS=222335742` (used now — simpler)
2. **Pre-baked pairing files**: Copy `~/.hermes/pairing/` into image at build time (less reliable — Hermes binary runs as root, reads from `/root/.hermes/` not `HERMES_HOME`)

### Resolved Issues
- **MiniMax 401**: Was wrong endpoint (`/v1/messages` instead of `/anthropic/v1/messages`)
- **Telegram pairing code**: Fixed by adding `TELEGRAM_ALLOWED_USERS=222335742` env var to Container App
- **Pairing files in wrong location**: Earlier attempts to bake pairing data to `/app/.hermes/` failed because Hermes reads from `/root/.hermes/`

## Next Steps

Since all core functionality is working, main priorities are:
1. **GitHub Actions CI/CD**: Set up automated build+deploy on push to main (repo: `foodiepig-svg/hermes-agent-azure`)
2. **Monitoring**: Set up alerting or health check that actually works
3. **Periodic pairing cleanup**: Clean up old revisions (rev 0000017-0000020 are inactive but stored)

## GitHub Actions CI/CD

GitHub repo: `foodiepig-svg/hermes-agent-azure`

Push to `main` should trigger `az acr build` + `az containerapp update`. Not yet tested.
