import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Table,
  Tag,
  Descriptions,
  Spin,
  message,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';
import CredentialCard from '@/components/CredentialCard';

const { Title, Text } = Typography;

// ==================== Types ====================

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
  createdAt: string;
  updatedAt: string;
}

interface ConfigItem {
  key: string;
  label: string;
  type: string;
  secret: boolean;
  configured: boolean;
  value: string;
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

interface SystemConfig {
  git: { repoUrl: string };
  workspace: { dir: string };
  ssh: { user: string };
  publishing: Record<string, boolean>;
}

// ==================== OptionGroupCard ====================

interface OptionGroupCardProps {
  group: BuildOptionGroup;
  onAddValue: (groupId: string, value: BuildOptionValue) => void;
  onRemoveValue: (groupId: string, value: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<BuildOptionGroup>) => void;
}

const OptionGroupCard: React.FC<OptionGroupCardProps> = ({
  group,
  onAddValue,
  onRemoveValue,
  onDeleteGroup,
  onUpdateGroup,
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const handleAddValue = (values: { value: string; label: string }) => {
    onAddValue(group.id, values);
    addForm.resetFields();
    setAddModalOpen(false);
  };

  const handleEditGroup = (values: { label: string; required: boolean }) => {
    onUpdateGroup(group.id, values);
    setEditModalOpen(false);
  };

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <Text strong>{group.label}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>({group.key})</Text>
            {group.required ? (
              <Tag color="blue" style={{ fontSize: 11 }}>必填</Tag>
            ) : (
              <Tag style={{ fontSize: 11 }}>选填</Tag>
            )}
            {group.isStandard && (
              <Tag color="orange" style={{ fontSize: 11 }}>系统</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button size="small" type="link" onClick={() => {
              editForm.setFieldsValue({ label: group.label, required: group.required });
              setEditModalOpen(true);
            }}>
              编辑
            </Button>
            {!group.isStandard && (
              <Popconfirm title="确定删除此分组？" onConfirm={() => onDeleteGroup(group.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        }
        style={{ marginBottom: 12 }}
      >
        <Space wrap>
          {group.values.map((v) => (
            <Tag
              key={v.value}
              closable
              onClose={() => onRemoveValue(group.id, v.value)}
              style={{ fontSize: 13, padding: '2px 8px' }}
            >
              {v.label}
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>({v.value})</Text>
            </Tag>
          ))}
          <Button
            size="small"
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            添加选项
          </Button>
        </Space>
      </Card>

      <Modal
        title={`添加选项 - ${group.label}`}
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        onOk={() => addForm.submit()}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddValue}>
          <Form.Item label="选项值 (英文)" name="value" rules={[{ required: true, message: '请输入选项值' }]}>
            <Input placeholder="例如: oversea" />
          </Form.Item>
          <Form.Item label="选项名称 (中文)" name="label" rules={[{ required: true, message: '请输入选项名称' }]}>
            <Input placeholder="例如: 海外" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑分组 - ${group.label}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditGroup}>
          <Form.Item label="中文名称" name="label" rules={[{ required: true, message: '请输入中文名称' }]}>
            <Input placeholder="例如: 渠道" />
          </Form.Item>
          <Form.Item label="是否必填" name="required" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ==================== Settings Page ====================

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [envList, setEnvList] = useState<ConfigItem[]>([]);
  const [optionGroups, setOptionGroups] = useState<BuildOptionGroup[]>([]);
  const [platforms, setPlatforms] = useState<Record<string, PlatformConfig>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [configRes, envRes, optionsRes, publishingRes] = await Promise.all([
        api.get('/config'),
        api.get('/config/env'),
        api.get('/config/option-groups'),
        api.get('/config/publishing'),
      ]);
      setConfig(configRes.data);
      setEnvList(envRes.data);
      setOptionGroups(optionsRes.data);
      setPlatforms(publishingRes.data);
    } catch {
      message.error('获取配置信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddValue = async (groupId: string, value: BuildOptionValue) => {
    try {
      await api.post(`/config/option-groups/${groupId}/values`, value);
      message.success('添加成功');
      fetchAll();
    } catch (err: any) {
      message.error(err.response?.data?.message || '添加失败');
    }
  };

  const handleRemoveValue = async (groupId: string, value: string) => {
    try {
      await api.delete(`/config/option-groups/${groupId}/values/${value}`);
      message.success('删除成功');
      fetchAll();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await api.delete(`/config/option-groups/${groupId}`);
      message.success('删除成功');
      fetchAll();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleUpdateGroup = async (groupId: string, updates: Partial<BuildOptionGroup>) => {
    try {
      await api.put(`/config/option-groups/${groupId}`, updates);
      message.success('更新成功');
      fetchAll();
    } catch (err: any) {
      message.error(err.response?.data?.message || '更新失败');
    }
  };

  const handleCreateGroup = async (values: { key: string; label: string; required: boolean }) => {
    try {
      await api.post('/config/option-groups', { ...values, values: [] });
      message.success('创建成功');
      createForm.resetFields();
      setCreateModalOpen(false);
      fetchAll();
    } catch (err: any) {
      message.error(err.response?.data?.message || '创建失败');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  }

  const columns: ColumnsType<ConfigItem> = [
    {
      title: '配置项',
      dataIndex: 'label',
      key: 'label',
      width: 200,
    },
    {
      title: '当前值',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (v: string, r: ConfigItem) => (r.secret && v ? '******' : (v || '-')),
    },
    {
      title: '状态',
      dataIndex: 'configured',
      key: 'configured',
      width: 100,
      render: (ok: boolean) =>
        ok ? (
          <Tag icon={<CheckCircleOutlined />} color="success">已配置</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">未配置</Tag>
        ),
    },
  ];

  return (
    <div>
      <Title level={2}>系统配置</Title>

      {/* 构建选项配置 */}
      <Card
        title="构建选项配置"
        style={{ marginBottom: 16 }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            添加分组
          </Button>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          管理构建表单中的选项分组。添加新分组后，构建时会将选项作为 --key=value 参数传入构建脚本。
        </Text>
        {optionGroups.map((group) => (
          <OptionGroupCard
            key={group.id}
            group={group}
            onAddValue={handleAddValue}
            onRemoveValue={handleRemoveValue}
            onDeleteGroup={handleDeleteGroup}
            onUpdateGroup={handleUpdateGroup}
          />
        ))}
      </Card>

      {/* 发布平台凭证配置 */}
      <Card title="发布平台配置" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          配置各应用商店的 API 凭证。配置后可在发布时选择上传。密钥信息加密存储。
        </Text>

        {/* 蒲公英 — static tag display (unchanged, uses env vars) */}
        {config && (
          <Card size="small" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Text strong>蒲公英 (Pgyer)</Text>
                <Tag
                  icon={config.publishing.pgyer ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  color={config.publishing.pgyer ? 'success' : 'default'}
                >
                  {config.publishing.pgyer ? '已配置' : '未配置'}
                </Tag>
              </Space>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              蒲公英 API Key 通过 .env 环境变量配置（PGYER_API_KEY）
            </Text>
          </Card>
        )}

        {/* Fastlane 管理的厂商 — editable credential cards */}
        {Object.entries(platforms).map(([key, plat]) => (
          <CredentialCard
            key={key}
            platform={key}
            label={plat.label}
            enabled={plat.enabled}
            configured={plat.configured}
            fields={plat.fields}
            onChanged={fetchAll}
          />
        ))}
      </Card>

      {/* 基本信息 */}
      {config && (
        <Card title="基本信息" style={{ marginBottom: 16 }}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Git 仓库">{config.git.repoUrl || '-'}</Descriptions.Item>
            <Descriptions.Item label="工作目录">{config.workspace.dir || '-'}</Descriptions.Item>
            <Descriptions.Item label="SSH 用户">{config.ssh.user || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title="环境变量配置">
        <Table
          columns={columns}
          dataSource={envList}
          rowKey="key"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 创建分组 Modal */}
      <Modal
        title="添加配置分组"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateGroup}>
          <Form.Item
            label="英文名称 (key)"
            name="key"
            rules={[
              { required: true, message: '请输入英文名称' },
              { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '只能包含英文字母、数字和下划线，且不能以数字开头' },
            ]}
            extra="用于构建脚本参数名，例如 sentry_dsn"
          >
            <Input placeholder="例如: sentry_dsn" />
          </Form.Item>
          <Form.Item
            label="中文名称"
            name="label"
            rules={[{ required: true, message: '请输入中文名称' }]}
            extra="显示在构建表单中的名称"
          >
            <Input placeholder="例如: Sentry DSN" />
          </Form.Item>
          <Form.Item label="是否必填" name="required" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
