import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Popconfirm, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { projectApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import type { Project } from '../../types';
import ProjectCalculationDetailPanel from './ProjectCalculationDetailPanel';
import styles from './DataPage.module.css';

const mockData: Project[] = [
  {
    proId: 1,
    number: 'GD-2024-001',
    name: '西部原油管道工程',
    responsible: '刘伟',
    createTime: '2024-01-15 10:00:00',
  },
  {
    proId: 2,
    number: 'GD-2024-002',
    name: '东部成品油管网升级',
    responsible: '张明',
    createTime: '2024-02-20 14:30:00',
  },
  {
    proId: 3,
    number: 'GD-2024-003',
    name: '北方输送系统优化改造',
    responsible: '王敏',
    createTime: '2024-03-10 09:15:00',
  },
];

const heroStyle = {
  '--hero-bg-start': '#eff6ff',
  '--hero-bg-end': '#f8fafc',
  '--hero-outline': 'rgba(37, 99, 235, 0.16)',
  '--hero-glow': 'rgba(37, 99, 235, 0.22)',
  '--hero-accent': '#1d4ed8',
  '--hero-icon-bg': 'rgba(37, 99, 235, 0.12)',
} as CSSProperties;

function nowrapTitle(text: string) {
  return <span style={{ whiteSpace: 'nowrap' }}>{text}</span>;
}

function formatText(value?: string | null) {
  return value && value.trim() ? value : '未填写';
}

export default function ProjectList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Project[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<Project>();
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (!viewingProject || !detailRef.current) {
      return;
    }

    detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [viewingProject]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await projectApi.list();
      setData(res.data || []);
    } catch {
      setData(mockData);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Project) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await projectApi.delete([id]);
      message.success('项目已删除');
      await fetchData();
    } catch {
      message.success('演示模式下已删除项目');
      setData((current) => current.filter((item) => item.proId !== id));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await projectApi.update({ ...editingItem, ...values });
        message.success('项目已更新');
      } else {
        await projectApi.create(values);
        message.success('项目已创建');
      }
      setModalVisible(false);
      await fetchData();
    } catch {
      message.success('演示模式下已保存项目');
      setModalVisible(false);
    }
  };

  const filteredData = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return data;
    }

    return data.filter((item) =>
      [item.name, item.number, item.responsible]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [data, searchText]);

  const assignedCount = useMemo(
    () => data.filter((item) => item.responsible && item.responsible.trim()).length,
    [data],
  );

  const columns: ColumnsType<Project> = [
    {
      title: nowrapTitle('ID'),
      dataIndex: 'proId',
      key: 'proId',
      width: 90,
      align: 'center',
    },
    {
      title: nowrapTitle('项目编号'),
      dataIndex: 'number',
      key: 'number',
      width: 180,
      align: 'center',
      render: (text?: string) => <span className={styles.numberBadge}>{formatText(text)}</span>,
    },
    {
      title: nowrapTitle('项目名称'),
      dataIndex: 'name',
      key: 'name',
      width: 240,
      align: 'center',
      render: (text: string) => <span className={styles.valueAccent}>{text}</span>,
    },
    {
      title: nowrapTitle('负责人'),
      dataIndex: 'responsible',
      key: 'responsible',
      width: 140,
      align: 'center',
      render: (text?: string) => <span>{formatText(text)}</span>,
    },
    {
      title: nowrapTitle('创建时间'),
      dataIndex: 'createTime',
      key: 'createTime',
      width: 190,
      align: 'center',
      render: (text?: string) => <span className={styles.secondaryText}>{formatText(text)}</span>,
    },
    {
      title: nowrapTitle('操作'),
      key: 'action',
      width: 250,
      align: 'center',
      render: (_, record) => (
        <div className={styles.actionGroup}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewingProject(record)}
            className={styles.actionBtn}
          >
            查看
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className={styles.actionBtn}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个项目吗？"
            description="删除后将无法恢复。"
            onConfirm={() => void handleDelete(record.proId)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            >
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <AnimatedPage className={styles.page}>
      <div className={styles.pageContent}>
        {!viewingProject ? (
          <>
            <section className={styles.hero} style={heroStyle}>
              <div className={styles.heroGrid}>
                <div className={styles.headerInfo}>
                  <span className={styles.eyebrow}>Data Entry / Projects</span>
                  <h1 className={styles.title}>项目录入面板</h1>
                  <p className={styles.subtitle}>
                    统一维护项目编号、负责人和计算入口，让后续的管道、泵站、油品与分析结果都能围绕项目主线归档。
                  </p>
                  <div className={styles.heroChips}>
                    <span className={styles.heroChip}>支持查看项目关联的计算记录</span>
                    <span className={styles.heroChip}>新增、编辑、删除全部集中在一个入口</span>
                    <span className={styles.heroChip}>移动端会自动切换成录入卡片视图</span>
                  </div>
                </div>
                <div className={styles.headerActions}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    className={styles.primaryButton}
                  >
                    新增项目
                  </Button>
                </div>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.statCard}>
                  <div className={styles.statTop}>
                    <span className={styles.statLabel}>项目总数</span>
                    <span className={styles.statIcon}>
                      <AppstoreOutlined />
                    </span>
                  </div>
                  <div className={styles.statValue}>{data.length}</div>
                  <div className={styles.statHint}>项目是全部基础数据和分析记录的组织入口。</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statTop}>
                    <span className={styles.statLabel}>负责人已配置</span>
                    <span className={styles.statIcon}>
                      <TeamOutlined />
                    </span>
                  </div>
                  <div className={styles.statValue}>{assignedCount}</div>
                  <div className={styles.statHint}>负责人信息越完整，后续追溯和协同越清晰。</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statTop}>
                    <span className={styles.statLabel}>当前筛选结果</span>
                    <span className={styles.statIcon}>
                      <FilterOutlined />
                    </span>
                  </div>
                  <div className={styles.statValue}>{filteredData.length}</div>
                  <div className={styles.statHint}>搜索会同步作用于表格和移动端卡片视图。</div>
                </div>
              </div>
            </section>

            <Card className={styles.tableCard} bordered={false}>
              <div className={styles.tableHeader}>
                <div className={styles.tableTitleGroup}>
                  <div className={styles.tableEyebrow}>项目清单</div>
                  <h2 className={styles.tableTitle}>基础资料总览</h2>
                  <p className={styles.tableMeta}>
                    录入完成后，可以直接进入项目详情查看关联计算历史。
                  </p>
                </div>
                <span className={styles.summaryPill}>
                  已显示 {filteredData.length} / {data.length} 个项目
                </span>
              </div>

              <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                  <Input
                    placeholder="搜索项目名称、编号或负责人"
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className={styles.searchInput}
                    allowClear
                  />
                </div>
                <div className={styles.toolbarRight}>
                  <Tooltip title="刷新项目数据">
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => void fetchData()}
                      loading={loading}
                      className={styles.toolbarButton}
                    />
                  </Tooltip>
                </div>
              </div>

              <ResponsiveTable
                columns={columns}
                dataSource={filteredData}
                rowKey="proId"
                loading={loading}
                scroll={{ x: 1100 }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
                cardRender={(record) => (
                  <div className={styles.mobileCard}>
                    <div className={styles.mobileCardTop}>
                      <div>
                        <div className={styles.mobileCardTitle}>{record.name}</div>
                        <div className={styles.mobileCardMeta}>
                          负责人：{formatText(record.responsible)}
                        </div>
                      </div>
                      <span className={styles.mobileCardBadge}>{formatText(record.number)}</span>
                    </div>

                    <div className={styles.mobileCardGrid}>
                      <div className={styles.mobileField}>
                        <div className={styles.mobileLabel}>项目 ID</div>
                        <div className={styles.mobileValue}>{record.proId}</div>
                      </div>
                      <div className={styles.mobileField}>
                        <div className={styles.mobileLabel}>创建时间</div>
                        <div className={styles.mobileValue}>{formatText(record.createTime)}</div>
                      </div>
                    </div>

                    <div className={styles.mobileActions}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => setViewingProject(record)}
                        className={styles.actionBtn}
                      >
                        查看
                      </Button>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        className={styles.actionBtn}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="确认删除这个项目吗？"
                        description="删除后将无法恢复。"
                        onConfirm={() => void handleDelete(record.proId)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                )}
              />
            </Card>
          </>
        ) : (
          <div ref={detailRef}>
            <ProjectCalculationDetailPanel
              project={viewingProject}
              onClose={() => setViewingProject(null)}
            />
          </div>
        )}

        <Modal
          title={
            <div className={styles.modalTitleBlock}>
              <span className={styles.modalTitle}>{editingItem ? '编辑项目资料' : '新增项目'}</span>
              <span className={styles.modalSubtitle}>
                补齐项目名称、编号与负责人后，后续管道和计算页面就能直接复用。
              </span>
            </div>
          }
          open={modalVisible}
          onOk={() => void handleSubmit()}
          onCancel={() => setModalVisible(false)}
          destroyOnClose
          className={styles.modal}
          okText="保存"
          cancelText="取消"
          width={560}
        >
          <div className={styles.formIntro}>
            建议先建立项目主档，再继续维护管道、泵站和油品数据，这样后续分析记录会更清晰。
          </div>

          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="项目名称"
              rules={[{ required: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="例如：西部原油管道工程" />
            </Form.Item>

            <Form.Item name="number" label="项目编号">
              <Input placeholder="例如：GD-2026-001" />
            </Form.Item>

            <Form.Item name="responsible" label="负责人">
              <Input placeholder="请输入负责人姓名" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
