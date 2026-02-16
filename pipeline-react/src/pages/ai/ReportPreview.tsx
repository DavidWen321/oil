import { useMemo, useState } from 'react';
import { Button, Card, Input, Space, Table, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { DownloadOutlined, FileWordOutlined, FilePdfOutlined } from '@ant-design/icons';
import { agentApi } from '../../api/agent';
import type { ReportData, ReportGeneratePayload, ReportSection } from '../../types/agent';
import AnimatedPage from '../../components/common/AnimatedPage';

const { Paragraph, Text, Title } = Typography;

export default function ReportPreview() {
  const [request, setRequest] = useState('生成长庆管道本月运行分析报告');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [javaReportId, setJavaReportId] = useState<number | null>(null);
  const [javaReportList, setJavaReportList] = useState<Record<string, unknown>[]>([]);

  const handleGenerate = async () => {
    const text = request.trim();
    if (!text) {
      return;
    }

    setLoading(true);
    try {
      const response = (await agentApi.generateReport(text)) as unknown as ReportGeneratePayload;
      if (response.report) {
        setReport(response.report);
      }
      setJavaReportId(response.java_report_id ?? null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadJavaReports = async () => {
    setLoading(true);
    try {
      const response = await agentApi.listJavaReports(1, 10);
      const data = response.data as { list?: Record<string, unknown>[] } | undefined;
      setJavaReportList(Array.isArray(data?.list) ? data.list : []);
    } finally {
      setLoading(false);
    }
  };

  const downloadWord = () => {
    if (!javaReportId) {
      return;
    }
    window.open(agentApi.getJavaReportDownloadUrl(javaReportId, 'docx'), '_blank');
  };

  const downloadPdf = () => {
    if (!javaReportId) {
      return;
    }
    window.open(agentApi.getJavaReportDownloadUrl(javaReportId, 'pdf'), '_blank');
  };

  return (
    <AnimatedPage>
      <Card
        title="报告预览"
        extra={
          <Space>
            <Button onClick={() => void handleLoadJavaReports()} icon={<DownloadOutlined />}>
              读取Java报告
            </Button>
            <Button onClick={() => void handleGenerate()} loading={loading} type="primary">
              生成报告
            </Button>
          </Space>
        }
      >
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder="请输入报告需求"
        />

        {javaReportId ? (
          <Space style={{ marginTop: 12 }}>
            <Button icon={<FileWordOutlined />} onClick={downloadWord}>
              下载 Word
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={downloadPdf}>
              下载 PDF
            </Button>
            <Text type="secondary">Java报告ID: {javaReportId}</Text>
          </Space>
        ) : null}

        {javaReportList.length > 0 ? (
          <Table
            style={{ marginTop: 12 }}
            size="small"
            rowKey={(record) => String(record.id)}
            pagination={false}
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id' },
              { title: '标题', dataIndex: 'reportTitle', key: 'reportTitle' },
              { title: '类型', dataIndex: 'reportType', key: 'reportType' },
              {
                title: '操作',
                key: 'actions',
                render: (_, record) => {
                  const id = Number(record.id);
                  if (!id) return null;
                  return (
                    <Space>
                      <Button size="small" onClick={() => window.open(agentApi.getJavaReportDownloadUrl(id, 'docx'), '_blank')}>
                        Word
                      </Button>
                      <Button size="small" onClick={() => window.open(agentApi.getJavaReportDownloadUrl(id, 'pdf'), '_blank')}>
                        PDF
                      </Button>
                    </Space>
                  );
                },
              },
            ]}
            dataSource={javaReportList}
          />
        ) : null}

        {report ? (
          <div style={{ marginTop: 16 }}>
            <Title level={4}>{report.title}</Title>
            <Text type="secondary">生成时间: {report.generate_time}</Text>

            {report.sections.map((section, index) => (
              <ReportSectionView key={`${section.title}-${index}`} section={section} />
            ))}

            {report.summary ? <Paragraph>{report.summary}</Paragraph> : null}
          </div>
        ) : (
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            生成后将在此渲染图表、表格与报告内容。
          </Paragraph>
        )}
      </Card>
    </AnimatedPage>
  );
}

function ReportSectionView({ section }: { section: ReportSection }) {
  const firstChart = section.charts?.[0] as Record<string, unknown> | undefined;
  const firstTable = section.tables?.[0] as Record<string, unknown> | undefined;

  const tableColumns = useMemo(() => {
    const headers = Array.isArray(firstTable?.headers) ? (firstTable.headers as string[]) : [];
    return headers.map((header) => ({ title: header, dataIndex: header, key: header }));
  }, [firstTable]);

  const tableData = useMemo(() => {
    const rows = Array.isArray(firstTable?.rows) ? (firstTable.rows as unknown[][]) : [];
    const headers = Array.isArray(firstTable?.headers) ? (firstTable.headers as string[]) : [];
    return rows.map((row, rowIndex) => {
      const record: Record<string, unknown> = { key: rowIndex };
      headers.forEach((header, colIndex) => {
        record[header] = row[colIndex];
      });
      return record;
    });
  }, [firstTable]);

  const chartOption = useMemo(() => {
    if (!firstChart) {
      return null;
    }

    const chartType = (firstChart.type as string) || 'line';
    const chartData = (firstChart.data as Record<string, unknown>) || {};
    const xValues = (chartData.x as string[]) || (chartData.dates as string[]) || [];
    const yValues = (chartData.y as number[]) || (chartData.values as number[]) || [];

    return {
      tooltip: {},
      xAxis: { type: 'category', data: xValues },
      yAxis: { type: 'value' },
      series: [
        {
          data: yValues,
          type: chartType === 'bar' ? 'bar' : 'line',
          smooth: chartType !== 'bar',
        },
      ],
    };
  }, [firstChart]);

  return (
    <Card size="small" style={{ marginTop: 12 }} title={section.title}>
      <Paragraph>{section.content}</Paragraph>

      {chartOption ? <ReactECharts style={{ height: 280 }} option={chartOption} /> : null}

      {tableColumns.length > 0 ? (
        <Table
          size="small"
          columns={tableColumns}
          dataSource={tableData}
          pagination={false}
        />
      ) : null}

      {(section.alerts ?? []).map((alert, idx) => (
        <Paragraph key={idx} type="warning">
          {(alert as { message?: string }).message ?? ''}
        </Paragraph>
      ))}
    </Card>
  );
}
