import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const SystemConfigPage: React.FC = () => {
  return (
    <Card bordered={false}>
      <Title level={3} style={{ marginTop: 0 }}>系统配置</Title>
      <Text type="secondary">页面待实现。</Text>
    </Card>
  );
};

export default SystemConfigPage;

