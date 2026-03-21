import { useEffect, useRef, useState } from 'react';

interface UseScrollToBottomOptions {
  /**
   * 是否启用自动滚动
   */
  enabled?: boolean;
  /**
   * 平滑滚动行为
   */
  behavior?: ScrollBehavior;
  /**
   * 距离底部多少像素时认为已在底部
   */
  threshold?: number;
}

/**
 * 滚动到底部 Hook
 * 自动检测用户手动滚动，暂停自动滚动
 */
export function useScrollToBottom<T extends HTMLElement>(
  deps: unknown[] = [],
  options: UseScrollToBottomOptions = {}
) {
  const { enabled = true, behavior = 'smooth', threshold = 100 } = options;
  const ref = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);

  // 检测是否在底部
  const checkIfAtBottom = () => {
    if (!ref.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  // 滚动到底部
  const scrollToBottom = () => {
    if (!ref.current) return;
    ref.current.scrollTo({
      top: ref.current.scrollHeight,
      behavior,
    });
    setUserScrolled(false);
  };

  // 监听滚动事件
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);

      // 如果用户向上滚动，标记为手动滚动
      if (!atBottom) {
        setUserScrolled(true);
      }
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  // 依赖变化时自动滚动（仅当未手动滚动时）
  useEffect(() => {
    if (enabled && !userScrolled) {
      scrollToBottom();
    }
  }, [...deps, enabled, userScrolled]);

  return {
    ref,
    isAtBottom,
    userScrolled,
    scrollToBottom,
  };
}
