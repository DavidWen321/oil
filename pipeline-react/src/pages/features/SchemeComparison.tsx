import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SwapOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import { comparisonApi, pipelineApi, projectApi } from '../../api';
import type { ComparisonRequest, ComparisonResult, Pipeline, Project } from '../../types';

interface SchemeEditorValue {
  schemeName: string;
  description?: string;
  flowRate: number;
  inletPressure: number;
  outletPressure?: number;
  oilTemperature?: number;
  oilDensity?: number;
  oilViscosity?: number;
  dailyOperatingHours?: number;
  electricityPrice?: number;
  runningPumpCount?: number;
  pumpPower?: number;
  pumpEfficiency?: number;
  variableFrequency?: boolean;
  frequency?: number;
}

interface ComparisonFormValues {
  projectId: number;
  pipelineId: number;
  comparisonDimensions?: string[];
  schemes: SchemeEditorValue[];
}

const INITIAL_VALUES: ComparisonFormValues = {
  projectId: 0,
  pipelineId: 0,
  comparisonDimensions: ['ENERGY', 'COST', 'EFFICIENCY', 'SAFETY', 'CARBON'],
  schemes: [
    {
      schemeName: '方案A',
      description: '稳态运行方案',
      flowRate: 850,
      inletPressure: 6.5,
      dailyOperatingHours: 24,
      electricityPrice: 0.8,
      oilTemperature: 38,
      oilDensity: 860,
      oilViscosity: 12,
      runningPumpCount: 3,
      pumpPower: 800,
      pumpEfficiency: 82,
      variableFrequency: false,
      frequency: 50,
    },
    {
      schemeName: '方案B',
      description: '节能优化方案',
      flowRate: 820,
      inletPressure: 6.1,
      dailyOperatingHours: 24,
      electricityPrice: 0.8,
      oilTemperature: 38,
      oilDensity: 860,
      oilViscosity: 12,
      runningPumpCount: 2,
      pumpPower: 760,
      pumpEfficiency: 84,
      variableFrequency: true,
      frequency: 46,
    },
  ],
};

const DIMENSION_LABELS: Record<string, string> = {
  ENERGY: '能耗',
  COST: '成本',
  EFFICIENCY: '效率',
  SAFETY: '安全',
  CARBON: '碳排',
};

export default function SchemeComparison() {
  const [form] = Form.useForm<ComparisonFormValues>();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const loadBaseData = useCallback(async () => {
    const [projectRes, dimensionRes] = await Promise.all([
      projectApi.list(),
      comparisonApi.getDimensions(),
    ]);

    const projectList = projectRes.data ?? [];
    const dimensionList = dimensionRes.data ?? [];

    setProjects(projectList);
    setDimensions(dimensionList);

    if (projectList.length > 0) {
      setSelectedProjectId(projectList[0].proId);
      form.setFieldValue('projectId', projectList[0].proId);
    }
    if (dimensionList.length > 0) {
      form.setFieldValue('comparisonDimensions', dimensionList);
    }
  }, [form]);

  const loadPipelines = useCallback(async (projectId: number) => {
    const response = await pipelineApi.listByProject(projectId);
    const pipelineList = response.data ?? [];
    setPipelines(pipelineList);
    if (pipelineList.length > 0) {
      form.setFieldValue('pipelineId', pipelineList[0].id);
    } else {
      form.setFieldValue('pipelineId', undefined);
    }
    setResult(null);
  }, [form]);

  useEffect(() => {
    form.setFieldsValue(INITIAL_VALUES);
    void loadBaseData();
  }, [form, loadBaseData]);

  useEffect(() => {
    if (selectedProjectId) {
      void loadPipelines(selectedProjectId);
    }
  }, [loadPipelines, selectedProjectId]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ComparisonRequest & { comparisonDimensions?: string[] } = {
      projectId: values.projectId ?? selectedProjectId ?? undefined,
      pipelineId: values.pipelineId,
      comparisonDimensions: values.comparisonDimensions,
      schemes: values.schemes.map((scheme) => ({
        schemeName: scheme.schemeName,
        description: scheme.description,
        flowRate: scheme.flowRate,
        inletPressure: scheme.inletPressure,
        outletPressure: scheme.outletPressure,
        oilTemperature: scheme.oilTemperature,
        oilDensity: scheme.oilDensity,
        oilViscosity: scheme.oilViscosity,
        dailyOperatingHours: scheme.dailyOperatingHours,
        electricityPrice: scheme.electricityPrice,
        pumpConfigs: [
          {
            runningPumpCount: scheme.runningPumpCount,
            pumpPower: scheme.pumpPower,
            pumpEfficiency: scheme.pumpEfficiency,
            variableFrequency: scheme.variableFrequency,
            frequency: scheme.frequency,
          },
        ],
      })),
    };

    setLoading(true);
    try {
      const response = await comparisonApi.compare(payload);
      setResult(response.data ?? null);
      message.success('方案对比完成');
    } finally {
      setLoading(false);
    }
  };

  const radarOption = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      legend: { bottom: 0 },
      radar: {
        indicator: result.radarChart.dimensions.map((dimension) => ({ name: dimension, max: 100 })),
      },
      series: [
        {
          type: 'radar',
          data: result.radarChart.series.map((item) => ({
            name: item.name,
            value: item.values,
            areaStyle: { opacity: 0.12 },
          })),
        },
      ],
    };
  }, [result]);

  const barOption = useMemo(() => {
    if (!result || result.barCharts.length === 0) {
      return null;
    }

    const firstChart = result.barCharts[0];
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: firstChart.items.map((item) => item.schemeName),
      },
      yAxis: {
        type: 'value',
        name: firstChart.unit,
      },
      series: [
        {
          type: 'bar',
          data: firstChart.items.map((item) => ({
            value: item.value,
            itemStyle: { color: item.isBest ? '#52c41a' : '#1677ff' },
          })),
        },
      ],
    };
  }, [result]);

  const columns = [
    {
      title: '方案',
      dataIndex: 'schemeName',
      key: 'schemeName',
    },
    {
      title: '年成本(元)',
      dataIndex: 'yearlyCost',
      key: 'yearlyCost',
    },
    {
      title: '年能耗(kWh)',
      dataIndex: 'yearlyEnergyConsumption',
      key: 'yearlyEnergyConsumption',
    },
    {
      title: '系统效率(%)',
      dataIndex: 'systemEfficiency',
      key: 'systemEfficiency',
    },
    {
      title: '安全裕度(%)',
      dataIndex: 'safetyMargin',
      key: 'safetyMargin',
    },
    {
      title: '综合得分',
      dataIndex: 'overallScore',
      key: 'overallScore',
      render: (value: number) => <Tag color={value >= 90 ? 'gold' : 'blue'}>{value}</Tag>,
    },
  ];

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><SwapOutlined /> 多方案对比</h2>
        <p>支持 2~5 套方案的真实后端对比分析，输出综合排名、推荐方案和可视化图表。</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={9}>
          <Card title="方案配置" className="page-card">
            <Form<ComparisonFormValues> form={form} layout="vertical" onFinish={() => void handleSubmit()}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
                    <Select<number>
                      onChange={(value) => {
                        setSelectedProjectId(value);
                        setResult(null);
                      }}
                      options={projects.map((project) => ({ value: project.proId, label: project.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pipelineId" label="管道" rules={[{ required: true, message: '请选择管道' }]}>
                    <Select<number>
                      placeholder="选择管道"
                      onChange={() => setResult(null)}
                      options={pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="comparisonDimensions" label="对比维度">
                <Select mode="multiple" options={dimensions.map((item) => ({ value: item, label: DIMENSION_LABELS[item] ?? item }))} />
              </Form.Item>

              <Form.List name="schemes">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`方案 ${index + 1}`}
                        style={{ marginBottom: 12 }}
                        extra={fields.length > 2 ? (
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                        ) : null}
                      >
                        <Row gutter={12}>
                          <Col span={12}><Form.Item name={[field.name, 'schemeName']} label="方案名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
                          <Col span={12}><Form.Item name={[field.name, 'description']} label="方案描述"><Input /></Form.Item></Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={12}><Form.Item name={[field.name, 'flowRate']} label="流量(m³/h)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col span={12}><Form.Item name={[field.name, 'inletPressure']} label="首站压力(MPa)" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={12}><Form.Item name={[field.name, 'dailyOperatingHours']} label="日运行时长(h)"><InputNumber min={0} precision={1} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col span={12}><Form.Item name={[field.name, 'electricityPrice']} label="电价(元/kWh)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={8}><Form.Item name={[field.name, 'oilTemperature']} label="油温(℃)"><InputNumber precision={1} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col span={8}><Form.Item name={[field.name, 'oilDensity']} label="密度"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col span={8}><Form.Item name={[field.name, 'oilViscosity']} label="粘度"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={8}><Form.Item name={[field.name, 'runningPumpCount']} label="运行泵数"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col span={8}><Form.Item name={[field.name, 'pumpPower']} label="单泵功率(kW)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col span={8}><Form.Item name={[field.name, 'pumpEfficiency']} label="泵效率(%)"><InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={12}><Form.Item name={[field.name, 'variableFrequency']} label="变频运行" valuePropName="checked"><Switch /></Form.Item></Col>
                          <Col span={12}><Form.Item name={[field.name, 'frequency']} label="频率(Hz)"><InputNumber min={0} precision={1} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      block
                      icon={<PlusOutlined />}
                      onClick={() => {
                        if (fields.length >= 5) {
                          message.warning('最多支持 5 套方案');
                          return;
                        }
                        add({
                          schemeName: `方案${String.fromCharCode(65 + fields.length)}`,
                          flowRate: 850,
                          inletPressure: 6,
                          dailyOperatingHours: 24,
                          electricityPrice: 0.8,
                        });
                      }}
                    >
                      添加方案
                    </Button>
                  </>
                )}
              </Form.List>

              <Button type="primary" htmlType="submit" loading={loading} icon={<SwapOutlined />} block style={{ marginTop: 16 }}>
                开始对比
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Card className="page-card" style={{ background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)', color: '#fff' }}>
                <Row align="middle" gutter={24}>
                  <Col span={4} style={{ textAlign: 'center' }}>
                    <TrophyOutlined style={{ fontSize: 48, color: '#ffd666' }} />
                  </Col>
                  <Col span={20}>
                    <h3 style={{ color: '#fff', marginBottom: 8 }}>推荐方案：{result.recommendation.schemeName}</h3>
                    <div style={{ marginBottom: 8 }}>{result.recommendation.reasons.join('；')}</div>
                    <Space wrap>
                      <Tag color="gold">预计节能 {result.recommendation.expectedBenefit.yearlySavingEnergy}</Tag>
                      <Tag color="gold">预计节省成本 {result.recommendation.expectedBenefit.yearlySavingCost}</Tag>
                      <Tag color="gold">预计减碳 {result.recommendation.expectedBenefit.yearlyCarbonReduction}</Tag>
                    </Space>
                  </Col>
                </Row>
              </Card>

              <AlertCard conclusion={result.conclusion} />

              <Card title="方案指标对比" className="page-card">
                <Table columns={columns} dataSource={result.schemeAnalyses} rowKey="schemeName" pagination={false} />
              </Card>

              <Row gutter={16}>
                <Col span={12}>
                  <Card title="综合评分雷达图" className="page-card">
                    {radarOption && <ReactECharts option={radarOption} style={{ height: 320 }} />}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title={result.barCharts[0]?.metricName ?? '关键指标对比'} className="page-card">
                    {barOption && <ReactECharts option={barOption} style={{ height: 320 }} />}
                  </Card>
                </Col>
              </Row>

              <Card title="综合排名" className="page-card">
                <Steps
                  current={-1}
                  items={result.overallRanking.map((item, index) => ({
                    title: `${item.rank}. ${item.schemeName}`,
                    description: `${item.comment}（得分 ${item.score}）`,
                    icon: index === 0 ? <TrophyOutlined style={{ color: '#faad14' }} /> : undefined,
                  }))}
                />
              </Card>
            </Space>
          ) : (
            <Card className="page-card" style={{ minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                <SwapOutlined style={{ fontSize: 56, marginBottom: 16 }} />
                <div>配置至少两套方案并提交后，可获得后端生成的真实对比结果。</div>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </AnimatedPage>
  );
}

function AlertCard({ conclusion }: { conclusion: string }) {
  return (
    <Card className="page-card" title="对比结论">
      <div>{conclusion}</div>
    </Card>
  );
}

