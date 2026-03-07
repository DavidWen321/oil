import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Form,
  InputNumber,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MedicineBoxOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { diagnosisApi, pipelineApi, projectApi, pumpStationApi } from '../../api';
import type {
  DiagnosisRequest,
  DiagnosisResult,
  Pipeline,
  Project,
  PumpStation,
} from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

type DiagnosisFormValues = DiagnosisRequest & {
  pumpStationId?: number;
  runningPumpCount?: number;
  actualEfficiency?: number;
  ratedEfficiency?: number;
  vibrationValue?: number;
  vibrationThreshold?: number;
};

const INITIAL_VALUES: DiagnosisFormValues = {
  pipelineId: 0,
  inletPressure: 6.5,
  outletPressure: 0.8,
  maxDesignPressure: 7.5,
  minDesignPressure: 0.3,
  inletFlowRate: 850,
  outletFlowRate: 845,
  designFlowRate: 850,
  temperature: 38,
  actualFrictionLoss: 4.6,
  theoreticalFrictionLoss: 4.2,
  actualUnitEnergy: 0.17,
  standardUnitEnergy: 0.15,
  runningPumpCount: 3,
  actualEfficiency: 78,
  ratedEfficiency: 82,
  vibrationValue: 2.6,
  vibrationThreshold: 3.2,
};

function getHealthLevelMeta(level?: string) {
  switch (level) {
    case 'EXCELLENT':
      return { label: '优秀', color: 'success' as const };
    case 'GOOD':
      return { label: '良好', color: 'processing' as const };
    case 'WARNING':
      return { label: '预警', color: 'warning' as const };
    case 'CRITICAL':
      return { label: '危险', color: 'error' as const };
    default:
      return { label: level ?? '未知', color: 'default' as const };
  }
}

function getSeverityIcon(severity?: string) {
  if (severity === 'critical' || severity === 'CRITICAL') {
    return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
  }
  if (severity === 'warning' || severity === 'WARNING') {
    return <WarningOutlined style={{ color: '#faad14' }} />;
  }
  return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
}

export default function FaultDiagnosis() {
  const [form] = Form.useForm<DiagnosisFormValues>();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stations, setStations] = useState<PumpStation[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const loadBaseData = async () => {
    const [projectRes, stationRes] = await Promise.all([
      projectApi.list(),
      pumpStationApi.list(),
    ]);

    const projectList = projectRes.data ?? [];
    setProjects(projectList);
    setStations(stationRes.data ?? []);

    if (projectList.length > 0) {
      setSelectedProjectId(projectList[0].proId);
    }
  };

  const loadPipelines = async (projectId: number) => {
    const response = await pipelineApi.listByProject(projectId);
    const pipelineList = response.data ?? [];
    setPipelines(pipelineList);
    if (pipelineList.length > 0) {
      form.setFieldValue('pipelineId', pipelineList[0].id);
    }
  };

  useEffect(() => {
    form.setFieldsValue(INITIAL_VALUES);
    void loadBaseData();
  }, [form]);

  useEffect(() => {
    if (selectedProjectId) {
      form.setFieldValue('projectId', selectedProjectId);
      void loadPipelines(selectedProjectId);
    }
  }, [form, selectedProjectId]);

  const handlePipelineChange = (pipelineId: number) => {
    const pipeline = pipelines.find((item) => item.id === pipelineId);
    if (!pipeline) {
      return;
    }

    form.setFieldsValue({
      pipelineId,
      designFlowRate: pipeline.throughput,
    });
  };

  const buildPayload = async (): Promise<DiagnosisRequest> => {
    const values = await form.validateFields();
    const station = stations.find((item) => item.id === values.pumpStationId);

    return {
      pipelineId: values.pipelineId,
      projectId: values.projectId,
      inletPressure: values.inletPressure,
      outletPressure: values.outletPressure,
      maxDesignPressure: values.maxDesignPressure,
      minDesignPressure: values.minDesignPressure,
      inletFlowRate: values.inletFlowRate,
      outletFlowRate: values.outletFlowRate,
      designFlowRate: values.designFlowRate,
      temperature: values.temperature,
      actualFrictionLoss: values.actualFrictionLoss,
      theoreticalFrictionLoss: values.theoreticalFrictionLoss,
      actualUnitEnergy: values.actualUnitEnergy,
      standardUnitEnergy: values.standardUnitEnergy,
      pumpDataList: values.pumpStationId ? [
        {
          pumpStationId: values.pumpStationId,
          pumpName: station?.name,
          runningPumpCount: values.runningPumpCount,
          actualEfficiency: values.actualEfficiency,
          ratedEfficiency: values.ratedEfficiency,
          vibrationValue: values.vibrationValue,
          vibrationThreshold: values.vibrationThreshold,
        },
      ] : undefined,
    };
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const payload = await buildPayload();
      const response = await diagnosisApi.analyze(payload);
      setResult(response.data ?? null);
      message.success('故障诊断完成');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCheck = async () => {
    setLoading(true);
    try {
      const payload = await buildPayload();
      const response = await diagnosisApi.quickCheck(payload);
      message.info(`当前健康评分：${response.data ?? 0} 分`);
    } finally {
      setLoading(false);
    }
  };

  const radarOption = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      radar: {
        indicator: [
          { name: '压力', max: 100 },
          { name: '流量', max: 100 },
          { name: '泵站', max: 100 },
          { name: '能效', max: 100 },
        ],
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [
                result.metrics.pressureScore,
                result.metrics.flowScore,
                result.metrics.pumpScore,
                result.metrics.energyScore,
              ],
              areaStyle: { color: 'rgba(24, 144, 255, 0.2)' },
            },
          ],
        },
      ],
    };
  }, [result]);

  const healthMeta = getHealthLevelMeta(result?.healthLevel);

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><MedicineBoxOutlined /> 智能故障诊断</h2>
        <p>基于真实诊断接口输出健康评分、故障列表、优先动作和风险预测。</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={9}>
          <Card title="诊断输入" className="page-card">
            <Form<DiagnosisFormValues> form={form} layout="vertical" onFinish={() => void handleAnalyze()}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="所属项目">
                    <Select<number>
                      value={selectedProjectId ?? undefined}
                      placeholder="选择项目"
                      onChange={setSelectedProjectId}
                      options={projects.map((project) => ({ value: project.proId, label: project.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pipelineId" label="诊断管道" rules={[{ required: true, message: '请选择管道' }]}>
                    <Select<number>
                      placeholder="选择管道"
                      onChange={handlePipelineChange}
                      options={pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}><Form.Item name="inletPressure" label="首站压力(MPa)" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="outletPressure" label="末站压力(MPa)" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="inletFlowRate" label="入口流量(m³/h)" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="outletFlowRate" label="出口流量(m³/h)" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="maxDesignPressure" label="最大设计压力"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="minDesignPressure" label="最小设计压力"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="designFlowRate" label="设计流量"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="temperature" label="油温(℃)"><InputNumber precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="actualFrictionLoss" label="实际摩阻损失"><InputNumber min={0} precision={3} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="theoreticalFrictionLoss" label="理论摩阻损失"><InputNumber min={0} precision={3} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item name="actualUnitEnergy" label="实际单位能耗"><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="standardUnitEnergy" label="标准单位能耗"><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>

              <Card size="small" title="可选泵站数据" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="pumpStationId" label="泵站"><Select<number> allowClear placeholder="选择泵站" options={stations.map((station) => ({ value: station.id, label: station.name }))} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="runningPumpCount" label="运行泵数"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="actualEfficiency" label="实际效率(%)"><InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="ratedEfficiency" label="额定效率(%)"><InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="vibrationValue" label="振动值(mm/s)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="vibrationThreshold" label="振动阈值(mm/s)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
              </Card>

              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button loading={loading} onClick={() => void handleQuickCheck()}>快速体检</Button>
                <Button type="primary" htmlType="submit" loading={loading}>开始诊断</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Card className="page-card">
                <Row gutter={24} align="middle">
                  <Col span={8} style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={result.healthScore}
                      strokeColor={result.healthScore >= 80 ? '#52c41a' : result.healthScore >= 60 ? '#faad14' : '#ff4d4f'}
                    />
                    <div style={{ marginTop: 12 }}>
                      <Tag color={healthMeta.color}>{healthMeta.label}</Tag>
                    </div>
                  </Col>
                  <Col span={16}>
                    {radarOption && <ReactECharts option={radarOption} style={{ height: 220 }} />}
                  </Col>
                </Row>
              </Card>

              <Alert
                message="诊断结论"
                description={result.conclusion}
                type={healthMeta.color === 'error' ? 'error' : healthMeta.color === 'warning' ? 'warning' : 'success'}
                showIcon
              />

              <Card title="优先处理动作" className="page-card">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {result.priorityActions.map((item, index) => (
                    <Tag key={`${item}-${index}`} color={index === 0 ? 'red' : 'orange'} style={{ padding: '6px 10px' }}>
                      {index + 1}. {item}
                    </Tag>
                  ))}
                </Space>
              </Card>

              <Card title={`故障详情 (${result.faults.length})`} className="page-card">
                <Collapse
                  accordion
                  items={result.faults.map((fault, index) => ({
                    key: `${fault.faultCode}-${index}`,
                    label: (
                      <Space>
                        {getSeverityIcon(fault.severity)}
                        <span>{fault.faultName}</span>
                        <Tag color={fault.severity === 'critical' || fault.severity === 'CRITICAL' ? 'red' : 'orange'}>
                          {fault.severity}
                        </Tag>
                      </Space>
                    ),
                    children: (
                      <div>
                        <Descriptions bordered size="small" column={2}>
                          <Descriptions.Item label="故障代码">{fault.faultCode}</Descriptions.Item>
                          <Descriptions.Item label="置信度">{fault.confidence}%</Descriptions.Item>
                          <Descriptions.Item label="检测值">{fault.detectedValue}</Descriptions.Item>
                          <Descriptions.Item label="正常范围">{fault.normalRange}</Descriptions.Item>
                          <Descriptions.Item label="偏差程度">{fault.deviationPercent}%</Descriptions.Item>
                          <Descriptions.Item label="描述" span={2}>{fault.description}</Descriptions.Item>
                        </Descriptions>
                        <div style={{ marginTop: 12 }}>
                          <strong>可能原因</strong>
                          <ul>
                            {fault.possibleCauses.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong>建议措施</strong>
                          <ul>
                            {fault.recommendations.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      </div>
                    ),
                  }))}
                />
              </Card>

              {result.riskPredictions.length > 0 && (
                <Card title="风险预测" className="page-card">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {result.riskPredictions.map((risk) => (
                      <Alert
                        key={risk.riskType}
                        type="warning"
                        showIcon
                        message={`${risk.riskType} · 概率 ${risk.probability}% · 影响 ${risk.impactLevel}`}
                        description={risk.riskDescription}
                      />
                    ))}
                  </Space>
                </Card>
              )}
            </Space>
          ) : (
            <Card className="page-card" style={{ minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                <MedicineBoxOutlined style={{ fontSize: 56, marginBottom: 16 }} />
                <div>填写运行数据后，即可调用后端故障诊断服务输出真实结果。</div>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </AnimatedPage>
  );
}
