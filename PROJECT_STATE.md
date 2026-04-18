# Hermes Agent Azure — Project State
## Last updated: 2026-04-19

## Architecture Decision (2026-04-19)
- One profile = one bot = one project = one Container App
- Each container: managed identity (RBAC scoped to its RG only) + GitHub PAT (scoped to its repo only)
- Cross-project contamination is the PRIMARY risk to prevent

## Current State

### hermes-agent (hermes-agent-rg)
- **Status**: Fully operational (rev 0000035, v24 image)
- **Region**: Southeast Asia
- **Container App**: hermes-agent
- **ACR**: hermesagentacr.azurecr.io
- **FQDN**: hermes-agent.orangehill-e65ae777.southeastasia.azurecontainerapps.io
- **Telegram bot token**: 8555328062:AAEu-U2vsHMQKt8SQEAA2BFvK0Kre1tIa9g
- **Identity**: System-assigned managed identity ENABLED (principalId: e2c4176a-2e38-4099-a3e7-4530876c1321)
- **RBAC**: Contributor on hermes-agent-rg granted ✓
- **MiniMax**: Working as primary (base_url: /anthropic — FIXED)
- **OpenRouter**: Working as fallback
- **Home channel**: Configured
- **Docs pushed to GitHub**: Yes (AS-BUILT.md, ARCHITECTURE.md)

### Pending: GitHub PAT
- Need to add GitHub PAT as secret so hermes-agent can push to GitHub
- PAT should be scoped to hermes-agent-azure repo only

## Ultimate Goal (2026-04-19)
**Build a template + IaC system so that creating a new Hermes project/bot/profile on Azure is self-service: fork a template, push, and it's live — no manual Azure CLI work per project.**

### Core Architecture
- Each project has one Hermes profile = one Telegram bot = one Container App
- Each bot constrained to one RG (resource group) and one GitHub repo
- Isolation is the primary constraint — no cross-project contamination
- Trade-off: bots can't learn from each other (acceptable for now)

### Profile Lifecycle Management (THE GOAL)
- **Option B: Control plane web app** — a single management UI to create, manage, and monitor all Hermes projects/bots/profiles from one place
- Shows all projects, their status, resource usage, bot health
- "Create new project" → app calls Azure APIs + creates Telegram bot via BotFather + sets up repo
- One app to rule them all — self-service project creation without manual CLI work

### Care Exchange Migration (first use case)
- Profile on Mac → push to GitHub
- Fork template → create care-exchange deployment
- Validates the template library works end-to-end

### Future Projects
Each new project is created via the control plane web app:
1. Open control plane → "Create new project"
2. Enter project name, Telegram bot token (from BotFather), GitHub repo URL
3. App creates RG, Container App, Managed Identity, sets up GitHub Actions
4. Bot is live — no manual CLI work

Planned:
- care-exchange: profile on Mac ~/.hermes/profiles/care-exchange/ → needs push to GitHub
- business-hub: profile at ~/projects/business-hub/project-files/care-exchange/agents/

## Resolved Issues
1. MiniMax 401: base_url was /v1, changed to /anthropic (Hermes sends Bearer vs x-api-key)
2. OpenRouter 400: model was "OpenRouter", needs real model ID like openai/gpt-4o-mini
3. Image rebuild hangs: ACR infrastructure issue — v20+ succeeded
