import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Alert,
  Divider,
  Row,
  Col,
  message,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { LoginRequest } from '@/types/auth';
import './LoginPage.css';

const { Title, Text, Link } = Typography;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login, error, clearError } = useAuthStore();

  // 检查是否已登录
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  // 处理登录
  const handleLogin = async (values: any) => {
    setLoading(true);
    clearError();

    try {
      const credentials: LoginRequest = {
        username: values.username,
        password: values.password,
      };

      await login(credentials);
      
      // 记住用户名
      if (rememberMe) {
        localStorage.setItem('remembered_username', values.username);
      } else {
        localStorage.removeItem('remembered_username');
      }

      message.success('登录成功！');
      navigate('/dashboard');
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理忘记密码
  const handleForgotPassword = () => {
    message.info('请联系管理员重置密码');
  };

  // 处理记住我
  const handleRememberMeChange = (e: any) => {
    setRememberMe(e.target.checked);
  };

  // 加载记住的用户名
  useEffect(() => {
    const rememberedUsername = localStorage.getItem('remembered_username');
    if (rememberedUsername) {
      form.setFieldsValue({ username: rememberedUsername });
      setRememberMe(true);
    }
  }, [form]);

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-background-overlay" />
        <div className="login-background-pattern" />
      </div>
      
      <div className="login-content">
        <Row justify="center" align="middle" style={{ height: '100vh' }}>
          <Col xs={24} sm={20} md={16} lg={12} xl={8}>
            <Card className="login-card" bordered={false}>
              <div className="login-header">
                <div className="login-logo">
                  <div className="logo-icon">💎</div>
                  <Title level={2} className="logo-text">
                    珠宝定制管理系统
                  </Title>
                </div>
                <Text type="secondary" className="login-subtitle">
                  企业信息化管理平台
                </Text>
              </div>

              <Divider />

              {error && (
                <Alert
                  message="登录失败"
                  description={error}
                  type="error"
                  showIcon
                  closable
                  onClose={clearError}
                  style={{ marginBottom: 24 }}
                />
              )}

              <Form
                form={form}
                name="login"
                layout="vertical"
                onFinish={handleLogin}
                autoComplete="off"
                size="large"
              >
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[
                    { required: true, message: '请输入用户名' },
                    { min: 3, message: '用户名至少3个字符' },
                    { max: 20, message: '用户名最多20个字符' },
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="请输入用户名"
                    allowClear
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="密码"
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少6个字符' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="请输入密码"
                    iconRender={(visible) =>
                      visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                    }
                    allowClear
                  />
                </Form.Item>

                <Form.Item>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={handleRememberMeChange}
                          style={{ marginRight: 8 }}
                        />
                        <Text>记住用户名</Text>
                      </label>
                    </Col>
                    <Col>
                      <Button
                        type="link"
                        onClick={handleForgotPassword}
                        style={{ padding: 0 }}
                      >
                        忘记密码？
                      </Button>
                    </Col>
                  </Row>
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    size="large"
                  >
                    登录
                  </Button>
                </Form.Item>

                <Divider>
                  <Text type="secondary">系统信息</Text>
                </Divider>

                <div className="login-footer">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Row justify="space-between">
                      <Col>
                        <Text type="secondary">版本: 1.0.0</Text>
                      </Col>
                      <Col>
                        <Text type="secondary">© 2024 珠宝定制工作室</Text>
                      </Col>
                    </Row>
                    <Row justify="center">
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          技术支持: support@jewelry.com
                        </Text>
                      </Col>
                    </Row>
                  </Space>
                </div>
              </Form>
            </Card>

            <div className="login-tips">
              <Alert
                message="登录提示"
                description={
                  <Space direction="vertical" size="small">
                    <Text>• 默认管理员账号: kuangjun / moje666</Text>
                    <Text>• 请妥善保管您的登录凭证</Text>
                    <Text>• 建议定期修改密码</Text>
                    <Text>• 如遇问题请联系管理员</Text>
                  </Space>
                }
                type="info"
                showIcon
              />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default LoginPage;