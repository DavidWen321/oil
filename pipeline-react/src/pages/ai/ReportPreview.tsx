import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { projectApi, reportApi } from '../../api';
import type { AnalysisReport, Project } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

const { Paragraph } = Typography;

const TEXT = {
  pageTitle: '报告预览',
  pageDescription: '从数据库读取项目信息和历史生成报告，支持按勾选项目筛选。',
  projectTitle: '项目勾选',
  projectDescription: '以下项目编号、项目名称、负责人、创建时间均直接来自数据库。',
  historyTitle: '历史生成报告',
  historyDescription: '下方展示数据库中已生成的历史报告，可按上方勾选项目进行筛选。',
  reload: '刷新数据',
  selectAll: '全选',
  clearAll: '清空',
  selectedCount: '已勾选',
  selectedUnit: '项',
  dbTag: '数据库',
  allReports: '全部历史报告',
  filteredReports: '按勾选项目筛选',
  fieldNumber: '项目编号',
  fieldName: '项目名称',
  fieldResponsible: '负责人',
  fieldCreateTime: '创建时间',
  reportNo: '报告编号',
  reportTitle: '报告标题',
  reportType: '报告类型',
  reportStatus: '状态',
  projectEmpty: '数据库中暂无项目数据',
  reportEmpty: '数据库中暂无历史生成报告',
  reportFilterEmpty: '当前勾选项目暂无历史生成报告',
  loadProjectFailed: '读取项目数据失败，请稍后重试',
  loadReportFailed: '读取历史生成报告失败，请稍后重试',
  statusCompleted: '已完成',
  statusGenerating: '生成中',
  statusFailed: '失败',
  statusUnknown: '未知',
  typeUnknown: '未分类',
} as const;

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ');
}

function sortProjects(list: Project[]) {
  return [...list].sort((left, right) => {
    const leftTime = new Date(left.createTime || left.buildDate || 0).getTime();
    const rightTime = new Date(right.createTime || right.buildDate || 0).getTime();

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.proId - right.proId;
  });
}

function sortReports(list: AnalysisReport[]) {
  return [...list].sort((left, right) => {
    const leftTime = new Date(left.createTime || 0).getTime();
    const rightTime = new Date(right.createTime || 0).getTime();

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id - left.id;
  });
}

function getStatusMeta(status?: number) {
  if (status === 1) {
    return { text: TEXT.statusCompleted, color: 'success' as const };
  }

  if (status === 0) {
    return { text: TEXT.statusGenerating, color: 'processing' as const };
  }

  if (status === 2) {
    return { text: TEXT.statusFailed, color: 'error' as const };
  }

  return { text: TEXT.statusUnknown, color: 'default' as const };
}

function getReportTypeText(value?: string) {
  if (!value) {
    return TEXT.typeUnknown;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === 'DAILY') {
    return '日报';
  }

  if (normalized === 'WEEKLY') {
    return '周报';
  }

  if (normalized === 'MONTHLY') {
    return '月报';
  }

  if (normalized === 'ANNUAL') {
    return '年报';
  }

  if (normalized === 'HYDRAULIC') {
    return '水力分析';
  }

  if (normalized === 'OPTIMIZATION') {
    return '泵站优化';
  }

  if (normalized === 'SENSITIVITY') {
    return '敏感性分析';
  }

  return value;
}

export default function ReportPreview() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const loadProjects = async () => {
    setProjectLoading(true);
    try {
      const response = await projectApi.list();
      const nextProjects = sortProjects(Array.isArray(response.data) ? response.data : []);
      const availableIds = new Set(nextProjects.map((item) => item.proId));

      setProjects(nextProjects);
      setSelectedProjectIds((current) => current.filter((id) => availableIds.has(id)));
    } catch {
      message.error(TEXT.loadProjectFailed);
    } finally {
      setProjectLoading(false);
    }
  };

  const loadReports = async () => {
    setReportLoading(true);
    try {
      const response = await reportApi.page({ pageNum: 1, pageSize: 200 });
      const nextReports = sortReports(Array.isArray(response.data?.list) ? response.data.list : []);
      setReports(nextReports);
    } catch {
      message.error(TEXT.loadReportFailed);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    void loadReports();
  }, []);

  const projectMap = useMemo(() => {
    return new Map(projects.map((item) => [item.proId, item]));
  }, [projects]);

  const filteredReports = useMemo(() => {
    if (selectedProjectIds.length === 0) {
      return reports;
    }

    const selectedIdSet = new Set(selectedProjectIds);
    return reports.filter((item) => item.proId !== undefined && selectedIdSet.has(item.proId));
  }, [reports, selectedProjectIds]);

  const projectColumns = [
    {
      title: TEXT.fieldNumber,
      dataIndex: 'number',
      key: 'number',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: TEXT.fieldName,
      dataIndex: 'name',
      key: 'name',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: TEXT.fieldResponsible,
      dataIndex: 'responsible',
      key: 'responsible',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: TEXT.fieldCreateTime,
      dataIndex: 'createTime',
      key: 'createTime',
      render: (_: unknown, record: Project) => formatDateTime(record.createTime || record.buildDate),
    },
  ];

  const reportColumns = [
    {
      title: TEXT.fieldNumber,
      dataIndex: 'proId',
      key: 'projectNumber',
      render: (_: unknown, record: AnalysisReport) => projectMap.get(record.proId ?? -1)?.number || '-',
    },
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      render: (_: unknown, record: AnalysisReport) => projectMap.get(record.proId ?? -1)?.name || '-',
    },
    {
      title: TEXT.reportNo,
      dataIndex: 'reportNo',
      key: 'reportNo',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: TEXT.reportTitle,
      dataIndex: 'reportTitle',
      key: 'reportTitle',
      render: (value: string | undefined) => value || '-',
    },
    {
      title: TEXT.reportType,
      dataIndex: 'reportType',
      key: 'reportType',
      render: (value: string | undefined) => getReportTypeText(value),
    },
    {
      title: TEXT.reportStatus,
      dataIndex: 'status',
      key: 'status',
      render: (value: number | undefined) => {
        const meta = getStatusMeta(value);
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: TEXT.fieldCreateTime,
      dataIndex: 'createTime',
      key: 'createTime',
      render: (value: string | undefined) => formatDateTime(value),
    },
  ];

  const toggleProjectSelection = (projectId: number) => {
    setSelectedProjectIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((id) => id !== projectId);
      }

      return [...current, projectId];
    });
  };

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2>{TEXT.pageTitle}</h2>
        <p>{TEXT.pageDescription}</p>
      </div>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card
          className="page-card"
          title={TEXT.projectTitle}
          extra={
            <Space size="small" wrap>
              <Tag color="blue">
                {TEXT.selectedCount} {selectedProjectIds.length} {TEXT.selectedUnit}
              </Tag>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadProjects()}>
                {TEXT.reload}
              </Button>
              <Button
                size="small"
                onClick={() => setSelectedProjectIds(projects.map((item) => item.proId))}
                disabled={projects.length === 0}
              >
                {TEXT.selectAll}
              </Button>
              <Button
                size="small"
                onClick={() => setSelectedProjectIds([])}
                disabled={selectedProjectIds.length === 0}
              >
                {TEXT.clearAll}
              </Button>
            </Space>
          }
        >
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {TEXT.projectDescription}
          </Paragraph>

          {projectLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '72px 0' }}>
              <Spin />
            </div>
          ) : projects.length === 0 ? (
            <Empty description={TEXT.projectEmpty} style={{ padding: '48px 0 24px' }} />
          ) : (
            <Table
              size="large"
              rowKey={(record) => String(record.proId)}
              pagination={false}
              columns={projectColumns}
              dataSource={projects}
              rowSelection={{
                selectedRowKeys: selectedProjectIds,
                onChange: (selectedRowKeys) =>
                  setSelectedProjectIds(selectedRowKeys.map((item) => Number(item))),
                columnWidth: 56,
              }}
              onRow={(record) => ({
                onClick: () => toggleProjectSelection(record.proId),
                style: { cursor: 'pointer' },
              })}
            />
          )}
        </Card>

        <Card
          className="page-card"
          title={TEXT.historyTitle}
          extra={
            <Space size="small" wrap>
              <Tag color={selectedProjectIds.length > 0 ? 'blue' : 'default'}>
                {selectedProjectIds.length > 0 ? TEXT.filteredReports : TEXT.allReports}
              </Tag>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadReports()}>
                {TEXT.reload}
              </Button>
            </Space>
          }
        >
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {TEXT.historyDescription}
          </Paragraph>

          <Table
            size="middle"
            rowKey={(record) => String(record.id)}
            loading={reportLoading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columns={reportColumns}
            dataSource={filteredReports}
            locale={{
              emptyText: (
                <Empty
                  description={
                    selectedProjectIds.length > 0 ? TEXT.reportFilterEmpty : TEXT.reportEmpty
                  }
                  style={{ padding: '48px 0 24px' }}
                />
              ),
            }}
          />
        </Card>
      </Space>
    </AnimatedPage>
  );
}
