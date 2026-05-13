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
  Checkbox,
  Tag,
  Modal,
  Input,
} from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
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

interface PlatformField {
  key: string;
  label: string;
  secret: boolean;
  value: string;
  configured: boolean;
}

interface PlatformConfig {
  label: string;
  platform: string;
  enabled: boolean;
  configured: boolean;
  fields: PlatformField[];
}

const STANDARD_KEYS = ['platform', 'flavor', 'buildMode', 'env', 'language', 'region', 'pgyerAccountType'];

const REGION_LANG_MAP: Record<string, string> = {
  CN: 'zh',
  US: 'en',
};

// Platform → available publish targets
const PLATFORM_PUBLISH_TARGETS: Record<string, { key: string; label: string }[]> = {
  ios: [
    { key: 'pgyer', label: '蒲公英' },
    { key: 'appstore', label: 'App Store Connect (CN)' },
    { key: 'appstore_over', label: 'App Store Connect (OVER)' },
  ],
  android: [
    { key: 'pgyer', label: '蒲公英' },
    // Other Android stores are uploaded manually via web console
    // { key: 'xiaomi', label: '小米应用商店' },
    // { key: 'huawei', label: '华为应用市场' },
    // { key: 'honor', label: '荣耀应用市场' },
    // { key: 'oppo', label: 'OPPO 软件商店' },
    // { key: 'vivo', label: 'VIVO 应用商店' },
    // { key: 'tencent', label: '应用宝' },
    // { key: 'qihu360', label: '360 手机助手' },
    // { key: 'samsung', label: '三星应用商店' },
  ],
};

const NewBuild: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [optionGroups, setOptionGroups] = useState<BuildOptionGroup[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [platforms, setPlatforms] = useState<Record<string, PlatformConfig>>({});
  const [selectedPlatform, setSelectedPlatform] = useState<string | undefined>();
  const [credPlatform, setCredPlatform] = useState<string | null>(null);
  const [credSaving, setCredSaving] = useState(false);
  const [credForm] = Form.useForm();

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [optionsRes, branchesRes, publishingRes] = await Promise.all([
        api.get('/config/option-groups'),
        api.get('/config/branches'),
        api.get('/config/publishing'),
      ]);
      setOptionGroups(optionsRes.data);
      setBranches(branchesRes.data);
      setPlatforms(publishingRes.data);
    } catch {
      message.error('获取配置选项失败');
    } finally {
      setOptionsLoading(false);
    }
  };

  const fetchBranches = async () => {
    setBranchesLoading(true);
    try {
      const res = await api.get('/config/branches');
      setBranches(res.data);
    } catch {
      // silent
    } finally {
      setBranchesLoading(false);
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

  const handleRegionChange = (regionValue: string) => {
    const defaultLang = REGION_LANG_MAP[regionValue];
    if (defaultLang) {
      form.setFieldValue('language', defaultLang);
    }
  };

  const handlePlatformChange = (value: string) => {
    setSelectedPlatform(value);
    // Reset publish targets when platform changes
    form.setFieldValue('publishTargets', []);
  };

  const openCredModal = (platform: string) => {
    const plat = platforms[platform];
    if (!plat) return;
    const init: Record<string, string> = {};
    plat.fields.forEach((f) => {
      if (!f.secret && f.value) init[f.key] = f.value;
    });
    credForm.setFieldsValue(init);
    setCredPlatform(platform);
  };

  const handleCredSave = async (values: Record<string, string>) => {
    if (!credPlatform) return;
    setCredSaving(true);
    try {
      await api.put(`/config/publishing/${credPlatform}`, { credentials: values });
      message.success('凭证已保存');
      setCredPlatform(null);
      // Refresh platforms to update configured status
      const publishingRes = await api.get('/config/publishing');
      setPlatforms(publishingRes.data);
    } catch (err: any) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setCredSaving(false);
    }
  };

  const standardGroups = optionGroups.filter((g) => STANDARD_KEYS.includes(g.key));
  const customGroups = optionGroups.filter((g) => !STANDARD_KEYS.includes(g.key));
  const getGroup = (key: string) => standardGroups.find((g) => g.key === key);

  const publishTargets = selectedPlatform ? PLATFORM_PUBLISH_TARGETS[selectedPlatform] || [] : [];

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
            initialValues={{ branch: 'main', region: 'CN', language: 'zh', publishTargets: [] }}
            style={{ maxWidth: 600 }}
          >
            {/* Platform */}
            {(() => {
              const g = getGroup('platform');
              return g ? (
                <Form.Item label={g.label} name="platform" rules={[{ required: true, message: `请选择${g.label}` }]}>
                  <Select placeholder={`选择${g.label}`} size="large" onChange={handlePlatformChange}>
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

            {/* Branch */}
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
                onDropdownVisibleChange={(open) => { if (open) fetchBranches(); }}
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {branches.map((b) => (
                  <Option key={b} value={b}>{b}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* Region */}
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

            {/* Language */}
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

            {/* Publish targets */}
            {selectedPlatform && publishTargets.length > 0 && (
              <>
                <Divider>发布平台</Divider>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  选择本次构建完成后要发布到哪些平台。仅已配置凭证且已启用的平台可勾选。
                </Text>
                <Form.Item name="publishTargets">
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {publishTargets.map((t) => {
                        // Pgyer is always available (configured via env vars)
                        if (t.key === 'pgyer') {
                          return (
                            <Checkbox key={t.key} value={t.key}>
                              <Space>
                                {t.label}
                                <Tag
                                  icon={<CheckCircleOutlined />}
                                  color="success"
                                  style={{ fontSize: 11 }}
                                >
                                  已配置
                                </Tag>
                              </Space>
                            </Checkbox>
                          );
                        }

                        // Other platforms check database credentials
                        const platCfg = platforms[t.key];
                        const isConfigured = platCfg?.configured && platCfg?.enabled;
                        return (
                          <Checkbox key={t.key} value={t.key} disabled={!isConfigured}>
                            <Space>
                              {t.label}
                              {isConfigured ? (
                                <Tag
                                  icon={<CheckCircleOutlined />}
                                  color="success"
                                  style={{ fontSize: 11, cursor: 'pointer' }}
                                  onClick={(e) => { e.stopPropagation(); openCredModal(t.key); }}
                                >
                                  已配置
                                </Tag>
                              ) : (
                                <Tag
                                  icon={<CloseCircleOutlined />}
                                  color="default"
                                  style={{ fontSize: 11, cursor: 'pointer' }}
                                  onClick={(e) => { e.stopPropagation(); openCredModal(t.key); }}
                                >
                                  {platCfg ? '点击配置' : '未启用'}
                                </Tag>
                              )}
                            </Space>
                          </Checkbox>
                        );
                      })}
                    </Space>
                  </Checkbox.Group>
                </Form.Item>
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

      {/* Credential configuration modal */}
      <Modal
        title={`配置 ${credPlatform ? platforms[credPlatform]?.label || credPlatform : ''}`}
        open={!!credPlatform}
        onCancel={() => setCredPlatform(null)}
        onOk={() => credForm.submit()}
        confirmLoading={credSaving}
        width={500}
      >
        {credPlatform && platforms[credPlatform] && (
          <Form form={credForm} layout="vertical" onFinish={handleCredSave}>
            {platforms[credPlatform].fields.map((f) => (
              <Form.Item
                key={f.key}
                label={f.label}
                name={f.key}
                extra={f.secret ? '密钥信息，留空则不覆盖已有值' : undefined}
              >
                {f.secret ? (
                  <Input.Password placeholder={f.configured ? '留空不修改' : `请输入${f.label}`} />
                ) : (
                  <Input placeholder={`请输入${f.label}`} />
                )}
              </Form.Item>
            ))}
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default NewBuild;
