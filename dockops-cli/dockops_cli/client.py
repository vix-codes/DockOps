import requests
from . import config


class DockOpsClient:
    def __init__(self):
        import os
        self.base_url = (os.environ.get("DOCKOPS_URL") or config.require("url", "DockOps URL")).rstrip("/")
        self.token = os.environ.get("DOCKOPS_TOKEN") or config.require("token", "auth token")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        })

    def _url(self, path: str) -> str:
        return f"{self.base_url}/api/{path.lstrip('/')}"

    def get(self, path: str, **kwargs):
        r = self.session.get(self._url(path), **kwargs)
        return self._handle(r)

    def post(self, path: str, json=None, **kwargs):
        r = self.session.post(self._url(path), json=json, **kwargs)
        return self._handle(r)

    def put(self, path: str, json=None, **kwargs):
        r = self.session.put(self._url(path), json=json, **kwargs)
        return self._handle(r)

    def delete(self, path: str, **kwargs):
        r = self.session.delete(self._url(path), **kwargs)
        return self._handle(r)

    def _handle(self, r: requests.Response):
        import click
        if r.status_code == 401:
            raise click.ClickException("Session expired. Run `dockops login` again.")
        if not r.ok:
            try:
                msg = r.json().get("message", r.text)
            except Exception:
                msg = r.text
            raise click.ClickException(f"API error {r.status_code}: {msg}")
        if r.status_code == 204 or not r.content:
            return None
        return r.json()


def login(url: str, username: str, password: str) -> dict:
    url = url.rstrip("/")
    r = requests.post(
        f"{url}/api/auth/login",
        json={"username": username, "password": password},
        headers={"Content-Type": "application/json"},
    )
    if not r.ok:
        try:
            msg = r.json().get("message", r.text)
        except Exception:
            msg = r.text
        import click
        raise click.ClickException(f"Login failed: {msg}")
    return r.json()
