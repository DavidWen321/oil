import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import GraphViewer from '../../components/agent/GraphViewer';
import HITLDialog from '../../components/agent/HITLDialog';
import TracePanel from '../../components/agent/TracePanel';
import AnimatedPage from '../../components/common/AnimatedPage';
import { agentApi } from '../../api/agent';
import { useAgentTrace } from '../../hooks/useAgentTrace';
import type {
  KnowledgeDocumentSummary,
  KnowledgeGraphQueryPayload,
  KnowledgeRetrievalDebugItem,
  KnowledgeRerankDebugItem,
  KnowledgeSearchDebugPayload,
  KnowledgeStageBaseline,
  KnowledgeStatsPayload,
} from '../../types/agent';

const { Text } = Typography;

const CATEGORY_OPTIONS = [
  { label: '标准规范', value: 'standards' },
  { label: '计算公式', value: 'formulas' },
  { label: '操作规程', value: 'operations' },
  { label: '案例经验', value: 'cases' },
  { label: '常见问答', value: 'faq' },
];

const STATUS_COLORS: Record<string, string> = {
  indexed: 'green',
  uploaded: 'blue',
  failed: 'red',
  parsing: 'gold',
  chunked: 'cyan',
  archived: 'default',
  draft: 'default',
};

const AGENT_BUSY_STATES = new Set(['planning', 'executing', 'waiting_hitl']);

interface UploadFormValues {
  title: string;
  source: string;
  category: string;
  tags: string;
  author?: string;
  summary?: string;
  language?: string;
  version?: string;
  external_id?: string;
  effective_at?: string;
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function normalizeTags(raw: string) {
  return raw
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createKnowledgeAgentSessionId() {
  return `knowledge-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const keepNormalizeTags = normalizeTags;
void keepNormalizeTags;

export default function KnowledgeBase() {
  const [knowledgeAgentSessionId, setKnowledgeAgentSessionId] = useState(() => createKnowledgeAgentSessionId());
  const [form] = Form.useForm<UploadFormValues>();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [baseline, setBaseline] = useState<KnowledgeStageBaseline | null>(null);
  const [stats, setStats] = useState<KnowledgeStatsPayload | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebug, setSearchDebug] = useState<KnowledgeSearchDebugPayload | null>(null);
  const [graphQuery, setGraphQuery] = useState('');
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphResult, setGraphResult] = useState<KnowledgeGraphQueryPayload | null>(null);
  const [agentQuestion, setAgentQuestion] = useState('');
  const [lastAgentQuestion, setLastAgentQuestion] = useState('');
  const [pendingAgentQuestion, setPendingAgentQuestion] = useState<string | null>(null);

  const {
    activeTools: agentTools,
    currentStep: agentCurrentStep,
    dismissHITL: dismissAgentHITL,
    errorMessage: agentErrorMessage,
    finalResponse: agentResponse,
    hitlRequest: agentHitlRequest,
    lastToolSearch: agentToolSearch,
    logs: agentLogs,
    metrics: agentMetrics,
    plan: agentPlan,
    startChat: startAgentChat,
    status: agentStatus,
    stop: stopAgentChat,
    streaming: agentStreaming,
    submitHITL: submitAgentHITL,
  } = useAgentTrace(knowledgeAgentSessionId);

  const acceptTypes = useMemo(() => {
    if (!baseline?.supported_file_types?.length) {
      return '.md,.txt,.pdf,.docx';
    }
    return baseline.supported_file_types.map((ext) => `.${ext}`).join(',');
  }, [baseline]);

  const graphVisualization = graphResult?.result.visualization ?? { nodes: [], edges: [] };
  const matchedNodes = graphResult?.result.matched_nodes ?? [];
  const agentBusy = agentStreaming || AGENT_BUSY_STATES.has(agentStatus);

  const loadPageData = async (params?: { category?: string; status?: string }) => {
    setLoading(true);
    try {
      const [baselineData, documentData, statsData] = await Promise.all([
        agentApi.getKnowledgeBaseline(),
        agentApi.listKnowledgeDocuments(params),
        agentApi.getKnowledgeStats(),
      ]);
      setBaseline(baselineData);
      setDocuments(documentData.documents ?? []);
      setStats(statsData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载知识库信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    if (!pendingAgentQuestion) {
      return;
    }
    startAgentChat(pendingAgentQuestion);
    setPendingAgentQuestion(null);
  }, [knowledgeAgentSessionId, pendingAgentQuestion, startAgentChat]);

  const handleRefresh = async () => {
    await loadPageData({ category: categoryFilter, status: statusFilter });
  };

  const handleUpload = async () => {
    const values = await form.validateFields();
    if (!selectedFile) {
      message.warning('请先选择要上传的文件');
      return;
    }

    const tags = values.tags
      .replaceAll('，', ',')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!tags.length) {
      message.warning('请至少输入一个标签');
      return;
    }

    setUploading(true);
    try {
      const result = await agentApi.uploadKnowledgeDocument({
        file: selectedFile,
        title: values.title,
        source: values.source,
        category: values.category,
        tags,
        author: values.author,
        summary: values.summary,
        language: values.language,
        version: values.version,
        external_id: values.external_id,
        effective_at: values.effective_at,
      });
      message.success(result.message || '知识文档上传成功');
      form.resetFields();
      setSelectedFile(null);
      await handleRefresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '知识文档上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const result = await agentApi.deleteKnowledgeDocument(docId);
      message.success(result.message || '文档已删除');
      await handleRefresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除文档失败');
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const result = await agentApi.reindexKnowledge(true);
      message.success(result.message || '知识库索引重建完成');
      await handleRefresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '重建索引失败');
    } finally {
      setReindexing(false);
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchDebug(null);
      message.warning('请输入检索问题或关键词');
      return;
    }

    setSearching(true);
    try {
      const debugResult = await agentApi.debugKnowledgeSearch({
        query,
        top_k: 5,
        category: categoryFilter,
      });
      setSearchDebug(debugResult);
    } catch (error) {
      setSearchDebug(null);
      message.error(error instanceof Error ? error.message : '检索测试失败');
    } finally {
      setSearching(false);
    }
  };

  const handleGraphSearch = async () => {
    const query = graphQuery.trim();
    if (!query) {
      setGraphResult(null);
      message.warning('请输入图谱查询关键词');
      return;
    }

    setGraphLoading(true);
    try {
      const result = await agentApi.queryGraph(query);
      setGraphResult(result);
    } catch (error) {
      setGraphResult(null);
      message.error(error instanceof Error ? error.message : '图谱查询失败');
    } finally {
      setGraphLoading(false);
    }
  };

  const handleAgentAsk = () => {
    if (agentBusy) {
      return;
    }

    const query = agentQuestion.trim();
    if (!query) {
      message.warning('请输入要让智能体分析的问题');
      return;
    }

    const scopedQuestion = [
      '你现在处于知识库工作台。',
      '优先使用 search_knowledge_base、query_fault_cause、query_standards、query_equipment_chain。',
      '除非用户明确要求查询业务数据库或进行水力计算，否则不要调用 query_database 或 hydraulic_calculation。',
      categoryFilter ? `当前知识分类筛选：${categoryFilter}` : '',
      `用户问题：${query}`,
    ]
      .filter(Boolean)
      .join('\n');

    setLastAgentQuestion(query);
    setPendingAgentQuestion(scopedQuestion);
    setKnowledgeAgentSessionId(createKnowledgeAgentSessionId());
  };

  const handleResetAgent = () => {
    setAgentQuestion('');
    setLastAgentQuestion('');
    setPendingAgentQuestion(null);
    setKnowledgeAgentSessionId(createKnowledgeAgentSessionId());
  };

  const handleFilterChange = async (nextCategory?: string, nextStatus?: string) => {
    setCategoryFilter(nextCategory);
    setStatusFilter(nextStatus);
    setSearchDebug(null);
    await loadPageData({ category: nextCategory, status: nextStatus });
  };

  const renderRetrievalList = (
    items: KnowledgeRetrievalDebugItem[],
    emptyText: string,
  ) => {
    if (!items.length) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        {items.map((item) => (
          <Card key={`${item.match_type}-${item.chunk_id}-${item.score}`} size="small">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space wrap>
                <Text strong>{item.doc_title || item.doc_id}</Text>
                <Tag color="blue">{item.match_type}</Tag>
                <Tag color="purple">{item.category || 'unknown'}</Tag>
                <Tag>{item.score.toFixed(4)}</Tag>
              </Space>
              <Text type="secondary">{item.content_preview || '无预览内容'}</Text>
              <Text type="secondary">来源：{item.source || '-'}</Text>
            </Space>
          </Card>
        ))}
      </Space>
    );
  };

  const renderRerankList = (
    items: KnowledgeRerankDebugItem[],
    emptyText: string,
  ) => {
    if (!items.length) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        {items.map((item) => (
          <Card key={`rerank-${item.chunk_id}-${item.final_score}`} size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Text strong>{item.doc_title || item.doc_id}</Text>
                <Tag color="blue">{item.match_type}</Tag>
                <Tag color="green">final {item.final_score.toFixed(4)}</Tag>
                <Tag>orig {item.original_score.toFixed(4)}</Tag>
                <Tag color="purple">rerank {item.rerank_score.toFixed(4)}</Tag>
              </Space>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="原始 chunk">
                  <Text type="secondary">{item.content_preview || '无原文预览'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="上下文说明">
                  <Text type="secondary">{item.context_preview || '当前结果没有额外上下文说明'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="送入重排的 full_text">
                  <Text type="secondary">{item.full_text_preview || '无上下文增强文本'}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>
        ))}
      </Space>
    );
  };

  const columns: ColumnsType<KnowledgeDocumentSummary> = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.file_name}</Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => <Tag color={STATUS_COLORS[value] || 'default'}>{value}</Tag>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) =>
        tags?.length ? (
          <Space size={[0, 4]} wrap>
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '大小',
      dataIndex: 'file_size_bytes',
      width: 110,
      render: (value: number) => formatFileSize(value),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="确认删除这份知识文档吗？"
          okText="删除"
          cancelText="取消"
          onConfirm={() => void handleDelete(record.doc_id)}
        >
          <Button danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card loading={loading}>
              <Statistic title="文档总数" value={stats?.total_documents ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card loading={loading}>
              <Statistic title="索引切块数" value={stats?.total_chunks ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card loading={loading}>
              <Statistic title="索引状态" value={stats?.index_exists ? '已建立' : '未建立'} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card
              title="知识文档录入"
              extra={
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={() => void handleRefresh()} loading={loading}>
                    刷新
                  </Button>
                  <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={() => void handleReindex()}
                    loading={reindexing}
                  >
                    重建索引
                  </Button>
                </Space>
              }
            >
              <Form<UploadFormValues>
                form={form}
                layout="vertical"
                initialValues={{ category: 'faq', language: 'zh-CN' }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="title"
                      label="文档标题"
                      rules={[{ required: true, message: '请输入文档标题' }]}
                    >
                      <Input placeholder="例如：输油管道启停操作规范" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="source"
                      label="来源"
                      rules={[{ required: true, message: '请输入文档来源' }]}
                    >
                      <Input placeholder="例如：现场手册 / 行业标准 / 经验总结" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="category"
                      label="知识分类"
                      rules={[{ required: true, message: '请选择知识分类' }]}
                    >
                      <Select options={CATEGORY_OPTIONS} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="tags"
                      label="标签"
                      rules={[{ required: true, message: '请至少输入一个标签' }]}
                    >
                      <Input placeholder="多个标签用逗号分隔，例如：启停,安全,巡检" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item name="author" label="作者/整理人">
                      <Input placeholder="可选" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="language" label="语言">
                      <Input placeholder="例如：zh-CN" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="version" label="版本">
                      <Input placeholder="例如：v1.0" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="summary" label="摘要">
                  <Input.TextArea rows={3} placeholder="简要说明文档内容，便于后续检索和管理" />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="external_id" label="外部业务编号">
                      <Input placeholder="可选" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="effective_at" label="生效时间">
                      <Input placeholder="例如：2026-03-28T12:00:00" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="上传文件" required>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <input
                      type="file"
                      accept={acceptTypes}
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    />
                    <Text type="secondary">
                      支持格式：{baseline?.supported_file_types?.join(', ') || 'md, txt, pdf, docx'}
                    </Text>
                    <Text>{selectedFile ? `已选择：${selectedFile.name}` : '尚未选择文件'}</Text>
                  </Space>
                </Form.Item>

                <Button type="primary" icon={<UploadOutlined />} onClick={() => void handleUpload()} loading={uploading}>
                  上传并写入知识库
                </Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Card title="阶段 0 基线">
              {baseline ? (
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="支持文件类型">
                    {baseline.supported_file_types.join(', ')}
                  </Descriptions.Item>
                  <Descriptions.Item label="必填元数据">
                    {baseline.required_metadata_fields.join(', ')}
                  </Descriptions.Item>
                  <Descriptions.Item label="最小链路">
                    {baseline.minimal_pipeline.join(' -> ')}
                  </Descriptions.Item>
                  <Descriptions.Item label="知识库目录">
                    {stats?.knowledge_root || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty description="暂无阶段基线信息" />
              )}
            </Card>

            <Card title="检索测试" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Input.Search
                  placeholder="输入问题或关键词，测试当前知识库检索效果"
                  enterButton={<SearchOutlined />}
                  value={searchQuery}
                  loading={searching}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onSearch={() => void handleSearch()}
                />
                <Text type="secondary">
                  这里用于验证阶段 2 和阶段 3 的效果，对比 Dense、BM25、Hybrid 以及 Rerank 的结果。
                </Text>
                {searchDebug ? (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="查询文本">{searchDebug.query}</Descriptions.Item>
                      <Descriptions.Item label="检索策略">
                        Dense 权重 {searchDebug.debug.dense_weight} / Sparse 权重 {searchDebug.debug.sparse_weight}
                      </Descriptions.Item>
                      <Descriptions.Item label="候选数">
                        Dense {searchDebug.debug.dense_candidates} / Sparse {searchDebug.debug.sparse_candidates} / Hybrid {searchDebug.debug.hybrid_candidates}
                      </Descriptions.Item>
                      <Descriptions.Item label="耗时">
                        Dense {searchDebug.debug.dense_duration_ms} ms / Sparse {searchDebug.debug.sparse_duration_ms} ms / Fusion {searchDebug.debug.fusion_duration_ms} ms / Total {searchDebug.debug.total_duration_ms} ms
                      </Descriptions.Item>
                      <Descriptions.Item label="Reranker">
                        {searchDebug.rerank_debug.reranker_class} / threshold {searchDebug.rerank_debug.reranker_threshold}
                      </Descriptions.Item>
                      <Descriptions.Item label="重排结果">
                        {searchDebug.rerank_debug.rerank_candidates_before}
                        {' -> '}
                        {searchDebug.rerank_debug.rerank_candidates_after}
                        {' / 耗时 '}
                        {searchDebug.rerank_debug.rerank_duration_ms}
                        {' ms'}
                      </Descriptions.Item>
                      <Descriptions.Item label="上下文切块">
                        {searchDebug.rerank_debug.contextual_enabled ? '已启用' : '未启用'} / 带上下文结果 {searchDebug.rerank_debug.contextual_results}
                      </Descriptions.Item>
                    </Descriptions>

                    {!searchDebug.debug.sparse_index_built && (
                      <Alert
                        type="warning"
                        showIcon
                        message="BM25 稀疏索引尚未构建"
                        description="当前 Hybrid 结果会退化为 Dense 检索，建议先重建索引后再做阶段 2 验证。"
                      />
                    )}

                    <Tabs
                      items={[
                        {
                          key: 'rerank',
                          label: `Rerank (${searchDebug.rerank_results.length})`,
                          children: renderRerankList(searchDebug.rerank_results, '没有重排结果'),
                        },
                        {
                          key: 'hybrid',
                          label: `Hybrid (${searchDebug.hybrid_results.length})`,
                          children: renderRetrievalList(searchDebug.hybrid_results, '没有 Hybrid 检索结果'),
                        },
                        {
                          key: 'dense',
                          label: `Dense (${searchDebug.dense_results.length})`,
                          children: renderRetrievalList(searchDebug.dense_results, '没有 Dense 检索结果'),
                        },
                        {
                          key: 'sparse',
                          label: `BM25 (${searchDebug.sparse_results.length})`,
                          children: renderRetrievalList(searchDebug.sparse_results, '没有 BM25 检索结果'),
                        },
                      ]}
                    />
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有检索调试结果" />
                )}
              </Space>
            </Card>

            <Card title="图谱增强查询" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Input.Search
                  placeholder="输入设备、故障、参数或标准关键词，查看图谱关系"
                  enterButton={<SearchOutlined />}
                  value={graphQuery}
                  loading={graphLoading}
                  onChange={(event) => setGraphQuery(event.target.value)}
                  onSearch={() => void handleGraphSearch()}
                />
                <Text type="secondary">
                  这里是阶段 4 的图谱增强入口，用来验证实体匹配、关系连边和子图可视化效果。
                </Text>
                {graphResult ? (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="查询文本">{graphResult.query}</Descriptions.Item>
                      <Descriptions.Item label="图谱反馈">
                        {graphResult.result.message || '已返回图谱结果'}
                      </Descriptions.Item>
                      <Descriptions.Item label="匹配节点数">
                        {graphResult.result.total_matches ?? matchedNodes.length}
                      </Descriptions.Item>
                      <Descriptions.Item label="中心节点">
                        {graphResult.result.center_node || '-'}
                      </Descriptions.Item>
                    </Descriptions>

                    {matchedNodes.length ? (
                      <Space size={[0, 8]} wrap>
                        {matchedNodes.map((node) => (
                          <Tag key={node.id} color={node.id === graphResult.result.center_node ? 'blue' : 'default'}>
                            {node.name}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <Alert
                        type="info"
                        showIcon
                        message="当前查询没有匹配到图谱节点"
                        description="可以尝试输入更具体的设备名称、故障名称、参数或标准关键词。"
                      />
                    )}

                    {graphVisualization.nodes.length ? (
                      <Card size="small" title="关联子图">
                        <GraphViewer data={graphVisualization} height={360} />
                      </Card>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可视化子图" />
                    )}
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有图谱查询结果" />
                )}
              </Space>
            </Card>

            <Card
              title="Agent 工作流问答"
              style={{ marginTop: 16 }}
              extra={
                <Space>
                  <Tag color={agentBusy ? 'processing' : agentStatus === 'completed' ? 'green' : 'default'}>
                    {agentBusy
                      ? '执行中'
                      : agentStatus === 'completed'
                        ? '已完成'
                        : agentStatus === 'error'
                          ? '失败'
                          : '待命'}
                  </Tag>
                  <Button
                    onClick={() => {
                      handleResetAgent();
                    }}
                  >
                    重置
                  </Button>
                  <Button
                    icon={<PauseCircleOutlined />}
                    onClick={() => stopAgentChat()}
                    disabled={!agentBusy}
                  >
                    停止
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Input.TextArea
                  rows={3}
                  value={agentQuestion}
                  onChange={(event) => setAgentQuestion(event.target.value)}
                  placeholder="输入知识库问题、标准规范问题、故障原因分析，或一个需要多步推理的复杂任务"
                />
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleAgentAsk} loading={agentBusy}>
                    发起问答
                  </Button>
                  <Text type="secondary">
                    智能体会自动判断是直接问答、检索知识库、查询图谱，还是进入多步任务流程。
                  </Text>
                </Space>

                {lastAgentQuestion ? (
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="最近问题">{lastAgentQuestion}</Descriptions.Item>
                    <Descriptions.Item label="当前状态">{agentStatus}</Descriptions.Item>
                    <Descriptions.Item label="工具候选">
                      {agentToolSearch?.selected_tools?.length
                        ? agentToolSearch.selected_tools.join(', ')
                        : '尚未完成工具选择'}
                    </Descriptions.Item>
                  </Descriptions>
                ) : null}

                {agentErrorMessage ? (
                  <Alert type="error" showIcon message="智能体执行失败" description={agentErrorMessage} />
                ) : null}

                {agentResponse ? (
                  <Card size="small" title="最终回答">
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{agentResponse}</div>
                  </Card>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有智能体回答" />
                )}

                <TracePanel
                  plan={agentPlan}
                  currentStep={agentCurrentStep}
                  logs={agentLogs}
                  metrics={agentMetrics}
                  activeTools={agentTools}
                  toolSearch={agentToolSearch}
                />
              </Space>
            </Card>
          </Col>
        </Row>

        <Card
          title="知识文档列表"
          extra={
            <Space>
              <Select
                allowClear
                placeholder="按分类筛选"
                style={{ width: 160 }}
                options={CATEGORY_OPTIONS}
                value={categoryFilter}
                onChange={(value) => void handleFilterChange(value, statusFilter)}
              />
              <Select
                allowClear
                placeholder="按状态筛选"
                style={{ width: 160 }}
                options={[
                  { label: 'indexed', value: 'indexed' },
                  { label: 'uploaded', value: 'uploaded' },
                  { label: 'failed', value: 'failed' },
                ]}
                value={statusFilter}
                onChange={(value) => void handleFilterChange(categoryFilter, value)}
              />
            </Space>
          }
        >
          <Table<KnowledgeDocumentSummary>
            rowKey="doc_id"
            loading={loading}
            columns={columns}
            dataSource={documents}
            pagination={{ pageSize: 8, showSizeChanger: true }}
          />
        </Card>
      </Space>

      <HITLDialog request={agentHitlRequest} onSubmit={submitAgentHITL} onCancel={dismissAgentHITL} />
    </AnimatedPage>
  );
}
