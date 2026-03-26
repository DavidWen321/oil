/**
 * PipelineList - 管道参数管理页面
 */

import { useState, useEffect } from 'react';
import { Card, Button, Space, Modal, Form, Input, InputNumber, message, Popconfirm, Tooltip, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Pipeline } from '../../types';
import { pipelineApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

export default function PipelineList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Pipeline[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Pipeline | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await pipelineApi.listByProject(1);
      if (res.data) {
        setData(res.data);
      }
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
      message.success('删除成功');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await pipelineApi.update({ ...editingItem, ...values });
        message.success('修改成功');
      } else {
        await pipelineApi.create({ ...values, proId: 1 });
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const filteredData = data.filter(item =>
      item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const nowrapTitle = (text: string) => (
      <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
  );

  const columns: ColumnsType<Pipeline> = [
    {
      title: nowrapTitle('编号'),
      dataIndex: 'id',
      width: 90,
      align: 'center',
    },
    {
      title: nowrapTitle('管道名称'),
      dataIndex: 'name',
      width: 200,
      align: 'center',
      render: (text: string) => (
          <span style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {text}
        </span>
      ),
    },
    {
      title: nowrapTitle('长度（km）'),
      dataIndex: 'length',
      width: 120,
      align: 'center',
      render: (val: number) => (
          <span style={{ whiteSpace: 'nowrap' }}>
          {val?.toFixed(1)}
        </span>
      ),
    },
    {
      title: nowrapTitle('管径（mm）'),
      dataIndex: 'diameter',
      width: 120,
      align: 'center',
      render: (val: number) => (
          <span style={{ whiteSpace: 'nowrap' }}>
          {val}
        </span>
      ),
    },
    {
      title: nowrapTitle('壁厚（mm）'),
      dataIndex: 'thickness',
      width: 120,
      align: 'center',
      render: (val: number) => (
          <span style={{ whiteSpace: 'nowrap' }}>
          {val}
        </span>
      ),
    },
    {
      title: nowrapTitle('输量（m³/h）'),
      dataIndex: 'throughput',
      width: 140,
      align: 'center',
      render: (val: number) => (
          <span style={{ whiteSpace: 'nowrap' }}>
          {val}
        </span>
      ),
    },
    {
      title: nowrapTitle('起点高程（m）'),
      dataIndex: 'startAltitude',
      width: 140,
      align: 'center',
      render: (val: number) => (
          <span style={{ whiteSpace: 'nowrap' }}>
          {val}
        </span>
      ),
    },
    {
      title: nowrapTitle('终点高程（m）'),
      dataIndex: 'endAltitude',
      width: 140,
      align: 'center',
      render: (val: number) => (
          <span style={{ whiteSpace: 'nowrap' }}>
          {val}
        </span>
      ),
    },
    {
      title: nowrapTitle('操作'),
      key: 'action',
      width: 150,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
          <Space size="small">
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
                title="确定删除吗？"
                description="此操作不可恢复"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
            >
              <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  className={styles.actionBtn}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
      ),
    },
  ];

  return (
      <AnimatedPage className={styles.page}>
        <div className={styles.pageContent}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <div className={styles.headerInfo}>
                <h1 className={styles.title}>管道参数</h1>
                <p className={styles.subtitle}>管理管道的物理参数信息，包括长度、直径、壁厚和高程等</p>
              </div>
              <div className={styles.headerActions}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="middle">
                  新增管道
                </Button>
              </div>
            </div>
          </header>

          <Card className={styles.tableCard} bordered={false}>
            <div className={styles.toolbar}>
              <div className={styles.toolbarLeft}>
                <Input
                    placeholder="搜索管道名称..."
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className={styles.searchInput}
                    allowClear
                />
              </div>
              <div className={styles.toolbarRight}>
                <Tooltip title="刷新数据">
                  <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} />
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
                    <div
                        style={{
                          padding: 'var(--space-4)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-lg)',
                        }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15, marginBottom: 8 }}>
                        {record.name}
                      </div>
                      <div
                          style={{
                            fontSize: 13,
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                      >
                        <span>长度：{record.length?.toFixed(1)}</span>
                        <span>管径/壁厚：{record.diameter} / {record.thickness}</span>
                        <span>高程：{record.startAltitude} → {record.endAltitude}</span>
                        <span>输量：{record.throughput}</span>
                      </div>
                    </div>
                )}
            />
          </Card>

          <Modal
              title={editingItem ? '编辑管道' : '新增管道'}
              open={modalVisible}
              onOk={handleSubmit}
              onCancel={() => setModalVisible(false)}
              width={680}
              destroyOnClose
              className={styles.modal}
              okText="保存"
              cancelText="取消"
          >
            <Form form={form} layout="vertical">
              <Form.Item name="name" label="管道名称" rules={[{ required: true, message: '请输入管道名称' }]}>
                <Input placeholder="请输入管道名称" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="length" label="长度 (km)" rules={[{ required: true }]}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="diameter" label="管径 (mm)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="thickness" label="壁厚 (mm)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="throughput" label="输量 (m³/h)">
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