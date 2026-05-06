import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Typography, Space, Spin } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text, Link } = Typography;

interface PublishRecord {
  id: string;
  buildId: string;
  platform: string;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'reviewing';
  downloadUrl?: string;
  error?: string;
  publishedAt?: string;
}

interface PublishStatusProps {
  buildId: string;
}

const PublishStatus: React.FC<PublishStatusProps> = ({ buildId }) => {
  const [loading, setLoading] = useState(true);
  const [publishes, setPublishes] = useState<PublishRecord[]>([]);

  useEffect(() => {
    fetchPublishes();
    // 每 10 秒刷新一次
    const interval = setInterval(fetchPublishes, 10000);
    return () => clearInterval(interval);
  }, [buildId]);

  const fetchPublishes = async () => {
    try {
      const response = await api.get(`/publishes/build/${buildId}`);
      setPublishes(response.data);
    } catch (error) {
      console.error('Failed to fetch publishes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
      case 'uploading':
        return <SyncOutlined spin style={{ color: '#1890ff', fontSize: 24 }} />;
      case 'reviewing':
        return <ClockCircleOutlined style={{ color: '#faad14', fontSize: 24 }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9', fontSize: 24 }} />;
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      uploading: { color: 'processing', text: '上传中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
      reviewing: { color: 'warning', text: '审核中' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      pgyer: '蒲公英',
      appstore: 'App Store',
      xiaomi: '小米应用商店',
      huawei: '华为应用市场',
      honor: '荣耀应用市场',
      oppo: 'OPPO 软件商店',
      vivo: 'VIVO 应用商店',
      tencent: '应用宝',
      qihu360: '360 手机助手',
      samsung: '三星应用商店',
    };
    return names[platform] || platform;
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (publishes.length === 0) {
    return (
      <Card>
        <Text type="secondary">暂无发布记录</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>
        发布状态
      </Title>
      <Row gutter={[16, 16]}>
        {publishes.map((publish) => (
          <Col xs={24} sm={12} md={8} lg={6} key={publish.id}>
            <Card
              size="small"
              style={{
                textAlign: 'center',
                borderColor: publish.status === 'success' ? '#52c41a' : undefined,
              }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {getStatusIcon(publish.status)}
                <Text strong>{getPlatformName(publish.platform)}</Text>
                {getStatusTag(publish.status)}
                {publish.downloadUrl && (
                  <Link href={publish.downloadUrl} target="_blank">
                    下载链接
                  </Link>
                )}
                {publish.error && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {publish.error}
                  </Text>
                )}
                {publish.publishedAt && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(publish.publishedAt).toLocaleString('zh-CN')}
                  </Text>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default PublishStatus;
