# Reference runtime configuration. The CLI passes workspace-specific values at launch.
c = get_config()  # noqa: F821
c.ServerApp.ip = "127.0.0.1"
c.ServerApp.open_browser = False
c.ServerApp.allow_remote_access = False
c.ServerApp.quit_button = False
c.ServerApp.websocket_ping_interval = 30
c.ServerApp.websocket_ping_timeout = 120
