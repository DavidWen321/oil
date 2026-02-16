import { useState } from 'react';
import { Card, Form, InputNumber, Button, Row, Col, DatePicker, Select, Switch, Descriptions, Tag, Progress, Table, Statistic, message } from 'antd';
import { CloudOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { CarbonCalculationResult } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

const { RangePicker } = DatePicker;

export default function CarbonCalculation() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CarbonCalculationResult | null>(null);
  const [form] = Form.useForm();

  const gridOptions = [
    { value: 'NORTH', label: '华北电网' },
    { value: 'EAST', label: '华东电网' },
    { value: 'SOUTH', label: '南方电网' },
    { value: 'CENTRAL', label: '华中电网' },
    { value: 'NORTHWEST', label: '西北电网' },
    { value: 'NORTHEAST', label: '东北电网' },
  ];

  const onFinish = async () => {
    setLoading(true);
    setTimeout(() => {
      const mockResult: CarbonCalculationResult = {
        calculationId: 'carbon-' + Date.now(),
        calculationTime: new Date().toISOString(),
        totalEmission: 1256.8,
        scope1Emission: 45.2,
        scope2Emission: 1180.5,
        scope3Emission: 31.1,
        carbonSink: 12.5,
        netEmission: 1244.3,
        emissionPerTon: 0.42,
        emissionPerTonKm: 0.014,
        emissionLevel: 'B',
        carbonScore: 72,
        emissionDetails: [
          { source: '电力消耗', scope: '范围二', activityData: 2150000, activityUnit: 'kWh', emissionFactor: 0.5839, emission: 1180.5, sharePercent: 93.9 },
          { source: '天然气燃烧', scope: '范围一', activityData: 18500, activityUnit: 'm³', emissionFactor: 2.1622, emission: 40.0, sharePercent: 3.2 },
          { source: '油品挥发逸散', scope: '范围一', activityData: 350000, activityUnit: '吨', emissionFactor: 0.0125, emission: 5.2, sharePercent: 0.4 },
          { source: '输配电损耗', scope: '范围三', activityData: 107500, activityUnit: 'kWh', emissionFactor: 0.5839, emission: 31.1, sharePercent: 2.5 },
        ],
        emissionShares: [
          { name: '电力消耗', value: 1180.5, percent: 93.9 },
          { name: '天然气燃烧', value: 40.0, percent: 3.2 },
          { name: '输配电损耗', value: 31.1, percent: 2.5 },
          { name: '油品挥发', value: 5.2, percent: 0.4 },
        ],
        reductionSuggestions: [
          { seq: 1, category: '节能降耗', suggestion: '优化泵站运行组合，采用变频调速技术', expectedReduction: 125, investmentCost: 100, paybackPeriod: 2.5, difficulty: 'MEDIUM', priority: 1 },
          { seq: 2, category: '清洁能源', suggestion: '购买绿色电力证书，提高清洁能源比例', expectedReduction: 300, investmentCost: 50, paybackPeriod: 1.0, difficulty: 'LOW', priority: 2 },
          { seq: 3, category: '清洁能源', suggestion: '在站场建设分布式光伏发电项目', expectedReduction: 80, investmentCost: 200, paybackPeriod: 5.0, difficulty: 'MEDIUM', priority: 3 },
        ],
        carbonQuota: { annualQuota: 1100, usedQuota: 1256.8, remainingQuota: -156.8, usageRate: 114.3, projectedGap: 156.8, carbonPrice: 70, projectedTradingAmount: 1.1 }
      };
      setResult(mockResult);
      setLoading(false);
      message.success('碳排放核算完成');
    }, 2000);
  };

  const pieOption = result ? {
    tooltip: { trigger: 'item', formatter: '{b}: {c} tCO2e ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{ type: 'pie', radius: ['40%', '70%'], label: { show: false }, data: result.emissionShares.map(s => ({ value: s.value, name: s.name })) }]
  } : null;

  const scopeOption = result ? {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['范围一\n直接排放', '范围二\n间接排放', '范围三\n其他排放', '碳汇抵消'] },
    yAxis: { type: 'value', name: 'tCO2e' },
    series: [{ type: 'bar', data: [
      { value: result.scope1Emission, itemStyle: { color: '#ff7875' } },
      { value: result.scope2Emission, itemStyle: { color: '#ffc53d' } },
      { value: result.scope3Emission, itemStyle: { color: '#69c0ff' } },
      { value: -result.carbonSink, itemStyle: { color: '#95de64' } }
    ], label: { show: true, position: 'top' } }]
  } : null;

  const suggestionColumns = [
    { title: '优先级', dataIndex: 'priority', render: (v: number) => <Tag color={v === 1 ? 'red' : v === 2 ? 'orange' : 'blue'}>{v}</Tag> },
    { title: '类别', dataIndex: 'category' },
    { title: '减排措施', dataIndex: 'suggestion' },
    { title: '预计减排(tCO2e/年)', dataIndex: 'expectedReduction' },
    { title: '投资(万元)', dataIndex: 'investmentCost' },
    { title: '回收期(年)', dataIndex: 'paybackPeriod' },
    { title: '难度', dataIndex: 'difficulty', render: (v: string) => <Tag color={v === 'LOW' ? 'green' : v === 'MEDIUM' ? 'orange' : 'red'}>{v === 'LOW' ? '低' : v === 'MEDIUM' ? '中' : '高'}</Tag> },
  ];

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><CloudOutlined /> 碳排放核算</h2>
        <p>符合国家标准的温室气体排放核算，支持碳配额管理和减排分析</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card title="核算参数" className="page-card">
            <Form form={form} layout="vertical" onFinish={onFinish}
              initialValues={{ dateRange: [dayjs().subtract(1, 'month'), dayjs()], gridType: 'EAST', electricityConsumption: 2150000, naturalGasConsumption: 18500, oilThroughput: 350000, pipelineLength: 150, useGreenPower: false }}>
              <Form.Item name="dateRange" label="核算周期"><RangePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="gridType" label="所属电网"><Select options={gridOptions} /></Form.Item>
              <Form.Item name="electricityConsumption" label="电力消耗(kWh)"><InputNumber style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="naturalGasConsumption" label="天然气消耗(m³)"><InputNumber style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="oilThroughput" label="原油输送量(吨)"><InputNumber style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="pipelineLength" label="管道长度(km)"><InputNumber style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="useGreenPower" label="使用绿电" valuePropName="checked"><Switch /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} icon={<CloudOutlined />} block size="large">开始核算</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {result ? (
            <div>
              {/* 核心指标 */}
              <Row gutter={16}>
                <Col span={6}>
                  <Card className="page-card" style={{ textAlign: 'center' }}>
                    <Statistic title="总碳排放" value={result.totalEmission} suffix="tCO2e" valueStyle={{ color: '#ff4d4f' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card className="page-card" style={{ textAlign: 'center' }}>
                    <Statistic title="净碳排放" value={result.netEmission} suffix="tCO2e" valueStyle={{ color: '#faad14' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card className="page-card" style={{ textAlign: 'center' }}>
                    <Statistic title="排放强度" value={result.emissionPerTonKm} suffix="kgCO2e/t·km" precision={4} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card className="page-card" style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 8 }}>碳绩效评分</div>
                    <Progress type="circle" percent={result.carbonScore} strokeColor={result.carbonScore >= 80 ? '#52c41a' : result.carbonScore >= 60 ? '#faad14' : '#ff4d4f'} format={() => <><span style={{ fontSize: 24, fontWeight: 700 }}>{result.carbonScore}</span><br/><Tag color={result.emissionLevel === 'A' ? 'success' : result.emissionLevel === 'B' ? 'blue' : 'warning'}>{result.emissionLevel}级</Tag></>} />
                  </Card>
                </Col>
              </Row>

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Card title="排放源构成" className="page-card">
                    <ReactECharts option={pieOption!} style={{ height: 280 }} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="分范围排放" className="page-card">
                    <ReactECharts option={scopeOption!} style={{ height: 280 }} />
                  </Card>
                </Col>
              </Row>

              {/* 碳配额 */}
              {result.carbonQuota && (
                <Card title="碳配额分析" className="page-card" style={{ marginTop: 16 }}>
                  <Row gutter={24}>
                    <Col span={8}>
                      <Progress type="dashboard" percent={Math.min(result.carbonQuota.usageRate, 100)} strokeColor={result.carbonQuota.usageRate > 100 ? '#ff4d4f' : result.carbonQuota.usageRate > 90 ? '#faad14' : '#52c41a'} format={() => <><div style={{ fontSize: 20, fontWeight: 700 }}>{result.carbonQuota!.usageRate.toFixed(1)}%</div><div style={{ fontSize: 12, color: '#999' }}>配额使用率</div></>} />
                    </Col>
                    <Col span={16}>
                      <Descriptions column={2} size="small">
                        <Descriptions.Item label="年度配额">{result.carbonQuota.annualQuota} tCO2e</Descriptions.Item>
                        <Descriptions.Item label="已使用">{result.carbonQuota.usedQuota} tCO2e</Descriptions.Item>
                        <Descriptions.Item label="剩余/缺口"><span style={{ color: result.carbonQuota.remainingQuota < 0 ? '#ff4d4f' : '#52c41a' }}>{result.carbonQuota.remainingQuota} tCO2e</span></Descriptions.Item>
                        <Descriptions.Item label="碳市场价格">{result.carbonQuota.carbonPrice} 元/tCO2e</Descriptions.Item>
                        <Descriptions.Item label="预计交易金额" span={2}><span style={{ color: result.carbonQuota.remainingQuota < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 700 }}>{result.carbonQuota.remainingQuota < 0 ? '需购买' : '可出售'} {result.carbonQuota.projectedTradingAmount} 万元</span></Descriptions.Item>
                      </Descriptions>
                    </Col>
                  </Row>
                </Card>
              )}

              {/* 减排建议 */}
              <Card title="减排建议" className="page-card" style={{ marginTop: 16 }}>
                <Table columns={suggestionColumns} dataSource={result.reductionSuggestions} rowKey="seq" pagination={false} size="small" />
              </Card>
            </div>
          ) : (
            <Card className="page-card" style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#999' }}><CloudOutlined style={{ fontSize: 64, marginBottom: 16, color: '#52c41a' }} /><h3>碳排放核算</h3><p>响应国家"双碳"战略，计算碳足迹和减排潜力</p></div>
            </Card>
          )}
        </Col>
      </Row>
    </AnimatedPage>
  );
}
