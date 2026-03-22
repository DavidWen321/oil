import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api';
import { useUserStore } from '../../stores/userStore';
import type { LoginParams } from '../../types';
import styles from './Login.module.css';

export default function Login() {
  const [form] = Form.useForm<LoginParams>();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken, setUserInfo } = useUserStore();

  const handleLogin = async (values: LoginParams) => {
    setLoading(true);
    try {
      const response = await authApi.login(values);
      if (response.data) {
        setToken(response.data.token);
        setUserInfo({
          userId: response.data.userId,
          username: response.data.username,
          nickname: response.data.nickname,
          roles: ['admin'],
        });
        message.success('登录成功');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
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
          <p>面向输油管道的能耗分析与优化平台</p>
        </div>

        <Form<LoginParams>
          form={form}
          name="login"
          onFinish={(values) => void handleLogin(values)}
          autoComplete="off"
          size="large"
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block className={styles.loginBtn}>
              登录系统
            </Button>
          </Form.Item>

          <Form.Item>
            <Button
              block
              onClick={() => {
                form.setFieldsValue({ username: 'admin', password: 'admin123' });
                message.info('已填入默认账号，请点击登录走真实认证流程');
              }}
            >
              填充默认账号
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.footer}>
          <Typography.Text type="secondary">默认账号：`admin / admin123`</Typography.Text>
        </div>
      </Card>
    </div>
  );
}
