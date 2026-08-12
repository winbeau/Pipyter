from __future__ import annotations

# This module deliberately uses only the Python standard library. Its source is
# sent over stdin to `ssh <alias> python3 -`; it is never persisted remotely and
# never imports the remote Pipyter installation.

REMOTE_HELPER_VERSION = 1
REMOTE_ENVELOPE_VERSION = 1

REMOTE_HELPER_SOURCE = r'''
import hashlib, json, os, stat, sys
from pathlib import Path

HELPER_VERSION = 1
ENVELOPE_VERSION = 1
SECRET_KEYS = {"key", "accessToken", "refreshToken", "secretHeaders", "clientSecret", "password", "token"}

def config_root():
    if os.environ.get("PIPYTER_CONFIG_HOME"):
        return Path(os.environ["PIPYTER_CONFIG_HOME"]).expanduser()
    if os.environ.get("XDG_CONFIG_HOME"):
        return Path(os.environ["XDG_CONFIG_HOME"]).expanduser() / "pipyter"
    return Path.home() / ".config" / "pipyter"

def read_object(path):
    details = path.lstat()
    if not stat.S_ISREG(details.st_mode) or path.is_symlink():
        raise ValueError("configuration file is not a private regular file")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("configuration file must contain an object")
    return value, stat.S_IMODE(details.st_mode)

def safe_endpoint(raw):
    if not isinstance(raw, str) or not raw:
        return None
    from urllib.parse import urlsplit
    parsed = urlsplit(raw)
    # Paths can contain tenant IDs or signed routing material. Public preview
    # exposes only the origin and whether a non-root path is configured.
    return {"scheme": parsed.scheme, "host": parsed.hostname, "port": parsed.port, "path_configured": parsed.path not in {"", "/"}}

def fingerprint(value):
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()

def credential_kind(entry):
    if not isinstance(entry, dict):
        return "missing"
    for key in ("key", "accessToken", "refreshToken"):
        value = entry.get(key)
        if isinstance(value, str) and value:
            if value.startswith("${") and value.endswith("}"):
                return "environment_reference"
            if value.startswith("!"):
                return "command_reference"
            return "literal"
    return "keyless" if entry.get("type") == "keyless" else "missing"

def main():
    raw = globals().get("PIGENT_MIGRATION_REQUEST") or os.environ.get("PIGENT_MIGRATION_REQUEST")
    request = json.loads(raw or "{}")
    if request.get("version") != 1 or request.get("mode") not in {"preview", "apply"}:
        raise ValueError("unsupported migration request")
    provider = request.get("provider")
    if not isinstance(provider, str) or not provider:
        raise ValueError("provider is required")
    base = Path(request["config_dir"]).expanduser() if request.get("config_dir") else config_root() / "pigent"
    settings_path, auth_path = base / "settings.json", base / "auth.json"
    settings, settings_mode = read_object(settings_path)
    auth, auth_mode = read_object(auth_path)
    entry = auth.get(provider)
    if not isinstance(entry, dict):
        raise ValueError("selected provider is missing")
    definitions = settings.get("models", {}).get("providers", {}) if isinstance(settings.get("models"), dict) else {}
    provider_definition = definitions.get(provider) if isinstance(definitions, dict) else None
    envelope = {
        "version": ENVELOPE_VERSION,
        "helper_version": HELPER_VERSION,
        "source_version": None,
        "provider": provider,
        "settings_mode": settings_mode,
        "auth_mode": auth_mode,
        "default_provider": settings.get("defaultProvider"),
        "default_model": settings.get("defaultModel"),
        "default_thinking_level": settings.get("defaultThinkingLevel"),
        "provider_ids": sorted(str(key) for key in auth),
        "provider_definition": provider_definition,
        "provider_definition_fingerprint": fingerprint(provider_definition),
        "provider_auth_fingerprint": fingerprint(entry),
        "credential_kind": credential_kind(entry),
        "endpoint": safe_endpoint(entry.get("baseUrl")),
    }
    if request["mode"] == "apply":
        envelope["provider_auth"] = entry
    sys.stdout.write(json.dumps(envelope, separators=(",", ":")))

try:
    main()
except Exception as error:
    sys.stderr.write("pipyter-migration-helper: invalid_source\n")
    sys.exit(2)
'''
