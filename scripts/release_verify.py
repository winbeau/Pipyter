from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
FORBIDDEN_PARTS = {"engines", ".beaupi", ".pi", "__pycache__", ".pytest_cache", "test-results"}
FORBIDDEN_FILES = {"settings.json", "auth.json", "credentials.json", ".env", ".npmrc"}
SECRET_PATTERNS = {
    "private key": re.compile(rb"-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----"),
    "authorization bearer": re.compile(rb"(?i)authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/=-]{16,}"),
    "common API key": re.compile(rb"(?i)(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*['\"](?:sk|key|token)[-_][A-Za-z0-9._~+/=-]{20,}['\"]"),
    "OpenAI-style key": re.compile(rb"\bsk-[A-Za-z0-9_-]{20,}\b"),
}


def fail(message: str) -> None:
    raise SystemExit(f"release verification failed: {message}")


def normalized(path: str) -> PurePosixPath:
    return PurePosixPath(path.replace("\\", "/"))


def validate_name(name: str) -> None:
    path = normalized(name)
    lowered = {part.lower() for part in path.parts}
    if lowered & FORBIDDEN_PARTS:
        fail(f"forbidden path in archive: {name}")
    if path.name.lower() in FORBIDDEN_FILES:
        fail(f"private runtime file in archive: {name}")


def scan_bytes(name: str, data: bytes) -> None:
    for label, pattern in SECRET_PATTERNS.items():
        if pattern.search(data):
            fail(f"{label} pattern found in {name}")


def archive_entries(path: Path):
    if path.suffix == ".whl":
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                mode = info.external_attr >> 16
                if stat.S_ISLNK(mode):
                    fail(f"symlink in wheel: {info.filename}")
                yield info.filename, archive.read(info)
        return
    if path.name.endswith(".tar.gz"):
        with tarfile.open(path, "r:gz") as archive:
            for member in archive.getmembers():
                if member.issym() or member.islnk():
                    fail(f"link in sdist: {member.name}")
                if not member.isfile():
                    continue
                stream = archive.extractfile(member)
                if stream is None:
                    fail(f"unreadable sdist member: {member.name}")
                yield member.name, stream.read()
        return
    fail(f"unsupported archive: {path.name}")


def verify_archive(path: Path) -> None:
    names: list[str] = []
    payload_manifest: dict | None = None
    payload_prefix: str | None = None
    payload_files: dict[str, bytes] = {}
    for name, data in archive_entries(path):
        validate_name(name)
        scan_bytes(f"{path.name}:{name}", data)
        names.append(name)
        normalized_name = normalized(name).as_posix()
        marker = "/_vendor/pigent/manifest.json" if path.suffix == ".whl" else "/build/pigent-runtime/manifest.json"
        if normalized_name.endswith(marker):
            payload_manifest = json.loads(data)
            payload_prefix = normalized_name[: -len("manifest.json")]
        if "/_vendor/pigent/" in normalized_name or "/build/pigent-runtime/" in normalized_name:
            payload_files[normalized_name] = data
    required_fragments = ["pipyter/static/index.html"]
    if path.name.endswith(".tar.gz"):
        required_fragments.extend(["packages/pigent/package.json", "packages/protocol/package.json", "packages/protocol/schemas/pigent-events.schema.json"])
    else:
        required_fragments.append("pipyter/protocol/schemas/pigent-events.schema.json")
    for fragment in required_fragments:
        if not any(name.endswith(fragment) for name in names):
            fail(f"{path.name} is missing {fragment}")
    if not payload_manifest or not payload_prefix:
        fail(f"{path.name} is missing the Pigent payload manifest")
    if payload_manifest.get("schema_version") != 2 or payload_manifest.get("host_protocol_version") != "0.2" or payload_manifest.get("tool_protocol_version") != "0.2":
        fail(f"{path.name} contains stale Pigent protocol metadata")
    if payload_manifest.get("external_engine_required") is not False:
        fail(f"{path.name} payload requires an external engine")
    expected = payload_manifest.get("files")
    if not isinstance(expected, dict) or not expected:
        fail(f"{path.name} payload inventory is empty")
    for relative, digest in expected.items():
        full_name = payload_prefix + relative
        data = payload_files.get(full_name)
        if data is None:
            fail(f"{path.name} payload is missing {relative}")
        actual = "sha256:" + hashlib.sha256(data).hexdigest()
        if actual != digest:
            fail(f"{path.name} payload hash mismatch: {relative}")


def run(command: list[str], *, env: dict[str, str] | None = None, cwd: Path | None = None) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd or ROOT, env=env, check=True)


def clean_install_smoke(wheel: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="pipyter-release-") as directory:
        root = Path(directory)
        env = os.environ.copy()
        env.update({
            "XDG_CONFIG_HOME": str(root / "config"),
            "XDG_DATA_HOME": str(root / "data"),
            "XDG_CACHE_HOME": str(root / "cache"),
            "UV_TOOL_DIR": str(root / "tools"),
            "UV_TOOL_BIN_DIR": str(root / "bin"),
            "HOME": str(root / "home"),
        })
        (root / "home").mkdir()
        run(["uv", "tool", "install", "--force", str(wheel)], env=env, cwd=root)
        suffix = ".exe" if os.name == "nt" else ""
        pipyter = root / "bin" / f"pipyter{suffix}"
        pigent = root / "bin" / f"pigent{suffix}"
        run([str(pipyter), "--version"], env=env, cwd=root)
        run([str(pigent), "--version"], env=env, cwd=root)
        run([str(pipyter), "project", "link", "."], env=env, cwd=root)
        run([str(pipyter), "doctor", "."], env=env, cwd=root)
        environment = next((root / "tools").glob("pipyter*"), None)
        if environment is None:
            fail("uv tool environment was not created")
        executable = environment / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
        run([str(executable), "-c", "from pipyter.pigent.resources import verify_payload; m=verify_payload(); assert m['schema_version']==2 and m['external_engine_required'] is False"], env=env, cwd=root)


def main() -> None:
    wheels = sorted(DIST.glob("pipyter-*.whl"))
    sdists = sorted(DIST.glob("pipyter-*.tar.gz"))
    if len(wheels) != 1 or len(sdists) != 1:
        fail("dist/ must contain exactly one Pipyter wheel and one sdist")
    for archive in [*wheels, *sdists]:
        verify_archive(archive)
        print(f"verified {archive.relative_to(ROOT)}")
    clean_install_smoke(wheels[0])
    with tempfile.TemporaryDirectory(prefix="pipyter-sdist-") as directory:
        root = Path(directory)
        output = root / "wheel"
        cache = root / "cache"
        env = os.environ.copy()
        env.update({"UV_CACHE_DIR": str(cache), "UV_PYTHON_DOWNLOADS": "never"})
        run(["uv", "build", "--wheel", "--out-dir", str(output), str(sdists[0])], env=env)
        rebuilt = sorted(output.glob("pipyter-*.whl"))
        if len(rebuilt) != 1:
            fail("sdist rebuild did not create exactly one wheel")
        verify_archive(rebuilt[0])
        clean_install_smoke(rebuilt[0])
    print("release verification passed")


if __name__ == "__main__":
    main()
