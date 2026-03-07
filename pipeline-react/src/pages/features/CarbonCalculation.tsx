import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import { CloudOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs, { type Dayjs } from 'dayjs';
import AnimatedPage from '../../components/common/AnimatedPage';
import { carbonApi, pipelineApi, projectApi } from '../../api';
import type {
  CarbonCalculationRequest,
  CarbonCalculationResult,
  Pipeline,
  Project,
} from '../../types';

const { RangePicker } = DatePicker;

interface CarbonFormValues extends Omit<CarbonCalculationRequest, 'startDate' | 'endDate'> {
  dateRange: [Dayjs, Dayjs];
}

const INITIAL_VALUES: CarbonFormValues = {
  projectId: 0,
  dateRange: [dayjs().subtract(30, 'day'), dayjs()],
  periodType: 'MONTH',
  electricityConsumption: 2150000,
  gridType: 'EAST',
  useGreenPower: false,
  greenPowerRatio: 0,
  naturalGasConsumption: 18500,
  dieselConsumption: 3600,
  oilThroughput: 320000,
  volatileRate: 0.5,
  vaporRecoveryRate: 96,
  greenAreaSize: 15000,
  solarGeneration: 60000,
  pipelineLength: 150,
  pumpStationCount: 4,
};

const GRID_LABELS: Record<string, string> = {
  NORTH: '华北电网',
  EAST: '华东电网',
  SOUTH: '华南电网',
  CENTRAL: '华中电网',
  NORTHWEST: '西北电网',
  NORTHEAST: '东北电网',
};

export default function CarbonCalculation() {
  const [form] = Form.useForm<CarbonFormValues>();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [emissionFactors, setEmissionFactors] = useState<Record<string, number>>({});
  const [industryAverage, setIndustryAverage] = useState<number | null>(null);
  const [result, setResult] = useState<CarbonCalculationResult | null>(null);

  const loadBaseData = async () => {
    const [projectRes, factorsRes, averageRes] = await Promise.all([
      projectApi.list(),
      carbonApi.getEmissionFactors(),
      carbonApi.getIndustryAverage(),
    ]);

    const projectList = projectRes.data ?? [];
    setProjects(projectList);
    setEmissionFactors(factorsRes.data ?? {});
    setIndustryAverage(averageRes.data ?? null);

    if (projectList.length > 0) {
      setSelectedProjectId(projectList[0].proId);
      form.setFieldValue('projectId', projectList[0].proId);
    }
  };

  const loadPipelines = async (projectId: number) => {
    const response = await pipelineApi.listByProject(projectId);
    const pipelineList = response.data ?? [];
    setPipelines(pipelineList);
    if (pipelineList.length > 0) {
      form.setFieldValue('pipelineId', pipelineList[0].id);
      form.setFieldValue('pipelineLength', pipelineList[0].length);
    }
  };

  useEffect(() => {
    form.setFieldsValue(INITIAL_VALUES);
    void loadBaseData();
  }, [form]);

  useEffect(() => {
    if (selectedProjectId) {
      void loadPipelines(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: CarbonCalculationRequest = {
      ...values,
      startDate: values.dateRange[0].format('YYYY-MM-DD'),
      endDate: values.dateRange[1].format('YYYY-MM-DD'),
    };
    delete (payload as CarbonCalculationRequest & { dateRange?: [Dayjs, Dayjs] }).dateRange;

    setLoading(true);
    try {
      const response = await carbonApi.calculate(payload);
      setResult(response.data ?? null);
      message.success('碳排放核算完成');
    } finally {
      setLoading(false);
    }
  };

  const pieOption = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['45%', '72%'],
          data: result.emissionShares.map((item) => ({ value: item.value, name: item.name })),
        },
      ],
    };
  }, [result]);

  const scopeOption = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['范围一', '范围二', '范围三', '碳汇抵消'],
      },
      yAxis: {
        type: 'value',
        name: 'tCO2e',
      },
      series: [
        {
          type: 'bar',
          data: [
            result.scope1Emission,
            result.scope2Emission,
            result.scope3Emission,
            -result.carbonSink,
          ],
        },
      ],
    };
  }, [result]);

  const suggestionColumns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (value: number) => <Tag color={value === 1 ? 'red' : value === 2 ? 'orange' : 'blue'}>{value}</Tag>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
    },
    {
      title: '预期减排(tCO2e)',
      dataIndex: 'expectedReduction',
      key: 'expectedReduction',
    },
    {
      title: '投资成本(万元)',
      dataIndex: 'investmentCost',
      key: 'investmentCost',
    },
  ];

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><CloudOutlined /> 碳排放核算</h2>
        <p>基于真实碳核算接口、区域电网因子和行业均值对项目碳排放进行量化分析。</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={9}>
          <Card title="核算参数" className="page-card">
            <Form<CarbonFormValues> form={form} layout="vertical" onFinish={() => void handleSubmit()}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="所属项目">
                    <Select<number>
                      value={selectedProjectId ?? undefined}
                      onChange={(value) => {
                        setSelectedProjectId(value);
                        form.setFieldValue('projectId', value);
                      }}
                      options={projects.map((project) => ({ value: project.proId, label: project.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pipelineId" label="关联管道">
                    <Select<number>
                      allowClear
                      placeholder="选择管道"
                      options={pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="dateRange" label="核算周期" rules={[{ required: true, message: '请选择核算周期' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}><Form.Item name="electricityConsumption" label="用电量(kWh)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="gridType" label="电网类型"><Select options={Object.entries(GRID_LABELS).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="naturalGasConsumption" label="天然气(m³)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="dieselConsumption" label="柴油(L)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="oilThroughput" label="原油输量(吨)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="pipelineLength" label="管道长度(km)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="greenAreaSize" label="绿化面积(m²)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="solarGeneration" label="光伏发电(kWh)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="vaporRecoveryRate" label="油气回收率(%)"><InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="pumpStationCount" label="泵站数量"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="useGreenPower" label="使用绿电" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={12}><Form.Item name="greenPowerRatio" label="绿电比例(%)"><InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>

              <Button type="primary" htmlType="submit" loading={loading} block>
                开始核算
              </Button>
            </Form>

            <div style={{ marginTop: 16 }}>
              <Space wrap>
                {Object.entries(emissionFactors).map(([key, value]) => (
                  <Tag key={key}>{GRID_LABELS[key] ?? key}: {value}</Tag>
                ))}
              </Space>
              <div style={{ marginTop: 12, color: '#8c8c8c' }}>
                行业平均碳排强度：{industryAverage ?? '-'} kgCO2e/t·km
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Row gutter={16}>
                <Col span={6}><Card className="page-card"><Statistic title="总排放" value={result.totalEmission} suffix="tCO2e" /></Card></Col>
                <Col span={6}><Card className="page-card"><Statistic title="净排放" value={result.netEmission} suffix="tCO2e" /></Card></Col>
                <Col span={6}><Card className="page-card"><Statistic title="吨公里排放" value={result.emissionPerTonKm} suffix="kgCO2e/t·km" precision={4} /></Card></Col>
                <Col span={6}><Card className="page-card"><Statistic title="碳绩效评分" value={result.carbonScore} suffix="分" /></Card></Col>
              </Row>

              <Card className="page-card" title="核算结论">
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="排放等级">
                    <Tag color={result.emissionLevel === 'A' ? 'success' : result.emissionLevel === 'B' ? 'processing' : 'warning'}>
                      {result.emissionLevel}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="碳汇抵消">{result.carbonSink}</Descriptions.Item>
                  <Descriptions.Item label="范围一排放">{result.scope1Emission}</Descriptions.Item>
                  <Descriptions.Item label="范围二排放">{result.scope2Emission}</Descriptions.Item>
                  <Descriptions.Item label="范围三排放">{result.scope3Emission}</Descriptions.Item>
                  <Descriptions.Item label="吨排放强度">{result.emissionPerTon}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Row gutter={16}>
                <Col span={12}>
                  <Card title="排放来源构成" className="page-card">
                    {pieOption && <ReactECharts option={pieOption} style={{ height: 300 }} />}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="范围排放对比" className="page-card">
                    {scopeOption && <ReactECharts option={scopeOption} style={{ height: 300 }} />}
                  </Card>
                </Col>
              </Row>

              {result.carbonQuota && (
                <Card title="碳配额分析" className="page-card">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="年度配额">{result.carbonQuota.annualQuota}</Descriptions.Item>
                    <Descriptions.Item label="已使用">{result.carbonQuota.usedQuota}</Descriptions.Item>
                    <Descriptions.Item label="剩余/缺口">{result.carbonQuota.remainingQuota}</Descriptions.Item>
                    <Descriptions.Item label="使用率">{result.carbonQuota.usageRate}%</Descriptions.Item>
                    <Descriptions.Item label="碳价">{result.carbonQuota.carbonPrice}</Descriptions.Item>
                    <Descriptions.Item label="预计交易金额">{result.carbonQuota.projectedTradingAmount}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Card title="减排建议" className="page-card">
                <Table columns={suggestionColumns} dataSource={result.reductionSuggestions} rowKey="seq" pagination={false} size="small" />
              </Card>
            </Space>
          ) : (
            <Card className="page-card" style={{ minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                <CloudOutlined style={{ fontSize: 56, marginBottom: 16 }} />
                <div>填写能耗与生产数据后，即可调用后端碳核算服务生成真实结果。</div>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </AnimatedPage>
  );
}
