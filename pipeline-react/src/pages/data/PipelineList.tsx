import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { pipelineApi, projectApi } from '../../api';
import type { Pipeline, Project } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

const EMPTY_PIPELINE: Partial<Pipeline> = {
  name: '',
  length: 0,
  diameter: 0,
  thickness: 0,
  throughput: 0,
  startAltitude: 0,
  endAltitude: 0,
  roughness: 0.03,
  workTime: 8000,
};

export default function PipelineList() {
  const [form] = Form.useForm<Pipeline>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [open, setOpen] = useState(false);

  const loadProjects = async () => {
    const response = await projectApi.list();
    const projectList = response.data ?? [];
    setProjects(projectList);
    if (!selectedProjectId && projectList.length > 0) {
      setSelectedProjectId(projectList[0].proId);
    }
  };

  const loadPipelines = async (projectId: number) => {
    setLoading(true);
    try {
      const response = await pipelineApi.listByProject(projectId);
      setPipelines(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void loadPipelines(selectedProjectId);
    }
  }, [selectedProjectId]);

  const filteredPipelines = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return pipelines;
    }

    return pipelines.filter((pipeline) => pipeline.name.toLowerCase().includes(normalized));
  }, [keyword, pipelines]);

  const handleCreate = () => {
    if (!selectedProjectId) {
      message.warning('请先创建项目');
      return;
    }
    setEditing(null);
    form.setFieldsValue({ ...(EMPTY_PIPELINE as Pipeline), proId: selectedProjectId });
    setOpen(true);
  };

  const handleEdit = (pipeline: Pipeline) => {
    setEditing(pipeline);
    form.setFieldsValue(pipeline);
    setOpen(true);
  };

  const handleDelete = async (pipelineId: number) => {
    await pipelineApi.delete([pipelineId]);
    message.success('管道已删除');
    if (selectedProjectId) {
      await loadPipelines(selectedProjectId);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProjectId) {
      message.warning('请先选择项目');
      return;
    }

    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = { ...values, proId: selectedProjectId };
      if (editing) {
        await pipelineApi.update({ ...editing, ...payload });
        message.success('管道已更新');
      } else {
        await pipelineApi.create(payload);
        message.success('管道已创建');
      }
      setOpen(false);
      await loadPipelines(selectedProjectId);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Pipeline> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '管道名称', dataIndex: 'name' },
    { title: '长度(km)', dataIndex: 'length' },
    { title: '外径(mm)', dataIndex: 'diameter' },
    { title: '壁厚(mm)', dataIndex: 'thickness' },
    { title: '起点高程(m)', dataIndex: 'startAltitude' },
    { title: '终点高程(m)', dataIndex: 'endAltitude' },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, pipeline) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(pipeline)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条管道吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(pipeline.id)}
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
        title="管道参数管理"
        extra={
          <Space>
            <Select<number>
              style={{ width: 240 }}
              placeholder="请选择项目"
              value={selectedProjectId ?? undefined}
              onChange={setSelectedProjectId}
              options={projects.map((project) => ({ value: project.proId, label: project.name }))}
            />
            <Input.Search
              placeholder="搜索管道名称"
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 220 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => selectedProjectId && void loadPipelines(selectedProjectId)}
              loading={loading}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建管道
            </Button>
          </Space>
        }
      >
        <Table<Pipeline>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredPipelines}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editing ? '编辑管道' : '新建管道'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnClose
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form<Pipeline> form={form} layout="vertical">
          <Form.Item name="name" label="管道名称" rules={[{ required: true, message: '请输入管道名称' }]}>
            <Input placeholder="请输入管道名称" />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="length" label="长度(km)" rules={[{ required: true, message: '请输入长度' }]}>
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="diameter" label="外径(mm)" rules={[{ required: true, message: '请输入外径' }]}>
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="thickness" label="壁厚(mm)" rules={[{ required: true, message: '请输入壁厚' }]}>
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="throughput" label="设计输量">
              <InputNumber min={0} precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="startAltitude" label="起点高程(m)">
              <InputNumber precision={2} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="endAltitude" label="终点高程(m)">
              <InputNumber precision={2} style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="roughness" label="粗糙度(m)">
              <InputNumber min={0} precision={4} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="workTime" label="年工作时长(h)">
              <InputNumber min={0} precision={0} style={{ width: 150 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </AnimatedPage>
  );
}
