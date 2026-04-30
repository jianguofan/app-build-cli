import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Card,
  Space,
  Select,
  Button,
  message,
} from 'antd';
import { ReloadOutlined, LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';

const { Title, Link } = Typography;

interface PublishRecord {
  id: string;
  buildId: string;
  platform: string;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'reviewing';
  downloadUrl?: string;
  error?: string;
  publishedAt?: string;
}

const platformNames: Record<string, string> = {
  pgyer: '蒲公英',
  appstore: 'App Store',
  xiaomi: '小米应用商店',
  huawei: '华为应用市场',
  tencent: '应用宝',
  vivo: 'VIVO 应用商店',
  oppo: 'OPPO 软件商店',
  qihu360: '360 手机助手',
};

const statusConfig: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  uploading: { color: 'processing', text: '上传中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  reviewing: { color: 'warning', text: '审核中' },
};

const Publishes: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PublishRecord[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filterPlatform, setFilterPlatform] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const fetchPublishes = async (page = 1, limit = 20) => {
    setLoading(true);
    try {
      const response = await api.get('/publishes', {
        params: { page, limit, platform: filterPlatform, status: filterStatus },
      });
      setData(response.data.data);
      setPagination({
        current: response.data.page,
        pageSize: response.data.limit,
        total: response.data.total,
      });
    } catch {
      message.error('获取发布记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishes();
  }, [filterPlatform, filterStatus]);

  const columns: ColumnsType<PublishRecord> = [
    {
      title: '构建任务',
      dataIndex: 'buildId',
      key: 'buildId',
      width: 120,
      render: (id: string) => (
        <Link onClick={() => window.open(`/builds/${id}`, '_self')}>{id.substring(0, 8)}</Link>
      ),
    },
    {
      title: '发布平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 140,
      render: (p: string) => platformNames[p] || p,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const cfg = statusConfig[s] || statusConfig.pending;
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '下载链接',
      dataIndex: 'downloadUrl',
      key: 'downloadUrl',
      width: 200,
      render: (url?: string) =>
        url ? (
          <Link href={url} target="_blank"><LinkOutlined /> 查看</Link>
        ) : (
          '-'
        ),
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (err?: string) =>
        err ? <span style={{ color: '#f5222d' }}>{err}</span> : '-',
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 180,
      render: (t?: string) => (t ? new Date(t).toLocaleString('zh-CN') : '-'),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>发布管理</Title>
          <Space>
            <Select
              placeholder="筛选平台"
              allowClear
              style={{ width: 160 }}
              value={filterPlatform}
              onChange={setFilterPlatform}
              options={Object.entries(platformNames).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 120 }}
              value={filterStatus}
              onChange={setFilterStatus}
              options={Object.entries(statusConfig).map(([k, v]) => ({ value: k, label: v.text }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchPublishes()}>刷新</Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={(p) => fetchPublishes(p.current, p.pageSize)}
        />
      </Card>
    </div>
  );
};

export default Publishes;
