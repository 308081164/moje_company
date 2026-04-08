import React, { useState } from 'react';
import { Button, Card, Form, Select, Space, Switch, Typography, message } from 'antd';

const { Title, Text } = Typography;

type SettingsForm = {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  autoRefreshOrders: boolean;
};

const STORAGE_KEY = 'app_settings_v1';

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm<SettingsForm>();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const initialValues: SettingsForm = {
    theme: 'light',
    compactMode: false,
    autoRefreshOrders: true,
    ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<SettingsForm>),
  };

  const handleSave = (values: SettingsForm) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    message.success('设置已保存');
  };

  const handleCheckUpdate = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      message.info('当前环境不支持自动更新检查');
      return;
    }

    setCheckingUpdate(true);
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result?.checked) {
        message.success('已发起更新检查，请稍候查看通知');
      } else {
        message.info('当前环境为开发模式，未执行更新检查');
      }
    } catch (error) {
      console.error('手动检查更新失败:', error);
      message.error('检查更新失败，请稍后重试');
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>
        设置
      </Title>

      <Card bordered={false}>
        <Form<SettingsForm>
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleSave}
        >
          <Form.Item<SettingsForm> label="主题模式" name="theme">
            <Select
              options={[
                { label: '浅色', value: 'light' },
                { label: '深色', value: 'dark' },
                { label: '跟随系统', value: 'system' },
              ]}
            />
          </Form.Item>

          <Form.Item<SettingsForm> label="紧凑布局" name="compactMode" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item<SettingsForm>
            label="订单列表自动刷新"
            name="autoRefreshOrders"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit">
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card bordered={false} title="应用更新">
        <Space direction="vertical">
          <Text type="secondary">
            可主动检查是否有新版本可下载，若检测到更新会在右上角通知并自动下载。
          </Text>
          <Button onClick={handleCheckUpdate} loading={checkingUpdate}>
            手动检查更新
          </Button>
        </Space>
      </Card>

      <Text type="secondary">
        说明：当前设置保存于本地，仅对当前设备与当前账号生效。
      </Text>
    </Space>
  );
};

export default SettingsPage;
