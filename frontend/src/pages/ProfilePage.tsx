import React from 'react';
import { Card, Descriptions, Space, Tag, Typography } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { UserStatus } from '@/types/auth';

const { Title, Text } = Typography;

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const statusTextMap: Record<UserStatus, string> = {
    [UserStatus.ACTIVE]: '活跃',
    [UserStatus.INACTIVE]: '未激活',
    [UserStatus.LOCKED]: '锁定',
    [UserStatus.DELETED]: '已删除',
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>
        个人资料
      </Title>

      <Card bordered={false}>
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="用户名">{user?.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="姓名">{user?.realName || '-'}</Descriptions.Item>
          <Descriptions.Item label="角色">
            {user?.roleDescription || user?.role || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="手机号">{user?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="账号状态">
            <Tag color={user?.status === 'ACTIVE' ? 'green' : 'orange'}>
              {user?.status ? statusTextMap[user.status] : '未知'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Text type="secondary">
        说明：基础资料由管理员统一维护，如需修改请联系管理员。
      </Text>
    </Space>
  );
};

export default ProfilePage;
