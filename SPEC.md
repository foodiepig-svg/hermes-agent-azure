# Hermes Control Plane — SPEC.md

## 1. Concept & Vision

A single web dashboard that lets you create, manage, and monitor all Hermes projects from one place. Instead of manually running Azure CLI commands and juggling Telegram bots per project, you fill in a form and the control plane provisions everything — resource group, Container App, managed identity, GitHub Actions, Telegram bot — automatically. It is the self-service portal for the multi-bot architecture.

## 2. Design Language

**Aesthetic:** Clean, dark, developer-tooling — similar to Vercel or Railway dashboards. Dark background, crisp typography, status indicators that are easy to scan.

**Color Palette:**
- Background: `#0d1117` (GitHub dark)
- Surface/Cards: `#161b22`
- Border: `#30363d`
- Primary accent: `#58a6ff` (blue links/actions)
- Success: `#3fb950`
- Warning: `#d29922`
- Error: `#f85149`
- Text primary: `#e6edf3`
- Text muted: `#8b949e`

**Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). Monospace for tokens, IDs, and technical values.

**Spatial System:** 8px base unit. Cards have 16px padding. Sections separated by 24px. Compact tables for data-dense views.

**Motion:** Minimal — 150ms transitions on hover states, no gratuitous animation. Status badges pulse if a bot is unhealthy.

**Icons:** Lucide icons (lightweight, consistent stroke width).

## 3. Layout & Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header: "Hermes Control Plane"     [+ New Project]    │
├─────────────────────────────────────────────────────────┤
│  Summary bar: Total bots | Healthy | Unhealthy | Regions│
├─────────────────────────────────────────────────────────┤
│  Project List (table)                                   │
│  Name | Status | Region | Bot Token | Created | Actions │
│  ─────────────────────────────────────────────────────  │
│  hermes-agent | ● Healthy | SEA | *** | 2026-04-10 | ⋮  │
│  care-exchange| ● Healthy | SEA | *** | 2026-04-15 | ⋮  │
└─────────────────────────────────────────────────────────┘
```

**New Project Modal (slide-over or centered modal):**
- Project name (validated: lowercase, no spaces)
- Telegram bot token (from BotFather)
- GitHub repo URL (where the profile lives)
- Azure region (dropdown: SEA, AUS East, US East)
- Submit → shows progress steps as resources are created

**Project Detail View (on row click or expand):**
- Resource group link → Azure Portal
- Container App FQDN → opens live bot
- GitHub repo → opens repo
- GitHub Actions → shows last deployment status
- Health: uptime, last response time, error rate
- Danger zone: Delete project (with confirmation)

**Responsive:** Desktop-first (this is a developer tool). Mobile shows a simplified list view.

## 4. Features & Interactions

### Dashboard
- **Project list table:** sortable by name, status, region, created date
- **Status badge:** green pulse if healthy, red if unreachable, yellow if degraded
- **Quick actions per row:** View details, Copy bot URL, Delete
- **Bulk actions:** None for now
- **Auth gate:** Unauthenticated users see a login page; only authenticated users access the dashboard

### Login Page
- Single-field login: enter the control plane access token
- Token stored in `CONTROL_PLANE_TOKEN` environment variable (hashed with bcrypt in DB or env comparison)
- On success: session cookie set (httpOnly, secure, sameSite=lax)
- Failed attempts: rate-limited (5 attempts per 15 min per IP)
- No registration — token is pre-set via environment variable (single-user tool)

### Create New Project
- **Form fields:** project name, Telegram token, GitHub repo URL, Azure region
- **Validation:** project name uniqueness (check against existing RGs), GitHub repo exists (GET to repo URL), Telegram token format
- **On submit:** calls Azure APIs to create RG → Container App → Managed Identity → RBAC; calls GitHub API to add secrets to repo; calls Telegram API to set webhook
- **Progress UI:** step-by-step checklist — "Creating resource group...", "Deploying Container App...", "Configuring GitHub Actions...", "Connecting Telegram bot..."
- **On success:** redirect to project detail view with success toast
- **On failure:** show which step failed, link to retry, log error details

### Project Detail
- **Resource links:** open Azure Portal, GitHub repo, GitHub Actions, Telegram bot in new tabs
- **Health metrics:** current status (healthy/unhealthy/degraded), last 24h uptime %, avg response time
- **Danger zone:** Delete project — requires typing project name to confirm, deletes RG and all resources

### Delete Project
- Confirmation modal: "Type the project name to delete"
- Deletes: Container App, resource group, role assignment, GitHub secrets (optional: archive repo)
- Shows: "Deleting..." with step progress, then success message

## 5. Component Inventory

### StatusBadge
- States: healthy (green + pulse), unhealthy (red), degraded (yellow), unknown (grey)
- Tooltip on hover: "Responded in 120ms" or "No response in 10 min"

### ProjectCard (table row)
- Default: project name (bold), status badge, region tag, created date, action menu
- Hover: subtle background highlight, action menu visible
- Selected/expanded: shows inline detail section

### CreateProjectModal
- Form with labeled inputs, inline validation errors below each field
- Submit button: disabled until all fields valid, shows spinner on submit
- Progress state: replaces form with step-by-step checklist
- Error state: red banner at top with retry button

### ConfirmDeleteModal
- Warning icon, bold red "This will permanently delete..." text
- Text input requiring exact project name match
- Delete button: disabled until match confirmed, red and destructive styling

### ResourceLink
- Small button/link with external icon, opens URL in new tab
- States: default, hover (underline), disabled (greyed out if resource missing)

## 6. Technical Approach

### Stack
- **Frontend:** Next.js (App Router), Tailwind CSS, Lucide icons
- **Backend:** Next.js API routes (serverless functions)
- **Database:** SQLite via Prisma (local file, suitable for single-instance control plane)
- **State management:** React Query for server state, Zustand for UI state
- **Deployment:** Single Container App on Azure, same pattern as hermes-agent

### Data Model

```prisma
model Project {
  id            String   @id @default(cuid())
  name          String   @unique  // lowercase, no spaces — used as Azure RG name
  telegramToken String   // encrypted at rest
  githubRepoUrl String
  azureRegion   String   @default("southeastasia")
  containerAppFqdn String?
  status        String   @default("provisioning")  // provisioning|healthy|unhealthy|degraded
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project (triggers provisioning) |
| GET | `/api/projects/[name]` | Get project details |
| DELETE | `/api/projects/[name]` | Delete project and all Azure resources |
| GET | `/api/projects/[name]/health` | Get health status for a project |

### Provisioning Flow (POST /api/projects)

1. Validate inputs (name uniqueness, repo exists, token format)
2. Encrypt Telegram token before storing (use AES-256 with env key)
3. Insert Project record to DB (status: "provisioning")
4. Call Azure Resource Manager:
   - Create resource group: `<name>-rg`
   - Create managed identity
   - Assign Contributor RBAC to RG
   - Create Container App (with placeholder image initially)
   - Create Container App environment
5. Call GitHub API:
   - Add `TELEGRAM_BOT_TOKEN` secret to repo
   - Add `AZURE_CREDENTIALS` secret (SP creds with RG scope) to repo
   - (Optional) Enable GitHub Actions if not already
6. Call Telegram Bot API:
   - Set webhook to `<container-app-fqdn>/telegram/webhook`
7. Update DB record with containerAppFqdn, set status to "healthy"
8. Return project object

### Health Check Flow (GET /api/projects/[name]/health)

1. Fetch Container App ingress URL
2. GET `<fqdn>/health` with 5s timeout
3. Return: `{ status: "healthy"|"unhealthy"|"degraded", responseTimeMs, checkedAt }`

### Security Considerations

- Telegram tokens encrypted at rest (AES-256-GCM, key in env var)
- No project data logged to stdout/cloudwatch
- RBAC scope: control plane's SP has `Contributor` at subscription level (or scoped to a management RG) — it creates RGs and assigns RBAC within them
- Each project bot's managed identity has minimum permissions (Contributor on its own RG only)
- GitHub PAT stored as encrypted secret in the control plane's DB (for GitHub API calls), not in code

### Error Handling

- Provisioning failures: roll back any created resources, mark project as "failed", store error message in DB
- Health check failures: mark as "unhealthy" after 3 consecutive failures, "degraded" after 1
- API errors: return structured JSON `{ error: string, code: string, details?: any }` with appropriate HTTP status

### Environment Variables

```
DATABASE_URL=file:./control-plane.db
ENCRYPTION_KEY=<32-byte hex key for AES-256-GCM>
AZURE_SUBSCRIPTION_ID=<target subscription>
AZURE_TENANT_ID=<Azure AD tenant>
AZURE_CLIENT_ID=<SP app ID>
AZURE_CLIENT_SECRET=<SP secret>
GITHUB_PAT=<personal access token with repo scope>
```

## 7. Out of Scope (for v1) — NOW PLANNED

~~- User authentication / teams (single-user owner for now)~~ — **Now in scope: single-user password/token login**
- Monitoring charts / graphs (just status indicators)
- Project editing (only create + delete)
- Profile content management (profile repo is managed separately)
- Automated profile sync from GitHub to running bot (GitHub Actions handles this)
- Multi-cloud support (Azure only)

## 8. Development Status

### Completed
- [x] Project scaffold (Next.js 16 + Tailwind v4 + TypeScript)
- [x] Database schema + Prisma 5 + SQLite
- [x] AES-256-GCM encryption for telegram tokens
- [x] API routes: GET/POST /api/projects, GET/DELETE /api/projects/[name], GET /api/projects/[name]/health, GET /api/health
- [x] UI components: StatusBadge, ProjectTable, CreateProjectModal, ConfirmDeleteModal
- [x] shadcn/ui v5 (Base UI) — dark theme, dialog, table, badge, select, dropdown-menu, sonner
- [x] Production build passes clean
- [x] Deployed to Azure Container Apps (control-plane-env, image v6)
- [x] DELETE /api/projects/[name] teardown wired (deletes RG and all Azure resources)
- [x] Health endpoint polls for FQDN before checking, sets Telegram webhook
- [x] GET /api/health returns clean response (no errors)

### In Progress
- [ ] Wire up Azure provisioning in POST /api/projects (create RG, Container App, MI, RBAC via Azure SDK)
- [ ] Wire up GitHub API calls in POST /api/projects (add secrets to repo)
- [ ] Wire up Telegram Bot API in POST /api/projects (set webhook)

### Pending
- [ ] Add secure login (bcrypt password check, httpOnly session cookie, rate limiting)
- [ ] README with setup instructions

### Known Issues
- shadcn/ui v5 uses Base UI (not Radix) — `asChild` replaced with `render` prop, Select value is nullable
- Control plane runs as single instance (SQLite file-based — not for production multi-user)
- Docker daemon on Cloud Shell is unreliable — use `az acr build` for remote Docker builds
