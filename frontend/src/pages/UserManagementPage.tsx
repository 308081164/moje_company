import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { userService } from '@/services/userService';
import type { UserInfo } from '@/types/auth';
import { UserRole, UserStatus } from '@/types/auth';

const { Title } = Typography;

const roleOptions = [
  { label: '管理员', value: UserRole.ADMIN },
  { label: '售前客服', value: UserRole.PRE_SALES },
  { label: '售中客服', value: UserRole.SALES },
  { label: '设计师', value: UserRole.DESIGNER },
  { label: '建模师', value: UserRole.MODELER },
  { label: '信息化数据归档师', value: UserRole.DATA_ARCHIVIST },
  { label: '跟单员', value: UserRole.TRACKER },
];

const statusOptions = [
  { label: '活跃', value: UserStatus.ACTIVE },
  { label: '停用', value: UserStatus.INACTIVE },
  { label: '已删除', value: UserStatus.DELETED },
];

const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  LOCKED: 'warning',
  DELETED: 'error',
};

const UserManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [searchForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editing, setEditing] = useState<UserInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const values = searchForm.getFieldsValue();
      const res = await userService.getUsers({
        page,
        size,
        username: values.username || undefined,
        realName: values.realName || undefined,
        role: values.role || undefined,
        status: values.status || undefined,
      });
      setData(res.content || []);
      setTotal(res.totalElements ?? 0);
    } catch (e) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, size, searchForm]);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async () => {
    try {
      const v = await createForm.validateFields();
      await userService.createUser({
        username: v.username,
        password: v.password,
        realName: v.realName,
        phone: v.phone,
        email: v.email,
        role: v.role,
        status: v.status || UserStatus.ACTIVE,
      });
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch {
      /* validated */
    }
  };

  const onEdit = async () => {
    if (!editing) return;
    try {
      const v = await editForm.validateFields();
      await userService.updateUser(editing.id, {
        realName: v.realName,
        phone: v.phone,
        email: v.email,
        role: v.role,
        status: v.status,
      });
      message.success('保存成功');
      setEditOpen(false);
      setEditing(null);
      load();
    } catch {
      /* validated */
    }
  };

  const onResetPwd = async () => {
    if (!editing) return;
    try {
      const v = await resetForm.validateFields();
      await userService.resetPassword({
        userId: editing.id,
        newPassword: v.newPassword,
        confirmPassword: v.confirmPassword,
      });
      message.success('密码已重置');
      setResetOpen(false);
      resetForm.resetFields();
      setEditing(null);
    } catch {
      /* validated */
    }
  };

  const columns: ColumnsType<UserInfo> = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    { title: '姓名', dataIndex: 'realName', key: 'realName', width: 120 },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 110,
      render: (r: string) => roleOptions.find((x) => x.value === r)?.label || r,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag color={statusColor[s] || 'default'}>{statusOptions.find((x) => x.value === s)?.label || s}</Tag>
      ),
    },
    { title: '手机', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditing(record);
              editForm.setFieldsValue({
                realName: record.realName,
                phone: record.phone,
                email: record.email,
                role: record.role,
                status: record.status,
              });
              setEditOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditing(record);
              resetForm.resetFields();
              setResetOpen(true);
            }}
          >
            重置密码
          </Button>
          {record.status === UserStatus.ACTIVE ? (
            <Button type="link" size="small" danger onClick={() => handleDisable(record.id)}>
              禁用
            </Button>
          ) : (
            <Button type="link" size="small" onClick={() => handleEnable(record.id)}>
              启用
            </Button>
          )}
          <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDelete = async (id: number) => {
    try {
      await userService.deleteUser(id);
      message.success('已删除');
      load();
    } catch {
      /* api handled */
    }
  };

  const handleEnable = async (id: number) => {
    try {
      await userService.enableUser(id);
      message.success('已启用');
      load();
    } catch {
      /* api handled */
    }
  };

  const handleDisable = async (id: number) => {
    try {
      await userService.disableUser(id);
      message.success('已禁用');
      load();
    } catch {
      /* api handled */
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        用户管理
      </Title>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={() => setPage(0)}>
          <Form.Item name="username" label="用户名">
            <Input allowClear placeholder="模糊搜索" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="realName" label="姓名">
            <Input allowClear placeholder="模糊搜索" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear placeholder="全部" style={{ width: 140 }} options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select allowClear placeholder="全部" style={{ width: 120 }} options={statusOptions} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                查询
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => { searchForm.resetFields(); setPage(0); load(); }}>
                重置
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
                新建用户
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card bordered={false}>
        <Table<UserInfo>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 1100 }}
          pagination={{
            current: page + 1,
            pageSize: size,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p - 1);
              setSize(ps || 10);
            },
          }}
        />
      </Card>

      <Modal
        title="新建用户"
        open={createOpen}
        onOk={onCreate}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="realName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={UserStatus.ACTIVE}>
            <Select options={statusOptions.filter((s) => s.value !== UserStatus.DELETED)} />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑用户" open={editOpen} onOk={onEdit} onCancel={() => setEditOpen(false)} destroyOnClose width={520}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="realName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editing ? `重置密码：${editing.username}` : '重置密码'}
        open={resetOpen}
        onOk={onResetPwd}
        onCancel={() => { setResetOpen(false); setEditing(null); }}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  if (!v || getFieldValue('newPassword') === v) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
