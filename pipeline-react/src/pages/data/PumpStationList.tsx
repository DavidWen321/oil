import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { PumpStation } from '../../types';
import { pumpStationApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

const heroStyle = {
  '--hero-bg-start': '#ecfdf5',
  '--hero-bg-end': '#f8fafc',
  '--hero-outline': 'rgba(5, 150, 105, 0.16)',
  '--hero-glow': 'rgba(5, 150, 105, 0.24)',
  '--hero-accent': '#047857',
  '--hero-icon-bg': 'rgba(5, 150, 105, 0.12)',
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

export default function PumpStationList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PumpStation[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PumpStation | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<PumpStation>();

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await pumpStationApi.list();
      setData(res.data || []);
    } catch {
      setData([]);
      message.error('加载泵站数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: PumpStation) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await pumpStationApi.delete([id]);
      message.success('泵站已删除');
      await fetchData();
    } catch {
      message.error('删除失败，请稍后重试');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await pumpStationApi.update({ ...editingItem, ...values });
        message.success('泵站已更新');
      } else {
        await pumpStationApi.create(values);
        message.success('泵站已添加');
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
      [item.name, item.pumpEfficiency, item.electricEfficiency, item.displacement]
        .some((value) => String(value ?? '').toLowerCase().includes(keyword)),
    );
  }, [data, searchText]);

  const averagePumpEfficiency = useMemo(() => {
    if (!data.length) {
      return 0;
    }
    return data.reduce((sum, item) => sum + (item.pumpEfficiency || 0), 0) / data.length;
  }, [data]);

  const averageElectricEfficiency = useMemo(() => {
    if (!data.length) {
      return 0;
    }
    return data.reduce((sum, item) => sum + (item.electricEfficiency || 0), 0) / data.length;
  }, [data]);

  const totalDisplacement = useMemo(
    () => data.reduce((sum, item) => sum + (item.displacement || 0), 0),
    [data],
  );

  const columns: ColumnsType<PumpStation> = [
    {
      title: nowrapTitle('ID'),
      dataIndex: 'id',
      width: 90,
      align: 'center',
    },
    {
      title: nowrapTitle('泵站名称'),
      dataIndex: 'name',
      width: 180,
      align: 'center',
      render: (text: string) => <span className={styles.valueAccent}>{text}</span>,
    },
    {
      title: nowrapTitle('泵效率 (%)'),
      dataIndex: 'pumpEfficiency',
      width: 140,
      align: 'center',
      render: (value?: number) => <span>{formatNumber(value, 1)}</span>,
    },
    {
      title: nowrapTitle('电效率 (%)'),
      dataIndex: 'electricEfficiency',
      width: 140,
      align: 'center',
      render: (value?: number) => <span>{formatNumber(value, 1)}</span>,
    },
    {
      title: nowrapTitle('排量 (m3/h)'),
      dataIndex: 'displacement',
      width: 150,
      align: 'center',
    },
    {
      title: nowrapTitle('来压 (MPa)'),
      dataIndex: 'comePower',
      width: 130,
      align: 'center',
      render: (value?: number) => <span>{formatNumber(value, 2)}</span>,
    },
    {
      title: nowrapTitle('ZMI480 扬程 (m)'),
      dataIndex: 'zmi480Lift',
      width: 160,
      align: 'center',
    },
    {
      title: nowrapTitle('ZMI375 扬程 (m)'),
      dataIndex: 'zmi375Lift',
      width: 160,
      align: 'center',
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
            title="确认删除这个泵站吗？"
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
              <span className={styles.eyebrow}>Data Entry / Pump Stations</span>
              <h1 className={styles.title}>泵站参数录入</h1>
              <p className={styles.subtitle}>
                统一维护泵效率、电效率、排量、来压和不同机型扬程，让泵站优化和故障判断拥有可靠底座。
              </p>
              <div className={styles.heroChips}>
                <span className={styles.heroChip}>双机型扬程同屏展示，更容易校验</span>
                <span className={styles.heroChip}>泵效与电效分开展示，录入时更不容易看串</span>
                <span className={styles.heroChip}>卡片模式突出高频字段，手机端也能快速改值</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                className={styles.primaryButton}
              >
                新增泵站
              </Button>
            </div>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>泵站总数</span>
                <span className={styles.statIcon}>
                  <ThunderboltOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{data.length}</div>
              <div className={styles.statHint}>每座泵站都可以作为后续优化和诊断节点。</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>平均泵效率</span>
                <span className={styles.statIcon}>
                  <DashboardOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{formatNumber(averagePumpEfficiency, 1)}</div>
              <div className={styles.statHint}>
                平均电效率 {formatNumber(averageElectricEfficiency, 1)}%。
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>总设计排量</span>
                <span className={styles.statIcon}>
                  <LineChartOutlined />
                </span>
              </div>
              <div className={styles.statValue}>{formatNumber(totalDisplacement, 0)}</div>
              <div className={styles.statHint}>当前所有泵站录入排量总和，单位 m3/h。</div>
            </div>
          </div>
        </section>

        <Card className={styles.tableCard} bordered={false}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitleGroup}>
              <div className={styles.tableEyebrow}>泵站台账</div>
              <h2 className={styles.tableTitle}>设备运行底表</h2>
              <p className={styles.tableMeta}>建议录入时同时核对铭牌参数和运行经验值。</p>
            </div>
            <span className={styles.summaryPill}>
              已显示 {filteredData.length} / {data.length} 座泵站
            </span>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Input
                placeholder="搜索泵站名称、效率或排量"
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={styles.searchInput}
                allowClear
              />
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title="刷新泵站数据">
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
            scroll={{ x: 1250 }}
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
                      来压 {formatNumber(record.comePower, 2)} MPa
                    </div>
                  </div>
                  <span className={styles.mobileCardBadge}>
                    泵效 {formatNumber(record.pumpEfficiency, 1)}%
                  </span>
                </div>

                <div className={styles.mobileCardGrid}>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>电效率</div>
                    <div className={styles.mobileValue}>{formatNumber(record.electricEfficiency, 1)}%</div>
                  </div>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>排量</div>
                    <div className={styles.mobileValue}>{formatNumber(record.displacement)} m3/h</div>
                  </div>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>ZMI480 扬程</div>
                    <div className={styles.mobileValue}>{formatNumber(record.zmi480Lift)} m</div>
                  </div>
                  <div className={styles.mobileField}>
                    <div className={styles.mobileLabel}>ZMI375 扬程</div>
                    <div className={styles.mobileValue}>{formatNumber(record.zmi375Lift)} m</div>
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
                    title="确认删除这个泵站吗？"
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
              <span className={styles.modalTitle}>{editingItem ? '编辑泵站参数' : '新增泵站'}</span>
              <span className={styles.modalSubtitle}>
                核心设备参数会直接影响泵站优化和能耗测算，建议录入时同步校核。
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
          width={660}
        >
          <div className={styles.formIntro}>
            录入效率与扬程时，尽量使用同一版本的设计或运行参数，避免分析结果因口径不一致而偏差。
          </div>

          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="泵站名称"
              rules={[{ required: true, message: '请输入泵站名称' }]}
            >
              <Input placeholder="例如：首站泵房 A" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="pumpEfficiency" label="泵效率 (%)">
                  <InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="electricEfficiency" label="电效率 (%)">
                  <InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="displacement" label="排量 (m3/h)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="comePower" label="来压 (MPa)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="zmi480Lift" label="ZMI480 扬程 (m)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="zmi375Lift" label="ZMI375 扬程 (m)">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
