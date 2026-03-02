/**
 * PumpStationList - 泵站参数管理页面
 */

import { useState, useEffect } from 'react';
import { Card, Button, Space, Modal, Form, Input, InputNumber, message, Popconfirm, Tooltip, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PumpStation } from '../../types';
import { pumpStationApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

export default function PumpStationList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PumpStation[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PumpStation | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await pumpStationApi.list();
      if (res.data) {
        setData(res.data);
      }
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
        await pumpStationApi.update({ ...editingItem, ...values });
        message.success('修改成功');
      } else {
        await pumpStationApi.create(values);
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

  const columns: ColumnsType<PumpStation> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      align: 'center',
    },
    {
      title: '泵站名称',
      dataIndex: 'name',
      render: (text: string) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{text}</span>
      ),
    },
    {
      title: '泵效率(%)',
      dataIndex: 'pumpEfficiency',
      width: 100,
      align: 'right',
      render: (val: number) => (
        <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{val}</span>
      ),
    },
    {
      title: '电效率(%)',
      dataIndex: 'electricEfficiency',
      width: 100,
      align: 'right',
    },
    {
      title: '排量(m³/h)',
      dataIndex: 'displacement',
      width: 110,
      align: 'right',
    },
    {
      title: '来压(MPa)',
      dataIndex: 'comePower',
      width: 100,
      align: 'right',
      render: (val: number) => val?.toFixed(2),
    },
    {
      title: 'ZMI480扬程(m)',
      dataIndex: 'zmi480Lift',
      width: 130,
      align: 'right',
    },
    {
      title: 'ZMI375扬程(m)',
      dataIndex: 'zmi375Lift',
      width: 130,
      align: 'right',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} className={styles.actionBtn}>编辑</Button>
          <Popconfirm title="确定删除吗？" description="此操作不可恢复" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} className={styles.actionBtn}>删除</Button>
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
              <h1 className={styles.title}>泵站参数</h1>
              <p className={styles.subtitle}>管理泵站设备参数信息，包括泵效率、排量和扬程等</p>
            </div>
            <div className={styles.headerActions}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="middle">新增泵站</Button>
            </div>
          </div>
        </header>

        <Card className={styles.tableCard} bordered={false}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Input placeholder="搜索泵站名称..." prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />} value={searchText} onChange={(e) => setSearchText(e.target.value)} className={styles.searchInput} allowClear />
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title="刷新数据"><Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} /></Tooltip>
            </div>
          </div>

          <ResponsiveTable
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条记录` }}
            cardRender={(record) => (
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15, marginBottom: 8 }}>{record.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>泵效率: {record.pumpEfficiency}% | 电效率: {record.electricEfficiency}%</span>
                  <span>排量: {record.displacement} m³/h | 来压: {record.comePower} MPa</span>
                  <span>ZMI480: {record.zmi480Lift}m | ZMI375: {record.zmi375Lift}m</span>
                </div>
              </div>
            )}
          />
        </Card>

        <Modal title={editingItem ? '编辑泵站' : '新增泵站'} open={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)} destroyOnClose className={styles.modal} okText="保存" cancelText="取消" width={600}>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="泵站名称" rules={[{ required: true, message: '请输入泵站名称' }]}>
              <Input placeholder="请输入泵站名称" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="pumpEfficiency" label="泵效率 (%)"><InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="electricEfficiency" label="电效率 (%)"><InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="displacement" label="排量 (m³/h)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="comePower" label="来压 (MPa)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="zmi480Lift" label="ZMI480扬程 (m)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="zmi375Lift" label="ZMI375扬程 (m)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
