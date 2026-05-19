#!/bin/bash
# DockOps VPS Deployment Script
# Target: 143.198.160.235
# Run as root on the VPS

set -euo pipefail

VPS_IP="143.198.160.235"
APP_DIR="/opt/dockops"
REPO_URL="https://github.com/vix-codes/DockOps.git"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Install prerequisites
install_deps() {
    log "Installing prerequisites..."
    apt-get update -q
    apt-get install -y git curl wget unzip nginx certbot python3-certbot-nginx

    # Docker
    if ! command -v docker &>/dev/null; then
        log "Installing Docker..."
        curl -fsSL https://get.docker.com | bash
        systemctl enable --now docker
    fi

    # Docker Compose plugin
    if ! docker compose version &>/dev/null; then
        log "Installing Docker Compose plugin..."
        mkdir -p /usr/local/lib/docker/cli-plugins
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
            -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    fi
}

# Clone or update repo
setup_repo() {
    log "Setting up repository..."
    mkdir -p "$APP_DIR"
    if [ -d "$APP_DIR/.git" ]; then
        cd "$APP_DIR" && git pull origin main
    else
        git clone "$REPO_URL" "$APP_DIR"
    fi
}

# Configure environment
setup_env() {
    log "Setting up environment..."
    if [ ! -f "$APP_DIR/.env" ]; then
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        # Generate secrets
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')
        WEBHOOK_SECRET=$(openssl rand -hex 32)

        sed -i "s/change-me-in-production/$DB_PASSWORD/g" "$APP_DIR/.env"
        sed -i "s/change-this-to-a-256-bit-random-secret-key-for-production-use/$JWT_SECRET/g" "$APP_DIR/.env"
        sed -i "s/change-this-webhook-secret/$WEBHOOK_SECRET/g" "$APP_DIR/.env"

        log "IMPORTANT: Edit $APP_DIR/.env to set GEMINI_API_KEY and CORS_ORIGINS"
    fi
}

# Deploy
deploy() {
    log "Deploying DockOps..."
    cd "$APP_DIR"

    # Pull and build
    docker compose pull postgres nginx 2>/dev/null || true
    docker compose build backend

    # Start services
    docker compose up -d

    log "Waiting for backend to be healthy..."
    for i in $(seq 1 30); do
        if curl -sf "http://localhost:8080/actuator/health" &>/dev/null; then
            log "Backend is healthy!"
            break
        fi
        if [ $i -eq 30 ]; then
            log "ERROR: Backend did not start in time"
            docker compose logs backend | tail -50
            exit 1
        fi
        sleep 5
    done
}

# Systemd service for auto-restart
setup_systemd() {
    log "Setting up systemd service..."
    cat > /etc/systemd/system/dockops.service << 'EOF'
[Unit]
Description=DockOps Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/dockops
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable dockops
}

main() {
    log "=== DockOps VPS Deployment ==="
    install_deps
    setup_repo
    setup_env
    deploy
    setup_systemd
    log "=== Deployment Complete ==="
    log "Backend API: http://${VPS_IP}/api"
    log "Health check: http://${VPS_IP}/actuator/health"
    log ""
    log "Next steps:"
    log "1. Create admin user: POST http://${VPS_IP}/api/auth/register/init"
    log "2. Deploy frontend to Vercel with VITE_API_URL=http://${VPS_IP}"
}

main "$@"
