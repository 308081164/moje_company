import React from 'react';
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

      <Text type="secondary">
        说明：当前设置保存于本地，仅对当前设备与当前账号生效。
      </Text>
    </Space>
  );
};

export default SettingsPage;
