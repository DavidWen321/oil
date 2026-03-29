"""
认证中间件
处理请求认证
"""

from typing import Optional

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import settings
from src.utils import logger


class AuthMiddleware(BaseHTTPMiddleware):
    """
    认证中间件

    验证请求的认证信息
    """

    # 不需要认证的路径
    PUBLIC_PATHS = {
        "/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/health",
        "/api/v1/health/ready",
        "/api/v1/health/live"
    }

    async def dispatch(self, request: Request, call_next):
        # 检查是否是公开路径
        path = request.url.path

        if path in self.PUBLIC_PATHS or path.startswith("/api/v1/health"):
            return await call_next(request)

        # 开发模式下跳过认证
        if settings.DEBUG:
            return await call_next(request)

        # 验证Token
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            # 检查是否来自Java Gateway（内部调用）
            internal_key = request.headers.get("X-Internal-Key")
            if internal_key and self._verify_internal_key(internal_key):
                return await call_next(request)

            raise HTTPException(
                status_code=401,
                detail="Missing authorization header"
            )

        # 解析Bearer Token
        try:
            scheme, token = auth_header.split()
            if scheme.lower() != "bearer":
                raise HTTPException(
                    status_code=401,
                    detail="Invalid authentication scheme"
                )

            # 验证Token
            if not self._verify_token(token):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid token"
                )

        except ValueError:
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header"
            )

        return await call_next(request)

    def _verify_token(self, token: str) -> bool:
        """
        验证Token

        实际应用中应该调用认证服务验证
        """
        # 简化实现：检查Token是否存在
        # TODO: 集成Sa-Token或其他认证服务
        return bool(token)

    def _verify_internal_key(self, key: str) -> bool:
        """
        验证内部调用Key
        """
        # 可以配置一个内部通信密钥
        expected_key = getattr(settings, "INTERNAL_API_KEY", None)
        if expected_key:
            return key == expected_key
        return False


class OptionalAuthBearer(HTTPBearer):
    """
    可选的Bearer认证

    用于某些接口可选认证
    """

    def __init__(self, auto_error: bool = False):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException:
            return None


# 依赖注入用的认证实例
optional_auth = OptionalAuthBearer()
