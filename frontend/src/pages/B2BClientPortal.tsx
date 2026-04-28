import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message, Modal, Typography, Space } from 'antd';
import { b2bService, B2BOrderAccessDto } from '../services/b2bService';

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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Card>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 30 }}>
          珠宝定制服务平台
        </Title>
        
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="创建订单" key="create">
            <Form form={orderForm} layout="vertical" onFinish={handleCreateOrder}>
              <Title level={4}>联系方式（创建订单必需）</Title>
              <Form.Item
                name="contact"
                label="联系方式"
                rules={[{ required: true, message: '请输入手机号或微信号' }]}
              >
                <Input placeholder="手机号或微信号" />
              </Form.Item>
              <Form.Item name="password" label="设置密码（选填）">
                <Input.Password placeholder="设置密码方便下次登录" />
              </Form.Item>
              <Form.Item name="companyName" label="公司名称">
                <Input placeholder="公司或店铺名称" />
              </Form.Item>
              <Form.Item name="contactPerson" label="联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="电子邮箱" />
              </Form.Item>

              <Title level={4}>订单需求</Title>
              <Form.Item
                name="basicRequirements"
                label="基础需求"
                rules={[{ required: true, message: '请描述您的需求' }]}
              >
                <Input.TextArea rows={4} placeholder="请描述您的珠宝定制需求..." />
              </Form.Item>
              <Form.Item name="styleInfo" label="款式信息">
                <Input.TextArea rows={3} placeholder="款式描述，如：戒指、项链、手镯..." />
              </Form.Item>
              <Form.Item name="materialInfo" label="材质信息">
                <Input.TextArea rows={3} placeholder="材质要求，如：925银、足金、K金..." />
              </Form.Item>
              <Form.Item name="depositAmount" label="定金金额">
                <Input type="number" placeholder="定金金额（选填）" />
              </Form.Item>
              <Form.Item name="sourceDetail" label="来源备注">
                <Input placeholder="如：抖音、小红书、达人推荐等" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  创建订单
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="登录" key="login">
            <Form form={loginForm} layout="vertical" onFinish={handleLogin}>
              <Form.Item
                name="contact"
                label="联系方式"
                rules={[{ required: true, message: '请输入联系方式' }]}
              >
                <Input placeholder="手机号或微信号" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  登录
                </Button>
              </Form.Item>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <Button type="link" onClick={() => setActiveTab('register')}>
                  还没有账号？立即注册
                </Button>
              </div>
            </Form>
          </TabPane>

          <TabPane tab="注册" key="register">
            <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
              <Form.Item
                name="contact"
                label="联系方式"
                rules={[{ required: true, message: '请输入手机号或微信号' }]}
              >
                <Input placeholder="手机号或微信号" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="密码" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                rules={[{ required: true, message: '请确认密码' }]}
              >
                <Input.Password placeholder="确认密码" />
              </Form.Item>
              <Form.Item name="companyName" label="公司名称">
                <Input placeholder="公司或店铺名称" />
              </Form.Item>
              <Form.Item name="contactPerson" label="联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="电子邮箱" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  注册
                </Button>
              </Form.Item>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <Button type="link" onClick={() => setActiveTab('login')}>
                  已有账号？立即登录
                </Button>
              </div>
            </Form>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="订单创建成功"
        visible={showResult}
        footer={null}
        onCancel={() => setShowResult(false)}
        width={600}
      >
        {orderResult && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>订单编号：</Text>
                <Text>{orderResult.orderNumber}</Text>
              </div>
              <div>
                <Text strong>访问链接：</Text>
                <a href={orderResult.accessUrl} target="_blank" rel="noopener noreferrer">
                  {orderResult.accessUrl}
                </a>
              </div>
              <div>
                <Text strong>二维码：</Text>
                <img
                  src={orderResult.qrcodeBase64}
                  alt="订单二维码"
                  style={{ width: 200, height: 200 }}
                />
              </div>
              <div>
                <Text strong>有效期至：</Text>
                <Text>{orderResult.expireTime}</Text>
              </div>
              <p>请保存好以上信息，便于查看订单进度</p>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default B2BClientPortal;