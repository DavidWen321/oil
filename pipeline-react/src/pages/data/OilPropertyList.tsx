/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OilPropertyList - 油品特性管理页面
 *  Design: Apple HIG + Linear + Stripe Light Theme
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Card, Button, Space, Modal, Form, Input, InputNumber, message, Popconfirm, Tooltip, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { OilProperty } from '../../types';
import { oilPropertyApi } from '../../api';
import AnimatedPage from '../../components/common/AnimatedPage';
import ResponsiveTable from '../../components/common/ResponsiveTable';
import styles from './DataPage.module.css';

export default function OilPropertyList() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<OilProperty[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<OilProperty | null>(null);
    const [searchText, setSearchText] = useState('');
    const [form] = Form.useForm();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await oilPropertyApi.list();
            if (res.data) {
                setData(res.data);
            }
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
                await oilPropertyApi.update({ ...editingItem, ...values });
                message.success('修改成功');
            } else {
                await oilPropertyApi.create(values);
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

    const getDensityClass = (density: number) => {
        if (density < 850) return { label: '轻质', color: 'var(--semantic-success)' };
        if (density < 900) return { label: '中质', color: 'var(--accent-primary)' };
        return { label: '重质', color: 'var(--semantic-warning)' };
    };

    const nowrapTitle = (text: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
    );

    const columns: ColumnsType<OilProperty> = [
        {
            title: nowrapTitle('编号'),
            dataIndex: 'id',
            width: 90,
            align: 'center',
        },
        {
            title: nowrapTitle('油品名称'),
            dataIndex: 'name',
            width: 220,
            align: 'center',
            render: (text: string) => (
                <span
                    style={{
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                    }}
                >
          {text}
        </span>
            ),
        },
        {
            title: nowrapTitle('密度（kg/m³）'),
            dataIndex: 'density',
            width: 220,
            align: 'center',
            render: (val: number) => {
                const cls = getDensityClass(val);
                return (
                    <span style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: cls.color, fontWeight: 500 }}>{val}</span>
            <span
                style={{
                    display: 'inline-block',
                    marginLeft: 8,
                    padding: '2px 8px',
                    fontSize: 'var(--text-xs)',
                    borderRadius: 'var(--radius-sm)',
                    background: `color-mix(in srgb, ${cls.color} 12%, transparent)`,
                    color: cls.color,
                }}
            >
              {cls.label}
            </span>
          </span>
                );
            },
        },
        {
            title: nowrapTitle('运动粘度（mm²/s）'),
            dataIndex: 'viscosity',
            width: 180,
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
                            <h1 className={styles.title}>油品特性</h1>
                            <p className={styles.subtitle}>管理油品物性参数，包括密度、粘度和计量温度等</p>
                        </div>
                        <div className={styles.headerActions}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                                size="middle"
                            >
                                新增油品
                            </Button>
                        </div>
                    </div>
                </header>

                <Card className={styles.tableCard} bordered={false}>
                    <div className={styles.toolbar}>
                        <div className={styles.toolbarLeft}>
                            <Input
                                placeholder="搜索油品名称..."
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
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 900 }}
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total) => `共 ${total} 条记录`,
                            className: styles.paginationElegant,
                        }}
                        cardRender={(record) => {
                            const cls = getDensityClass(record.density);
                            return (
                                <div
                                    style={{
                                        padding: 'var(--space-4)',
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-lg)',
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            fontSize: 15,
                                            marginBottom: 8,
                                        }}
                                    >
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
                    <span>
                      密度：<span style={{ color: cls.color }}>{record.density}</span>（{cls.label}）
                    </span>
                                        <span>运动粘度：{record.viscosity}</span>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </Card>

                <Modal
                    title={editingItem ? '编辑油品' : '新增油品'}
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
                            label="油品名称"
                            rules={[{ required: true, message: '请输入油品名称' }]}
                        >
                            <Input placeholder="请输入油品名称" />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="density"
                                    label="密度 (kg/m³)"
                                    rules={[{ required: true, message: '请输入密度' }]}
                                >
                                    <InputNumber
                                        min={0}
                                        style={{ width: '100%' }}
                                        placeholder="0"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="viscosity"
                                    label="运动粘度 (mm²/s)"
                                    rules={[{ required: true, message: '请输入粘度' }]}
                                >
                                    <InputNumber
                                        min={0}
                                        precision={2}
                                        style={{ width: '100%' }}
                                        placeholder="0.00"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            </div>
        </AnimatedPage>
    );
}