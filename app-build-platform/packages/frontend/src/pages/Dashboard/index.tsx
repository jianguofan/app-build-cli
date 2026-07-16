import React, { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
} from 'antd';
import {
  BuildOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';

const { Title } = Typography;

interface Stats {
  totalBuilds: number;
  successRate: number;
  runningBuilds: number;
  avgDuration: number;
}

interface BuildTask {
  id: string;
  platform: 'ios' | 'android';
  flavor: 'oversea' | 'cn';
  env: 'dev' | 'staging' | 'pre' | 'prod';
  androidArtifact?: 'apk' | 'appbundle';
  buildMode: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: string;
  duration?: number;
}

const statusConfig: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  running: { color: 'processing', text: '进行中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBuilds, setRecentBuilds] = useState<BuildTask[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        api.get('/builds/stats'),
        api.get('/builds/recent'),
      ]);
      setStats(statsRes.data);
      setRecentBuilds(recentRes.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<BuildTask> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => id.substring(0, 8),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 80,
      render: (p: string) => (
        <Tag color={p === 'ios' ? 'blue' : 'green'}>{p === 'ios' ? 'iOS' : 'Android'}</Tag>
      ),
    },
    {
      title: '渠道',
      dataIndex: 'flavor',
      key: 'flavor',
      width: 80,
    },
    {
      title: '环境',
      dataIndex: 'env',
      key: 'env',
      width: 70,
      render: (e: string) => e.toUpperCase(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const cfg = statusConfig[s] || statusConfig.pending;
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (d?: number) => formatDuration(d),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={2}>仪表盘</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总构建数"
              value={stats?.totalBuilds || 0}
              prefix={<BuildOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="成功率"
              value={stats?.successRate || 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: (stats?.successRate || 0) >= 80 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats?.runningBuilds || 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="平均耗时"
              value={formatDuration(stats?.avgDuration)}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近构建">
        <Table
          columns={columns}
          dataSource={recentBuilds}
          rowKey="id"
          pagination={false}
          size="small"
          onRow={(record) => ({
            onClick: () => navigate(`/builds/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
