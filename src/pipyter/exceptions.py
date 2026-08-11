class PipyterError(RuntimeError):
    """Base error for user-facing Pipyter failures."""


class ProjectNotLinkedError(PipyterError):
    """Raised when no `.pipyter/project.toml` can be resolved."""


class UnsafePathError(PipyterError):
    """Raised when a workspace request escapes its configured root."""


class RuntimeStateError(PipyterError):
    """Raised when persisted runtime state is invalid or unsafe."""
