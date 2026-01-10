"""Version header middleware for stale client detection.

This middleware adds an X-App-Version header to all HTTP responses,
enabling the frontend to detect when it's running stale code after
a backend deployment.

The version is determined from environment variables:
1. RAILWAY_GIT_COMMIT_SHA (Railway deployments)
2. GITHUB_SHA (GitHub Actions builds)
3. "dev" (local development fallback)
"""

import os

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class VersionHeaderMiddleware:
    """Adds X-App-Version header to all HTTP responses.

    This enables stale client detection by comparing the frontend's
    build-time commit SHA with the backend's runtime commit SHA.

    When they differ, the frontend knows it's running outdated code
    and can trigger an automatic refresh.

    Example usage:
        app.add_middleware(VersionHeaderMiddleware)

    The header will contain:
        X-App-Version: abc123def  (commit SHA)
        X-App-Version: dev        (local development)
    """

    # Determine version at class load time (once per process)
    VERSION: str = os.environ.get(
        "RAILWAY_GIT_COMMIT_SHA",
        os.environ.get("GITHUB_SHA", "dev"),
    )

    def __init__(self, app: ASGIApp) -> None:
        """Initialize the middleware.

        Args:
            app: The ASGI application to wrap.
        """
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process the request and add version header to responses.

        Only modifies HTTP responses; passes through other protocol
        types (websocket, lifespan) unchanged.

        Args:
            scope: The ASGI scope.
            receive: The receive callable.
            send: The send callable.
        """
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            """Wrapper to inject X-App-Version header into response."""
            if message["type"] == "http.response.start":
                # Get existing headers and add our version header
                headers = MutableHeaders(raw=list(message.get("headers", [])))
                headers.append("X-App-Version", self.VERSION)
                # Create new message with updated headers
                message = {**message, "headers": headers.raw}
            await send(message)

        await self.app(scope, receive, send_wrapper)
