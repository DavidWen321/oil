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
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { pumpStationApi } from '../../api';
import type { PumpStation } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';
import { useDebounce } from '../../hooks/useDebounce';

const EMPTY_PUMP_STATION: Partial<PumpStation> = {
  name: '',
  pumpEfficiency: 80,
  electricEfficiency: 95,
  displacement: 0,
  comePower: 0,
  zmi480Lift: 0,
  zmi375Lift: 0,
};

export default function PumpStationList() {
  const [form] = Form.useForm<PumpStation>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stations, setStations] = useState<PumpStation[]>([]);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<PumpStation | null>(null);
  const [open, setOpen] = useState(false);

  const loadStations = async () => {
    setLoading(true);
    try {
      const response = await pumpStationApi.list();
      setStations(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStations();
  }, []);

  // 防抖搜索关键词
  const debouncedKeyword = useDebounce(keyword, 300);

  const filteredStations = useMemo(() => {
    const normalized = debouncedKeyword.trim().toLowerCase();
    if (!normalized) {
      return stations;
    }
    return stations.filter((station) => station.name.toLowerCase().includes(normalized));
  }, [debouncedKeyword, stations]);

  const handleCreate = () => {
    setEditing(null);
    form.setFieldsValue(EMPTY_PUMP_STATION as PumpStation);
    setOpen(true);
  };

  const handleEdit = (station: PumpStation) => {
    setEditing(station);
    form.setFieldsValue(station);
    setOpen(true);
  };

  const handleDelete = async (stationId: number) => {
    await pumpStationApi.delete([stationId]);
    message.success('泵站已删除');
    await loadStations();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await pumpStationApi.update({ ...editing, ...values });
        message.success('泵站已更新');
      } else {
        await pumpStationApi.create(values);
        message.success('泵站已创建');
      }
      setOpen(false);
      await loadStations();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<PumpStation> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '泵站名称', dataIndex: 'name' },
    { title: '泵效率(%)', dataIndex: 'pumpEfficiency' },
    { title: '电机效率(%)', dataIndex: 'electricEfficiency' },
    { title: '排量(m³/h)', dataIndex: 'displacement' },
    { title: '来压(MPa)', dataIndex: 'comePower' },
    { title: 'ZMI480扬程(m)', dataIndex: 'zmi480Lift' },
    { title: 'ZMI375扬程(m)', dataIndex: 'zmi375Lift' },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, station) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(station)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个泵站吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(station.id)}
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
        title="泵站参数管理"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索泵站名称"
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 220 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadStations()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建泵站
            </Button>
          </Space>
        }
      >
        <Table<PumpStation>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredStations}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editing ? '编辑泵站' : '新建泵站'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnClose
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form<PumpStation> form={form} layout="vertical">
          <Form.Item name="name" label="泵站名称" rules={[{ required: true, message: '请输入泵站名称' }]}>
            <Input placeholder="请输入泵站名称" />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="pumpEfficiency" label="泵效率(%)">
              <InputNumber min={0} max={100} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="electricEfficiency" label="电机效率(%)">
              <InputNumber min={0} max={100} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="displacement" label="排量(m³/h)">
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="comePower" label="来压(MPa)">
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="zmi480Lift" label="ZMI480扬程(m)">
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="zmi375Lift" label="ZMI375扬程(m)">
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </AnimatedPage>
  );
}
