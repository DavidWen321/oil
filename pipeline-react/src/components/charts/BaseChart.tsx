/**
 * BaseChart - 通用图表基础组件
 *
 * 功能:
 * - 自动主题切换 (浅色/暗色)
 * - 响应式 resize
 * - Loading 状态
 * - 性能优化 (采样、渐进式渲染)
 * - 统一动画配置
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, ECharts } from 'echarts';
import { Spin } from 'antd';
import { useChartTheme } from '../../hooks/useChartTheme';
import styles from './BaseChart.module.css';

interface BaseChartProps {
  option: EChartsOption;
  loading?: boolean;
  height?: string | number;
  renderer?: 'canvas' | 'svg';
  className?: string;
  onChartReady?: (chart: ECharts) => void;
  enableDataZoom?: boolean;
  enableSampling?: boolean;
  samplingThreshold?: number;
}

export default function BaseChart({
  option,
  loading = false,
  height = '100%',
  renderer = 'canvas',
  className,
  onChartReady,
  enableDataZoom = false,
  enableSampling = false,
  samplingThreshold = 1000,
}: BaseChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const [isReady, setIsReady] = useState(false);
  const theme = useChartTheme();

  // 合并主题配置
  const mergedOption = useMemo<EChartsOption>(() => {
    const baseOption: EChartsOption = {
      ...theme,
      ...option,
      animation: true,
      animationDuration: 600,
      animationEasing: 'cubicOut',
      animationDelay: 0,
    };

    // 自动添加 dataZoom
    if (enableDataZoom && !baseOption.dataZoom) {
      baseOption.dataZoom = [
        {
          type: 'inside',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
          borderColor: 'transparent',
          backgroundColor: theme.colors?.borderLight,
          fillerColor: theme.colors?.primaryLight,
          handleStyle: {
            color: theme.colors?.primary,
          },
        },
      ];
    }

    // 数据采样优化
    if (enableSampling && baseOption.series) {
      baseOption.series = (Array.isArray(baseOption.series) ? baseOption.series : [baseOption.series]).map(
        (series: any) => {
          if (series.type === 'line' || series.type === 'bar') {
            const dataLength = Array.isArray(series.data) ? series.data.length : 0;
            if (dataLength > samplingThreshold) {
              return {
                ...series,
                sampling: 'lttb', // Largest-Triangle-Three-Buckets 算法
                large: true,
                largeThreshold: samplingThreshold,
              };
            }
          }
          return series;
        }
      );
    }

    return baseOption;
  }, [option, theme, enableDataZoom, enableSampling, samplingThreshold]);

  // 图表实例化回调
  const handleChartReady = (chart: ECharts) => {
    setIsReady(true);
    onChartReady?.(chart);
  };

  // 清理
  useEffect(() => {
    return () => {
      const instance = chartRef.current?.getEchartsInstance();
      if (instance && !instance.isDisposed()) {
        instance.dispose();
      }
    };
  }, []);

  return (
    <div className={`${styles.baseChart} ${className || ''}`} style={{ height, position: 'relative' }}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <Spin size="large" tip="加载中..." />
        </div>
      )}
      <ReactECharts
        ref={chartRef}
        option={mergedOption}
        opts={{ renderer }}
        style={{ height: '100%', width: '100%', opacity: isReady ? 1 : 0 }}
        notMerge={false}
        lazyUpdate
        onChartReady={handleChartReady}
      />
    </div>
  );
}
