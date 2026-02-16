import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Tag, Button, Space, Alert, Badge, Statistic, Switch, Slider, message, Modal, Descriptions, Timeline } from 'antd';
import { DashboardOutlined, BellOutlined, WarningOutlined, CheckCircleOutlined, SyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useMonitorStore } from '../../stores/monitorStore';
import type { MonitorData, AlarmInfo } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

export default function RealtimeMonitor() {
  const { data, alarms, connected, setData, addAlarm, clearAlarms } = useMonitorStore();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmInfo | null>(null);
  const [historyData, setHistoryData] = useState<{ time: string; pressure: number; flow: number; power: number }[]>([]);

  // 模拟实时数据更新
  const generateMockData = useCallback(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    const newData: MonitorData = {
      pipelineId: 1,
      timestamp: now.toISOString(),
      inletPressure: 6.2 + Math.random() * 0.8,
      outletPressure: 0.7 + Math.random() * 0.3,
      flowRate: 820 + Math.random() * 60,
      oilTemperature: 45 + Math.random() * 10,
      pumpStatus: [
        { pumpId: 1, name: 'ZMI480-1', running: true, current: 85 + Math.random() * 10, frequency: 50, vibration: 2.5 + Math.random() },
        { pumpId: 2, name: 'ZMI480-2', running: true, current: 82 + Math.random() * 10, frequency: 50, vibration: 2.3 + Math.random() },
        { pumpId: 3, name: 'ZMI480-3', running: Math.random() > 0.3, current: Math.random() > 0.3 ? 78 + Math.random() * 10 : 0, frequency: 50, vibration: 2.1 + Math.random() },
        { pumpId: 4, name: 'ZMI375-1', running: false, current: 0, frequency: 0, vibration: 0 },
      ],
      energyConsumption: 2350 + Math.random() * 200,
      systemEfficiency: 76 + Math.random() * 8,
    };

    setData(newData);

    // 更新历史数据
    setHistoryData(prev => {
      const updated = [...prev, { time: timeStr, pressure: newData.inletPressure, flow: newData.flowRate, power: newData.energyConsumption }];
      return updated.slice(-20); // 保留最近20个点
    });

    // 随机生成告警
    if (Math.random() > 0.85) {
      const alarmTypes = [
        { type: 'PRESSURE_HIGH', level: 'warning', message: '首站压力偏高', value: newData.inletPressure.toFixed(2) + ' MPa' },
        { type: 'FLOW_ABNORMAL', level: 'warning', message: '流量波动异常', value: newData.flowRate.toFixed(0) + ' m³/h' },
        { type: 'PUMP_VIBRATION', level: 'critical', message: '泵站振动超标', value: '3.8 mm/s' },
        { type: 'TEMP_HIGH', level: 'info', message: '油温偏高', value: newData.oilTemperature.toFixed(1) + '°C' },
      ];
      const randomAlarm = alarmTypes[Math.floor(Math.random() * alarmTypes.length)];
      addAlarm({
        alarmId: 'alarm-' + Date.now(),
        pipelineId: 1,
        alarmType: randomAlarm.type,
        alarmLevel: randomAlarm.level as 'info' | 'warning' | 'critical',
        message: randomAlarm.message,
        value: randomAlarm.value,
        threshold: '阈值范围',
        timestamp: now.toISOString(),
        acknowledged: false,
      });
    }
  }, [setData, addAlarm]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      generateMockData(); // 立即执行一次
      timer = setInterval(generateMockData, refreshInterval * 1000);
    }
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, generateMockData]);

  // 压力趋势图
  const pressureChartOption = {
    title: { text: '压力趋势', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['首站压力'], right: 10, top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
    xAxis: { type: 'category', data: historyData.map(d => d.time), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: 'MPa', min: 5, max: 8 },
    series: [{ name: '首站压力', type: 'line', smooth: true, data: historyData.map(d => d.pressure.toFixed(2)), lineStyle: { color: '#667eea', width: 2 }, areaStyle: { color: 'rgba(102,126,234,0.2)' } }]
  };

  // 流量趋势图
  const flowChartOption = {
    title: { text: '流量趋势', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['流量'], right: 10, top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
    xAxis: { type: 'category', data: historyData.map(d => d.time), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: 'm³/h', min: 750, max: 950 },
    series: [{ name: '流量', type: 'line', smooth: true, data: historyData.map(d => d.flow.toFixed(0)), lineStyle: { color: '#52c41a', width: 2 }, areaStyle: { color: 'rgba(82,196,26,0.2)' } }]
  };

  // 能耗仪表盘
  const gaugeOption = data ? {
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 3000,
      splitNumber: 6,
      itemStyle: { color: '#667eea' },
      progress: { show: true, width: 20 },
      pointer: { show: false },
      axisLine: { lineStyle: { width: 20 } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { distance: 25, fontSize: 10 },
      title: { offsetCenter: [0, '30%'], fontSize: 14 },
      detail: { valueAnimation: true, fontSize: 28, offsetCenter: [0, '-10%'], formatter: '{value} kW', color: '#667eea' },
      data: [{ value: Math.round(data.energyConsumption), name: '实时功率' }]
    }]
  } : null;

  // 泵站状态列
  const pumpColumns = [
    { title: '设备', dataIndex: 'name' },
    { title: '状态', dataIndex: 'running', render: (v: boolean) => <Badge status={v ? 'processing' : 'default'} text={v ? '运行中' : '停机'} /> },
    { title: '电流(A)', dataIndex: 'current', render: (v: number) => v > 0 ? v.toFixed(1) : '-' },
    { title: '振动(mm/s)', dataIndex: 'vibration', render: (v: number) => v > 0 ? <span style={{ color: v > 3 ? '#ff4d4f' : '#52c41a' }}>{v.toFixed(2)}</span> : '-' },
  ];

  // 告警列
  const alarmColumns = [
    { title: '时间', dataIndex: 'timestamp', width: 100, render: (v: string) => new Date(v).toLocaleTimeString() },
    { title: '级别', dataIndex: 'alarmLevel', width: 80, render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'warning' ? 'orange' : 'blue'}>{v === 'critical' ? '严重' : v === 'warning' ? '警告' : '提示'}</Tag> },
    { title: '告警信息', dataIndex: 'message' },
    { title: '检测值', dataIndex: 'value', width: 120 },
    { title: '状态', dataIndex: 'acknowledged', width: 80, render: (v: boolean) => v ? <Tag color="green">已确认</Tag> : <Tag color="orange">待处理</Tag> },
    { title: '操作', width: 80, render: (_: any, record: AlarmInfo) => <Button type="link" size="small" onClick={() => setSelectedAlarm(record)}>详情</Button> },
  ];

  const acknowledgeAlarm = (_alarmId: string) => {
    message.success('告警已确认');
    setSelectedAlarm(null);
  };

  const getStatusColor = (value: number, min: number, max: number) => {
    if (value < min || value > max) return '#ff4d4f';
    if (value < min * 1.1 || value > max * 0.9) return '#faad14';
    return '#52c41a';
  };

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><DashboardOutlined /> 实时监控</h2>
        <p>管道系统运行状态实时监控与预警</p>
      </div>

      {/* 控制面板 */}
      <Card className="page-card" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <Badge status={connected ? 'processing' : 'error'} text={connected ? '已连接' : '未连接'} />
              <span>自动刷新: <Switch checked={autoRefresh} onChange={setAutoRefresh} /></span>
              <span>刷新间隔: <Slider style={{ width: 120, display: 'inline-block', marginLeft: 8 }} min={1} max={30} value={refreshInterval} onChange={setRefreshInterval} disabled={!autoRefresh} /></span>
              <span>{refreshInterval}秒</span>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<SyncOutlined spin={autoRefresh} />} onClick={generateMockData}>手动刷新</Button>
              <Button icon={<BellOutlined />} onClick={() => clearAlarms()}>清除告警</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 实时告警 */}
      {alarms.filter((a: AlarmInfo) => !a.acknowledged).length > 0 && (
        <Alert
          message={<><BellOutlined /> 当前有 {alarms.filter((a: AlarmInfo) => !a.acknowledged).length} 条未处理告警</>}
          type={alarms.some((a: AlarmInfo) => a.alarmLevel === 'critical' && !a.acknowledged) ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          action={<Button size="small" type="primary" danger onClick={() => message.info('跳转到告警列表')}>查看详情</Button>}
        />
      )}

      <Row gutter={16}>
        {/* 核心指标 */}
        <Col span={6}>
          <Card className="page-card" style={{ textAlign: 'center' }}>
            <Statistic
              title="首站压力"
              value={data?.inletPressure?.toFixed(2) || '-'}
              suffix="MPa"
              valueStyle={{ color: data ? getStatusColor(data.inletPressure, 5, 7) : '#666' }}
              prefix={data && data.inletPressure > 7 ? <WarningOutlined /> : <CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="page-card" style={{ textAlign: 'center' }}>
            <Statistic
              title="末站压力"
              value={data?.outletPressure?.toFixed(2) || '-'}
              suffix="MPa"
              valueStyle={{ color: data ? getStatusColor(data.outletPressure, 0.3, 1.5) : '#666' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="page-card" style={{ textAlign: 'center' }}>
            <Statistic
              title="输送流量"
              value={data?.flowRate?.toFixed(0) || '-'}
              suffix="m³/h"
              valueStyle={{ color: data ? getStatusColor(data.flowRate, 750, 900) : '#666' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="page-card" style={{ textAlign: 'center' }}>
            <Statistic
              title="系统效率"
              value={data?.systemEfficiency?.toFixed(1) || '-'}
              suffix="%"
              valueStyle={{ color: data && data.systemEfficiency >= 75 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* 趋势图 */}
        <Col span={12}>
          <Card title="压力趋势" className="page-card">
            <ReactECharts option={pressureChartOption} style={{ height: 250 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="流量趋势" className="page-card">
            <ReactECharts option={flowChartOption} style={{ height: 250 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* 能耗仪表盘 */}
        <Col span={8}>
          <Card title="实时功率" className="page-card">
            {gaugeOption && <ReactECharts option={gaugeOption} style={{ height: 250 }} />}
          </Card>
        </Col>

        {/* 泵站状态 */}
        <Col span={8}>
          <Card title="泵站状态" className="page-card">
            <Table
              columns={pumpColumns}
              dataSource={data?.pumpStatus || []}
              rowKey="pumpId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 运行概览 */}
        <Col span={8}>
          <Card title="运行概览" className="page-card">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="管道ID">{data?.pipelineId || '-'}</Descriptions.Item>
              <Descriptions.Item label="油温">{data?.oilTemperature?.toFixed(1) || '-'} °C</Descriptions.Item>
              <Descriptions.Item label="运行泵数">{data?.pumpStatus?.filter((p: { running: boolean }) => p.running).length || 0} / {data?.pumpStatus?.length || 4}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Timeline
                items={[
                  { color: 'green', children: '系统运行正常' },
                  { color: 'blue', children: '数据采集中...' },
                  { color: 'gray', children: '等待下次刷新' },
                ]}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 告警列表 */}
      <Card title={<><BellOutlined /> 告警记录 <Badge count={alarms.filter((a: AlarmInfo) => !a.acknowledged).length} style={{ marginLeft: 8 }} /></>} className="page-card" style={{ marginTop: 16 }}>
        <Table
          columns={alarmColumns}
          dataSource={alarms.slice().reverse()}
          rowKey="alarmId"
          pagination={{ pageSize: 5 }}
          size="small"
          locale={{ emptyText: '暂无告警记录' }}
        />
      </Card>

      {/* 告警详情弹窗 */}
      <Modal
        title={<><ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />告警详情</>}
        open={!!selectedAlarm}
        onCancel={() => setSelectedAlarm(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedAlarm(null)}>关闭</Button>,
          <Button key="ack" type="primary" onClick={() => acknowledgeAlarm(selectedAlarm?.alarmId || '')}>确认告警</Button>,
        ]}
      >
        {selectedAlarm && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="告警ID">{selectedAlarm.alarmId}</Descriptions.Item>
            <Descriptions.Item label="告警类型">{selectedAlarm.alarmType}</Descriptions.Item>
            <Descriptions.Item label="告警级别">
              <Tag color={selectedAlarm.alarmLevel === 'critical' ? 'red' : selectedAlarm.alarmLevel === 'warning' ? 'orange' : 'blue'}>
                {selectedAlarm.alarmLevel === 'critical' ? '严重' : selectedAlarm.alarmLevel === 'warning' ? '警告' : '提示'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警信息">{selectedAlarm.message}</Descriptions.Item>
            <Descriptions.Item label="检测值">{selectedAlarm.value}</Descriptions.Item>
            <Descriptions.Item label="阈值范围">{selectedAlarm.threshold}</Descriptions.Item>
            <Descriptions.Item label="发生时间">{new Date(selectedAlarm.timestamp).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="处理建议">
              {selectedAlarm.alarmLevel === 'critical' ? '请立即检查相关设备并采取应急措施' : '请关注设备状态并适时处理'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </AnimatedPage>
  );
}
