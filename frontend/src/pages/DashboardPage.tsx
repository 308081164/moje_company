import React from 'react';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import { ShoppingCartOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>仪表盘</Title>
      <Text type="secondary">欢迎回来，{user?.realName || user?.username}</Text>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card bordered={false}>
            <Statistic title="订单（示例）" value={0} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col span={12}>
          <Card bordered={false}>
            <Statistic title="用户（示例）" value={0} prefix={<UserOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;

