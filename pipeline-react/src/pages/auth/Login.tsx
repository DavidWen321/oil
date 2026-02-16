import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api';
import { useUserStore } from '../../stores/userStore';
import type { LoginParams } from '../../types';
import styles from './Login.module.css';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken, setUserInfo } = useUserStore();

  const onFinish = async (values: LoginParams) => {
    setLoading(true);
    try {
      const res = await authApi.login(values);
      if (res.data) {
        setToken(res.data.token);
        setUserInfo({
          userId: res.data.userId,
          username: res.data.username,
          nickname: res.data.nickname,
          roles: ['admin'],
        });
        message.success('登录成功');
        navigate('/dashboard');
      }
    } catch {
      // 错误已在拦截器处理
    } finally {
      setLoading(false);
    }
  };

  // 演示模式：直接登录
  const handleDemoLogin = () => {
    setToken('demo-token');
    setUserInfo({
      userId: 1,
      username: 'admin',
      nickname: '管理员',
      roles: ['admin'],
    });
    message.success('演示模式登录成功');
    navigate('/dashboard');
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.pipeline}></div>
      </div>

      <Card className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⚡</span>
          </div>
          <h1>管道能耗分析系统</h1>
          <p>Pipeline Energy Consumption Analysis System</p>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className={styles.loginBtn}
            >
              登录
            </Button>
          </Form.Item>

          <Form.Item>
            <Button
              type="default"
              block
              onClick={handleDemoLogin}
            >
              演示模式（无需后端）
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.footer}>
          <p>默认账号: admin / admin123</p>
        </div>
      </Card>
    </div>
  );
}
