import sys
import click
from . import config, __version__
from .client import DockOpsClient, login as api_login
from .fmt import out, summarize_node, summarize_project, summarize_container, status_color

OUTPUT = click.option("-o", "--output", default="table", type=click.Choice(["table", "json"]), help="Output format")


@click.group()
@click.version_option(__version__, prog_name="dockops")
def cli():
    """DockOps CLI — link and manage projects on your infrastructure."""
    pass


# ─── AUTH ────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--url", required=True, help="DockOps API base URL (e.g. http://host/dockops)")
@click.option("--username", "-u", required=True, help="Admin username")
@click.option("--password", "-p", required=True, help="Admin password")
def login(url, username, password):
    """Authenticate and save credentials locally."""
    data = api_login(url, username, password)
    config.save({
        "url": url.rstrip("/"),
        "token": data["accessToken"],
        "refresh_token": data["refreshToken"],
        "username": data["username"],
        "role": data["role"],
    })
    click.echo(click.style(f"Logged in as {data['username']} ({data['role']})", fg="green"))
    click.echo(f"Connected to: {url}")


@cli.command("config")
def show_config():
    """Show current CLI configuration."""
    cfg = config.load()
    if not cfg:
        click.echo("Not configured. Run `dockops login`.")
        return
    safe = {k: v for k, v in cfg.items() if k not in ("token", "refresh_token")}
    safe["token"] = cfg.get("token", "")[:20] + "..." if cfg.get("token") else "(none)"
    out(safe)


# ─── NODES ───────────────────────────────────────────────────────────────────

@cli.group()
def node():
    """Manage server nodes (VPS / droplets)."""
    pass


@node.command("list")
@OUTPUT
def node_list(output):
    """List all registered server nodes."""
    c = DockOpsClient()
    nodes = c.get("nodes")
    if output == "json":
        out(nodes, "json")
    else:
        out([summarize_node(n) for n in nodes])


@node.command("get")
@click.argument("node_id")
@OUTPUT
def node_get(node_id, output):
    """Get details of a specific node."""
    c = DockOpsClient()
    node_id = _resolve_node(c, node_id)
    n = c.get(f"nodes/{node_id}")
    if output == "json":
        out(n, "json")
    else:
        out({
            "id": n["id"],
            "name": n["name"],
            "host": n["host"],
            "ssh_port": n["sshPort"],
            "ssh_user": n["sshUser"],
            "auth_method": n["authMethod"],
            "status": status_color(n.get("status", "?")),
            "os": n.get("os", "-"),
            "kernel": n.get("kernelVersion", "-"),
            "cpu_%": f"{n.get('cpuUsage', 0):.1f}",
            "ram_%": f"{n.get('ramUsage', 0):.1f}",
            "disk_%": f"{n.get('diskUsage', 0):.1f}",
            "containers": n.get("runningContainers", 0),
            "docker": n.get("dockerAvailable", False),
            "uptime_sec": n.get("uptimeSeconds", 0),
            "last_checked": n.get("lastCheckedAt", "-"),
        })


@node.command("add")
@click.option("--name", required=True, help="Display name")
@click.option("--host", required=True, help="IP address or hostname")
@click.option("--ssh-port", default=22, show_default=True)
@click.option("--ssh-user", default="root", show_default=True)
@click.option("--key-file", type=click.Path(exists=True), help="Path to SSH private key file")
@click.option("--password", help="SSH password (if not using key)")
@click.option("--description", default="")
@click.option("--environment", default="production", show_default=True)
@OUTPUT
def node_add(name, host, ssh_port, ssh_user, key_file, password, description, environment, output):
    """Register a new server node."""
    if not key_file and not password:
        raise click.ClickException("Provide either --key-file or --password.")
    auth_method = "PRIVATE_KEY" if key_file else "PASSWORD"
    private_key = open(key_file).read() if key_file else None
    c = DockOpsClient()
    result = c.post("nodes", json={
        "name": name,
        "host": host,
        "sshPort": ssh_port,
        "sshUser": ssh_user,
        "authMethod": auth_method,
        "sshPrivateKey": private_key,
        "sshPassword": password,
        "description": description,
        "environment": environment,
    })
    click.echo(click.style(f"Node '{name}' registered (id: {result['id']})", fg="green"))
    if output == "json":
        out(result, "json")


@node.command("refresh")
@click.argument("node_id")
def node_refresh(node_id):
    """Force a metrics refresh for a node."""
    c = DockOpsClient()
    node_id = _resolve_node(c, node_id)
    result = c.post(f"nodes/{node_id}/refresh-metrics")
    click.echo(f"CPU: {result.get('cpuUsage', 0):.1f}%  RAM: {result.get('ramUsage', 0):.1f}%  "
               f"Disk: {result.get('diskUsage', 0):.1f}%  Containers: {result.get('runningContainers', 0)}")


@node.command("ping")
@click.argument("node_id")
def node_ping(node_id):
    """Test SSH connectivity to a node."""
    c = DockOpsClient()
    node_id = _resolve_node(c, node_id)
    result = c.post(f"nodes/{node_id}/test-connection")
    if result.get("connected"):
        click.echo(click.style("Connected", fg="green"))
    else:
        click.echo(click.style("Failed", fg="red"))
        sys.exit(1)


# ─── PROJECTS ────────────────────────────────────────────────────────────────

@cli.group()
def project():
    """Manage projects linked to DockOps."""
    pass


@project.command("link")
@click.option("--name", required=True, help="Project display name")
@click.option("--repo", required=True, help="Git repository URL")
@click.option("--branch", default="main", show_default=True, help="Branch to track")
@click.option("--node", "node_ref", required=True, help="Node ID or name to deploy on")
@click.option("--dir", "working_dir", default="", help="Working directory on the node")
@click.option("--compose", "compose_path", default="docker-compose.yml", show_default=True,
              help="Path to docker-compose file (relative to working dir)")
@click.option("--description", default="")
@OUTPUT
def project_link(name, repo, branch, node_ref, working_dir, compose_path, description, output):
    """Link a project repository to DockOps for monitoring and deployment."""
    c = DockOpsClient()
    node_id = _resolve_node(c, node_ref)
    result = c.post("projects", json={
        "name": name,
        "repoUrl": repo,
        "branch": branch,
        "serverNodeId": node_id,
        "workingDirectory": working_dir or None,
        "composeFilePath": compose_path,
        "description": description,
    })
    click.echo(click.style(f"Project '{name}' linked (id: {result['id']})", fg="green"))
    click.echo(f"Tracking {repo}@{branch} on node {node_id}")
    if output == "json":
        out(result, "json")


@project.command("list")
@OUTPUT
def project_list(output):
    """List all linked projects."""
    c = DockOpsClient()
    projects = c.get("projects")
    if output == "json":
        out(projects, "json")
    else:
        out([summarize_project(p) for p in projects])


@project.command("get")
@click.argument("project_ref")
@OUTPUT
def project_get(project_ref, output):
    """Get details of a project by name or ID."""
    c = DockOpsClient()
    pid = _resolve_project(c, project_ref)
    p = c.get(f"projects/{pid}")
    if output == "json":
        out(p, "json")
    else:
        node = p.get("serverNode") or {}
        out({
            "id": p["id"],
            "name": p["name"],
            "status": status_color(p.get("status", "?")),
            "repo": p.get("repoUrl", "-"),
            "branch": p.get("branch", "-"),
            "compose_file": p.get("composeFilePath", "-"),
            "working_dir": p.get("workingDirectory", "-"),
            "node": node.get("name", "-"),
            "node_host": node.get("host", "-"),
            "last_commit": p.get("lastDeployedCommit", "-"),
            "last_deployed": p.get("lastDeployedAt", "-"),
            "created": p.get("createdAt", "-"),
        })


@project.command("unlink")
@click.argument("project_ref")
@click.option("--yes", is_flag=True, help="Skip confirmation prompt")
def project_unlink(project_ref, yes):
    """Remove a project from DockOps (does not stop containers)."""
    c = DockOpsClient()
    pid = _resolve_project(c, project_ref)
    if not yes:
        click.confirm(f"Unlink project '{project_ref}'?", abort=True)
    c.delete(f"projects/{pid}")
    click.echo(click.style(f"Project '{project_ref}' unlinked.", fg="yellow"))


@project.command("deploy")
@click.argument("project_ref")
@click.option("--branch", default=None, help="Override branch for this deployment")
def project_deploy(project_ref, branch):
    """Trigger a deployment for a project."""
    c = DockOpsClient()
    pid = _resolve_project(c, project_ref)
    result = c.post("deployments", json={"projectId": pid, "branch": branch})
    click.echo(click.style(f"Deployment triggered: {result['id']}", fg="green"))
    click.echo(f"Status: {result.get('status', '?')}")


# ─── CONTAINERS ──────────────────────────────────────────────────────────────

@cli.group()
def container():
    """Manage Docker containers on a node."""
    pass


@container.command("list")
@click.option("--node", "node_ref", required=True, help="Node ID or name")
@OUTPUT
def container_list(node_ref, output):
    """List all containers running on a node."""
    c = DockOpsClient()
    node_id = _resolve_node(c, node_ref)
    containers = c.get(f"containers?nodeId={node_id}")
    if output == "json":
        out(containers, "json")
    else:
        out([summarize_container(ct) for ct in containers])


@container.command("start")
@click.argument("container_id")
@click.option("--node", "node_ref", required=True, help="Node ID or name")
def container_start(container_id, node_ref):
    """Start a container."""
    _container_action(container_id, node_ref, "start")


@container.command("stop")
@click.argument("container_id")
@click.option("--node", "node_ref", required=True, help="Node ID or name")
def container_stop(container_id, node_ref):
    """Stop a container."""
    _container_action(container_id, node_ref, "stop")


@container.command("restart")
@click.argument("container_id")
@click.option("--node", "node_ref", required=True, help="Node ID or name")
def container_restart(container_id, node_ref):
    """Restart a container."""
    _container_action(container_id, node_ref, "restart")


@container.command("logs")
@click.argument("container_id")
@click.option("--node", "node_ref", required=True, help="Node ID or name")
@click.option("--tail", default=100, show_default=True, help="Number of lines to fetch")
def container_logs(container_id, node_ref, tail):
    """Fetch recent logs from a container."""
    c = DockOpsClient()
    node_id = _resolve_node(c, node_ref)
    lines = c.get(f"containers/logs?nodeId={node_id}&containerId={container_id}&tail={tail}")
    for line in (lines or []):
        click.echo(line)


# ─── DEPLOYMENTS ─────────────────────────────────────────────────────────────

@cli.group()
def deploy():
    """View and manage deployment history."""
    pass


@deploy.command("list")
@click.argument("project_ref")
@click.option("--page", default=0)
@click.option("--size", default=10)
@OUTPUT
def deploy_list(project_ref, page, size, output):
    """List deployments for a project."""
    c = DockOpsClient()
    pid = _resolve_project(c, project_ref)
    result = c.get(f"deployments?projectId={pid}&page={page}&size={size}")
    deployments = result.get("content", result) if isinstance(result, dict) else result
    if output == "json":
        out(deployments, "json")
    else:
        rows = [{
            "id": d["id"][:8] + "...",
            "status": status_color(d.get("status", "?")),
            "branch": d.get("branch", "-"),
            "commit": (d.get("commitHash") or "-")[:8],
            "triggered_by": d.get("triggeredBy", "-"),
            "started_at": d.get("startedAt", "-"),
        } for d in deployments]
        out(rows)


@deploy.command("rollback")
@click.argument("deployment_id")
def deploy_rollback(deployment_id):
    """Roll back to a previous deployment."""
    c = DockOpsClient()
    result = c.post(f"deployments/{deployment_id}/rollback")
    click.echo(click.style(f"Rollback triggered: {result['id']}", fg="yellow"))


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _resolve_node(client: DockOpsClient, ref: str) -> str:
    """Accept node ID or name, return ID."""
    nodes = client.get("nodes")
    # exact ID match
    for n in nodes:
        if n["id"] == ref:
            return ref
    # name match (case-insensitive)
    matches = [n for n in nodes if n["name"].lower() == ref.lower()]
    if len(matches) == 1:
        return matches[0]["id"]
    if len(matches) > 1:
        raise click.ClickException(f"Ambiguous node name '{ref}'. Use the node ID.")
    # partial name match
    matches = [n for n in nodes if ref.lower() in n["name"].lower()]
    if len(matches) == 1:
        return matches[0]["id"]
    raise click.ClickException(
        f"Node '{ref}' not found. Run `dockops node list` to see available nodes."
    )


def _resolve_project(client: DockOpsClient, ref: str) -> str:
    """Accept project ID or name, return ID."""
    projects = client.get("projects")
    for p in projects:
        if p["id"] == ref:
            return ref
    matches = [p for p in projects if p["name"].lower() == ref.lower()]
    if len(matches) == 1:
        return matches[0]["id"]
    if len(matches) > 1:
        raise click.ClickException(f"Ambiguous project name '{ref}'. Use the project ID.")
    matches = [p for p in projects if ref.lower() in p["name"].lower()]
    if len(matches) == 1:
        return matches[0]["id"]
    raise click.ClickException(
        f"Project '{ref}' not found. Run `dockops project list` to see linked projects."
    )


def _container_action(container_id: str, node_ref: str, action: str):
    c = DockOpsClient()
    node_id = _resolve_node(c, node_ref)
    c.post("containers/action", json={
        "serverNodeId": node_id,
        "containerId": container_id,
        "action": action,
    })
    click.echo(click.style(f"Container {container_id}: {action} OK", fg="green"))


def main():
    cli()
