from __future__ import annotations

import secrets
import time
import webbrowser

import httpx

from ..config import Credentials, save_credentials
from ..exceptions import PipyterError


def login_local(server_url: str = "http://127.0.0.1:8765") -> Credentials:
    credentials = Credentials(
        account_id="local",
        access_token="local-" + secrets.token_urlsafe(24),
        server_url=server_url.rstrip("/"),
    )
    save_credentials(credentials)
    return credentials


def login_with_device_flow(
    server_url: str,
    *,
    open_browser: bool = True,
    timeout: float = 300,
) -> Credentials:
    base = server_url.rstrip("/")
    with httpx.Client(timeout=20) as client:
        response = client.post(f"{base}/api/v1/auth/device")
        response.raise_for_status()
        device = response.json()
        verification_uri = str(device["verification_uri"])
        user_code = str(device["user_code"])
        device_code = str(device["device_code"])
        interval = float(device.get("interval", 2))
        print(f"Open {verification_uri} and enter code {user_code}")
        if open_browser:
            webbrowser.open(verification_uri)
        deadline = time.time() + timeout
        while time.time() < deadline:
            token_response = client.get(f"{base}/api/v1/auth/device/{device_code}")
            if token_response.status_code == 200:
                payload = token_response.json()
                credentials = Credentials(
                    account_id=str(payload["account_id"]),
                    access_token=str(payload["access_token"]),
                    refresh_token=payload.get("refresh_token"),
                    server_url=base,
                )
                save_credentials(credentials)
                return credentials
            if token_response.status_code not in {404, 428}:
                token_response.raise_for_status()
            time.sleep(interval)
    raise PipyterError("Device authorization timed out")
