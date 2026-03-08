"""认证中间件：生产模式下验证请求来自受信任网关或受控调用方。"""

from __future__ import annotations

from secrets import compare_digest
from typing import Optional

from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.config import get_settings


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate gateway/internal requests in production."""

    PUBLIC_PATHS = {
        "/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/health",
        "/api/v1/health/ready",
        "/api/v1/health/live",
    }

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        path = request.url.path

        if not settings.AUTH_REQUIRED_IN_PRODUCTION:
            self._inject_user_context(request, trusted=False, allow_identity_headers=False)
            return await call_next(request)

        if path in self.PUBLIC_PATHS or path.startswith("/api/v1/health"):
            self._inject_user_context(request, trusted=False, allow_identity_headers=False)
            return await call_next(request)

        client_host = request.client.host if request.client else ""
        trusted_ip = client_host in settings.trusted_gateway_ips

        internal_token = request.headers.get("X-Internal-Token") or request.headers.get("X-Internal-Key")
        if internal_token and self._verify_internal_token(internal_token, settings):
            self._inject_user_context(request, trusted=trusted_ip, allow_identity_headers=trusted_ip)
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if auth_header:
            parsed = self._parse_bearer_token(auth_header)
            if parsed is None:
                return JSONResponse(status_code=401, content={"error": "Invalid authorization header"})
            if self._verify_bearer_token(parsed, settings):
                self._inject_user_context(request, trusted=trusted_ip, allow_identity_headers=trusted_ip)
                return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={"error": "未授权：缺少有效的内部服务凭证或 Bearer Token"},
        )

    @staticmethod
    def _parse_bearer_token(auth_header: str) -> Optional[str]:
        try:
            scheme, token = auth_header.split(None, 1)
        except ValueError:
            return None
        if scheme.lower() != "bearer":
            return None
        token = token.strip()
        return token or None

    @staticmethod
    def _verify_internal_token(token: str, settings) -> bool:  # noqa: ANN001
        expected_values = [
            str(settings.INTERNAL_SERVICE_TOKEN or "").strip(),
            str(settings.INTERNAL_API_KEY or "").strip(),
        ]
        return any(expected and compare_digest(token, expected) for expected in expected_values)

    @staticmethod
    def _verify_bearer_token(token: str, settings) -> bool:  # noqa: ANN001
        return any(compare_digest(token, expected) for expected in settings.allowed_bearer_tokens)

    @staticmethod
    def _inject_user_context(request: Request, trusted: bool, allow_identity_headers: bool) -> None:
        if allow_identity_headers:
            request.state.user_id = request.headers.get("X-User-Id") or request.headers.get("X-Login-Id") or "anonymous"
            request.state.user_role = request.headers.get("X-User-Role") or request.headers.get("X-Role-Code") or "user"
            request.state.tenant_id = request.headers.get("X-Tenant-Id") or request.headers.get("X-Org-Id") or "default"
        else:
            request.state.user_id = "anonymous"
            request.state.user_role = "user"
            request.state.tenant_id = "default"
        request.state.is_trusted_gateway = trusted


class OptionalAuthBearer(HTTPBearer):
    """Optional bearer auth dependency."""

    def __init__(self, auto_error: bool = False):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException:
            return None


optional_auth = OptionalAuthBearer()
