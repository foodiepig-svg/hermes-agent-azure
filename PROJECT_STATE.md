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

## Future Projects (per this architecture)
Each project needs:
1. Resource group: <project>-rg
2. Container App: <project>-agent
3. Managed identity (RBAC scoped to <project>-rg only)
4. GitHub PAT (scoped to <project>-repo only)
5. Profile repo on GitHub

Planned:
- care-exchange: profile on Mac ~/.hermes/profiles/care-exchange/ → needs push to GitHub
- business-hub: profile at ~/projects/business-hub/project-files/care-exchange/agents/

## Resolved Issues
1. MiniMax 401: base_url was /v1, changed to /anthropic (Hermes sends Bearer vs x-api-key)
2. OpenRouter 400: model was "OpenRouter", needs real model ID like openai/gpt-4o-mini
3. Image rebuild hangs: ACR infrastructure issue — v20+ succeeded
