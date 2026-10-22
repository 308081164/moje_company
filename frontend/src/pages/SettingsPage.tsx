import React, { useMemo, useState } from 'react';
import { Button, Card, Form, Input, Select, Space, Switch, Table, Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { resolvePublicSites } from '@/utils/publicSites';

const { Title, Text, Paragraph } = Typography;

type SettingsForm = {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  autoRefreshOrders: boolean;
};

const STORAGE_KEY = 'app_settings_v1';

type ShareLink = {
  key: string;
  name: string;
  usage: string;
  url: string;
};

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm<SettingsForm>();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const initialValues: SettingsForm = {
    theme: 'light',
    compactMode: false,
    autoRefreshOrders: true,
    ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<SettingsForm>),
  };

  const shareLinks = useMemo<ShareLink[]>(() => {
    const { portal, cend } = resolvePublicSites();
    return [
      { key: 'b2b-home', name: 'B2B 客户门户', usage: '发给企业客户浏览门户首页', url: `${portal}/` },
      { key: 'b2b-portal', name: 'B2B 下单入口', usage: '企业客户登录后提交定制需求', url: `${portal}/portal` },
      { key: 'b2b-orders', name: 'B2B 我的订单', usage: '企业客户查看自己的订单列表', url: `${portal}/portal/b2b/my-orders` },
      { key: 'b2b-chat', name: '客户沟通页', usage: '客户与工作室在线沟通', url: `${portal}/portal/chat` },
      { key: 'c-home', name: 'C 端官网', usage: '发给终端客户看品牌官网', url: `${cend}/` },
      { key: 'c-workspace', name: 'C 端订单工作台', usage: '终端客户查看/跟进自己的订单', url: `${cend}/order-workspace.html` },
      { key: 'c-my-orders', name: 'C 端我的订单', usage: '终端客户登录后的订单列表', url: `${portal}/portal/c/my-orders` },
    ];
  }, []);

  const handleSave = (values: SettingsForm) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    message.success('设置已保存');
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选择链接');
    }
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

      <Card bordered={false} title="分享链接">
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          复制后可发给客户或同事。链接根据当前员工端连接的服务器自动生成。
        </Paragraph>
        <Table<ShareLink>
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={shareLinks}
          columns={[
            { title: '页面', dataIndex: 'name', width: 160 },
            { title: '用途', dataIndex: 'usage' },
            {
              title: '链接',
              dataIndex: 'url',
              render: (url: string) => (
                <Input value={url} readOnly onFocus={(e) => e.target.select()} />
              ),
            },
            {
              title: '',
              width: 88,
              render: (_, row) => (
                <Button type="link" icon={<CopyOutlined />} onClick={() => { void copyText(row.url); }}>
                  复制
                </Button>
              ),
            },
          ]}
        />
      </Card>

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
