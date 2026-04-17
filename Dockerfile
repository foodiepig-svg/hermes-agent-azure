FROM python:3.11-slim

WORKDIR /app

# Install curl and git for Hermes install script
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Hermes Agent
RUN curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# Copy config
COPY config.yaml /app/config.yaml
COPY .env /app/.env

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run Hermes gateway
CMD ["hermes", "gateway", "run", "--config", "/app/config.yaml", "--env", "/app/.env"]
