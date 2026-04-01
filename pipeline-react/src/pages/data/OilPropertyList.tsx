import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  BgColorsOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { OilProperty } from '../../types';
import { oilPropertyApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

const heroStyle = {
  '--hero-bg-start': '#fff7ed',
  '--hero-bg-end': '#f8fafc',
  '--hero-outline': 'rgba(217, 119, 6, 0.18)',
  '--hero-glow': 'rgba(217, 119, 6, 0.22)',
  '--hero-accent': '#b45309',
  '--hero-icon-bg': 'rgba(217, 119, 6, 0.12)',
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

function getDensityMeta(density: number) {
  if (density < 850) {
    return { label: '轻质', color: 'var(--semantic-success)', background: 'var(--semantic-success-bg)' };
  }
  if (density < 900) {
    return { label: '中质', color: 'var(--accent-primary-active)', background: 'var(--accent-primary-light)' };
  }
  return { label: '重质', color: 'var(--semantic-warning-text)', background: 'var(--semantic-warning-bg)' };
}

export default function OilPropertyList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OilProperty[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<OilProperty | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<OilProperty>();

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await oilPropertyApi.list();
      setData(res.data || []);
    } catch {
      setData([]);
      message.error('加载油品数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: OilProperty) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await oilPropertyApi.delete([id]);
      message.success('油品已删除');
      await fetchData();
    } catch {
      message.error('删除失败，请稍后重试');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await oilPropertyApi.update({ ...editingItem, ...values });
        message.success('油品已更新');
      } else {
        await oilPropertyApi.create(values);
        message.success('油品已添加');
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
      [item.name, item.density, item.viscosity]
        .some((value) => String(value ?? '').toLowerCase().includes(keyword)),
    );
  }, [data, searchText]);

  const averageDensity = useMemo(() => {
    if (!data.length) {
      return 0;
    }
    return data.reduce((sum, item) => sum + (item.density || 0), 0) / data.length;
  }, [data]);

  const maxViscosity = useMemo(
    () => data.reduce((max, item) => Math.max(max, item.viscosity || 0), 0),
    [data],
  );

  const lightOilCount = useMemo(
    () => data.filter((item) => item.density < 850).length,
    [data],
  );

  const columns: ColumnsType<OilProperty> = [
    {
      title: nowrapTitle('ID'),
      dataIndex: 'id',
      width: 90,
      align: 'center',
    },
    {
      title: nowrapTitle('油品名称'),
      dataIndex: 'name',
      width: 220,
      align: 'center',
      render: (text: string) => <span className={styles.valueAccent}>{text}</span>,
    },
    {
      title: nowrapTitle('密度 (kg/m3)'),
      dataIndex: 'density',
      width: 220,
      align: 'center',
      render: (value: number) => {
        const meta = getDensityMeta(value);
        return (
          <span style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: meta.color, fontWeight: 600 }}>{formatNumber(value, 0)}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: 8,
                padding: '4px 10px',
                borderRadius: 999,
                background: meta.background,
                color: meta.color,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {meta.label}
            </span>
          </span>
        );
      },
    },
    {
      title: nowrapTitle('运动黏度 (mm2/s)'),
      dataIndex: 'viscosity',
      width: 180,
      align: 'center',
      render: (value?: number) => <span>{formatNumber(value, 2)}</span>,
    },
    {
      title: nowrapTitle('操作'),
      key: 'action',
      width: 200,
      align: 'center',
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
            title="确认删除这个油品吗？"
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
              <span className={styles.eyebrow}>Data Entry / Oil Profiles</span>
              <h1 className={styles.title}>油品物性录入</h1>
              <p className={styles.subtitle}>
                集中维护油品密度与黏度，让分析计算、监测诊断和知识解释都能共用统一物性基线。
              </p>
              <div className={styles.heroChips}>
                <span className={styles.heroChip}>密度分级会自动高亮，录入时更容易发现异常</span>
                <span className={styles.heroChip}>弹窗字段更聚焦，不再像默认后台表单</span>
                <span className={styles.heroChip}>搜索支持名称、密度和黏度，排查更快</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                className={styles.primaryButton}
              >
                新增油品
              </Button>
            </div>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>油品总数</span>
                <span className={styles.statIcon}>
                  <ExperimentOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{data.length}</div>
              <div className={styles.statHint}>同一套物性数据会被多个分析模块重复使用。</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>平均密度</span>
                <span className={styles.statIcon}>
                  <DashboardOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{formatNumber(averageDensity, 0)}</div>
              <div className={styles.statHint}>当前已录入轻质油品 {lightOilCount} 个。</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>最高黏度</span>
                <span className={styles.statIcon}>
                  <BgColorsOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{formatNumber(maxViscosity, 2)}</div>
              <div className={styles.statHint}>用于快速观察目前录入油品的黏度跨度。</div>
            </div>
          </div>
        </section>

        <Card className={styles.tableCard} bordered={false}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleGroup}>
              <div className={styles.tableEyebrow}>油品物性表</div>
              <h2 className={styles.tableTitle}>基础物性总览</h2>
              <p className={styles.tableMeta}>如果不同季节或批次差异较大，建议按油品档案拆分录入。</p>
            </div>
            <span className={styles.summaryPill}>
              已显示 {filteredData.length} / {data.length} 个油品
            </span>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Input
                placeholder="搜索油品名称、密度或黏度"
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={styles.searchInput}
                allowClear
              />
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title="刷新油品数据">
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
            scroll={{ x: 920 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            cardRender={(record) => {
              const meta = getDensityMeta(record.density);
              return (
                <div className={styles.mobileCard}>
                  <div className={styles.mobileCardTop}>
                    <div>
                      <div className={styles.mobileCardTitle}>{record.name}</div>
                      <div className={styles.mobileCardMeta}>用于计算与监测的基础物性档案</div>
                    </div>
                    <span
                      className={styles.mobileCardBadge}
                      style={{ background: meta.background, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className={styles.mobileCardGrid}>
                    <div className={styles.mobileField}>
                      <div className={styles.mobileLabel}>密度</div>
                      <div className={styles.mobileValue}>{formatNumber(record.density, 0)} kg/m3</div>
                    </div>
                    <div className={styles.mobileField}>
                      <div className={styles.mobileLabel}>运动黏度</div>
                      <div className={styles.mobileValue}>{formatNumber(record.viscosity, 2)} mm2/s</div>
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
                      title="确认删除这个油品吗？"
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
              );
            }}
          />
        </Card>

        <Modal
          title={
            <div className={styles.modalTitleBlock}>
              <span className={styles.modalTitle}>{editingItem ? '编辑油品物性' : '新增油品'}</span>
              <span className={styles.modalSubtitle}>
                密度和黏度是分析链路里最常被复用的两个基础字段，建议录入时统一单位口径。
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
            如果同一种油品在不同温度区间物性差异明显，建议拆分成多个档案，避免后续计算混用。
          </div>

          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="油品名称"
              rules={[{ required: true, message: '请输入油品名称' }]}
            >
              <Input placeholder="例如：大庆原油" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="density"
                  label="密度 (kg/m3)"
                  rules={[{ required: true, message: '请输入密度' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="viscosity"
                  label="运动黏度 (mm2/s)"
                  rules={[{ required: true, message: '请输入运动黏度' }]}
                >
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
