import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Select,
  Button,
  Card,
  Typography,
  Space,
  message,
  Divider,
  Spin,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface BuildOptionValue {
  value: string;
  label: string;
}

interface BuildOptionGroup {
  id: string;
  key: string;
  label: string;
  values: BuildOptionValue[];
  required: boolean;
  isStandard: boolean;
}

const STANDARD_KEYS = ['platform', 'flavor', 'buildMode', 'env', 'language', 'region', 'pgyerAccountType'];

// Region → default language mapping
const REGION_LANG_MAP: Record<string, string> = {
  CN: 'zh',
  US: 'en',
};

const NewBuild: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [optionGroups, setOptionGroups] = useState<BuildOptionGroup[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [optionsRes, branchesRes] = await Promise.all([
        api.get('/config/option-groups'),
        api.get('/config/branches'),
      ]);
      setOptionGroups(optionsRes.data);
      setBranches(branchesRes.data);
    } catch {
      message.error('获取配置选项失败');
    } finally {
      setOptionsLoading(false);
    }
  };

  const onFinish = async (values: any) => {
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

  // When region changes, auto-set language if not already manually set
  const handleRegionChange = (regionValue: string) => {
    const defaultLang = REGION_LANG_MAP[regionValue];
    if (defaultLang) {
      form.setFieldValue('language', defaultLang);
    }
  };

  const standardGroups = optionGroups.filter((g) => STANDARD_KEYS.includes(g.key));
  const customGroups = optionGroups.filter((g) => !STANDARD_KEYS.includes(g.key));
  const getGroup = (key: string) => standardGroups.find((g) => g.key === key);

  if (optionsLoading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  }

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
            initialValues={{ branch: 'main', region: 'CN', language: 'zh' }}
            style={{ maxWidth: 600 }}
          >
            {/* Platform */}
            {(() => {
              const g = getGroup('platform');
              return g ? (
                <Form.Item label={g.label} name="platform" rules={[{ required: true, message: `请选择${g.label}` }]}>
                  <Select placeholder={`选择${g.label}`} size="large">
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* Flavor */}
            {(() => {
              const g = getGroup('flavor');
              return g ? (
                <Form.Item label={g.label} name="flavor" rules={[{ required: true, message: `请选择${g.label}` }]}>
                  <Select placeholder={`选择${g.label}`} size="large">
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* Env */}
            {(() => {
              const g = getGroup('env');
              return g ? (
                <Form.Item label={g.label} name="env" rules={[{ required: true, message: `请选择${g.label}` }]}>
                  <Select placeholder={`选择${g.label}`} size="large">
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* BuildMode */}
            {(() => {
              const g = getGroup('buildMode');
              return g ? (
                <Form.Item label={g.label} name="buildMode" rules={[{ required: true, message: `请选择${g.label}` }]}>
                  <Select placeholder={`选择${g.label}`} size="large">
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* Branch - fetched from git, searchable */}
            <Form.Item
              label="分支"
              name="branch"
              rules={[{ required: true, message: '请选择或输入分支' }]}
            >
              <Select
                placeholder="选择或搜索分支"
                size="large"
                showSearch
                loading={branchesLoading}
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {branches.map((b) => (
                  <Option key={b} value={b}>{b}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* Region - shown before language */}
            {(() => {
              const g = getGroup('region');
              return g ? (
                <Form.Item label={g.label} name="region">
                  <Select placeholder={`选择${g.label}`} size="large" allowClear onChange={handleRegionChange}>
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* Language - auto-linked from region */}
            {(() => {
              const g = getGroup('language');
              return g ? (
                <Form.Item label={g.label} name="language">
                  <Select placeholder={`选择${g.label}`} size="large" allowClear>
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* Pgyer Account */}
            {(() => {
              const g = getGroup('pgyerAccountType');
              return g ? (
                <Form.Item label={g.label} name="pgyerAccountType">
                  <Select placeholder={`选择${g.label}（可选）`} size="large" allowClear>
                    {g.values.map((v) => (
                      <Option key={v.value} value={v.value}>{v.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null;
            })()}

            {/* Custom option groups */}
            {customGroups.length > 0 && (
              <>
                <Divider>自定义参数</Divider>
                {customGroups.map((group) => (
                  <Form.Item
                    key={group.id}
                    label={`${group.label} (${group.key})`}
                    name={['customParams', group.key]}
                    rules={group.required ? [{ required: true, message: `请选择${group.label}` }] : []}
                  >
                    <Select
                      placeholder={`选择${group.label}`}
                      size="large"
                      allowClear={!group.required}
                    >
                      {group.values.map((v) => (
                        <Option key={v.value} value={v.value}>{v.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                ))}
              </>
            )}

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
