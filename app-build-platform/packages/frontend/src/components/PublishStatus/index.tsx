import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Tag, Typography, Space, Spin, Button, message, Drawer, Descriptions } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  CopyOutlined,
  EyeOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import api from '@/services/api';

const { Title, Text, Paragraph } = Typography;

interface PublishRecord {
  id: string;
  buildId: string;
  platform: string;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'reviewing';
  downloadUrl?: string;
  reviewUrl?: string;
  error?: string;
  publishedAt?: string;
}

interface PublishStatusProps {
  buildId: string;
}

const PublishStatus: React.FC<PublishStatusProps> = ({ buildId }) => {
  const [loading, setLoading] = useState(true);
  const [publishes, setPublishes] = useState<PublishRecord[]>([]);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [selectedPublish, setSelectedPublish] = useState<PublishRecord | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchPublishes();

    // Connect to WebSocket for real-time updates
    const socket = io(`${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/publishes`, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected to publishes namespace, subscribing to build:', buildId);
      socket.emit('subscribe', buildId);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.on('publishStatus', (data: { buildId: string; publish: PublishRecord }) => {
      console.log('Received publish status update:', data);
      if (data.buildId === buildId) {
        setPublishes((prev) => {
          const index = prev.findIndex((p) => p.id === data.publish.id);
          if (index >= 0) {
            // Update existing record
            const updated = [...prev];
            updated[index] = data.publish;
            return updated;
          } else {
            // Add new record
            return [...prev, data.publish];
          }
        });
      }
    });

    // Fallback polling every 30 seconds (reduced from 10s since we have WebSocket)
    const interval = setInterval(fetchPublishes, 30000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe', buildId);
        socketRef.current.disconnect();
      }
    };
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败'),
    );
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
      appstore: 'App Store (CN)',
      appstore_over: 'App Store (OVER)',
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

  const formatTime = (time?: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
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
    <>
      <Card>
        <Title level={4} style={{ marginBottom: 16 }}>
          发布状态
        </Title>
        <Row gutter={[16, 16]}>
          {publishes.map((publish) => (
            <Col xs={24} sm={12} md={8} lg={6} key={publish.id}>
              <Card
                size="small"
                hoverable
                style={{
                  textAlign: 'center',
                  borderColor: publish.status === 'success' ? '#52c41a' : publish.status === 'failed' ? '#f5222d' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedPublish(publish)}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {getStatusIcon(publish.status)}
                  <Text strong>{getPlatformName(publish.platform)}</Text>
                  {getStatusTag(publish.status)}
                  {publish.downloadUrl && (
                    <Button
                      type="link"
                      size="small"
                      href={publish.downloadUrl}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      下载链接
                    </Button>
                  )}
                  {publish.reviewUrl && (
                    <Button
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      href={publish.reviewUrl}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#1890ff' }}
                    >
                      查看审核
                    </Button>
                  )}
                  {publish.error && (
                    <div style={{ width: '100%' }}>
                      <Text type="danger" style={{ fontSize: 12, lineHeight: '20px' }}>
                        {publish.error.length > 40
                          ? publish.error.substring(0, 40) + '...'
                          : publish.error
                        }
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Button
                          type="link"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(publish.error || '');
                          }}
                          style={{ padding: 0 }}
                        >
                          复制错误
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPublish(publish);
                          }}
                          style={{ padding: '0 0 0 12px' }}
                        >
                          详情
                        </Button>
                      </div>
                    </div>
                  )}
                  {publish.status === 'failed' && (
                    <Button
                      type="link"
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={retrying[publish.id]}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setRetrying(prev => ({ ...prev, [publish.id]: true }));
                        try {
                          await api.post(`/publishes/${publish.id}/retry`);
                          message.success('重试任务已创建');
                          setTimeout(fetchPublishes, 1000);
                        } catch (err: any) {
                          message.error(err.response?.data?.message || '重试失败');
                        } finally {
                          setRetrying(prev => ({ ...prev, [publish.id]: false }));
                        }
                      }}
                    >
                      重试
                    </Button>
                  )}
                  {publish.publishedAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatTime(publish.publishedAt)}
                    </Text>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Drawer
        title={`${getPlatformName(selectedPublish?.platform || '')} - 上传详情`}
        placement="right"
        width={560}
        open={!!selectedPublish}
        onClose={() => setSelectedPublish(null)}
      >
        {selectedPublish && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="发布 ID">
                <Text copyable={{ text: selectedPublish.id }}>{selectedPublish.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="平台">
                {getPlatformName(selectedPublish.platform)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedPublish.status)}
              </Descriptions.Item>
              {selectedPublish.publishedAt && (
                <Descriptions.Item label="发布时间">
                  {formatTime(selectedPublish.publishedAt)}
                </Descriptions.Item>
              )}
              {selectedPublish.downloadUrl && (
                <Descriptions.Item label="下载链接">
                  <Button type="link" href={selectedPublish.downloadUrl} target="_blank">
                    打开链接
                  </Button>
                </Descriptions.Item>
              )}
              {selectedPublish.reviewUrl && (
                <Descriptions.Item label="审核链接">
                  <Button type="link" icon={<LinkOutlined />} href={selectedPublish.reviewUrl} target="_blank">
                    在 App Store Connect 中查看
                  </Button>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 错误信息详情 */}
            {selectedPublish.error && (
              <Card
                size="small"
                title={
                  <Space>
                    <CloseCircleOutlined style={{ color: '#f5222d' }} />
                    <span>错误详情</span>
                  </Space>
                }
                extra={
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(selectedPublish.error || '')}
                  >
                    复制
                  </Button>
                }
              >
                <Paragraph
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    maxHeight: 400,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: 0,
                  }}
                >
                  {selectedPublish.error}
                </Paragraph>
              </Card>
            )}

            {/* 上传中状态 */}
            {selectedPublish.status === 'uploading' && (
              <Card size="small">
                <Space>
                  <SyncOutlined spin style={{ color: '#1890ff' }} />
                  <Text>正在上传，请稍候...</Text>
                </Space>
              </Card>
            )}

            {/* 成功状态 */}
            {selectedPublish.status === 'success' && (
              <Card
                size="small"
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>上传成功</span>
                  </Space>
                }
              >
                <Space direction="vertical">
                  <Text>上传已完成</Text>
                  {selectedPublish.publishedAt && (
                    <Text type="secondary">完成时间：{formatTime(selectedPublish.publishedAt)}</Text>
                  )}
                </Space>
              </Card>
            )}

            {/* 审核中状态 */}
            {selectedPublish.status === 'reviewing' && (
              <Card
                size="small"
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#faad14' }} />
                    <span>审核中</span>
                  </Space>
                }
              >
                <Text>已提交至平台审核，请等待审核结果</Text>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </>
  );
};

export default PublishStatus;
