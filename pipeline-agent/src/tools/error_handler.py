"""Unified safe wrapper for tool execution."""

from __future__ import annotations

import asyncio
import functools
import traceback
from typing import Callable

from src.utils import logger


def safe_tool_call(tool_name: str) -> Callable:
    """Wrap tool calls and return LLM-friendly error text instead of raising."""

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                try:
                    return await func(*args, **kwargs)
                except TimeoutError:
                    message = f"工具 {tool_name} 调用超时，请稍后重试"
                except ConnectionError:
                    message = f"工具 {tool_name} 连接失败，请检查后端服务状态"
                except ValueError as exc:
                    message = f"工具 {tool_name} 参数错误: {exc}"
                except Exception as exc:  # noqa: BLE001
                    message = f"工具 {tool_name} 执行异常: {type(exc).__name__}: {exc}"
                logger.error(f"{message}: {traceback.format_exc()}")
                return message

            return async_wrapper

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except TimeoutError:
                message = f"工具 {tool_name} 调用超时，请稍后重试"
            except ConnectionError:
                message = f"工具 {tool_name} 连接失败，请检查后端服务状态"
            except ValueError as exc:
                message = f"工具 {tool_name} 参数错误: {exc}"
            except Exception as exc:  # noqa: BLE001
                message = f"工具 {tool_name} 执行异常: {type(exc).__name__}: {exc}"
            logger.error(f"{message}: {traceback.format_exc()}")
            return message

        return sync_wrapper

    return decorator
