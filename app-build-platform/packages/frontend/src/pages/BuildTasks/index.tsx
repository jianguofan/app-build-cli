import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Card,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, ReloadOutlined, EyeOutlined, DeleteOutlined, RedoOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';

const { Title } = Typography;

interface BuildTask {
  id: string;
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  env: 'dev' | 'pre' | 'prod';
  buildMode: 'debug' | 'release';
  branch: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

const BuildTasks: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BuildTask[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const fetchBuilds = async (page = 1, limit = 20) => {
    setLoading(true);
    try {
      const response = await api.get('/builds', {
        params: { page, limit },
      });
      setData(response.data.data);
      setPagination({
        current: response.data.page,
        pageSize: response.data.limit,
        total: response.data.total,
      });
    } catch (error: any) {
      message.error('获取构建任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuilds();
  }, []);

  const handleRebuild = async (record: BuildTask) => {
    try {
      const res = await api.post(`/builds/${record.id}/rebuild`);
      message.success('重新构建已创建');
      navigate(`/builds/${res.data.id}`);
    } catch (err: any) {
      message.error(err.response?.data?.message || '重新构建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/builds/${id}`);
      message.success('删除成功');
      fetchBuilds(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  const handleCancel = async (record: BuildTask) => {
    try {
      await api.post(`/builds/${record.id}/cancel`);
      message.success('构建已取消');
      fetchBuilds(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error.response?.data?.message || '取消失败');
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '进行中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
      cancelled: { color: 'warning', text: '已取消' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPlatformTag = (platform: string) => {
    return platform === 'ios' ? (
      <Tag color="blue">iOS</Tag>
    ) : (
      <Tag color="green">Android</Tag>
    );
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const columns: ColumnsType<BuildTask> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => id.substring(0, 8),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => getPlatformTag(platform),
    },
    {
      title: '渠道',
      dataIndex: 'flavor',
      key: 'flavor',
      width: 100,
    },
    {
      title: '环境',
      dataIndex: 'env',
      key: 'env',
      width: 80,
      render: (env: string) => env.toUpperCase(),
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration?: number) => formatDuration(duration),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: BuildTask) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/builds/${record.id}`)}
          >
            查看
          </Button>
          {(record.status === 'pending' || record.status === 'running') && (
            <Popconfirm
              title="确定取消此构建？"
              onConfirm={() => handleCancel(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                取消
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            size="small"
            icon={<RedoOutlined />}
            onClick={() => handleRebuild(record)}
          >
            重建
          </Button>
          <Popconfirm
            title="确定删除此任务？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>
            构建任务
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchBuilds()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/builds/new')}
            >
              新建构建
            </Button>
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
          onChange={(newPagination) => {
            fetchBuilds(newPagination.current, newPagination.pageSize);
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default BuildTasks;
