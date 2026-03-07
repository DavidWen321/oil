import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import {
  BellOutlined,
  DashboardOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import { useWebSocket } from '../../hooks/useWebSocket';
import { monitorApi, pipelineApi, projectApi } from '../../api';
import type { AlarmMessage, AlarmRule, MonitorDataPoint, Pipeline, Project } from '../../types';

const SCENARIO_OPTIONS = [
  { value: 'NORMAL', label: '正常工况' },
  { value: 'PRESSURE_HIGH', label: '高压预警' },
  { value: 'LEAKAGE', label: '泄漏疑似' },
  { value: 'PUMP_FAULT', label: '泵站异常' },
];

function levelColor(level?: string) {
  if (!level) {
    return 'default';
  }
  if (level.includes('EMERGENCY') || level.includes('CRITICAL')) {
    return 'error';
  }
  if (level.includes('WARNING')) {
    return 'warning';
  }
  return 'processing';
}

function dedupeHistory(history: MonitorDataPoint[], incoming: MonitorDataPoint) {
  const next = [...history, incoming];
  const deduped = next.filter((item, index, array) => {
    const firstIndex = array.findIndex((current) => current.timestamp === item.timestamp);
    return firstIndex === index;
  });
  return deduped.slice(-20);
}

function reconcileAlarm(list: AlarmMessage[], alarm: AlarmMessage) {
  const next = list.filter((item) => item.alarmId !== alarm.alarmId);
  if (alarm.status !== 'RESOLVED') {
    next.unshift(alarm);
  }
  return next.sort(
    (left, right) => new Date(right.alarmTime).getTime() - new Date(left.alarmTime).getTime(),
  );
}

export default function RealtimeMonitor() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [rules, setRules] = useState<AlarmRule[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentData, setCurrentData] = useState<MonitorDataPoint | null>(null);
  const [history, setHistory] = useState<MonitorDataPoint[]>([]);
  const [alarms, setAlarms] = useState<AlarmMessage[]>([]);
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmMessage | null>(null);

  const applyDataPoint = useCallback((data: MonitorDataPoint) => {
    setCurrentData(data);
    setHistory((prev) => dedupeHistory(prev, data));
  }, []);

  const applyAlarm = useCallback((alarm: AlarmMessage) => {
    setAlarms((prev) => reconcileAlarm(prev, alarm));
  }, []);

  const { connected } = useWebSocket({
    pipelineId: selectedPipelineId,
    scope: 'pipeline',
    subscribeMonitor: selectedPipelineId != null,
    subscribeAlarms: selectedPipelineId != null,
    onMonitorData: (data) => {
      if (selectedPipelineId == null || data.pipelineId !== selectedPipelineId) {
        return;
      }
      applyDataPoint(data);
    },
    onAlarm: (alarm) => {
      if (selectedPipelineId == null || alarm.pipelineId !== selectedPipelineId) {
        return;
      }
      applyAlarm(alarm);
    },
    onAlarmUpdate: (alarm) => {
      if (selectedPipelineId == null || alarm.pipelineId !== selectedPipelineId) {
        return;
      }
      applyAlarm(alarm);
    },
  });

  const loadBaseData = async () => {
    const [projectRes, ruleRes] = await Promise.all([
      projectApi.list(),
      monitorApi.getAlarmRules(),
    ]);

    const projectList = projectRes.data ?? [];
    setProjects(projectList);
    setRules(ruleRes.data ?? []);

    if (projectList.length > 0) {
      setSelectedProjectId(projectList[0].proId);
    }
  };

  const loadPipelines = async (projectId: number) => {
    const response = await pipelineApi.listByProject(projectId);
    const pipelineList = response.data ?? [];
    setPipelines(pipelineList);
    setSelectedPipelineId(pipelineList.length > 0 ? pipelineList[0].id : null);
    setCurrentData(null);
    setHistory([]);
    setAlarms([]);
  };

  const fetchSnapshot = async (pipelineId: number) => {
    const [dataRes, alarmRes] = await Promise.all([
      monitorApi.getCurrentData(pipelineId).catch(() => null),
      monitorApi.getActiveAlarms(pipelineId).catch(() => null),
    ]);

    const nextData = dataRes?.data ?? null;
    const nextAlarms = alarmRes?.data ?? [];

    setCurrentData(nextData);
    if (nextData) {
      setHistory((prev) => dedupeHistory(prev, nextData));
    }
    setAlarms(nextAlarms);
  };

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void loadPipelines(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedPipelineId) {
      void fetchSnapshot(selectedPipelineId);
    }
  }, [selectedPipelineId]);

  useEffect(() => {
    if (!running || !selectedPipelineId || connected) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void fetchSnapshot(selectedPipelineId);
    }, intervalSeconds * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [connected, intervalSeconds, running, selectedPipelineId]);

  useEffect(() => {
    return () => {
      if (running && selectedPipelineId) {
        void monitorApi.stopSimulation(selectedPipelineId);
      }
    };
  }, [running, selectedPipelineId]);

  const handleStart = async () => {
    if (!selectedPipelineId) {
      message.warning('请先选择管道');
      return;
    }

    setLoading(true);
    try {
      await monitorApi.startSimulation(selectedPipelineId, intervalSeconds * 1000);
      setRunning(true);
      window.setTimeout(() => {
        void fetchSnapshot(selectedPipelineId);
      }, 600);
      message.success(connected ? '监控推送已启动' : '监控模拟已启动，当前使用接口兜底刷新');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!selectedPipelineId) {
      return;
    }

    setLoading(true);
    try {
      await monitorApi.stopSimulation(selectedPipelineId);
      setRunning(false);
      message.success('监控模拟已停止');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedPipelineId) {
      message.warning('请先选择管道');
      return;
    }

    setLoading(true);
    try {
      await fetchSnapshot(selectedPipelineId);
      message.success('监控数据已刷新');
    } finally {
      setLoading(false);
    }
  };

  const handleInjectScenario = async (scenario: string) => {
    if (!selectedPipelineId) {
      message.warning('请先选择管道');
      return;
    }

    setLoading(true);
    try {
      const response = await monitorApi.simulateData(selectedPipelineId, scenario);
      if (response.data) {
        await monitorApi.receiveData(response.data);
      }
      if (!connected) {
        await fetchSnapshot(selectedPipelineId);
      }
      message.success('场景数据已注入');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alarmId: string) => {
    await monitorApi.acknowledgeAlarm(alarmId, 'web-user');
    if (!connected && selectedPipelineId) {
      await fetchSnapshot(selectedPipelineId);
    }
    message.success('告警已确认');
  };

  const handleResolve = async (alarmId: string) => {
    await monitorApi.resolveAlarm(alarmId);
    setAlarms((prev) => prev.filter((item) => item.alarmId !== alarmId));
    if (!connected && selectedPipelineId) {
      await fetchSnapshot(selectedPipelineId);
    }
    message.success('告警已处置');
  };

  const pressureOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['首站压力', '末站压力'] },
    xAxis: {
      type: 'category',
      data: history.map((item) => new Date(item.timestamp).toLocaleTimeString()),
    },
    yAxis: {
      type: 'value',
      name: 'MPa',
    },
    series: [
      {
        name: '首站压力',
        type: 'line',
        smooth: true,
        data: history.map((item) => item.inletPressure),
      },
      {
        name: '末站压力',
        type: 'line',
        smooth: true,
        data: history.map((item) => item.outletPressure),
      },
    ],
  }), [history]);

  const energyOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['入口流量', '实时功率'] },
    xAxis: {
      type: 'category',
      data: history.map((item) => new Date(item.timestamp).toLocaleTimeString()),
    },
    yAxis: [
      {
        type: 'value',
        name: 'm³/h',
      },
      {
        type: 'value',
        name: 'kW',
      },
    ],
    series: [
      {
        name: '入口流量',
        type: 'bar',
        data: history.map((item) => item.inletFlowRate),
      },
      {
        name: '实时功率',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: history.map((item) => item.realTimePower),
      },
    ],
  }), [history]);

  const alarmColumns = [
    {
      title: '时间',
      dataIndex: 'alarmTime',
      key: 'alarmTime',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '级别',
      dataIndex: 'alarmLevel',
      key: 'alarmLevel',
      render: (value: string) => <Tag color={levelColor(value)}>{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={value === 'ACTIVE' ? 'red' : 'blue'}>{value}</Tag>,
    },
    {
      title: '告警标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '指标',
      dataIndex: 'metricName',
      key: 'metricName',
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AlarmMessage) => (
        <Space>
          <Button size="small" onClick={() => setSelectedAlarm(record)}>详情</Button>
          <Button size="small" disabled={record.status !== 'ACTIVE'} onClick={() => void handleAcknowledge(record.alarmId)}>确认</Button>
          <Button size="small" type="primary" disabled={record.status === 'RESOLVED'} onClick={() => void handleResolve(record.alarmId)}>处置</Button>
        </Space>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><DashboardOutlined /> 实时监控</h2>
        <p>已升级为 WebSocket 推送优先、接口兜底的实时监控链路，支持异常场景注入与告警处置。</p>
      </div>

      <Card className="page-card" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} md={6}>
            <Select<number>
              style={{ width: '100%' }}
              value={selectedProjectId ?? undefined}
              placeholder="选择项目"
              onChange={setSelectedProjectId}
              options={projects.map((project) => ({ value: project.proId, label: project.name }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select<number>
              style={{ width: '100%' }}
              value={selectedPipelineId ?? undefined}
              placeholder="选择管道"
              onChange={setSelectedPipelineId}
              options={pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <InputNumber
              min={2}
              max={60}
              value={intervalSeconds}
              onChange={(value) => setIntervalSeconds(value ?? 5)}
              style={{ width: '100%' }}
              addonAfter="秒"
            />
          </Col>
          <Col xs={24} md={8}>
            <Space wrap>
              <Button type="primary" loading={loading} icon={<PlayCircleOutlined />} onClick={() => void handleStart()}>
                启动模拟
              </Button>
              <Button loading={loading} icon={<PauseCircleOutlined />} onClick={() => void handleStop()}>
                停止模拟
              </Button>
              <Button loading={loading} icon={<ReloadOutlined />} onClick={() => void handleRefresh()}>
                手动刷新
              </Button>
            </Space>
          </Col>
        </Row>
        <div style={{ marginTop: 12 }}>
          <Space wrap>
            <Tag color={running ? 'success' : 'default'}>{running ? '模拟运行中' : '模拟未启动'}</Tag>
            <Tag color={connected ? 'success' : 'warning'}>{connected ? 'WebSocket 已连接' : 'WebSocket 未连接，使用轮询兜底'}</Tag>
            <Tag color="blue">启用规则 {rules.filter((item) => item.enabled).length} 条</Tag>
            {SCENARIO_OPTIONS.map((item) => (
              <Button key={item.value} size="small" onClick={() => void handleInjectScenario(item.value)}>
                注入{item.label}
              </Button>
            ))}
          </Space>
        </div>
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Card className="page-card"><Statistic title="系统健康度" value={currentData?.healthScore ?? 0} suffix="分" /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="page-card"><Statistic title="实时功率" value={currentData?.realTimePower ?? 0} suffix="kW" /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="page-card"><Statistic title="单位能耗" value={currentData?.unitEnergy ?? 0} suffix="kWh/t·km" precision={4} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="page-card"><Statistic title="活动告警数" value={alarms.filter((item) => item.status === 'ACTIVE').length} suffix="条" /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="压力趋势" className="page-card">
            <ReactECharts option={pressureOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="流量与功率" className="page-card">
            <ReactECharts option={energyOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="当前工况" className="page-card">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="管道名称">{currentData?.pipelineName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="首站压力">{currentData?.inletPressure ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="末站压力">{currentData?.outletPressure ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="入口流量">{currentData?.inletFlowRate ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="出口流量">{currentData?.outletFlowRate ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="系统状态">
                <Tag color={levelColor(currentData?.systemStatus)}>{currentData?.systemStatus ?? 'NO_DATA'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最近时间">{currentData?.timestamp ? new Date(currentData.timestamp).toLocaleString() : '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title={<><BellOutlined /> 告警中心</>}
            className="page-card"
            extra={<Tag color={alarms.some((item) => item.status === 'ACTIVE') ? 'error' : 'success'}>{alarms.some((item) => item.status === 'ACTIVE') ? '存在活动告警' : '当前告警正常'}</Tag>}
          >
            <Table
              columns={alarmColumns}
              dataSource={alarms}
              rowKey="alarmId"
              pagination={{ pageSize: 5 }}
              size="small"
              locale={{ emptyText: '当前没有活动告警' }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={<><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />告警详情</>}
        open={Boolean(selectedAlarm)}
        onCancel={() => setSelectedAlarm(null)}
        footer={selectedAlarm ? [
          <Button key="close" onClick={() => setSelectedAlarm(null)}>关闭</Button>,
          <Button key="ack" disabled={selectedAlarm.status !== 'ACTIVE'} onClick={() => void handleAcknowledge(selectedAlarm.alarmId)}>确认告警</Button>,
          <Button key="resolve" type="primary" disabled={selectedAlarm.status === 'RESOLVED'} onClick={() => void handleResolve(selectedAlarm.alarmId)}>标记处置</Button>,
        ] : null}
      >
        {selectedAlarm ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="告警标题">{selectedAlarm.title}</Descriptions.Item>
            <Descriptions.Item label="告警级别">
              <Tag color={levelColor(selectedAlarm.alarmLevel)}>{selectedAlarm.alarmLevel}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警状态">{selectedAlarm.status}</Descriptions.Item>
            <Descriptions.Item label="告警类型">{selectedAlarm.alarmType}</Descriptions.Item>
            <Descriptions.Item label="告警描述">{selectedAlarm.description}</Descriptions.Item>
            <Descriptions.Item label="当前值">{selectedAlarm.currentValue}</Descriptions.Item>
            <Descriptions.Item label="阈值">{selectedAlarm.threshold}</Descriptions.Item>
            <Descriptions.Item label="偏离率">{selectedAlarm.deviationPercent}%</Descriptions.Item>
            <Descriptions.Item label="处理建议">{selectedAlarm.suggestion}</Descriptions.Item>
            <Descriptions.Item label="发生时间">{new Date(selectedAlarm.alarmTime).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </AnimatedPage>
  );
}

