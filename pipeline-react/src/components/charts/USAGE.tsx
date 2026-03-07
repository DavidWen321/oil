/**
 * 图表组件快速使用指南
 */

// ============================================
// 1. 导入组件
// ============================================

import {
  EnergyTrendChart,
  PressureDistributionChart,
  PumpStationGauge,
  PumpStationRadar,
  OptimizationComparisonChart,
  FaultDiagnosisSankey,
} from '@/components/charts';

// ============================================
// 2. 基础使用
// ============================================

// 能耗趋势图
<EnergyTrendChart
  data={[{ time: '00:00', value: 2100 }, ...]}
  height={400}
  showPeakValley={true}
/>

// 压力分布图
<PressureDistributionChart
  data={[{ position: 'K0+000', pressure: 5.2 }, ...]}
  safetyThreshold={7.5}
  onNodeClick={(node) => console.log(node)}
/>

// 泵站仪表盘
<PumpStationGauge
  data={{
    name: '1号泵站',
    efficiency: 94.7,
    power: 2150,
    status: 'running',
  }}
/>

// 优化对比图
<OptimizationComparisonChart
  schemes={[...]}
  chartType="bar"
/>

// 故障诊断图
<FaultDiagnosisSankey
  nodes={[...]}
  links={[...]}
  onNodeClick={(node) => console.log(node)}
/>

// ============================================
// 3. 性能优化
// ============================================

// 大数据量自动采样
<BaseChart
  option={option}
  enableSampling={true}
  samplingThreshold={1000}
/>

// 数据缩放
<EnergyTrendChart
  data={largeDataset}
  enableDataZoom={true}
/>

// ============================================
// 4. 主题适配
// ============================================

// 自动检测系统主题，无需手动配置
// 支持 data-theme 属性切换
// 支持 prefers-color-scheme 系统偏好

// ============================================
// 5. 完整示例参考
// ============================================

// 查看 src/examples/ChartExamples.tsx
