/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Optimized Chart Component
 *  使用按需引入的 ECharts
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, memo } from 'react';
import echarts from '../utils/echarts';
import type { EChartsOption } from 'echarts';

interface ChartProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
  onChartReady?: (chart: echarts.ECharts) => void;
}

function Chart({ option, style, className, loading = false, onChartReady }: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表实例
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
      onChartReady?.(instanceRef.current);
    }

    // 设置配置项
    instanceRef.current.setOption(option, true);

    // 响应式调整
    const handleResize = () => {
      instanceRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option, onChartReady]);

  useEffect(() => {
    if (instanceRef.current) {
      if (loading) {
        instanceRef.current.showLoading();
      } else {
        instanceRef.current.hideLoading();
      }
    }
  }, [loading]);

  // 组件卸载时销毁实例
  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ width: '100%', height: '400px', ...style }}
    />
  );
}

// 使用 memo 避免不必要的重渲染
export default memo(Chart);
