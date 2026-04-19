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
- **Telegram bot token**: 8555328062:***
- **Identity**: System-assigned managed identity ENABLED (principalId: e2c4176a-2e38-4099-a3e7-4530876c1321)
- **RBAC**: Contributor on hermes-agent-rg granted ✓
- **MiniMax**: Working as primary (base_url: /anthropic — FIXED)
- **OpenRouter**: Working as fallback
- **Home channel**: Configured
- **Docs pushed to GitHub**: Yes (AS-BUILT.md, ARCHITECTURE.md)

### hermes-control-plane (control-plane-env)
- **Status**: Deployed (image: control-plane:v6)
- **Region**: Southeast Asia
- **Container App**: hermes-control-plane
- **ACR image**: hermesagentacr.azurecr.io/control-plane:v6
- **Repo**: github.com/foodiepig-svg/hermes-control-plane
- **URL**: https://control-plane.thankfulhill-a8e49df7.southeastasia.azurecontainerapps.io
- **Stack**: Next.js 16 + Prisma 5 + SQLite
- **Auth**: NOT YET WIRED — login form exists but no password check
- **DB**: SQLite file at /app/control-plane.db (provisioning state persisted)

### Pending: GitHub PATs
- hermes-agent needs GitHub PAT so it can push to hermes-agent-azure repo
- PAT should be scoped to hermes-agent-azure repo only
- hermes-control-plane also needs GITHUB_PAT for GitHub API calls (add secrets to repos)

## Ultimate Goal (2026-04-19)
**Build a self-service control plane so that creating a new Hermes project/bot on Azure is: fork a template, push, and it's live — no manual Azure CLI work per project.**

### Core Architecture
- Each project has one Hermes profile = one Telegram bot = one Container App
- Each bot constrained to one RG (resource group) and one GitHub repo
- Isolation is the primary constraint — no cross-project contamination
- Trade-off: bots can't learn from each other (acceptable for now)

### Control Plane (THE GOAL)
- **Option B selected**: Control plane web app — single management UI to create, manage, and monitor all Hermes projects/bots/profiles from one place
- Shows all projects, their status, resource usage, bot health
- "Create new project" → app calls Azure APIs + creates Telegram bot via BotFather + sets up repo
- One app to rule them all — self-service project creation without manual CLI work

### Control Plane Development Status (2026-04-19)

#### Completed
- [x] Project scaffold (Next.js 16 + Tailwind v4 + TypeScript)
- [x] Database schema + Prisma 5 + SQLite
- [x] AES-256-GCM encryption for telegram tokens
- [x] API routes: GET/POST /api/projects, GET/DELETE /api/projects/[name], GET /api/projects/[name]/health, GET /api/health
- [x] UI components: StatusBadge, ProjectTable, CreateProjectModal, ConfirmDeleteModal
- [x] shadcn/ui v5 (Base UI) — dark theme, dialog, table, badge, select, dropdown-menu, sonner
- [x] Production build passes clean
- [x] Deployed to Azure Container Apps (control-plane-env, image v6)

#### In Progress
- [ ] Wire up Azure provisioning in POST /api/projects (create RG, Container App, MI, RBAC via Azure SDK)
- [ ] Wire up GitHub API calls (add secrets to repo) in POST /api/projects
- [ ] Wire up Telegram Bot API (set webhook) in POST /api/projects
- [ ] Wire up DELETE /api/projects/[name] (delete RG and all Azure resources)

#### Pending
- [ ] Add secure login (bcrypt password check, httpOnly session cookie, rate limiting)
- [ ] Write README with setup instructions

### Future Projects
Each new project is created via the control plane web app:
1. Open control plane → "Create new project"
2. Enter project name, Telegram bot token (from BotFather), GitHub repo URL
3. App creates RG, Container App, Managed Identity, sets up GitHub Actions
4. Bot is live — no manual CLI work

Planned:
- care-exchange: profile on Mac ~/.hermes/profiles/care-exchange/ → needs push to GitHub from Mac first
- business-hub: profile at ~/projects/business-hub/project-files/care-exchange/agents/

## Resolved Issues
1. MiniMax 401: base_url was /v1, changed to /anthropic (Hermes sends Bearer vs x-api-key)
2. OpenRouter 400: model was "OpenRouter", needs real model ID like openai/gpt-4o-mini
3. Image rebuild hangs: ACR infrastructure issue — v20+ succeeded
4. Control plane health check timeout: Polling loop added to wait for FQDN before health check
