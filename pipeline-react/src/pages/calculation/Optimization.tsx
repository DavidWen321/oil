import { useState } from 'react';
import { Card, Form, InputNumber, Button, Row, Col, Table, Tag, Space, message } from 'antd';
import { SettingOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import styles from './Optimization.module.css';

interface PumpScheme {
  schemeId: number;
  pumpCombination: string;
  totalPower: number;
  efficiency: number;
  outletPressure: number;
  feasible: boolean;
  energyConsumption: number;
  isOptimal?: boolean;
}

export default function Optimization() {
  const [loading, setLoading] = useState(false);
  const [schemes, setSchemes] = useState<PumpScheme[]>([]);
  const [optimalScheme, setOptimalScheme] = useState<PumpScheme | null>(null);
  const [form] = Form.useForm();

  const onFinish = async () => {
    setLoading(true);
    setTimeout(() => {
      const mockSchemes: PumpScheme[] = [
        { schemeId: 1, pumpCombination: '3×ZMI480 + 0×ZMI375', totalPower: 2400, efficiency: 80, outletPressure: 0.85, feasible: true, energyConsumption: 57600, isOptimal: true },
        { schemeId: 2, pumpCombination: '2×ZMI480 + 2×ZMI375', totalPower: 2800, efficiency: 79, outletPressure: 1.05, feasible: true, energyConsumption: 67200 },
        { schemeId: 3, pumpCombination: '3×ZMI480 + 1×ZMI375', totalPower: 3000, efficiency: 78, outletPressure: 1.25, feasible: true, energyConsumption: 72000 },
        { schemeId: 4, pumpCombination: '2×ZMI480 + 1×ZMI375', totalPower: 2200, efficiency: 78, outletPressure: 0.55, feasible: true, energyConsumption: 52800 },
        { schemeId: 5, pumpCombination: '1×ZMI480 + 3×ZMI375', totalPower: 2600, efficiency: 77, outletPressure: 0.75, feasible: true, energyConsumption: 62400 },
        { schemeId: 6, pumpCombination: '2×ZMI480 + 0×ZMI375', totalPower: 1600, efficiency: 80, outletPressure: -0.15, feasible: false, energyConsumption: 38400 },
      ];
      setSchemes(mockSchemes);
      setOptimalScheme(mockSchemes[0]);
      setLoading(false);
      message.success('优化计算完成');
    }, 1500);
  };

  const columns = [
    { title: '方案', dataIndex: 'schemeId', render: (v: number, r: PumpScheme) => r.isOptimal ? <><TrophyOutlined style={{ color: '#faad14' }} /> 方案{v}</> : `方案${v}` },
    { title: '泵组合', dataIndex: 'pumpCombination' },
    { title: '总功率(kW)', dataIndex: 'totalPower' },
    { title: '效率(%)', dataIndex: 'efficiency' },
    { title: '末站压力(MPa)', dataIndex: 'outletPressure', render: (v: number) => <span style={{ color: v < 0.3 ? '#ff4d4f' : '#52c41a' }}>{v.toFixed(2)}</span> },
    { title: '日能耗(kWh)', dataIndex: 'energyConsumption', render: (v: number) => v.toLocaleString() },
    { title: '可行性', dataIndex: 'feasible', render: (v: boolean) => <Tag color={v ? 'success' : 'error'}>{v ? '可行' : '不可行'}</Tag> },
  ];

  const chartOption = schemes.length > 0 ? {
    title: { text: '方案能耗对比', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: schemes.filter(s => s.feasible).map(s => `方案${s.schemeId}`) },
    yAxis: { type: 'value', name: 'kWh/日' },
    series: [{
      type: 'bar',
      data: schemes.filter(s => s.feasible).map(s => ({ value: s.energyConsumption, itemStyle: { color: s.isOptimal ? '#52c41a' : '#667eea' } })),
      label: { show: true, position: 'top' },
    }],
  } : null;

  return (
    <AnimatedPage>
      <div className={styles.calculationLayout}>
        <div className={styles.paramPanel}>
          <div className="page-header">
            <h2><SettingOutlined /> 泵站优化</h2>
            <p>遍历泵组合方案，找出满足输送要求的最优节能方案</p>
          </div>

          <Card title="输入参数" className="page-card">
            <Form form={form} layout="vertical" onFinish={onFinish}
              initialValues={{ flowRate: 850, inletPressure: 6.5, oilDensity: 860, oilViscosity: 20, pipelineLength: 150, innerDiameter: 492, elevationDiff: 35 }}>
              <Form.Item name="flowRate" label="输送流量(m³/h)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="inletPressure" label="首站压力(MPa)" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="oilDensity" label="油品密度(kg/m³)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="oilViscosity" label="运动粘度(mm²/s)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="pipelineLength" label="管道长度(km)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SettingOutlined />} block size="large">开始优化</Button>
            </Form>
          </Card>
        </div>

        <div className={styles.resultPanel}>
          {optimalScheme && (
            <Card title="推荐方案" className="page-card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #f6ffed 0%, #e6fffb 100%)' }}>
              <Row gutter={16} align="middle">
                <Col span={4}><TrophyOutlined style={{ fontSize: 48, color: '#faad14' }} /></Col>
                <Col span={20}>
                  <h3 style={{ marginBottom: 8 }}>{optimalScheme.pumpCombination}</h3>
                  <Space size="large">
                    <span>总功率: <strong>{optimalScheme.totalPower} kW</strong></span>
                    <span>日能耗: <strong>{optimalScheme.energyConsumption.toLocaleString()} kWh</strong></span>
                    <span>末站压力: <strong>{optimalScheme.outletPressure} MPa</strong></span>
                  </Space>
                </Col>
              </Row>
            </Card>
          )}

          <Card title="所有方案对比" className="page-card">
            <Table columns={columns} dataSource={schemes} rowKey="schemeId" pagination={false}
              rowClassName={(r) => r.isOptimal ? 'ant-table-row-selected' : ''} />
          </Card>

          {chartOption && (
            <Card title="能耗对比图" className="page-card" style={{ marginTop: 16 }}>
              <ReactECharts option={chartOption} style={{ height: 300 }} />
            </Card>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
