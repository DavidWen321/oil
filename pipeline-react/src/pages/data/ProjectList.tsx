import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { projectApi } from '../../api';
import type { Project } from '../../types';
import AnimatedPage from '../../components/common/AnimatedPage';

const EMPTY_PROJECT: Partial<Project> = {
  name: '',
  number: '',
  responsible: '',
};

export default function ProjectList() {
  const [form] = Form.useForm<Project>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await projectApi.list();
      setProjects(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return projects;
    }

    return projects.filter((project) =>
      [project.name, project.number, project.responsible]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [keyword, projects]);

  const handleCreate = () => {
    setEditing(null);
    form.setFieldsValue(EMPTY_PROJECT as Project);
    setOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditing(project);
    form.setFieldsValue(project);
    setOpen(true);
  };

  const handleDelete = async (projectId: number) => {
    await projectApi.delete([projectId]);
    message.success('项目已删除');
    await loadProjects();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await projectApi.update({ ...editing, ...values });
        message.success('项目已更新');
      } else {
        await projectApi.create(values);
        message.success('项目已创建');
      }
      setOpen(false);
      await loadProjects();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Project> = [
    {
      title: 'ID',
      dataIndex: 'proId',
      width: 80,
    },
    {
      title: '项目编号',
      dataIndex: 'number',
      render: (value?: string) => value ? <Tag color="blue">{value}</Tag> : '-',
    },
    {
      title: '项目名称',
      dataIndex: 'name',
    },
    {
      title: '负责人',
      dataIndex: 'responsible',
      render: (value?: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, project) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(project)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个项目吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(project.proId)}
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
        title="项目管理"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索项目名称 / 编号 / 负责人"
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadProjects()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建项目
            </Button>
          </Space>
        }
      >
        <Table<Project>
          rowKey="proId"
          loading={loading}
          columns={columns}
          dataSource={filteredProjects}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editing ? '编辑项目' : '新建项目'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnClose
        okText="保存"
        cancelText="取消"
      >
        <Form<Project> form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：西部原油输送项目" />
          </Form.Item>
          <Form.Item name="number" label="项目编号">
            <Input placeholder="例如：PIPE-2026-001" />
          </Form.Item>
          <Form.Item name="responsible" label="负责人">
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>
        </Form>
      </Modal>
    </AnimatedPage>
  );
}
