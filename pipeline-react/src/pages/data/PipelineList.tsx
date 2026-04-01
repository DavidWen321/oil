import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ColumnWidthOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Pipeline } from '../../types';
import { pipelineApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

const heroStyle = {
  '--hero-bg-start': '#ecfeff',
  '--hero-bg-end': '#f8fafc',
  '--hero-outline': 'rgba(8, 145, 178, 0.18)',
  '--hero-glow': 'rgba(8, 145, 178, 0.24)',
  '--hero-accent': '#0f766e',
  '--hero-icon-bg': 'rgba(8, 145, 178, 0.12)',
} as CSSProperties;

function formatNumber(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(digits);
}

function nowrapTitle(text: string) {
  return <span style={{ whiteSpace: 'nowrap' }}>{text}</span>;
}

export default function PipelineList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Pipeline[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Pipeline | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<Pipeline>();

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await pipelineApi.listByProject(1);
      setData(res.data || []);
    } catch {
      setData([]);
      message.error('加载管道数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Pipeline) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await pipelineApi.delete([id]);
      message.success('管道已删除');
      await fetchData();
    } catch {
      message.error('删除失败，请稍后重试');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await pipelineApi.update({ ...editingItem, ...values });
        message.success('管道已更新');
      } else {
        await pipelineApi.create({ ...values, proId: 1 });
        message.success('管道已添加');
      }
      setModalVisible(false);
      await fetchData();
    } catch {
      message.error('保存失败，请检查表单内容');
    }
  };

  const filteredData = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return data;
    }

    return data.filter((item) =>
      [item.name, item.length, item.diameter, item.throughput]
        .some((value) => String(value ?? '').toLowerCase().includes(keyword)),
    );
  }, [data, searchText]);

  const totalLength = useMemo(
    () => data.reduce((sum, item) => sum + (item.length || 0), 0),
    [data],
  );

  const averageDiameter = useMemo(() => {
    if (!data.length) {
      return 0;
    }
    return data.reduce((sum, item) => sum + (item.diameter || 0), 0) / data.length;
  }, [data]);

  const maxThroughput = useMemo(
    () => data.reduce((max, item) => Math.max(max, item.throughput || 0), 0),
    [data],
  );

  const columns: ColumnsType<Pipeline> = [
    {
      title: nowrapTitle('ID'),
      dataIndex: 'id',
      width: 90,
      align: 'center',
    },
    {
      title: nowrapTitle('管道名称'),
      dataIndex: 'name',
      width: 220,
      align: 'center',
      render: (text: string) => <span className={styles.valueAccent}>{text}</span>,
    },
    {
      title: nowrapTitle('长度 (km)'),
      dataIndex: 'length',
      width: 140,
      align: 'center',
      render: (value?: number) => <span>{formatNumber(value, 1)}</span>,
    },
    {
      title: nowrapTitle('管径 (mm)'),
      dataIndex: 'diameter',
      width: 130,
      align: 'center',
    },
    {
      title: nowrapTitle('壁厚 (mm)'),
      dataIndex: 'thickness',
      width: 130,
      align: 'center',
    },
    {
      title: nowrapTitle('输量 (m3/h)'),
      dataIndex: 'throughput',
      width: 150,
      align: 'center',
    },
    {
      title: nowrapTitle('起点高程 (m)'),
      dataIndex: 'startAltitude',
      width: 150,
      align: 'center',
    },
    {
      title: nowrapTitle('终点高程 (m)'),
      dataIndex: 'endAltitude',
      width: 150,
      align: 'center',
    },
    {
      title: nowrapTitle('操作'),
      key: 'action',
      width: 200,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <div className={styles.actionGroup}>
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
            title="确认删除这条管道吗？"
            description="删除后将无法恢复。"
            onConfirm={() => void handleDelete(record.id)}
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
        <section className={styles.hero} style={heroStyle}>
          <div className={styles.heroGrid}>
            <div className={styles.headerInfo}>
              <span className={styles.eyebrow}>Data Entry / Pipelines</span>
              <h1 className={styles.title}>管道参数录入</h1>
              <p className={styles.subtitle}>
                维护管线长度、管径、壁厚、设计输量和高程参数，为水力分析、敏感性分析和监测计算提供基础输入。
              </p>
              <div className={styles.heroChips}>
                <span className={styles.heroChip}>默认读取项目 #1 的管道数据</span>
                <span className={styles.heroChip}>关键几何参数集中展示，录入时更容易对照</span>
                <span className={styles.heroChip}>移动端会压缩成双列信息卡，不会再像表格截图</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                className={styles.primaryButton}
              >
                新增管道
              </Button>
            </div>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>管线总数</span>
                <span className={styles.statIcon}>
                  <SlidersOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{data.length}</div>
              <div className={styles.statHint}>每条管线都可以作为后续分析的独立对象。</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>累计里程</span>
                <span className={styles.statIcon}>
                  <RiseOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{formatNumber(totalLength, 1)}</div>
              <div className={styles.statHint}>当前项目下所有已录入管道长度总和，单位 km。</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>平均管径</span>
                <span className={styles.statIcon}>
                  <ColumnWidthOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{formatNumber(averageDiameter, 0)}</div>
              <div className={styles.statHint}>
                最高设计输量 {formatNumber(maxThroughput, 0)} m3/h。
              </div>
            </div>
          </div>
        </section>

        <Card className={styles.tableCard} bordered={false}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleGroup}>
              <div className={styles.tableEyebrow}>管道台账</div>
              <h2 className={styles.tableTitle}>录入结果总览</h2>
              <p className={styles.tableMeta}>建议先录入主干管线，再补支线或差异化参数。</p>
            </div>
            <span className={styles.summaryPill}>
              已显示 {filteredData.length} / {data.length} 条管道
            </span>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Input
                placeholder="搜索管道名称、长度、管径或输量"
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={styles.searchInput}
                allowClear
              />
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title="刷新管道数据">
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
            rowKey="id"
            loading={loading}
            scroll={{ x: 1300 }}
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
                      高程 {formatNumber(record.startAltitude)} m 至 {formatNumber(record.endAltitude)} m
                    </div>
                  </div>
                  <span className={styles.mobileCardBadge}>{formatNumber(record.diameter)} mm</span>
                </div>

                <div className={styles.mobileCardGrid}>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>长度</div>
                    <div className={styles.mobileValue}>{formatNumber(record.length, 1)} km</div>
                  </div>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>壁厚</div>
                    <div className={styles.mobileValue}>{formatNumber(record.thickness)} mm</div>
                  </div>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>输量</div>
                    <div className={styles.mobileValue}>{formatNumber(record.throughput)} m3/h</div>
                  </div>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>粗糙度</div>
                    <div className={styles.mobileValue}>{formatNumber(record.roughness, 4)}</div>
                  </div>
                </div>

                <div className={styles.mobileActions}>
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
                    title="确认删除这条管道吗？"
                    description="删除后将无法恢复。"
                    onConfirm={() => void handleDelete(record.id)}
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

        <Modal
          title={
            <div className={styles.modalTitleBlock}>
              <span className={styles.modalTitle}>{editingItem ? '编辑管道参数' : '新增管道'}</span>
              <span className={styles.modalSubtitle}>
                完整填写长度、管径、壁厚和高程后，后续分析参数可以直接带入。
              </span>
            </div>
          }
          open={modalVisible}
          onOk={() => void handleSubmit()}
          onCancel={() => setModalVisible(false)}
          width={720}
          destroyOnClose
          className={styles.modal}
          okText="保存"
          cancelText="取消"
        >
          <div className={styles.formIntro}>
            这里的参数会直接参与水力计算，建议录入时对照设计台账或现场定值，减少后续重复修正。
          </div>

          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="管道名称"
              rules={[{ required: true, message: '请输入管道名称' }]}
            >
              <Input placeholder="例如：一号主输管线" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="length"
                  label="长度 (km)"
                  rules={[{ required: true, message: '请输入长度' }]}
                >
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="diameter"
                  label="管径 (mm)"
                  rules={[{ required: true, message: '请输入管径' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="thickness"
                  label="壁厚 (mm)"
                  rules={[{ required: true, message: '请输入壁厚' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="throughput" label="输量 (m3/h)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="startAltitude" label="起点高程 (m)">
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="endAltitude" label="终点高程 (m)">
                  <InputNumber style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="roughness" label="粗糙度">
              <InputNumber min={0} precision={4} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
