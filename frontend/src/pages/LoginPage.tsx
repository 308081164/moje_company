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
  GemOutlined,
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

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (values: any) => {
    setLoading(true);
    clearError();

    try {
      const credentials: LoginRequest = {
        username: values.username,
        password: values.password,
      };

      await login(credentials);
      
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

  const handleForgotPassword = () => {
    message.info('请联系管理员重置密码');
  };

  const handleRememberMeChange = (e: any) => {
    setRememberMe(e.target.checked);
  };

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
        <div className="login-background-gradient" />
        <div className="login-background-shimmer" />
      </div>
      
      <div className="login-content">
        <Row justify="center" align="middle" style={{ height: '100vh' }}>
          <Col xs={24} sm={20} md={16} lg={12} xl={8}>
            <Card className="login-card" bordered={false}>
              <div className="login-header">
                <div className="login-logo">
                  <GemOutlined className="logo-diamond" />
                  <div className="logo-text">
                    <Title level={2} className="logo-title">MOJE</Title>
                    <Text className="logo-subtitle">珠宝定制管理系统</Text>
                  </div>
                </div>
                <Text className="login-tagline">传承匠心工艺 · 定制专属珠宝</Text>
              </div>

              <div className="gold-divider" />

              {error && (
                <Alert
                  message="登录失败"
                  description={error}
                  type="error"
                  showIcon
                  closable
                  onClose={clearError}
                  style={{ marginBottom: 24 }}
                  className="error-alert"
                />
              )}

              <Form
                form={form}
                name="login"
                layout="vertical"
                onFinish={handleLogin}
                autoComplete="off"
                size="large"
                className="login-form"
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
                    prefix={<UserOutlined className="input-icon" />}
                    placeholder="请输入用户名"
                    allowClear
                    className="login-input"
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
                    prefix={<LockOutlined className="input-icon" />}
                    placeholder="请输入密码"
                    iconRender={(visible) =>
                      visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                    }
                    allowClear
                    className="login-input"
                  />
                </Form.Item>

                <Form.Item className="login-options">
                  <Row justify="space-between" align="middle">
                    <Col>
                      <label className="remember-me-label">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={handleRememberMeChange}
                          className="remember-me-checkbox"
                        />
                        <Text className="remember-me-text">记住用户名</Text>
                      </label>
                    </Col>
                    <Col>
                      <Button
                        type="link"
                        onClick={handleForgotPassword}
                        className="forgot-password-btn"
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
                    className="login-btn"
                  >
                    登录
                  </Button>
                </Form.Item>

                <div className="gold-divider" />

                <div className="login-footer">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Row justify="space-between">
                      <Col>
                        <Text type="secondary" className="footer-text">版本: 1.0.0</Text>
                      </Col>
                      <Col>
                        <Text type="secondary" className="footer-text">© 2024 MOJE Jewelry</Text>
                      </Col>
                    </Row>
                    <Row justify="center">
                      <Col>
                        <Text type="secondary" className="footer-contact">
                          技术支持: support@moje-jewelry.com
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
                className="tips-alert"
              />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default LoginPage;