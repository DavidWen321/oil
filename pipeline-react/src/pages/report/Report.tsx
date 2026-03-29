import { useState } from 'react';
import { Card, Row, Col, DatePicker, Select, Button, Table, Statistic, Tag, Space, Tabs, message, Descriptions } from 'antd';
import { FileTextOutlined, DownloadOutlined, PrinterOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import AnimatedPage from '../../components/common/AnimatedPage';

const { RangePicker } = DatePicker;

interface ReportData {
  summary: {
    totalEnergy: number;
    avgEfficiency: number;
    totalCost: number;
    totalThroughput: number;
    energyChange: number;
    costChange: number;
  };
  dailyData: { date: string; energy: number; flow: number; efficiency: number; cost: number }[];
  pumpStats: { pumpName: string; runningHours: number; energyConsumption: number; efficiency: number; maintenanceCount: number }[];
  alarmStats: { type: string; count: number; percent: number }[];
  carbonData: { month: string; emission: number; quota: number }[];
}

export default function Report() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('daily');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const generateReport = () => {
    setLoading(true);
    setTimeout(() => {
      const mockData: ReportData = {
        summary: {
          totalEnergy: 684500,
          avgEfficiency: 78.5,
          totalCost: 445925,
          totalThroughput: 765000,
          energyChange: -5.2,
          costChange: -4.8,
        },
        dailyData: Array.from({ length: 30 }, (_, i) => ({
          date: dayjs().subtract(29 - i, 'day').format('MM-DD'),
          energy: 20000 + Math.random() * 5000,
          flow: 24000 + Math.random() * 3000,
          efficiency: 75 + Math.random() * 8,
          cost: 13000 + Math.random() * 3500,
        })),
        pumpStats: [
          { pumpName: 'ZMI480-1#', runningHours: 720, energyConsumption: 172800, efficiency: 82.5, maintenanceCount: 1 },
          { pumpName: 'ZMI480-2#', runningHours: 696, energyConsumption: 167040, efficiency: 81.2, maintenanceCount: 0 },
          { pumpName: 'ZMI480-3#', runningHours: 648, energyConsumption: 155520, efficiency: 79.8, maintenanceCount: 2 },
          { pumpName: 'ZMI375-1#', runningHours: 480, energyConsumption: 86400, efficiency: 77.5, maintenanceCount: 0 },
        ],
        alarmStats: [
          { type: '压力异常', count: 12, percent: 35.3 },
          { type: '流量波动', count: 8, percent: 23.5 },
          { type: '设备振动', count: 6, percent: 17.6 },
          { type: '温度告警', count: 5, percent: 14.7 },
          { type: '其他告警', count: 3, percent: 8.8 },
        ],
        carbonData: [
          { month: '1月', emission: 1050, quota: 1100 },
          { month: '2月', emission: 980, quota: 1100 },
          { month: '3月', emission: 1120, quota: 1100 },
          { month: '4月', emission: 1080, quota: 1100 },
          { month: '5月', emission: 1020, quota: 1100 },
          { month: '6月', emission: 990, quota: 1100 },
        ],
      };
      setReportData(mockData);
      setLoading(false);
      message.success('报表生成成功');
    }, 1500);
  };

  // 能耗趋势图
  const energyTrendOption = reportData ? {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['能耗(kWh)', '效率(%)'], top: 5 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: reportData.dailyData.map(d => d.date) },
    yAxis: [
      { type: 'value', name: 'kWh', position: 'left' },
      { type: 'value', name: '%', position: 'right', min: 60, max: 100 }
    ],
    series: [
      { name: '能耗(kWh)', type: 'bar', data: reportData.dailyData.map(d => d.energy.toFixed(0)), itemStyle: { color: '#667eea' } },
      { name: '效率(%)', type: 'line', yAxisIndex: 1, smooth: true, data: reportData.dailyData.map(d => d.efficiency.toFixed(1)), lineStyle: { color: '#52c41a', width: 2 } }
    ]
  } : null;

  // 流量趋势图
  const flowTrendOption = reportData ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['日输量(m³)'], top: 5 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: reportData.dailyData.map(d => d.date) },
    yAxis: { type: 'value', name: 'm³' },
    series: [{ name: '日输量(m³)', type: 'line', smooth: true, data: reportData.dailyData.map(d => d.flow.toFixed(0)), areaStyle: { color: 'rgba(102,126,234,0.3)' }, lineStyle: { color: '#667eea', width: 2 } }]
  } : null;

  // 告警分布饼图
  const alarmPieOption = reportData ? {
    tooltip: { trigger: 'item', formatter: '{b}: {c}次 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'],
      label: { show: false },
      data: reportData.alarmStats.map(a => ({ value: a.count, name: a.type }))
    }]
  } : null;

  // 碳排放对比图
  const carbonChartOption = reportData ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['实际排放', '配额上限'], top: 5 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: reportData.carbonData.map(d => d.month) },
    yAxis: { type: 'value', name: 'tCO2e' },
    series: [
      { name: '实际排放', type: 'bar', data: reportData.carbonData.map(d => d.emission), itemStyle: { color: (params: { data: number }) => params.data > 1100 ? '#ff4d4f' : '#52c41a' } },
      { name: '配额上限', type: 'line', data: reportData.carbonData.map(d => d.quota), lineStyle: { color: '#faad14', type: 'dashed', width: 2 } }
    ]
  } : null;

  // 泵站统计表格
  const pumpColumns = [
    { title: '泵站名称', dataIndex: 'pumpName' },
    { title: '运行时长(h)', dataIndex: 'runningHours' },
    { title: '能耗(kWh)', dataIndex: 'energyConsumption', render: (v: number) => v.toLocaleString() },
    { title: '平均效率(%)', dataIndex: 'efficiency', render: (v: number) => <Tag color={v >= 80 ? 'green' : v >= 75 ? 'blue' : 'orange'}>{v}%</Tag> },
    { title: '维护次数', dataIndex: 'maintenanceCount', render: (v: number) => v > 0 ? <Tag color="orange">{v}次</Tag> : <Tag color="green">无</Tag> },
  ];

  const tabItems = [
    {
      key: 'energy',
      label: <><BarChartOutlined /> 能耗分析</>,
      children: (
        <Row gutter={16}>
          <Col span={24}>
            <Card title="能耗与效率趋势" size="small">
              {energyTrendOption && <ReactECharts option={energyTrendOption} style={{ height: 350 }} />}
            </Card>
          </Col>
          <Col span={24} style={{ marginTop: 16 }}>
            <Card title="泵站运行统计" size="small">
              <Table columns={pumpColumns} dataSource={reportData?.pumpStats} rowKey="pumpName" pagination={false} size="small" />
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: 'flow',
      label: <><LineChartOutlined /> 输送分析</>,
      children: (
        <Card title="日输量趋势" size="small">
          {flowTrendOption && <ReactECharts option={flowTrendOption} style={{ height: 400 }} />}
        </Card>
      )
    },
    {
      key: 'alarm',
      label: <><PieChartOutlined /> 告警统计</>,
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Card title="告警类型分布" size="small">
              {alarmPieOption && <ReactECharts option={alarmPieOption} style={{ height: 300 }} />}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="告警明细" size="small">
              <Table
                columns={[
                  { title: '告警类型', dataIndex: 'type' },
                  { title: '发生次数', dataIndex: 'count' },
                  { title: '占比', dataIndex: 'percent', render: (v: number) => `${v}%` },
                ]}
                dataSource={reportData?.alarmStats}
                rowKey="type"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: 'carbon',
      label: <><BarChartOutlined /> 碳排放</>,
      children: (
        <Card title="月度碳排放与配额对比" size="small">
          {carbonChartOption && <ReactECharts option={carbonChartOption} style={{ height: 400 }} />}
        </Card>
      )
    },
  ];

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><FileTextOutlined /> 统计报表</h2>
        <p>生成多维度运行统计报表，支持导出和打印</p>
      </div>

      {/* 查询条件 */}
      <Card className="page-card" style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Space>
              <span>报表类型:</span>
              <Select
                value={reportType}
                onChange={setReportType}
                style={{ width: 120 }}
                options={[
                  { value: 'daily', label: '日报' },
                  { value: 'weekly', label: '周报' },
                  { value: 'monthly', label: '月报' },
                  { value: 'yearly', label: '年报' },
                ]}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <span>时间范围:</span>
              <RangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<BarChartOutlined />} onClick={generateReport} loading={loading}>生成报表</Button>
              <Button icon={<DownloadOutlined />} disabled={!reportData}>导出Excel</Button>
              <Button icon={<PrinterOutlined />} disabled={!reportData}>打印</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {reportData ? (
        <>
          {/* 核心指标概览 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card className="page-card">
                <Statistic
                  title="总能耗"
                  value={reportData.summary.totalEnergy}
                  suffix="kWh"
                  valueStyle={{ color: '#667eea' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Tag color={reportData.summary.energyChange < 0 ? 'green' : 'red'}>
                    {reportData.summary.energyChange < 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
                    {Math.abs(reportData.summary.energyChange)}% 同比
                  </Tag>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="page-card">
                <Statistic
                  title="平均效率"
                  value={reportData.summary.avgEfficiency}
                  suffix="%"
                  precision={1}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="page-card">
                <Statistic
                  title="总成本"
                  value={reportData.summary.totalCost}
                  prefix="¥"
                  valueStyle={{ color: '#faad14' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Tag color={reportData.summary.costChange < 0 ? 'green' : 'red'}>
                    {reportData.summary.costChange < 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
                    {Math.abs(reportData.summary.costChange)}% 同比
                  </Tag>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="page-card">
                <Statistic
                  title="总输量"
                  value={reportData.summary.totalThroughput}
                  suffix="m³"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 详细报表 */}
          <Card className="page-card">
            <Tabs items={tabItems} />
          </Card>

          {/* 报表摘要 */}
          <Card title="报表摘要" className="page-card" style={{ marginTop: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="报表周期">{dateRange[0].format('YYYY-MM-DD')} 至 {dateRange[1].format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="报表类型">{reportType === 'daily' ? '日报' : reportType === 'weekly' ? '周报' : reportType === 'monthly' ? '月报' : '年报'}</Descriptions.Item>
              <Descriptions.Item label="生成时间">{new Date().toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="数据来源">管道监控系统</Descriptions.Item>
              <Descriptions.Item label="分析结论" span={2}>
                本报告期内，管道系统运行平稳，总能耗{reportData.summary.totalEnergy.toLocaleString()}kWh，
                平均运行效率{reportData.summary.avgEfficiency}%，较上期{reportData.summary.energyChange < 0 ? '下降' : '上升'}
                {Math.abs(reportData.summary.energyChange)}%。建议继续优化泵站运行组合，提升系统整体效率。
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </>
      ) : (
        <Card className="page-card" style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#999' }}>
            <FileTextOutlined style={{ fontSize: 64, marginBottom: 16, color: '#667eea' }} />
            <h3>统计报表</h3>
            <p>选择报表类型和时间范围后点击"生成报表"</p>
          </div>
        </Card>
      )}
    </AnimatedPage>
  );
}
