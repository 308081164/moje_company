import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message, Modal, Typography, Space, Row, Col } from 'antd';
import { GemOutlined, QrcodeOutlined, LinkOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { b2bService, B2BOrderAccessDto } from '../services/b2bService';
import './B2BClientPortal.css';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

const B2BClientPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [orderForm] = Form.useForm();
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [showResult, setShowResult] = useState(false);
  const [orderResult, setOrderResult] = useState<B2BOrderAccessDto | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateOrder = async () => {
    try {
      const values = orderForm.getFieldsValue();
      if (!values.contact || values.contact.trim() === '') {
        message.error('联系方式不能为空');
        return;
      }

      setLoading(true);
      const result = await b2bService.createOrder({
        contact: values.contact,
        password: values.password,
        companyName: values.companyName,
        contactPerson: values.contactPerson,
        email: values.email,
        basicRequirements: values.basicRequirements,
        styleInfo: values.styleInfo,
        materialInfo: values.materialInfo,
        depositAmount: values.depositAmount,
        sourceDetail: values.sourceDetail,
      });

      setOrderResult(result);
      setShowResult(true);
      orderForm.resetFields();
      message.success('订单创建成功');
    } catch (error) {
      console.error('创建订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const values = loginForm.getFieldsValue();
      await b2bService.login({
        contact: values.contact,
        password: values.password,
      });
      message.success('登录成功');
      loginForm.resetFields();
    } catch (error) {
      console.error('登录失败:', error);
    }
  };

  const handleRegister = async () => {
    try {
      const values = registerForm.getFieldsValue();
      if (values.password !== values.confirmPassword) {
        message.error('两次输入的密码不一致');
        return;
      }

      await b2bService.register({
        contact: values.contact,
        password: values.password,
        companyName: values.companyName,
        contactPerson: values.contactPerson,
        email: values.email,
      });
      message.success('注册成功');
      registerForm.resetFields();
      setActiveTab('login');
    } catch (error) {
      console.error('注册失败:', error);
    }
  };

  return (
    <div className="b2b-portal-container">
      <div className="b2b-portal-background" />
      
      <div className="b2b-portal-content">
        <Card className="b2b-portal-card" bordered={false}>
          <div className="b2b-portal-header">
            <div className="b2b-portal-logo">
              <GemOutlined className="b2b-logo-icon" />
              <div className="b2b-logo-text">
                <Title level={2} className="b2b-logo-title">MOJE</Title>
                <Text className="b2b-logo-subtitle">珠宝定制服务平台</Text>
              </div>
            </div>
            <Text className="b2b-portal-tagline">传承匠心工艺 · 定制专属珠宝</Text>
          </div>

          <div className="gold-divider" />

          <Tabs activeKey={activeTab} onChange={setActiveTab} className="b2b-tabs">
            <TabPane tab={<span className="tab-label">创建订单</span>} key="create">
              <Form form={orderForm} layout="vertical" onFinish={handleCreateOrder} className="b2b-form">
                <div className="form-section">
                  <div className="section-header">
                    <Title level={4} className="section-title">联系方式</Title>
                    <Text type="secondary" className="section-hint">（创建订单必需）</Text>
                  </div>
                  <Form.Item
                    name="contact"
                    label="联系方式"
                    rules={[{ required: true, message: '请输入手机号或微信号' }]}
                  >
                    <Input className="b2b-input" placeholder="手机号或微信号" />
                  </Form.Item>
                  <Form.Item name="password" label="设置密码（选填）">
                    <Input.Password className="b2b-input" placeholder="设置密码方便下次登录" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="companyName" label="公司名称">
                        <Input className="b2b-input" placeholder="公司或店铺名称" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="contactPerson" label="联系人">
                        <Input className="b2b-input" placeholder="联系人姓名" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="email" label="邮箱">
                    <Input className="b2b-input" placeholder="电子邮箱" />
                  </Form.Item>
                </div>

                <div className="gold-divider-small" />

                <div className="form-section">
                  <div className="section-header">
                    <Title level={4} className="section-title">订单需求</Title>
                  </div>
                  <Form.Item
                    name="basicRequirements"
                    label="基础需求"
                    rules={[{ required: true, message: '请描述您的需求' }]}
                  >
                    <Input.TextArea className="b2b-textarea" rows={4} placeholder="请描述您的珠宝定制需求..." />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="styleInfo" label="款式信息">
                        <Input.TextArea className="b2b-textarea" rows={3} placeholder="款式描述，如：戒指、项链、手镯..." />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="materialInfo" label="材质信息">
                        <Input.TextArea className="b2b-textarea" rows={3} placeholder="材质要求，如：925银、足金、K金..." />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="depositAmount" label="定金金额">
                        <Input className="b2b-input" type="number" placeholder="定金金额（选填）" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="sourceDetail" label="来源备注">
                        <Input className="b2b-input" placeholder="如：抖音、小红书、达人推荐等" />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block className="b2b-submit-btn">
                    创建订单
                  </Button>
                </Form.Item>
              </Form>
            </TabPane>

            <TabPane tab={<span className="tab-label">登录</span>} key="login">
              <Form form={loginForm} layout="vertical" onFinish={handleLogin} className="b2b-form">
                <Form.Item
                  name="contact"
                  label="联系方式"
                  rules={[{ required: true, message: '请输入联系方式' }]}
                >
                  <Input className="b2b-input" placeholder="手机号或微信号" />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password className="b2b-input" placeholder="密码" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" block className="b2b-submit-btn">
                    登录
                  </Button>
                </Form.Item>
                <div className="form-footer">
                  <Button type="link" onClick={() => setActiveTab('register')} className="b2b-link-btn">
                    还没有账号？立即注册
                  </Button>
                </div>
              </Form>
            </TabPane>

            <TabPane tab={<span className="tab-label">注册</span>} key="register">
              <Form form={registerForm} layout="vertical" onFinish={handleRegister} className="b2b-form">
                <Form.Item
                  name="contact"
                  label="联系方式"
                  rules={[{ required: true, message: '请输入手机号或微信号' }]}
                >
                  <Input className="b2b-input" placeholder="手机号或微信号" />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password className="b2b-input" placeholder="密码" />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="确认密码"
                  rules={[{ required: true, message: '请确认密码' }]}
                >
                  <Input.Password className="b2b-input" placeholder="确认密码" />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="companyName" label="公司名称">
                      <Input className="b2b-input" placeholder="公司或店铺名称" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="contactPerson" label="联系人">
                      <Input className="b2b-input" placeholder="联系人姓名" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="email" label="邮箱">
                  <Input className="b2b-input" placeholder="电子邮箱" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" block className="b2b-submit-btn">
                    注册
                  </Button>
                </Form.Item>
                <div className="form-footer">
                  <Button type="link" onClick={() => setActiveTab('login')} className="b2b-link-btn">
                    已有账号？立即登录
                  </Button>
                </div>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      </div>

      <Modal
        title="订单创建成功"
        visible={showResult}
        footer={null}
        onCancel={() => setShowResult(false)}
        width={600}
        className="success-modal"
      >
        {orderResult && (
          <div className="success-content">
            <div className="success-header">
              <GemOutlined className="success-icon" />
              <Title level={3} className="success-title">订单创建成功</Title>
            </div>
            <div className="gold-divider" />
            <Space direction="vertical" style={{ width: '100%', gap: '16px' }}>
              <div className="result-item">
                <Text strong className="result-label">订单编号</Text>
                <Text className="result-value">{orderResult.orderNumber}</Text>
              </div>
              <div className="result-item">
                <Text strong className="result-label">
                  <LinkOutlined className="result-icon" />
                  访问链接
                </Text>
                <a 
                  href={orderResult.accessUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="result-link"
                >
                  {orderResult.accessUrl}
                </a>
              </div>
              <div className="result-item">
                <Text strong className="result-label">
                  <QrcodeOutlined className="result-icon" />
                  二维码
                </Text>
                <div className="qrcode-container">
                  <img
                    src={orderResult.qrcodeBase64}
                    alt="订单二维码"
                    className="qrcode-image"
                  />
                </div>
              </div>
              <div className="result-item">
                <Text strong className="result-label">
                  <ClockCircleOutlined className="result-icon" />
                  有效期至
                </Text>
                <Text className="result-value">{orderResult.expireTime}</Text>
              </div>
              <div className="result-tip">
                <Text type="secondary">请保存好以上信息，便于查看订单进度</Text>
              </div>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default B2BClientPortal;