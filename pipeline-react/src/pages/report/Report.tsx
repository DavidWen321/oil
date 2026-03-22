import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import AnimatedPage from '../../components/common/AnimatedPage';
import { MarkdownRenderer } from '../../components/agent';
import { agentApi } from '../../api/agent';
import type { ReportData } from '../../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface ReportFormValues {
  reportType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dateRange: [Dayjs, Dayjs];
  focus: string;
}

interface JavaReportRecord {
  id: number | string;
  reportNo?: string;
  reportType?: string;
  reportTitle?: string;
  reportSummary?: string;
  fileName?: string;
  fileFormat?: string;
  fileSize?: string;
  createTime?: string;
}

function formatReportFileType(value?: string) {
  if (!value) {
    return '-';
  }
  if (value.toLowerCase() === 'docx') {
    return '可编辑版';
  }
  if (value.toLowerCase() === 'pdf') {
    return '版式版';
  }
  return value;
}

const REPORT_TYPE_LABEL: Record<ReportFormValues['reportType'], string> = {
  daily: '日报',
  weekly: '周报',
  monthly: '月报',
  yearly: '年报',
};

function extractReportPayload(response: Record<string, unknown>) {
  if (response.report && typeof response.report === 'object') {
    return response;
  }
  if (response.data && typeof response.data === 'object') {
    return response.data as Record<string, unknown>;
  }
  return response;
}

function extractJavaReportList(response: Record<string, unknown>): JavaReportRecord[] {
  const payload = response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : response;
  const list = Array.isArray(payload.list)
    ? payload.list
    : Array.isArray(payload.records)
      ? payload.records
      : [];
  return list as JavaReportRecord[];
}

export default function Report() {
  const [form] = Form.useForm<ReportFormValues>();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [traceId, setTraceId] = useState<string>('');
  const [latestReportId, setLatestReportId] = useState<number | null>(null);
  const [javaReports, setJavaReports] = useState<JavaReportRecord[]>([]);

  const loadJavaReports = async () => {
    setRefreshing(true);
    try {
      const response = await agentApi.listJavaReports();
      setJavaReports(extractJavaReportList(response));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    form.setFieldsValue({
      reportType: 'monthly',
      dateRange: [dayjs().subtract(30, 'day'), dayjs()],
      focus: '请重点分析能耗变化、泵站运行效率、异常告警、优化建议和潜在节能空间。',
    });
    void loadJavaReports();
  }, [form]);

  const handleGenerate = async () => {
    const values = await form.validateFields();
    const userRequest = [
      `请生成一份${REPORT_TYPE_LABEL[values.reportType]}。`,
      `统计周期：${values.dateRange[0].format('YYYY-MM-DD')} 至 ${values.dateRange[1].format('YYYY-MM-DD')}。`,
      `重点关注：${values.focus}`,
      '请输出摘要、核心发现、可执行建议以及适合下载归档的正式报告结构。',
    ].join(' ');

    setLoading(true);
    try {
      const response = await agentApi.generateReport(userRequest);
      const payload = extractReportPayload(response);
      setReport((payload.report ?? null) as ReportData | null);
      setTraceId(String(payload.trace_id ?? ''));
      setLatestReportId(payload.java_report_id ? Number(payload.java_report_id) : null);
      await loadJavaReports();
      message.success('报告生成成功');
    } finally {
      setLoading(false);
    }
  };

  const sectionCount = report?.sections.length ?? 0;
  const recommendationCount = report?.recommendations?.length ?? 0;

  const reportColumns = useMemo(() => [
    {
      title: '报告编号',
      dataIndex: 'reportNo',
      key: 'reportNo',
    },
    {
      title: '标题',
      dataIndex: 'reportTitle',
      key: 'reportTitle',
    },
    {
      title: '格式',
      dataIndex: 'fileFormat',
      key: 'fileFormat',
      render: (value: string | undefined) => formatReportFileType(value),
    },
    {
      title: '生成时间',
      dataIndex: 'createTime',
      key: 'createTime',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: JavaReportRecord) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => window.open(agentApi.getJavaReportDownloadUrl(Number(record.id), 'docx'), '_blank')}
          >
            可编辑版
          </Button>
          <Button
            size="small"
            onClick={() => window.open(agentApi.getJavaReportDownloadUrl(Number(record.id), 'pdf'), '_blank')}
          >
            版式版
          </Button>
        </Space>
      ),
    },
  ], []);

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><FileTextOutlined /> 分析报告</h2>
        <p>直接调用智能助手报告生成链路，并展示可下载的正式报告记录。</p>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card title="报告生成" className="page-card">
            <Form<ReportFormValues> form={form} layout="vertical" onFinish={() => void handleGenerate()}>
              <Form.Item name="reportType" label="报告类型" rules={[{ required: true, message: '请选择报告类型' }]}>
                <Select
                  options={Object.entries(REPORT_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>

              <Form.Item name="dateRange" label="统计周期" rules={[{ required: true, message: '请选择统计周期' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="focus" label="分析重点" rules={[{ required: true, message: '请输入分析重点' }]}>
                <TextArea rows={6} placeholder="例如：重点关注单位能耗、末站压力、异常告警、调度优化建议。" />
              </Form.Item>

              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button icon={<SyncOutlined />} loading={refreshing} onClick={() => void loadJavaReports()}>
                  刷新记录
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  生成报告
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={16}>
              <Col span={8}><Card className="page-card"><Descriptions column={1} size="small"><Descriptions.Item label="追踪编号">{traceId || '-'}</Descriptions.Item></Descriptions></Card></Col>
              <Col span={8}><Card className="page-card"><Descriptions column={1} size="small"><Descriptions.Item label="章节数量">{sectionCount}</Descriptions.Item></Descriptions></Card></Col>
              <Col span={8}><Card className="page-card"><Descriptions column={1} size="small"><Descriptions.Item label="建议数量">{recommendationCount}</Descriptions.Item></Descriptions></Card></Col>
            </Row>

            {report ? (
              <>
                <Card title={report.title} className="page-card" extra={latestReportId ? <Tag color="success">已存档 #{latestReportId}</Tag> : null}>
                  <Typography.Paragraph type="secondary">
                    生成时间：{report.generate_time}
                  </Typography.Paragraph>
                  {report.summary ? <MarkdownRenderer content={report.summary} /> : <Typography.Text type="secondary">暂无摘要</Typography.Text>}
                  {report.recommendations && report.recommendations.length > 0 ? (
                    <div style={{ marginTop: 16 }}>
                      <Typography.Title level={5}>建议清单</Typography.Title>
                      <Space wrap>
                        {report.recommendations.map((item) => (
                          <Tag key={item} color="blue">{item}</Tag>
                        ))}
                      </Space>
                    </div>
                  ) : null}
                </Card>

                {report.sections.map((section) => (
                  <Card key={section.title} title={section.title} className="page-card">
                    <MarkdownRenderer content={section.content} />
                  </Card>
                ))}
              </>
            ) : (
              <Card className="page-card" style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                  <FileTextOutlined style={{ fontSize: 56, marginBottom: 16 }} />
                  <div>输入统计周期和分析重点后，即可生成真实智能报告。</div>
                </div>
              </Card>
            )}

            <Card title="已生成报告" className="page-card">
              <Table
                columns={reportColumns}
                dataSource={javaReports}
                rowKey={(record) => String(record.id)}
                size="small"
                pagination={{ pageSize: 5 }}
              />
            </Card>
          </Space>
        </Col>
      </Row>
    </AnimatedPage>
  );
}
