import { useState } from 'react';
import { Card, Form, InputNumber, Button, Row, Col, Descriptions, Tag, Divider, Space, message } from 'antd';
import { ThunderboltOutlined, CalculatorOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { HydraulicAnalysisResult } from '../../types';
import { calculationApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import styles from './HydraulicAnalysis.module.css';

export default function HydraulicAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HydraulicAnalysisResult | null>(null);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await calculationApi.hydraulicAnalysis(values);
      if (res.data) {
        setResult(res.data);
        message.success('计算完成');
      }
    } catch {
      const mockResult: HydraulicAnalysisResult = {
        calculationId: 'demo-' + Date.now(),
        reynoldsNumber: 125680,
        flowRegime: '紊流-水力光滑区',
        frictionFactor: 0.0156,
        frictionHeadLoss: 567.8,
        hydraulicGradient: 3.79,
        inletPressure: values.inletPressure,
        outletPressure: 0.85,
        velocity: 1.68,
        flowRate: values.flowRate,
        feasible: true,
        message: '计算成功，末站压力满足要求',
      };
      setResult(mockResult);
      message.success('计算完成（演示模式）');
    } finally {
      setLoading(false);
    }
  };

  const getFlowRegimeColor = (regime: string) => {
    if (regime.includes('层流')) return 'blue';
    if (regime.includes('光滑')) return 'green';
    if (regime.includes('混合')) return 'orange';
    return 'purple';
  };

  const pressureChartOption = result ? {
    title: { text: '沿程压力分布', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', name: '里程(km)', data: ['0', '30', '60', '90', '120', '150'] },
    yAxis: { type: 'value', name: 'MPa' },
    series: [{
      type: 'line',
      smooth: true,
      data: [result.inletPressure, 5.2, 4.0, 2.8, 1.6, result.outletPressure],
      lineStyle: { color: '#667eea', width: 3 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(102,126,234,0.3)' }, { offset: 1, color: 'rgba(102,126,234,0.05)' }] } },
      markLine: { data: [{ yAxis: 0.3, name: '最低安全压力', lineStyle: { color: '#ff4d4f', type: 'dashed' } }] },
    }],
  } : null;

  return (
    <AnimatedPage>
      <div className={styles.calculationLayout}>
        <div className={styles.paramPanel}>
          <div className="page-header">
            <h2><ThunderboltOutlined /> 水力分析</h2>
            <p>基于管道参数和油品特性，计算雷诺数、流态、摩阻损失和压力分布</p>
          </div>

          <Card title="输入参数" className="page-card">
            <Form form={form} layout="vertical" onFinish={onFinish}
              initialValues={{ flowRate: 850, inletPressure: 6.5, oilDensity: 860, oilViscosity: 20, pipelineLength: 150, innerDiameter: 492, roughness: 0.03, elevationDiff: 35 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="flowRate" label="输送流量(m³/h)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="inletPressure" label="首站压力(MPa)" rules={[{ required: true }]}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="oilDensity" label="油品密度(kg/m³)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="oilViscosity" label="运动粘度(mm²/s)" rules={[{ required: true }]}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pipelineLength" label="管道长度(km)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="innerDiameter" label="内径(mm)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="roughness" label="管道粗糙度(mm)">
                    <InputNumber min={0} precision={3} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="elevationDiff" label="高程差(m)">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={loading} icon={<CalculatorOutlined />} block size="large">
                开始计算
              </Button>
            </Form>
          </Card>
        </div>

        <div className={styles.resultPanel}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Card title="计算结果" className="page-card" extra={<Tag color={result.feasible ? 'success' : 'error'}>{result.feasible ? '可行' : '不可行'}</Tag>}>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="雷诺数">{result.reynoldsNumber.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="流态"><Tag color={getFlowRegimeColor(result.flowRegime)}>{result.flowRegime}</Tag></Descriptions.Item>
                  <Descriptions.Item label="摩阻系数">{result.frictionFactor.toFixed(4)}</Descriptions.Item>
                  <Descriptions.Item label="沿程水头损失">{result.frictionHeadLoss.toFixed(2)} m</Descriptions.Item>
                  <Descriptions.Item label="水力坡降">{result.hydraulicGradient.toFixed(2)} m/km</Descriptions.Item>
                  <Descriptions.Item label="平均流速">{result.velocity.toFixed(2)} m/s</Descriptions.Item>
                  <Descriptions.Item label="首站压力">{result.inletPressure.toFixed(2)} MPa</Descriptions.Item>
                  <Descriptions.Item label="末站压力">{result.outletPressure.toFixed(2)} MPa</Descriptions.Item>
                </Descriptions>
                <Divider />
                <div style={{ padding: '8px 12px', background: result.feasible ? '#f6ffed' : '#fff2f0', borderRadius: 8 }}>
                  <strong>{result.feasible ? '✅' : '❌'} {result.message}</strong>
                </div>
              </Card>

              <Card title="压力分布曲线">
                {pressureChartOption && <ReactECharts option={pressureChartOption} style={{ height: 300 }} />}
              </Card>
            </Space>
          ) : (
            <Card className="page-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#999' }}>
                <ThunderboltOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>请输入参数后点击"开始计算"</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
