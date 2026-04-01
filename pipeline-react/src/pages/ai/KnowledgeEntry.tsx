import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UploadFile, UploadProps } from 'antd';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClockCircleOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { knowledgeDocumentApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import type { KnowledgeDocument, KnowledgeIngestTask } from '../../types';

const { Dragger } = Upload;
const { Paragraph, Text } = Typography;
const { Search } = Input;

interface KnowledgeFormValues {
  title?: string;
  category: string;
}

const CATEGORY_OPTIONS = [
  { label: '技术标准', value: 'standards' },
  { label: '计算公式', value: 'formulas' },
  { label: '运行操作', value: 'operations' },
  { label: '案例分析', value: 'cases' },
  { label: '常见问答', value: 'faq' },
];

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '已入库', value: 'INDEXED' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '待处理', value: 'UPLOADED' },
  { label: '失败', value: 'FAILED' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  INDEXED: { label: '已入库', color: 'green' },
  PROCESSING: { label: '处理中', color: 'blue' },
  UPLOADED: { label: '待处理', color: 'gold' },
  FAILED: { label: '失败', color: 'red' },
};

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: '排队中', color: 'gold' },
  PROCESSING: { label: '处理中', color: 'blue' },
  SUCCESS: { label: '成功', color: 'green' },
  FAILED: { label: '失败', color: 'red' },
};

const TASK_TYPE_META: Record<string, string> = {
  UPLOAD: '首次入库',
  RETRY: '手动重试',
};

const CATEGORY_LABEL_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((item) => [item.value, item.label]));

const INGESTION_STEPS = [
  '上传后先落文档元数据和 MinIO 原文件。',
  '系统创建入库任务并交给后台线程池异步执行。',
  'Python Agent 解析文档、切片并写入向量库。',
  '页面自动刷新处理中状态，也可以打开任务历史查看每一次尝试。',
];

export default function KnowledgeEntry() {
  const [form] = Form.useForm<KnowledgeFormValues>();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [tasks, setTasks] = useState<KnowledgeIngestTask[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument>();
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<number>();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const taskRequestSeqRef = useRef(0);
  const selectedDocumentIdRef = useRef<number | undefined>(undefined);

  const hasRunningTask = useMemo(
    () => documents.some((item) => item.status === 'PROCESSING' || item.status === 'UPLOADED'),
    [documents],
  );

  const loadDocuments = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await knowledgeDocumentApi.list();
      setDocuments(response.data ?? []);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  const loadTasks = useCallback(async (documentId: number, showLoading = true) => {
    const requestSeq = ++taskRequestSeqRef.current;
    if (showLoading) {
      setTaskLoading(true);
    }
    try {
      const response = await knowledgeDocumentApi.listTasks(documentId);
      if (selectedDocumentIdRef.current === documentId && requestSeq === taskRequestSeqRef.current) {
        setTasks(response.data ?? []);
      }
    } finally {
      if (showLoading && requestSeq === taskRequestSeqRef.current) {
        setTaskLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      category: 'faq',
    });
    void loadDocuments();
  }, [form, loadDocuments]);

  useEffect(() => {
    if (!hasRunningTask) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadDocuments(false);
      if (taskDrawerOpen && selectedDocument?.id) {
        void loadTasks(selectedDocument.id, false);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hasRunningTask, loadDocuments, loadTasks, selectedDocument?.id, taskDrawerOpen]);

  const filteredDocuments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return documents.filter((item) => {
      const tags = item.tags ?? '';
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.fileName.toLowerCase().includes(normalizedKeyword) ||
        tags.toLowerCase().includes(normalizedKeyword);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesKeyword && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, documents, keyword, statusFilter]);

  const uploadProps: UploadProps = {
    multiple: false,
    beforeUpload: () => false,
    accept: '.pdf,.docx,.md,.txt',
    fileList,
    onChange: ({ fileList: nextFileList }) => setFileList(nextFileList.slice(-1)),
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedFile = fileList[0]?.originFileObj;
      if (!selectedFile) {
        message.warning('请先选择要录入的知识文档');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', values.title?.trim() || selectedFile.name.replace(/\.[^.]+$/, ''));
      formData.append('category', values.category);

      setSubmitting(true);
      const response = await knowledgeDocumentApi.upload(formData);
      message.success(response.msg || '知识文档已接收，正在后台入库');
      form.resetFields();
      form.setFieldsValue({ category: 'faq' });
      setFileList([]);
      await loadDocuments();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (record: KnowledgeDocument) => {
    setActingId(record.id);
    try {
      const response = await knowledgeDocumentApi.retry(record.id);
      message.success(response.msg || '已加入重试队列，请稍后刷新');
      await loadDocuments();
      if (taskDrawerOpen && selectedDocument?.id === record.id) {
        await loadTasks(record.id);
      }
    } finally {
      setActingId(undefined);
    }
  };

  const handleDelete = async (record: KnowledgeDocument) => {
    setActingId(record.id);
    try {
      await knowledgeDocumentApi.delete(record.id);
      message.success('知识文档已删除');
      if (selectedDocument?.id === record.id) {
        handleCloseTasks();
      }
      await loadDocuments();
    } finally {
      setActingId(undefined);
    }
  };

  const handleOpenTasks = async (record: KnowledgeDocument) => {
    selectedDocumentIdRef.current = record.id;
    setSelectedDocument(record);
    setTaskDrawerOpen(true);
    await loadTasks(record.id);
  };

  const handleCloseTasks = () => {
    taskRequestSeqRef.current += 1;
    selectedDocumentIdRef.current = undefined;
    setTaskDrawerOpen(false);
    setSelectedDocument(undefined);
    setTasks([]);
    setTaskLoading(false);
  };

  const columns: ColumnsType<KnowledgeDocument> = [
    {
      title: '文档信息',
      dataIndex: 'title',
      key: 'title',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.fileName}</Text>
          {record.tags ? (
            <Space size={[4, 4]} wrap>
              {record.tags
                .split(',')
                .filter(Boolean)
                .map((tag: string) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
            </Space>
          ) : null}
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (value: string) => CATEGORY_LABEL_MAP[value] || value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={STATUS_META[value]?.color || 'default'}>{STATUS_META[value]?.label || value}</Tag>
          {record.failureReason ? <Text type="danger">{record.failureReason}</Text> : null}
        </Space>
      ),
    },
    {
      title: '切片 / 重试',
      key: 'chunkCount',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text>{record.chunkCount ?? 0} 个切片</Text>
          <Text type="secondary">重试 {record.retryCount ?? 0} 次</Text>
        </Space>
      ),
    },
    {
      title: '存储',
      key: 'storage',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text>{record.storageType || '-'}</Text>
          <Text type="secondary" ellipsis style={{ maxWidth: 220 }}>
            {record.storageObjectKey || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '最近入库',
      dataIndex: 'lastIngestTime',
      key: 'lastIngestTime',
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<FileSearchOutlined />} onClick={() => void handleOpenTasks(record)}>
            任务历史
          </Button>
          <Button
            size="small"
            icon={<SyncOutlined />}
            loading={actingId === record.id}
            disabled={!record.storageObjectKey || record.status === 'PROCESSING' || record.status === 'UPLOADED'}
            onClick={() => void handleRetry(record)}
          >
            {record.status === 'INDEXED' ? '重新入库' : '重试'}
          </Button>
          <Popconfirm
            title="确认删除这条知识文档吗？"
            description="会同时删除向量库记录、原文件和任务历史。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(record)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={actingId === record.id}
              disabled={record.status === 'PROCESSING' || record.status === 'UPLOADED'}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const taskColumns: ColumnsType<KnowledgeIngestTask> = [
    {
      title: '任务',
      dataIndex: 'taskType',
      key: 'taskType',
      render: (value: string, record) => (
        <Space direction="vertical" size={4}>
          <Text strong>{TASK_TYPE_META[value] || value}</Text>
          <Text type="secondary">第 {record.attemptNo ?? 1} 次</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={TASK_STATUS_META[value]?.color || 'default'}>{TASK_STATUS_META[value]?.label || value}</Tag>
          {record.failureReason ? <Text type="danger">{record.failureReason}</Text> : null}
        </Space>
      ),
    },
    {
      title: '结果',
      key: 'result',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text>{record.chunkCount ?? 0} 个切片</Text>
          <Text type="secondary">{record.agentDocId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '时间',
      key: 'time',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text type="secondary">开始：{record.startedAt || '-'}</Text>
          <Text type="secondary">结束：{record.finishedAt || '-'}</Text>
        </Space>
      ),
    },
  ];

  return (
    <AnimatedPage className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 py-6 md:px-6">
      <PageHeader
        title="知识库录入"
        subtitle="第三阶段把入库改成后台异步执行，并补上任务历史查看，方便我们持续观察每一次解析结果。"
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void loadDocuments()} loading={loading}>
              刷新状态
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => void handleSubmit()} loading={submitting}>
              提交入库
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message="第三阶段说明"
        description="上传和重试现在都会先创建后台任务，再由线程池异步执行入库。页面会自动轮询处理中记录，你也可以打开任务历史查看每次尝试的开始时间、结束时间和失败原因。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="知识文档总数" value={documents.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="后台处理中"
              value={documents.filter((item) => item.status === 'PROCESSING' || item.status === 'UPLOADED').length}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="已完成入库"
              value={documents.filter((item) => item.status === 'INDEXED').length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="失败文档"
              value={documents.filter((item) => item.status === 'FAILED').length}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={14}>
          <Card title="资料上传与元数据填写" extra={<Text type="secondary">阶段三</Text>}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Dragger {...uploadProps} style={{ padding: 12 }}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">拖拽文件到这里，或点击选择一个文件</p>
                <p className="ant-upload-hint">当前支持 PDF、DOCX、MD、TXT。提交后会进入后台任务，不再阻塞页面等待解析。</p>
              </Dragger>

              <Form<KnowledgeFormValues> form={form} layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="title" label="文档标题">
                      <Input placeholder="不填则默认使用文件名" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="category" label="知识分类" rules={[{ required: true, message: '请选择知识分类' }]}>
                      <Select options={CATEGORY_OPTIONS} />
                    </Form.Item>
                  </Col>
                </Row>

                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  页面仅保留文档标题和分类两个录入项，其余元数据由系统按默认规则补全。
                </Paragraph>
              </Form>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="当前入库流程">
              <List
                dataSource={INGESTION_STEPS}
                renderItem={(item, index) => (
                  <List.Item>
                    <Space align="start">
                      <Tag color="blue">{index + 1}</Tag>
                      <Text>{item}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            <Card title="当前边界">
              <Paragraph>
                这一阶段已经把同步阻塞改成后台异步任务，但还没有做真正的批量导入、任务取消和更细粒度的进度百分比。
              </Paragraph>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                你先检查异步体验和任务历史是否顺手，确认通过后我再继续往批量导入和任务运营能力推进。
              </Paragraph>
            </Card>
          </Space>
        </Col>
      </Row>

      <Card
        title="已录入文档"
        extra={
          <Space wrap>
            <Search
              allowClear
              placeholder="搜索标题、文件名或标签"
              style={{ width: 240 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              style={{ width: 160 }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ label: '全部分类', value: 'all' }, ...CATEGORY_OPTIONS]}
            />
            <Select style={{ width: 140 }} value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          </Space>
        }
      >
        {filteredDocuments.length > 0 ? (
          <Table<KnowledgeDocument>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filteredDocuments}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 1320 }}
          />
        ) : (
          <Empty description="当前还没有录入任何知识文档" />
        )}
      </Card>

      <Drawer
        title={selectedDocument ? `${selectedDocument.title} 的任务历史` : '任务历史'}
        open={taskDrawerOpen}
        onClose={handleCloseTasks}
        width={760}
        extra={
          selectedDocument ? (
            <Button icon={<ReloadOutlined />} onClick={() => void loadTasks(selectedDocument.id)} loading={taskLoading}>
              刷新任务
            </Button>
          ) : null
        }
      >
        {selectedDocument ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="任务状态说明"
              description="PENDING 表示已入队，PROCESSING 表示后台线程正在执行，SUCCESS/FAILED 表示本次任务的最终结果。"
            />
            <Table<KnowledgeIngestTask>
              rowKey="id"
              loading={taskLoading}
              columns={taskColumns}
              dataSource={tasks}
              pagination={{ pageSize: 5, showSizeChanger: false }}
            />
          </Space>
        ) : null}
      </Drawer>
    </AnimatedPage>
  );
}
