import React, { useState, useEffect } from 'react';
import { Card, Button, Select, message, Modal, Form, Input } from 'antd';
import { b2bService, ModelerWorkStatusDto } from '../services/b2bService';
import { webSocketService } from '../services/webSocketService';
import { useAuthStore } from '../stores/authStore';

const { Option } = Select;

const ModelerStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<ModelerWorkStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [modeForm] = Form.useForm();
  const [statusForm] = Form.useForm();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (user?.id && user?.role === 'MODELER') {
      webSocketService.connect(user.id, user.role);
    }

    return () => {
      webSocketService.disconnect();
    };
  }, [user]);

  const fetchStatus = async () => {
    try {
      const result = await b2bService.getModelerStatus();
      setStatus(result);
    } catch (error) {
      console.error('获取工作状态失败:', error);
    }
  };

  const handleUpdateMode = async () => {
    try {
      const values = modeForm.getFieldsValue();
      await b2bService.updateWorkMode(values.mode);
      message.success('工作模式更新成功');
      setShowModeModal(false);
      modeForm.resetFields();
      fetchStatus();
    } catch (error) {
      console.error('更新工作模式失败:', error);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      const values = statusForm.getFieldsValue();
      await b2bService.updateWorkStatus(values.status, values.reason);
      message.success('工作状态更新成功');
      setShowStatusModal(false);
      statusForm.resetFields();
      fetchStatus();
    } catch (error) {
      console.error('更新工作状态失败:', error);
    }
  };

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      AUTO: '自动接单',
      B2B_ONLY: '仅B2B',
      C2C_ONLY: '仅C2C',
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

  if (!status) {
    return <Card loading />;
  }

  return (
    <Card title="工作状态管理" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <span style={{ marginRight: 10 }}>工作模式：</span>
          <span className="ant-tag" style={{ padding: '4px 12px' }}>
            {getModeLabel(status.workMode)}
          </span>
          <Button
            type="link"
            onClick={() => setShowModeModal(true)}
            style={{ marginLeft: 10 }}
          >
            切换
          </Button>
        </div>
        
        <div>
          <span style={{ marginRight: 10 }}>工作状态：</span>
          <span 
            className="ant-tag" 
            style={{ 
              padding: '4px 12px',
              backgroundColor: getStatusColor(status.status) === 'green' ? '#52c41a' : 
                              getStatusColor(status.status) === 'orange' ? '#fa8c16' : 
                              getStatusColor(status.status) === 'red' ? '#f5222d' : '#d9d9d9',
              color: '#fff'
            }}
          >
            {getStatusLabel(status.status)}
          </span>
          <Button
            type="link"
            onClick={() => setShowStatusModal(true)}
            style={{ marginLeft: 10 }}
          >
            更改
          </Button>
        </div>

        <div>
          <span style={{ marginRight: 10 }}>待办任务：</span>
          <span className="ant-tag ant-tag-blue" style={{ padding: '4px 12px' }}>
            {status.todoCount} 个
          </span>
        </div>
      </div>

      {status.pauseReason && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fff7e6', borderRadius: 4 }}>
          <span style={{ color: '#fa8c16' }}>暂停原因：</span>
          <span>{status.pauseReason}</span>
        </div>
      )}

      <Modal
        title="切换工作模式"
        visible={showModeModal}
        footer={null}
        onCancel={() => setShowModeModal(false)}
      >
        <Form form={modeForm} layout="vertical" onFinish={handleUpdateMode}>
          <Form.Item
            name="mode"
            label="工作模式"
            rules={[{ required: true }]}
          >
            <Select placeholder="请选择工作模式">
              <Option value="AUTO">自动接单（B2B+C2C）</Option>
              <Option value="B2B_ONLY">仅处理B2B订单</Option>
              <Option value="C2C_ONLY">仅处理C2C订单</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              确认切换
            </Button>
            <Button onClick={() => setShowModeModal(false)}>取消</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="更改工作状态"
        visible={showStatusModal}
        footer={null}
        onCancel={() => setShowStatusModal(false)}
      >
        <Form form={statusForm} layout="vertical" onFinish={handleUpdateStatus}>
          <Form.Item
            name="status"
            label="工作状态"
            rules={[{ required: true }]}
          >
            <Select placeholder="请选择工作状态">
              <Option value="AVAILABLE">可接单</Option>
              <Option value="PAUSED">暂停接单</Option>
              <Option value="BUSY">忙碌中</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="备注（选填）">
            <Input.TextArea rows={3} placeholder="请输入原因（暂停接单时建议填写）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              确认更改
            </Button>
            <Button onClick={() => setShowStatusModal(false)}>取消</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ModelerStatusPanel;