import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const UserManagementPage: React.FC = () => {
  return (
    <Card bordered={false}>
      <Title level={3} style={{ marginTop: 0 }}>用户管理</Title>
      <Text type="secondary">页面待实现。</Text>
    </Card>
  );
};

export default UserManagementPage;

