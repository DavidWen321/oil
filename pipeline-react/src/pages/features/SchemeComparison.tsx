import { useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Row, Col, Table, Tag, Space, message, Steps } from 'antd';
import { SwapOutlined, PlusOutlined, DeleteOutlined, TrophyOutlined, StarFilled } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ComparisonResult, SchemeAnalysis } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

export default function SchemeComparison() {
  const [loading, setLoading] = useState(false);
  const [schemes, setSchemes] = useState([{ id: 1, name: '方案A' }, { id: 2, name: '方案B' }]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [form] = Form.useForm();

  const addScheme = () => {
    if (schemes.length >= 5) { message.warning('最多支持5个方案'); return; }
    setSchemes([...schemes, { id: Date.now(), name: `方案${String.fromCharCode(65 + schemes.length)}` }]);
  };

  const removeScheme = (id: number) => {
    if (schemes.length <= 2) { message.warning('至少需要2个方案'); return; }
    setSchemes(schemes.filter(s => s.id !== id));
  };

  const onFinish = async () => {
    setLoading(true);
    setTimeout(() => {
      const mockAnalyses: SchemeAnalysis[] = [
        { schemeName: '方案A', totalPower: 2400, dailyEnergyConsumption: 57600, yearlyEnergyConsumption: 21024000, yearlyCost: 13665600, unitEnergyConsumption: 0.18, systemEfficiency: 78.5, safetyMargin: 28.3, yearlyCarbonEmission: 12278, energyScore: 95, costScore: 92, efficiencyScore: 88, safetyScore: 85, environmentScore: 90, overallScore: 90, advantages: ['能耗最低', '成本最优'], disadvantages: ['安全裕度稍低'] },
        { schemeName: '方案B', totalPower: 2800, dailyEnergyConsumption: 67200, yearlyEnergyConsumption: 24528000, yearlyCost: 15943200, unitEnergyConsumption: 0.21, systemEfficiency: 76.2, safetyMargin: 35.5, yearlyCarbonEmission: 14324, energyScore: 82, costScore: 78, efficiencyScore: 82, safetyScore: 95, environmentScore: 78, overallScore: 83, advantages: ['安全裕度高'], disadvantages: ['能耗偏高', '成本较高'] },
        { schemeName: '方案C', totalPower: 2600, dailyEnergyConsumption: 62400, yearlyEnergyConsumption: 22776000, yearlyCost: 14804400, unitEnergyConsumption: 0.195, systemEfficiency: 77.5, safetyMargin: 32.1, yearlyCarbonEmission: 13301, energyScore: 88, costScore: 85, efficiencyScore: 85, safetyScore: 90, environmentScore: 84, overallScore: 86, advantages: ['综合平衡'], disadvantages: ['无明显优势'] },
      ];

      const mockResult: ComparisonResult = {
        comparisonId: 'comp-' + Date.now(),
        comparisonTime: new Date().toISOString(),
        schemeCount: 3,
        schemeAnalyses: mockAnalyses,
        radarChart: { dimensions: ['能耗', '成本', '效率', '安全', '环保'], series: mockAnalyses.map(a => ({ name: a.schemeName, values: [a.energyScore, a.costScore, a.efficiencyScore, a.safetyScore, a.environmentScore] })) },
        barCharts: [{ metricName: '年运行成本', unit: '万元', items: mockAnalyses.map(a => ({ schemeName: a.schemeName, value: a.yearlyCost / 10000, isBest: a.schemeName === '方案A' })) }],
        overallRanking: [
          { rank: 1, schemeName: '方案A', score: 90, comment: '综合表现最优，推荐采用' },
          { rank: 2, schemeName: '方案C', score: 86, comment: '表现均衡，可作为备选' },
          { rank: 3, schemeName: '方案B', score: 83, comment: '安全性好但能耗偏高' },
        ],
        recommendation: { schemeName: '方案A', reasons: ['能耗表现优秀，单位能耗最低', '运行成本最低，经济性最优'], recommendationLevel: 5, expectedBenefit: { yearlySavingEnergy: 3504000, yearlySavingCost: 2277600, yearlyCarbonReduction: 2046 } },
        conclusion: '本次共对比分析了3个运行方案。综合评估结果显示，"方案A"方案表现最优，综合得分90分。建议优先采用推荐方案实施。'
      };
      setResult(mockResult);
      setLoading(false);
      message.success('对比分析完成');
    }, 2000);
  };

  const radarOption = result ? {
    legend: { data: result.radarChart.series.map(s => s.name), bottom: 0 },
    radar: { indicator: result.radarChart.dimensions.map(d => ({ name: d, max: 100 })), radius: '60%' },
    series: [{ type: 'radar', data: result.radarChart.series.map((s) => ({ value: s.values, name: s.name, areaStyle: { opacity: 0.2 }, lineStyle: { width: 2 } })) }]
  } : null;

  const barOption = result ? {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: result.schemeAnalyses.map(a => a.schemeName) },
    yAxis: { type: 'value', name: '万元' },
    series: [{ type: 'bar', data: result.schemeAnalyses.map(a => ({ value: (a.yearlyCost / 10000).toFixed(0), itemStyle: { color: a.overallScore === 90 ? '#52c41a' : '#667eea' } })), label: { show: true, position: 'top' } }]
  } : null;

  const columns = [
    { title: '方案', dataIndex: 'schemeName', render: (v: string, r: SchemeAnalysis) => r.overallScore === 90 ? <><TrophyOutlined style={{ color: '#faad14' }} /> {v}</> : v },
    { title: '总功率(kW)', dataIndex: 'totalPower' },
    { title: '年能耗(万kWh)', dataIndex: 'yearlyEnergyConsumption', render: (v: number) => (v / 10000).toFixed(0) },
    { title: '年成本(万元)', dataIndex: 'yearlyCost', render: (v: number) => (v / 10000).toFixed(0) },
    { title: '系统效率(%)', dataIndex: 'systemEfficiency' },
    { title: '安全裕度(%)', dataIndex: 'safetyMargin' },
    { title: '年碳排放(tCO2)', dataIndex: 'yearlyCarbonEmission' },
    { title: '综合评分', dataIndex: 'overallScore', render: (v: number) => <Tag color={v >= 90 ? 'success' : v >= 80 ? 'blue' : 'orange'}>{v}分</Tag> },
  ];

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><SwapOutlined /> 多方案对比</h2>
        <p>综合对比多个运行方案的能耗、成本、效率、安全性和碳排放</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card title="方案配置" className="page-card" extra={<Button type="link" icon={<PlusOutlined />} onClick={addScheme}>添加方案</Button>}>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              {schemes.map((scheme, idx) => (
                <Card key={scheme.id} size="small" style={{ marginBottom: 12 }} title={<Input defaultValue={scheme.name} variant="borderless" style={{ fontWeight: 600 }} />} extra={schemes.length > 2 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeScheme(scheme.id)} />}>
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label="流量(m³/h)"><InputNumber defaultValue={800 + idx * 50} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label="首站压力(MPa)"><InputNumber defaultValue={6.5} precision={1} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label="运行泵数"><InputNumber defaultValue={3 + idx} min={1} max={6} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={12}><Form.Item label="单泵功率(kW)"><InputNumber defaultValue={800} style={{ width: '100%' }} /></Form.Item></Col>
                  </Row>
                </Card>
              ))}
              <Button type="primary" htmlType="submit" loading={loading} icon={<SwapOutlined />} block size="large">开始对比分析</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 推荐方案 */}
              <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', borderRadius: 12 }}>
                <Row align="middle" gutter={24}>
                  <Col span={4} style={{ textAlign: 'center' }}><TrophyOutlined style={{ fontSize: 48 }} /></Col>
                  <Col span={14}>
                    <h2 style={{ color: '#fff', marginBottom: 8 }}>推荐方案: {result.recommendation.schemeName}</h2>
                    <Space>{[...Array(result.recommendation.recommendationLevel)].map((_, i) => <StarFilled key={i} style={{ color: '#faad14' }} />)}</Space>
                    <div style={{ marginTop: 8 }}>{result.recommendation.reasons.map((r, i) => <Tag key={i} color="gold">{r}</Tag>)}</div>
                  </Col>
                  <Col span={6} style={{ textAlign: 'right' }}>
                    <div>年节约成本</div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{(result.recommendation.expectedBenefit.yearlySavingCost / 10000).toFixed(0)}万元</div>
                  </Col>
                </Row>
              </Card>

              {/* 对比表格 */}
              <Card title="方案指标对比" className="page-card">
                <Table columns={columns} dataSource={result.schemeAnalyses} rowKey="schemeName" pagination={false} />
              </Card>

              <Row gutter={16}>
                {/* 雷达图 */}
                <Col span={12}>
                  <Card title="综合评分雷达图" className="page-card">
                    <ReactECharts option={radarOption!} style={{ height: 300 }} />
                  </Card>
                </Col>
                {/* 成本对比 */}
                <Col span={12}>
                  <Card title="年运行成本对比" className="page-card">
                    <ReactECharts option={barOption!} style={{ height: 300 }} />
                  </Card>
                </Col>
              </Row>

              {/* 排名 */}
              <Card title="综合排名" className="page-card">
                <Steps current={-1} items={result.overallRanking.map((r, idx) => ({ title: <>{idx === 0 && <TrophyOutlined style={{ color: '#faad14', marginRight: 4 }} />}{r.schemeName}</>, description: <><Tag color={idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'default'}>{r.score}分</Tag> {r.comment}</> }))} />
              </Card>
            </Space>
          ) : (
            <Card className="page-card" style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#999' }}><SwapOutlined style={{ fontSize: 64, marginBottom: 16, color: '#667eea' }} /><h3>多方案对比分析</h3><p>配置2-5个运行方案，系统将进行综合对比</p></div>
            </Card>
          )}
        </Col>
      </Row>
    </AnimatedPage>
  );
}
