/**
 * 图表组件使用示例
 *
 * 展示如何在实际页面中使用优化后的图表组件
 */

import { useState, useEffect } from 'react';
import {
  EnergyTrendChart,
  PressureDistributionChart,
  PumpStationGauge,
  PumpStationRadar,
  OptimizationComparisonChart,
  FaultDiagnosisSankey,
} from '@/components/charts';
import type {
  EnergyDataPoint,
  PressureNode,
  PumpStationData,
  OptimizationScheme,
  FaultNode,
  FaultLink,
} from '@/components/charts';

// ============================================
// 1. 能耗趋势分析示例
// ============================================
export function EnergyTrendExample() {
  const [data, setData] = useState<EnergyDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 模拟数据加载
    setLoading(true);
    setTimeout(() => {
      setData([
        { time: '00:00', value: 2100 },
        { time: '04:00', value: 2250 },
        { time: '08:00', value: 2680 },
        { time: '12:00', value: 2890 },
        { time: '16:00', value: 2750 },
        { time: '20:00', value: 2920 },
        { time: '24:00', value: 2847 },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h2>能耗趋势分析</h2>
      <EnergyTrendChart
        data={data}
        loading={loading}
        height={400}
        timeRange="24h"
        showPeakValley={true}
        unit="kWh"
        title="24小时能耗趋势"
      />
    </div>
  );
}

// ============================================
// 2. 管道压力分布示例
// ============================================
export function PressureDistributionExample() {
  const data: PressureNode[] = [
    { position: 'K0+000', pressure: 5.2, stationName: '首站', status: 'normal' },
    { position: 'K50+000', pressure: 4.8, stationName: '1号站', status: 'normal' },
    { position: 'K100+000', pressure: 4.5, stationName: '2号站', status: 'normal' },
    { position: 'K150+000', pressure: 4.2, stationName: '3号站', status: 'warning' },
    { position: 'K200+000', pressure: 3.9, stationName: '4号站', status: 'normal' },
    { position: 'K250+000', pressure: 3.5, stationName: '末站', status: 'normal' },
  ];

  const handleNodeClick = (node: PressureNode) => {
    console.log('点击节点:', node);
    alert(`${node.position}\n压力: ${node.pressure} MPa\n${node.stationName || ''}`);
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2>管道压力分布</h2>
      <PressureDistributionChart
        data={data}
        height={400}
        safetyThreshold={7.5}
        warningThreshold={6.5}
        onNodeClick={handleNodeClick}
        showHeatmap={false}
      />
    </div>
  );
}

// ============================================
// 3. 泵站运行状态示例
// ============================================
export function PumpStationExample() {
  const singleStation: PumpStationData = {
    id: '1',
    name: '1号泵站',
    efficiency: 94.7,
    power: 2150,
    status: 'running',
    temperature: 42.6,
    vibration: 2.6,
  };

  const multipleStations: PumpStationData[] = [
    { id: '1', name: '1号泵站', efficiency: 94.7, power: 2150, status: 'running', temperature: 42, vibration: 2.6 },
    { id: '2', name: '2号泵站', efficiency: 89.2, power: 1890, status: 'running', temperature: 45, vibration: 3.1 },
    { id: '3', name: '3号泵站', efficiency: 76.5, power: 2340, status: 'warning', temperature: 52, vibration: 4.2 },
    { id: '4', name: '4号泵站', efficiency: 91.8, power: 2010, status: 'running', temperature: 40, vibration: 2.3 },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h2>泵站运行状态</h2>

      {/* 单个泵站仪表盘 */}
      <div style={{ marginBottom: '40px' }}>
        <h3>单站监控</h3>
        <PumpStationGauge data={singleStation} height={300} />
      </div>

      {/* 多泵站雷达图对比 */}
      <div>
        <h3>多站对比</h3>
        <PumpStationRadar stations={multipleStations} height={400} />
      </div>
    </div>
  );
}

// ============================================
// 4. 泵组合优化对比示例
// ============================================
export function OptimizationComparisonExample() {
  const schemes: OptimizationScheme[] = [
    {
      id: '1',
      name: '方案1 (2×480+1×375)',
      pump480Count: 2,
      pump375Count: 1,
      energyConsumption: 4200,
      cost: 3360,
      isFeasible: true,
      isOptimal: true,
    },
    {
      id: '2',
      name: '方案2 (3×480)',
      pump480Count: 3,
      pump375Count: 0,
      energyConsumption: 4500,
      cost: 3600,
      isFeasible: true,
      isOptimal: false,
    },
    {
      id: '3',
      name: '方案3 (1×480+2×375)',
      pump480Count: 1,
      pump375Count: 2,
      energyConsumption: 3800,
      cost: 3040,
      isFeasible: true,
      isOptimal: false,
    },
    {
      id: '4',
      name: '方案4 (4×375)',
      pump480Count: 0,
      pump375Count: 4,
      energyConsumption: 3200,
      cost: 2560,
      isFeasible: false,
      isOptimal: false,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h2>泵组合优化对比</h2>

      {/* 柱状图模式 */}
      <div style={{ marginBottom: '40px' }}>
        <h3>柱状图对比</h3>
        <OptimizationComparisonChart
          schemes={schemes}
          chartType="bar"
          height={400}
        />
      </div>

      {/* 散点图模式 */}
      <div>
        <h3>散点图分析</h3>
        <OptimizationComparisonChart
          schemes={schemes}
          chartType="scatter"
          height={400}
        />
      </div>
    </div>
  );
}

// ============================================
// 5. 故障诊断因果图示例
// ============================================
export function FaultDiagnosisExample() {
  const nodes: FaultNode[] = [
    { name: '压力异常', category: 'fault', severity: 'critical' },
    { name: '流量波动', category: 'fault', severity: 'warning' },
    { name: '泵效率下降', category: 'cause' },
    { name: '管道堵塞', category: 'cause' },
    { name: '阀门故障', category: 'cause' },
    { name: '能耗增加', category: 'impact' },
    { name: '输送延迟', category: 'impact' },
  ];

  const links: FaultLink[] = [
    { source: '泵效率下降', target: '压力异常', value: 85 },
    { source: '管道堵塞', target: '压力异常', value: 70 },
    { source: '阀门故障', target: '流量波动', value: 60 },
    { source: '压力异常', target: '能耗增加', value: 90 },
    { source: '流量波动', target: '输送延迟', value: 75 },
  ];

  const handleNodeClick = (node: FaultNode) => {
    console.log('点击节点:', node);
    alert(`${node.name}\n类型: ${node.category}\n严重程度: ${node.severity || 'N/A'}`);
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2>故障诊断因果关系</h2>
      <FaultDiagnosisSankey
        nodes={nodes}
        links={links}
        height={500}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}

// ============================================
// 完整示例页面
// ============================================
export default function ChartExamplesPage() {
  return (
    <div>
      <EnergyTrendExample />
      <hr style={{ margin: '40px 0' }} />
      <PressureDistributionExample />
      <hr style={{ margin: '40px 0' }} />
      <PumpStationExample />
      <hr style={{ margin: '40px 0' }} />
      <OptimizationComparisonExample />
      <hr style={{ margin: '40px 0' }} />
      <FaultDiagnosisExample />
    </div>
  );
}
