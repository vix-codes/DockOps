# DockOps CLI

Command-line interface for the DockOps infrastructure platform. Designed to be used by developers, scripts, and AI agents to link projects and manage containers without touching the web UI.

---

## Installation

### From the repo (recommended)

```bash
pip install git+https://github.com/vix-codes/DockOps.git#subdirectory=dockops-cli
```

### From local clone

```bash
git clone https://github.com/vix-codes/DockOps.git
cd DockOps/dockops-cli
pip install -e .
```

### Minimal (no install)

```bash
pip install click requests
cd DockOps/dockops-cli
python -m dockops_cli.cli --help
```

---

## Quick Start

```bash
# 1. Authenticate (run once — saves token to ~/.dockops/config.json)
dockops login --url http://143.198.160.235/dockops --username admin --password Admin@123

# 2. Verify connectivity
dockops node list

# 3. Link a project
dockops project link \
  --name "Apartment Mgmt" \
  --repo https://github.com/your-org/apartment-mgmt \
  --branch main \
  --node "DigitalOcean Droplet" \
  --dir /opt/apartment-mgmt

# 4. Confirm it's visible
dockops project list
```

---

## Configuration

Credentials are stored in `~/.dockops/config.json` (chmod 600).

```bash
dockops config          # show current config (token is masked)
dockops login ...       # overwrite with new credentials
```

Config file schema:
```json
{
  "url": "http://143.198.160.235/dockops",
  "token": "<jwt>",
  "refresh_token": "<jwt>",
  "username": "admin",
  "role": "ROLE_ADMIN"
}
```

---

## Commands Reference

### `dockops login`

Authenticate and store credentials locally.

```bash
dockops login \
  --url http://143.198.160.235/dockops \
  --username admin \
  --password Admin@123
```

| Flag | Required | Description |
|------|----------|-------------|
| `--url` | yes | DockOps API base URL |
| `--username` / `-u` | yes | Username |
| `--password` / `-p` | yes | Password |

---

### Node Commands

#### `dockops node list`

List all registered server nodes with live metrics.

```bash
dockops node list
dockops node list -o json
```

#### `dockops node get <id-or-name>`

Full details of one node.

```bash
dockops node get "DigitalOcean Droplet"
dockops node get 0be2a2eb-0c5b-429c-a025-4694448eae9a
```

#### `dockops node add`

Register a new VPS/server.

```bash
# SSH key auth
dockops node add \
  --name "Production Server" \
  --host 1.2.3.4 \
  --ssh-user root \
  --key-file ~/.ssh/id_ed25519 \
  --environment production

# Password auth
dockops node add \
  --name "Staging Server" \
  --host 5.6.7.8 \
  --ssh-user deploy \
  --password s3cr3t \
  --environment staging
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | required | Display name |
| `--host` | required | IP or hostname |
| `--ssh-port` | 22 | SSH port |
| `--ssh-user` | root | SSH username |
| `--key-file` | - | Path to private key file |
| `--password` | - | SSH password |
| `--environment` | production | production / staging / dev |
| `--description` | - | Optional description |

#### `dockops node refresh <id-or-name>`

Force a live metrics poll (CPU, RAM, disk, container count).

```bash
dockops node refresh "DigitalOcean Droplet"
```

#### `dockops node ping <id-or-name>`

Test SSH connectivity. Exits 1 if unreachable.

```bash
dockops node ping "DigitalOcean Droplet"
```

---

### Project Commands

#### `dockops project link`

Link a repository to DockOps. This makes it visible in the dashboard and enables deployment tracking.

```bash
dockops project link \
  --name "Apartment Mgmt" \
  --repo https://github.com/your-org/apartment-mgmt \
  --branch main \
  --node "DigitalOcean Droplet" \
  --dir /opt/apartment-mgmt \
  --compose docker-compose.yml
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | required | Project display name |
| `--repo` | required | Git repo URL |
| `--branch` | main | Branch to track |
| `--node` | required | Node ID or name |
| `--dir` | - | Working directory on the node |
| `--compose` | docker-compose.yml | Path to compose file |
| `--description` | - | Optional description |

#### `dockops project list`

List all linked projects.

```bash
dockops project list
dockops project list -o json
```

#### `dockops project get <name-or-id>`

Full details of one project.

```bash
dockops project get "Apartment Mgmt"
```

#### `dockops project unlink <name-or-id>`

Remove a project from DockOps. Does **not** stop or remove containers.

```bash
dockops project unlink "Apartment Mgmt"
dockops project unlink "Apartment Mgmt" --yes   # skip confirmation
```

#### `dockops project deploy <name-or-id>`

Trigger a deployment for a project.

```bash
dockops project deploy "Apartment Mgmt"
dockops project deploy "Apartment Mgmt" --branch feature/new-ui
```

---

### Container Commands

#### `dockops container list --node <name-or-id>`

List all Docker containers on a node.

```bash
dockops container list --node "DigitalOcean Droplet"
dockops container list --node "DigitalOcean Droplet" -o json
```

#### `dockops container start|stop|restart`

Control a container by its Docker container ID or name.

```bash
dockops container start  apartment-mgmt-app --node "DigitalOcean Droplet"
dockops container stop   apartment-mgmt-app --node "DigitalOcean Droplet"
dockops container restart apartment-mgmt-app --node "DigitalOcean Droplet"
```

#### `dockops container logs`

Fetch recent log output from a container.

```bash
dockops container logs apartment-mgmt-app --node "DigitalOcean Droplet"
dockops container logs apartment-mgmt-app --node "DigitalOcean Droplet" --tail 200
```

---

### Deployment Commands

#### `dockops deploy list <project>`

View deployment history for a project.

```bash
dockops deploy list "Apartment Mgmt"
dockops deploy list "Apartment Mgmt" --page 0 --size 20
```

#### `dockops deploy rollback <deployment-id>`

Roll back to a specific previous deployment.

```bash
dockops deploy rollback 3f2a1b4c-...
```

---

## Output Formats

All list/get commands support `-o json` for machine-readable output:

```bash
dockops node list -o json
dockops project list -o json | jq '.[].name'
dockops container list --node prod -o json | jq '.[] | select(.status == "running")'
```

---

## AI Agent Integration

This CLI is designed to be called by AI agents (Claude, etc.) after deploying a project to the droplet. Typical agent workflow:

```bash
# Step 1 — agent deploys app to droplet (SSH/docker compose)
ssh root@143.198.160.235 "cd /opt/apartment-mgmt && git pull && docker compose up -d"

# Step 2 — agent links the project to DockOps
dockops project link \
  --name "Apartment Mgmt" \
  --repo https://github.com/your-org/apartment-mgmt \
  --branch main \
  --node "DigitalOcean Droplet" \
  --dir /opt/apartment-mgmt

# Step 3 — agent confirms containers are visible
dockops container list --node "DigitalOcean Droplet" -o json

# Step 4 — DockOps now monitors it automatically (30s polling)
```

### Environment Variable Auth

Instead of running `dockops login`, agents can pass credentials via env vars:

```bash
export DOCKOPS_URL=http://143.198.160.235/dockops
export DOCKOPS_TOKEN=eyJhbGci...
```

> **Note:** `DOCKOPS_TOKEN` overrides the config file token. Useful for CI/CD pipelines.

---

## Connection Details

| Setting | Value |
|---------|-------|
| DockOps URL | `http://143.198.160.235/dockops` |
| Dashboard | https://dockops-frontend-henna.vercel.app |
| Node | DigitalOcean Droplet (`0be2a2eb-0c5b-429c-a025-4694448eae9a`) |
| Admin user | `admin` |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (API error, not found, auth failure, etc.) |
