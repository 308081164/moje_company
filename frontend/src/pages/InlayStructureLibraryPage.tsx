import React from 'react';
import { Card, Typography } from 'antd';
import InlayStructureLibraryBrowser from '@/components/InlayStructureLibraryBrowser';

const { Title, Paragraph } = Typography;

const InlayStructureLibraryPage: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Title level={3}>镶嵌结构库</Title>
    <Paragraph type="secondary">
      建模师常用镶嵌结构文件夹，已同步至阿里云 OSS。支持浏览、上传、重命名、移动与删除（每日免费删除 3 次，超额需二级密码）。
    </Paragraph>
    <Card>
      <InlayStructureLibraryBrowser />
    </Card>
  </div>
);

export default InlayStructureLibraryPage;
