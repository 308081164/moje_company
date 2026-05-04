import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, message, Space } from 'antd';
import { b2bService, ModelerWorkStatusDto } from '../services/b2bService';
import { webSocketService } from '../services/webSocketService';
import { useAuthStore } from '../stores/authStore';

const { Column } = Table;

const AdminMonitorPage: React.FC = () => {
  const [modelers, setModelers] = useState<ModelerWorkStatusDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm] = Form.useForm();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchModelers();

    if (user?.id && user?.role === 'ADMIN') {
      webSocketService.connect(user.id, user.role);
    }

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  const fetchModelers = async () => {
    try {
      setLoading(true);
      const result = await b2bService.getAllModelerStatus();
      setModelers(result);
    } catch (error) {
      console.error('获取建模师状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      const values = emailForm.getFieldsValue();
      message.success('邮箱配置已保存');
      setShowEmailModal(false);
      emailForm.resetFields();
    } catch (error) {
      console.error('保存邮箱失败:', error);
    }
  };

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      AUTO: '自动接单',
    };
    return labels[mode] || mode;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      AVAILABLE: '可接单',
      PAUSED: '已暂停',
      BUSY: '忙碌',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'green';
      case 'PAUSED':
        return 'orange';
      case 'BUSY':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <div>
      <Card title="系统监控" style={{ marginBottom: 20 }}>
        <Space>
          <Button type="primary" onClick={fetchModelers}>
            刷新状态
          </Button>
          <Button onClick={() => setShowEmailModal(true)}>
            设置提醒邮箱
          </Button>
        </Space>
      </Card>

      <Card title="建模师工作状态">
        <Table
          loading={loading}
          dataSource={modelers}
          rowKey="userId"
          pagination={false}
        >
          <Column title="用户名" dataIndex="username" />
          <Column title="真实姓名" dataIndex="realName" />
          <Column 
            title="工作模式" 
            dataIndex="workMode" 
            render={(mode: string) => <Tag>{getModeLabel(mode)}</Tag>}
          />
          <Column 
            title="工作状态" 
            dataIndex="status" 
            render={(status: string) => (
              <Tag color={getStatusColor(status)}>
                {getStatusLabel(status)}
              </Tag>
            )}
          />
          <Column 
            title="待办任务" 
            dataIndex="todoCount" 
            render={(count: number) => (
              <Tag color={count > 0 ? 'blue' : 'gray'}>
                {count} 个
              </Tag>
            )}
          />
          <Column 
            title="暂停原因" 
            dataIndex="pauseReason" 
            render={(reason: string) => reason || '-'}
          />
        </Table>
      </Card>

      <Card title="系统通知">
        <p>系统会通过WebSocket实时推送以下通知：</p>
        <ul>
          <li>新订单创建通知</li>
          <li>订单状态变更通知</li>
          <li>订单驳回通知</li>
        </ul>
        <p style={{ color: '#1890ff' }}>
          当前WebSocket连接状态：{webSocketService.isConnected() ? '已连接' : '未连接'}
        </p>
      </Card>

      <Modal
        title="设置提醒邮箱"
        visible={showEmailModal}
        footer={null}
        onCancel={() => setShowEmailModal(false)}
      >
        <Form form={emailForm} layout="vertical" onFinish={handleSaveEmail}>
          <Form.Item
            name="email"
            label="管理员邮箱"
            rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
          >
            <Input placeholder="请输入管理员邮箱" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              保存
            </Button>
            <Button onClick={() => setShowEmailModal(false)}>取消</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminMonitorPage;