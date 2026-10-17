import React, { useEffect, useState } from 'react';
import { Button, Empty, Space, Spin, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import './SocialPublishPage.css';

const { Text } = Typography;

const SocialPublishPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    if (!window.electronAPI?.embedSocialPublisher) {
      setError('社媒发布已内嵌于员工桌面端，请使用「珠宝定制管理系统」桌面版。无需再单独安装 SocialPublisher。');
      setLoading(false);
      return;
    }
    try {
      const res = await window.electronAPI.embedSocialPublisher();
      if (!res?.ok || !res.url) {
        setError(res?.error || '社媒发布模块未打入当前安装包。请重新打包员工端。');
        setUrl('');
      } else {
        setUrl(res.url);
      }
    } catch (e: any) {
      setError(e?.message || '启动社媒发布失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="social-publish-page">
      <div className="social-publish-toolbar">
        <Space size={8} wrap>
          <Text strong>社媒发布</Text>
          <Text type="secondary">内嵌模块，发布引擎在本机运行</Text>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => { void load(); }}>
          重新加载
        </Button>
      </div>
      {loading ? (
        <div className="social-publish-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
          <Spin tip="正在启动社媒发布模块…" />
        </div>
      ) : error ? (
        <div className="social-publish-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
          <Empty description={error}>
            <Button type="primary" onClick={() => { void load(); }}>
              重试
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="social-publish-frame">
          {React.createElement('webview', {
            src: url,
            className: 'social-publish-webview',
            allowpopups: 'true',
          })}
        </div>
      )}
    </div>
  );
};

export default SocialPublishPage;
