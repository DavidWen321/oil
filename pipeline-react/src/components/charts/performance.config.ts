/**
 * 图表性能优化配置
 *
 * 根据不同场景提供最佳性能配置建议
 */

import type { EChartsOption } from 'echarts';

// ============================================
// 1. 大数据量场景 (10000+ 数据点)
// ============================================
export const largeDataConfig: Partial<EChartsOption> = {
  animation: false, // 关闭动画
  series: [
    {
      type: 'line',
      sampling: 'lttb', // 启用采样
      large: true,
      largeThreshold: 2000,
      progressive: 5000, // 渐进式渲染
      progressiveThreshold: 10000,
    },
  ],
};

// ============================================
// 2. 实时更新场景 (高频数据推送)
// ============================================
export const realtimeConfig: Partial<EChartsOption> = {
  animation: false, // 关闭动画提升性能
  animationDuration: 0,
  animationDurationUpdate: 300, // 仅更新时短动画
};

// ============================================
// 3. 移动端场景
// ============================================
export const mobileConfig = {
  renderer: 'svg' as const, // SVG 更清晰
  devicePixelRatio: 2, // 高清屏适配
  legend: false, // 隐藏图例节省空间
  grid: {
    left: '12%',
    right: '5%',
    bottom: '5%',
    top: '8%',
    containLabel: false,
  },
};

// ============================================
// 4. 打印/导出场景
// ============================================
export const exportConfig = {
  renderer: 'svg' as const, // SVG 矢量图
  animation: false,
  backgroundColor: '#ffffff',
};

// ============================================
// 5. 数据采样阈值建议
// ============================================
export const samplingThresholds = {
  line: 1000, // 折线图
  bar: 500, // 柱状图
  scatter: 2000, // 散点图
  heatmap: 10000, // 热力图
};

// ============================================
// 6. Canvas vs SVG 选择策略
// ============================================
export function getOptimalRenderer(dataPoints: number, isMobile: boolean): 'canvas' | 'svg' {
  // 移动端小数据量用 SVG
  if (isMobile && dataPoints < 500) return 'svg';

  // 大数据量用 Canvas
  if (dataPoints > 1000) return 'canvas';

  // 默认 Canvas
  return 'canvas';
}

// ============================================
// 7. 内存优化建议
// ============================================
export const memoryOptimization = {
  // 及时销毁图表实例
  disposeOnUnmount: true,

  // 限制历史数据长度
  maxDataLength: 1000,

  // 使用 notMerge: false 增量更新
  notMerge: false,

  // 延迟更新
  lazyUpdate: true,
};

// ============================================
// 8. 使用示例
// ============================================

/*
// 大数据量场景
<BaseChart
  option={{ ...baseOption, ...largeDataConfig }}
  renderer="canvas"
  enableSampling={true}
  samplingThreshold={samplingThresholds.line}
/>

// 实时更新场景
<EnergyTrendChart
  data={realtimeData}
  height={400}
  // 使用 React 的 key 强制重新渲染
  key={updateTimestamp}
/>

// 移动端场景
<PressureDistributionChart
  data={data}
  height={300}
  // useChartConfig 会自动检测并应用移动端配置
/>

// 导出场景
const handleExport = () => {
  const chart = chartRef.current?.getEchartsInstance();
  const url = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff',
  });
  // 下载图片
  const link = document.createElement('a');
  link.download = 'chart.png';
  link.href = url;
  link.click();
};
*/
