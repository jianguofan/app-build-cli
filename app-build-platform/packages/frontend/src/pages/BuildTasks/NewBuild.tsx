import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Select,
  Input,
  Button,
  Card,
  Typography,
  Space,
  message,
  Divider,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface BuildFormValues {
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  env: 'dev' | 'pre' | 'prod';
  buildMode: 'debug' | 'release';
  branch: string;
  language?: string;
  region?: string;
}

const NewBuild: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: BuildFormValues) => {
    setLoading(true);
    try {
      const response = await api.post('/builds', values);
      message.success('构建任务创建成功！');
      navigate(`/builds/${response.data.id}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '创建失败，请重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/builds')}
              style={{ paddingLeft: 0 }}
            >
              返回列表
            </Button>
            <Title level={2} style={{ marginTop: 8 }}>
              新建构建任务
            </Title>
            <Text type="secondary">
              选择构建配置，系统将自动执行打包流程
            </Text>
          </div>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              branch: 'main',
              language: 'zh',
              region: 'CN',
            }}
            style={{ maxWidth: 600 }}
          >
            <Form.Item
              label="平台"
              name="platform"
              rules={[{ required: true, message: '请选择平台' }]}
            >
              <Select placeholder="选择平台" size="large">
                <Option value="ios">iOS</Option>
                <Option value="android">Android</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="渠道"
              name="flavor"
              rules={[{ required: true, message: '请选择渠道' }]}
            >
              <Select placeholder="选择渠道" size="large">
                <Option value="oversea">Oversea (海外)</Option>
                <Option value="cn">CN (国内)</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="环境"
              name="env"
              rules={[{ required: true, message: '请选择环境' }]}
            >
              <Select placeholder="选择环境" size="large">
                <Option value="dev">Development (开发)</Option>
                <Option value="pre">Pre-production (预发布)</Option>
                <Option value="prod">Production (生产)</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="构建类型"
              name="buildMode"
              rules={[{ required: true, message: '请选择构建类型' }]}
            >
              <Select placeholder="选择构建类型" size="large">
                <Option value="debug">Debug</Option>
                <Option value="release">Release</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="分支"
              name="branch"
              rules={[
                { required: true, message: '请输入分支名称' },
                { min: 1, message: '分支名称至少 1 个字符' },
              ]}
            >
              <Input placeholder="例如: main, develop, feature/xxx" size="large" />
            </Form.Item>

            <Form.Item label="语言" name="language">
              <Select placeholder="选择语言（可选）" size="large" allowClear>
                <Option value="zh">中文</Option>
                <Option value="en">English</Option>
              </Select>
            </Form.Item>

            <Form.Item label="地区" name="region">
              <Select placeholder="选择地区（可选）" size="large" allowClear>
                <Option value="CN">中国</Option>
                <Option value="US">美国</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading} size="large">
                  开始构建
                </Button>
                <Button onClick={() => navigate('/builds')} size="large">
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default NewBuild;
