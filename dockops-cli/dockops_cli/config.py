import json
import os
from pathlib import Path

CONFIG_DIR = Path.home() / ".dockops"
CONFIG_FILE = CONFIG_DIR / "config.json"


def load() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    with open(CONFIG_FILE) as f:
        return json.load(f)


def save(data: dict):
    CONFIG_DIR.mkdir(exist_ok=True)
    CONFIG_FILE.chmod(0o700) if CONFIG_FILE.exists() else None
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)
    CONFIG_FILE.chmod(0o600)


def get(key: str, default=None):
    return load().get(key, default)


def set_key(key: str, value):
    cfg = load()
    cfg[key] = value
    save(cfg)


def require(key: str, label: str = None):
    val = get(key)
    if not val:
        import click
        raise click.ClickException(
            f"Not configured: {label or key}. Run `dockops login` first."
        )
    return val
