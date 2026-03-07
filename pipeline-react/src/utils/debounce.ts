/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Debounce & Throttle Utilities
 *  防抖和节流工具函数
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 防抖函数
 * 在事件触发 n 秒后才执行，如果在 n 秒内又触发，则重新计时
 *
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 节流函数
 * 在 n 秒内只执行一次，如果在 n 秒内多次触发，只有第一次生效
 *
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

/**
 * React Hook: 防抖
 */
import { useCallback, useRef } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );
}

/**
 * React Hook: 节流
 */
export function useThrottle<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const lastTimeRef = useRef(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastTimeRef.current >= delay) {
        fn(...args);
        lastTimeRef.current = now;
      }
    },
    [fn, delay]
  );
}
