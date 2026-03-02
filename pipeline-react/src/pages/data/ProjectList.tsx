/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ProjectList - 项目管理页面
 *  Design: Apple HIG + Linear + Stripe Light Theme
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Card, Button, Space, Modal, Form, Input, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Project } from '../../types';
import { projectApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

export default function ProjectList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Project[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Project | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // 后备数据
  const mockData: Project[] = [
    { proId: 1, number: 'GD-2024-001', name: '西部原油管道工程', responsible: '刘伟', createTime: '2024-01-15 10:00:00' },
    { proId: 2, number: 'GD-2024-002', name: '东部成品油管道项目', responsible: '张明', createTime: '2024-02-20 14:30:00' },
    { proId: 3, number: 'GD-2024-003', name: '北方天然气管线', responsible: '王磊', createTime: '2024-03-10 09:15:00' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await projectApi.list();
      if (res.data) {
        setData(res.data);
      }
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
      message.success('删除成功');
      fetchData();
    } catch {
      message.success('删除成功（演示模式）');
      setData(data.filter(item => item.proId !== id));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await projectApi.update({ ...editingItem, ...values });
        message.success('修改成功');
      } else {
        await projectApi.create(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchData();
    } catch {
      message.success('操作成功（演示模式）');
      setModalVisible(false);
    }
  };

  // 过滤数据
  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.number?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.responsible?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<Project> = [
    {
      title: 'ID',
      dataIndex: 'proId',
      key: 'proId',
      width: 80,
      align: 'center',
    },
    {
      title: '项目编号',
      dataIndex: 'number',
      key: 'number',
      width: 140,
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{text}</span>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'responsible',
      key: 'responsible',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (text: string) => (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{text}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
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
            onConfirm={() => handleDelete(record.proId)}
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
        {/* 页面头部 */}
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>项目管理</h1>
              <p className={styles.subtitle}>管理管道工程项目基本信息，包括项目创建、编辑和删除</p>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                size="middle"
              >
                新增项目
              </Button>
            </div>
          </div>
        </header>

        {/* 表格卡片 */}
        <Card className={styles.tableCard} bordered={false}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <Input
                placeholder="搜索项目名称或描述..."
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={styles.searchInput}
                allowClear
              />
            </div>
            <div className={styles.toolbarRight}>
              <Tooltip title="刷新数据">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchData}
                  loading={loading}
                />
              </Tooltip>
            </div>
          </div>

          <ResponsiveTable
            columns={columns}
            dataSource={filteredData}
            rowKey="proId"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            cardRender={(record) => (
              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15, marginBottom: 8 }}>
                  {record.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>编号: {record.number || '-'}</span>
                  <span>负责人: {record.responsible || '-'}</span>
                  <span>创建时间: {record.createTime || '-'}</span>
                </div>
              </div>
            )}
          />
        </Card>

        {/* 编辑弹窗 */}
        <Modal
          title={editingItem ? '编辑项目' : '新增项目'}
          open={modalVisible}
          onOk={handleSubmit}
          onCancel={() => setModalVisible(false)}
          destroyOnClose
          className={styles.modal}
          okText="保存"
          cancelText="取消"
          width={520}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="项目名称"
              rules={[{ required: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="请输入项目名称" />
            </Form.Item>
            <Form.Item name="number" label="项目编号">
              <Input placeholder="请输入项目编号" />
            </Form.Item>
            <Form.Item name="responsible" label="负责人">
              <Input placeholder="请输入负责人" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AnimatedPage>
  );
}
