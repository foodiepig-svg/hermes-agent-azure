FROM python:3.11-slim

WORKDIR /app

# Install base dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    xz-utils \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Azure CLI
RUN curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/repos/azure-cli $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/azure-cli.list \
    && apt-get update && apt-get install -y azure-cli \
    && rm -rf /var/lib/apt/lists/*

# Install Azure CLI for identity-based auth
RUN curl -sL https://aka.ms/InstallAzureCLILinux | bash

# Install Hermes Agent (skip interactive setup wizard)
RUN curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup

# Install system-wide deps for gateway modules (hermes uses uv venv, but gateway imports these as system pkgs)
RUN pip install pyyaml python-dotenv --break-system-packages

# Add hermes to PATH
ENV PATH="/root/.local/bin:/root/.hermes/node/bin:${PATH}"

# Set Hermes home to /app so it reads /app/.env and /app/config.yaml
ENV HERMES_HOME="/app"

# Allow pre-approved Telegram users by user ID (simpler than pairing files)
# Override at container run time or set via Container App env var
ENV TELEGRAM_ALLOWED_USERS="${TELEGRAM_ALLOWED_USERS:-222335742}"

# Add hermes-agent to PYTHONPATH so 'python -m gateway.run' can find it
ENV PYTHONPATH="/root/.hermes/hermes-agent:${PYTHONPATH}"

# Copy config — toolsets are enabled via config.yaml tools.enabled[]
COPY config.yaml /app/config.yaml
COPY .env /app/.env

# Copy pre-approved pairing data so the bot owner doesn't need manual approval
# Hermes binary runs as root and reads /root/.hermes/, not HERMES_HOME
# So copy to BOTH locations
COPY pairing/.hermes /app/.hermes
COPY pairing/.hermes /root/.hermes

EXPOSE 8000

# Run Hermes gateway
CMD ["/root/.local/bin/hermes", "gateway", "run"]
