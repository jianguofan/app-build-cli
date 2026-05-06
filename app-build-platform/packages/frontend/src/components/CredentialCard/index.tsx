import React, { useState } from 'react';
import { Card, Button, Space, Tag, Modal, Form, Input, Switch, Popconfirm, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Text } = Typography;

interface FieldMeta {
  key: string;
  label: string;
  secret: boolean;
  value: string;
  configured: boolean;
}

interface CredentialCardProps {
  platform: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  fields: FieldMeta[];
  onChanged: () => void;
}

const CredentialCard: React.FC<CredentialCardProps> = ({
  platform,
  label,
  enabled,
  configured,
  fields,
  onChanged,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      await api.put(`/config/publishing/${platform}`, { credentials: values });
      message.success(`${label} 凭证已保存`);
      setModalOpen(false);
      onChanged();
    } catch (err: any) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = () => {
    // Pre-fill non-secret fields with current values
    const init: Record<string, string> = {};
    fields.forEach((f) => {
      if (!f.secret && f.value) {
        init[f.key] = f.value;
      }
    });
    form.setFieldsValue(init);
    setModalOpen(true);
  };

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await api.put(`/config/publishing/${platform}/toggle`, { enabled: checked });
      message.success(`${label} 已${checked ? '启用' : '禁用'}`);
      onChanged();
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/config/publishing/${platform}`);
      message.success(`${label} 凭证已删除`);
      onChanged();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 12 }}
        title={
          <Space>
            <Text strong>{label}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>({platform})</Text>
          </Space>
        }
        extra={
          <Space>
            <Switch
              size="small"
              checked={enabled}
              loading={toggling}
              onChange={handleToggle}
              disabled={!configured}
            />
            <Button size="small" type="link" icon={<EditOutlined />} onClick={handleOpen}>
              配置
            </Button>
            {configured && (
              <Popconfirm title="确定删除此平台凭证？" onConfirm={handleDelete}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />} loading={deleting} />
              </Popconfirm>
            )}
          </Space>
        }
      >
        <Space wrap>
          <Tag
            icon={configured ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={configured ? 'success' : 'default'}
          >
            {configured ? '已配置' : '未配置'}
          </Tag>
          {fields.map((f) => (
            <Tag key={f.key} color={f.configured ? 'blue' : 'default'} style={{ fontSize: 12 }}>
              {f.label}: {f.configured ? (f.secret ? '******' : f.value) : '-'}
            </Tag>
          ))}
        </Space>
      </Card>

      <Modal
        title={`配置 ${label}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {fields.map((f) => (
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
      </Modal>
    </>
  );
};

export default CredentialCard;
