import { useState } from 'react';
import { Card, Form, InputNumber, Button, Row, Col, Select, Slider, Table, message } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import styles from './SensitivityAnalysis.module.css';

export default function SensitivityAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form] = Form.useForm();

  const variableOptions = [
    { value: 'flowRate', label: '输送流量' },
    { value: 'oilDensity', label: '油品密度' },
    { value: 'oilViscosity', label: '油品粘度' },
    { value: 'inletPressure', label: '首站压力' },
    { value: 'pipelineLength', label: '管道长度' },
  ];

  const onFinish = async () => {
    setLoading(true);
    setTimeout(() => {
      const mockResult = {
        variable: '输送流量',
        dataPoints: [
          { value: 700, result: 1.25, change: -32.4 },
          { value: 750, result: 1.05, change: -23.0 },
          { value: 800, result: 0.95, change: -13.5 },
          { value: 850, result: 0.85, change: 0 },
          { value: 900, result: 0.72, change: 15.3 },
          { value: 950, result: 0.58, change: 31.8 },
          { value: 1000, result: 0.42, change: 50.6 },
        ],
        sensitivity: -0.68,
        trend: '负相关',
        conclusion: '流量每增加10%，末站压力下降约6.8%',
      };
      setResult(mockResult);
      setLoading(false);
      message.success('分析完成');
    }, 1500);
  };

  const chartOption = result ? {
    title: { text: '敏感性分析曲线', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['末站压力', '变化率'], top: 30 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', name: result.variable, data: result.dataPoints.map((p: any) => p.value) },
    yAxis: [
      { type: 'value', name: 'MPa', position: 'left' },
      { type: 'value', name: '%', position: 'right' },
    ],
    series: [
      { name: '末站压力', type: 'line', smooth: true, data: result.dataPoints.map((p: any) => p.result), lineStyle: { color: '#667eea', width: 3 } },
      { name: '变化率', type: 'bar', yAxisIndex: 1, data: result.dataPoints.map((p: any) => p.change), itemStyle: { color: (params: { value: number }) => params.value >= 0 ? '#ff4d4f' : '#52c41a' } },
    ],
  } : null;

  const columns = [
    { title: '参数值', dataIndex: 'value' },
    { title: '末站压力(MPa)', dataIndex: 'result', render: (v: number) => v.toFixed(2) },
    { title: '变化率(%)', dataIndex: 'change', render: (v: number) => <span style={{ color: v >= 0 ? '#ff4d4f' : '#52c41a' }}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span> },
  ];

  return (
    <AnimatedPage>
      <div className={styles.calculationLayout}>
        <div className={styles.paramPanel}>
          <div className="page-header">
            <h2><BarChartOutlined /> 敏感性分析</h2>
            <p>分析各参数变化对计算结果的影响程度</p>
          </div>

          <Card title="分析参数" className="page-card">
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ variable: 'flowRate', rangeMin: -30, rangeMax: 30, steps: 7 }}>
              <Form.Item name="variable" label="分析变量" rules={[{ required: true }]}>
                <Select options={variableOptions} />
              </Form.Item>
              <Form.Item label="变化范围(%)">
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="rangeMin" noStyle><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="rangeMax" noStyle><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
              </Form.Item>
              <Form.Item name="steps" label="分析点数"><Slider min={3} max={15} marks={{ 3: '3', 7: '7', 11: '11', 15: '15' }} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} icon={<BarChartOutlined />} block size="large">开始分析</Button>
            </Form>
          </Card>
        </div>

        <div className={styles.resultPanel}>
          {result ? (
            <>
              <Card title="分析结论" className="page-card" style={{ marginBottom: 16 }}>
                <Row gutter={24}>
                  <Col span={8}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, fontWeight: 700, color: '#667eea' }}>{result.sensitivity}</div><div>敏感性系数</div></div></Col>
                  <Col span={8}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, fontWeight: 700, color: result.trend === '负相关' ? '#52c41a' : '#ff4d4f' }}>{result.trend}</div><div>相关趋势</div></div></Col>
                  <Col span={8}><div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>{result.conclusion}</div></Col>
                </Row>
              </Card>

              <Card title="分析曲线" className="page-card" style={{ marginBottom: 16 }}>
                {chartOption && <ReactECharts option={chartOption} style={{ height: 350 }} />}
              </Card>

              <Card title="数据明细" className="page-card">
                <Table columns={columns} dataSource={result.dataPoints} rowKey="value" pagination={false} size="small" />
              </Card>
            </>
          ) : (
            <Card className="page-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#999' }}><BarChartOutlined style={{ fontSize: 48, marginBottom: 16 }} /><p>请选择分析变量后点击"开始分析"</p></div>
            </Card>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
