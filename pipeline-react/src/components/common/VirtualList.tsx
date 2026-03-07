/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Virtual List Component
 *  虚拟滚动列表（优化大数据渲染性能）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { throttle } from '../utils/debounce';

interface VirtualListProps<T> {
  data: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // 预渲染的额外项数
  className?: string;
}

export default function VirtualList<T>({
  data,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算可见范围
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // 可见项
  const visibleItems = data.slice(startIndex, endIndex + 1);

  // 总高度
  const totalHeight = data.length * itemHeight;

  // 偏移量
  const offsetY = startIndex * itemHeight;

  // 滚动处理（节流）
  const handleScroll = useCallback(
    throttle((e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
    }, 16), // 约 60fps
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
