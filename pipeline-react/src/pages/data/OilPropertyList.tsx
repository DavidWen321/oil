import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { oilPropertyApi } from '../../api';
import type { OilProperty } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

const EMPTY_OIL: Partial<OilProperty> = {
  name: '',
  density: 850,
  viscosity: 20,
};

function getDensityTagColor(density: number): string {
  if (density >= 920) return 'volcano';
  if (density >= 860) return 'gold';
  return 'green';
}

export default function OilPropertyList() {
  const [form] = Form.useForm<OilProperty>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oils, setOils] = useState<OilProperty[]>([]);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<OilProperty | null>(null);
  const [open, setOpen] = useState(false);

  const loadOils = async () => {
    setLoading(true);
    try {
      const response = await oilPropertyApi.list();
      setOils(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOils();
  }, []);

  const filteredOils = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return oils;
    }
    return oils.filter((oil) => oil.name.toLowerCase().includes(normalized));
  }, [keyword, oils]);

  const handleCreate = () => {
    setEditing(null);
    form.setFieldsValue(EMPTY_OIL as OilProperty);
    setOpen(true);
  };

  const handleEdit = (oil: OilProperty) => {
    setEditing(oil);
    form.setFieldsValue(oil);
    setOpen(true);
  };

  const handleDelete = async (oilId: number) => {
    await oilPropertyApi.delete([oilId]);
    message.success('油品已删除');
    await loadOils();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await oilPropertyApi.update({ ...editing, ...values });
        message.success('油品已更新');
      } else {
        await oilPropertyApi.create(values);
        message.success('油品已创建');
      }
      setOpen(false);
      await loadOils();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<OilProperty> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '油品名称', dataIndex: 'name' },
    {
      title: '密度(kg/m³)',
      dataIndex: 'density',
      render: (value: number) => <Tag color={getDensityTagColor(value)}>{value}</Tag>,
    },
    { title: '运动粘度(mm²/s)', dataIndex: 'viscosity' },
    { title: '更新时间', dataIndex: 'updateTime', render: (value?: string) => value || '-' },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, oil) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(oil)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个油品吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(oil.id)}
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <Card
        title="油品物性管理"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索油品名称"
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 220 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadOils()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建油品
            </Button>
          </Space>
        }
      >
        <Table<OilProperty>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredOils}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editing ? '编辑油品' : '新建油品'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnClose
        okText="保存"
        cancelText="取消"
      >
        <Form<OilProperty> form={form} layout="vertical">
          <Form.Item name="name" label="油品名称" rules={[{ required: true, message: '请输入油品名称' }]}>
            <Input placeholder="请输入油品名称" />
          </Form.Item>
          <Form.Item name="density" label="密度(kg/m³)" rules={[{ required: true, message: '请输入密度' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="viscosity" label="运动粘度(mm²/s)" rules={[{ required: true, message: '请输入粘度' }]}>
            <InputNumber min={0} precision={4} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </AnimatedPage>
  );
}
