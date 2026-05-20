import json
import click


def out(data, output_format: str = "table"):
    if output_format == "json":
        click.echo(json.dumps(data, indent=2, default=str))
    else:
        _table(data)


def _table(data):
    if isinstance(data, list):
        if not data:
            click.echo("(no results)")
            return
        keys = list(data[0].keys())
        widths = {k: max(len(str(k)), max(len(str(row.get(k, ""))) for row in data)) for k in keys}
        header = "  ".join(str(k).upper().ljust(widths[k]) for k in keys)
        click.echo(click.style(header, bold=True))
        click.echo("-" * len(header))
        for row in data:
            click.echo("  ".join(str(row.get(k, "")).ljust(widths[k]) for k in keys))
    elif isinstance(data, dict):
        width = max(len(k) for k in data.keys()) + 2
        for k, v in data.items():
            click.echo(f"  {click.style(k.ljust(width), bold=True)}{v}")


def status_color(status: str) -> str:
    colors = {
        "ONLINE": "green", "running": "green", "ACTIVE": "green",
        "OFFLINE": "red", "exited": "red", "INACTIVE": "red",
        "DEGRADED": "yellow", "paused": "yellow",
    }
    color = colors.get(status, "white")
    return click.style(status, fg=color)


def summarize_node(node: dict) -> dict:
    return {
        "id": node["id"][:8] + "...",
        "name": node["name"],
        "host": node["host"],
        "status": status_color(node.get("status", "?")),
        "os": node.get("os", "-"),
        "cpu%": f"{node.get('cpuUsage', 0):.1f}",
        "ram%": f"{node.get('ramUsage', 0):.1f}",
        "containers": node.get("runningContainers", 0),
    }


def summarize_project(p: dict) -> dict:
    return {
        "id": p["id"][:8] + "...",
        "name": p["name"],
        "status": status_color(p.get("status", "?")),
        "branch": p.get("branch", "-"),
        "repo": p.get("repoUrl", "-"),
        "node": (p.get("serverNode") or {}).get("name", "-"),
        "deployed": p.get("lastDeployedAt", "-"),
    }


def _fmt_ports(ports) -> str:
    if not ports:
        return ""
    if isinstance(ports, str):
        return ports
    if isinstance(ports, list):
        return ", ".join(str(p) for p in ports)
    return str(ports)


def summarize_container(c: dict) -> dict:
    return {
        "id": c.get("containerId", c.get("id", "?"))[:12],
        "name": c.get("name", "-").lstrip("/"),
        "image": c.get("image", "-"),
        "status": status_color(c.get("status", "?")),
        "ports": _fmt_ports(c.get("ports")) or "-",
    }
