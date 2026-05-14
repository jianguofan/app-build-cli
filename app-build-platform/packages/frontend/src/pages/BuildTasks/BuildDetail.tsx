import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Divider,
  Spin,
  message,
  Modal,
  Checkbox,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import api from '@/services/api';
import LogViewer from '@/components/LogViewer';
import PublishStatus from '@/components/PublishStatus';

const { Title, Text } = Typography;

interface BuildTask {
  id: string;
  platform: string;
  flavor: string;
  env: string;
  buildMode: string;
  branch: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  artifacts?: {
    ipa?: string;
    apk?: string;
  };
  error?: string;
  customParams?: Record<string, string>;
  publishTargets?: string[];
}

interface PublishPlatform {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
}

const BuildDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<BuildTask | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [republishModalVisible, setRepublishModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedUploadPlatforms, setSelectedUploadPlatforms] = useState<string[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<PublishPlatform[]>([]);
  const [republishing, setRepublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!id) return;

    let socket: Socket | null = null;

    const init = async () => {
      // 1. 先拉取任务详情和历史日志（含运行中的 live logs）
      await fetchTaskDetail();

      // 2. 再连接 WebSocket 获取实时日志，避免竞态覆盖
      socket = io(`${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/builds`, {
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('WebSocket connected, subscribing to task:', id);
        socket!.emit('subscribe', id);
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });

      socket.on('log', (data: { taskId: string; log: string }) => {
        if (data.taskId === id) {
          setLogs((prev) => [...prev, data.log]);
        }
      });

      socket.on('status', (data: { taskId: string; status: string }) => {
        if (data.taskId === id) {
          setTask((prev) => (prev ? { ...prev, status: data.status as any } : null));
          if (data.status === 'success' || data.status === 'failed' || data.status === 'cancelled') {
            if (data.status === 'cancelled') message.info('构建已被取消');
            fetchTaskDetail();
          }
        }
      });
    };

    init();

    return () => {
      if (socket) {
        socket.emit('unsubscribe', id);
        socket.disconnect();
      }
    };
  }, [id]);

  const fetchTaskDetail = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const response = await api.get(`/builds/${id}`);
      setTask(response.data);

      // 获取日志
      const logsResponse = await api.get(`/builds/${id}/logs`);
      setLogs(logsResponse.data);

      // 获取可用的发布平台
      if (response.data.status === 'success') {
        await fetchAvailablePlatforms(response.data.platform);
      }
    } catch (error: any) {
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePlatforms = async (buildPlatform: string) => {
    try {
      const response = await api.get('/config/publishing');
      const platforms: PublishPlatform[] = Object.values(response.data)
        .filter((p: any) => {
          // iOS 只能发布到 App Store 和蒲公英
          if (buildPlatform === 'ios') {
            return p.platform === 'appstore' || p.platform === 'appstore_over' || p.platform === 'pgyer';
          }
          // Android uploads are done manually via web console
          // return p.platform !== 'appstore' && p.platform !== 'appstore_over';
          return false;
        })
        .map((p: any) => ({
          id: p.platform,
          name: p.label,
          enabled: p.enabled,
          configured: p.configured,
        }));
      setAvailablePlatforms(platforms);
    } catch (error) {
      console.error('Failed to fetch available platforms:', error);
    }
  };

  const handleRepublish = () => {
    setSelectedPlatforms([]);
    setRepublishModalVisible(true);
  };

  const handleDirectUpload = () => {
    setSelectedUploadPlatforms([]);
    setUploadModalVisible(true);
  };

  const handleCancel = async () => {
    if (!id) return;

    try {
      await api.post(`/builds/${id}/cancel`);
      message.success('构建已取消');
      fetchTaskDetail();
    } catch (error: any) {
      message.error(error.response?.data?.message || '取消失败');
    }
  };

  const handleUploadConfirm = async () => {
    if (selectedUploadPlatforms.length === 0) {
      message.warning('请至少选择一个上传平台');
      return;
    }

    setUploading(true);
    const errors: string[] = [];

    try {
      for (const platform of selectedUploadPlatforms) {
        try {
          await api.post(`/publishes/upload/${id}/${platform}`);
          message.success(`${platform} 上传任务已创建`);
        } catch (err: any) {
          const errorMsg = err.response?.data?.message || '上传失败';
          errors.push(`${platform}: ${errorMsg}`);
        }
      }

      if (errors.length === 0) {
        message.success('所有上传任务已创建');
        setUploadModalVisible(false);
      } else {
        Modal.error({
          title: '部分上传任务创建失败',
          content: (
            <div>
              {errors.map((err, idx) => (
                <div key={idx}>{err}</div>
              ))}
            </div>
          ),
        });
      }

      // 刷新发布状态
      setTimeout(() => {
        fetchTaskDetail();
      }, 1000);
    } finally {
      setUploading(false);
    }
  };

  const handleRepublishConfirm = async () => {
    if (selectedPlatforms.length === 0) {
      message.warning('请至少选择一个发布平台');
      return;
    }

    setRepublishing(true);
    try {
      await api.post(`/publishes/build/${id}/republish`, {
        platforms: selectedPlatforms,
      });
      message.success('重新发布任务已创建');
      setRepublishModalVisible(false);
      // 刷新发布状态
      setTimeout(() => {
        fetchTaskDetail();
      }, 1000);
    } catch (error: any) {
      message.error(error.response?.data?.message || '重新发布失败');
    } finally {
      setRepublishing(false);
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return (
      <Card>
        <Text>任务不存在</Text>
      </Card>
    );
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Title level={2} style={{ margin: 0 }}>
                构建任务详情
              </Title>
              <Space>
                {(task.status === 'pending' || task.status === 'running') && (
                  <Popconfirm
                    title="确定取消此构建？"
                    onConfirm={handleCancel}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button danger icon={<StopOutlined />}>
                      取消构建
                    </Button>
                  </Popconfirm>
                )}
                <Button icon={<ReloadOutlined />} onClick={fetchTaskDetail}>
                  刷新
                </Button>
              </Space>
            </div>
          </div>

          <Descriptions bordered column={2}>
            <Descriptions.Item label="任务 ID">{task.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(task.status)}
            </Descriptions.Item>
            <Descriptions.Item label="平台">
              {task.platform === 'ios' ? 'iOS' : 'Android'}
            </Descriptions.Item>
            <Descriptions.Item label="渠道">{task.flavor}</Descriptions.Item>
            <Descriptions.Item label="环境">
              {task.env.toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="构建类型">
              {task.buildMode}
            </Descriptions.Item>
            <Descriptions.Item label="分支">{task.branch}</Descriptions.Item>
            {task.publishTargets && task.publishTargets.length > 0 && (
              <Descriptions.Item label="发布目标">
                <Space>
                  {task.publishTargets.map((target) => {
                    const nameMap: Record<string, string> = {
                      appstore: 'App Store (CN)',
                      appstore_over: 'App Store (OVER)',
                      pgyer: '蒲公英',
                      xiaomi: '小米', huawei: '华为', honor: '荣耀',
                      oppo: 'OPPO', vivo: 'VIVO', tencent: '应用宝',
                      qihu360: '360', samsung: '三星',
                    };
                    return <Tag key={target}>{nameMap[target] || target}</Tag>;
                  })}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {new Date(task.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {task.startedAt && (
              <Descriptions.Item label="开始时间">
                {new Date(task.startedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            {task.completedAt && (
              <Descriptions.Item label="完成时间">
                {new Date(task.completedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="耗时">
              {formatDuration(task.duration)}
            </Descriptions.Item>
            {task.customParams && Object.keys(task.customParams).length > 0 && (
              <Descriptions.Item label="自定义参数" span={2}>
                <Space>
                  {Object.entries(task.customParams).map(([key, value]) => (
                    <Tag key={key}>{key}: {value}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>

          {task.artifacts && (task.artifacts.ipa || task.artifacts.apk) && task.status !== 'cancelled' && (
            <>
              <Divider />
              <div>
                <Title level={4}>构建产物</Title>
                <Space>
                  {task.artifacts.ipa && (
                    <Button
                      icon={<DownloadOutlined />}
                      type="primary"
                      href={`/api/builds/${task.id}/download?token=${localStorage.getItem('token')}`}
                    >
                      下载 IPA
                    </Button>
                  )}
                  {task.artifacts.apk && (
                    <Button
                      icon={<DownloadOutlined />}
                      type="primary"
                      href={`/api/builds/${task.id}/download?token=${localStorage.getItem('token')}`}
                    >
                      下载 APK
                    </Button>
                  )}
                  {task.platform === 'ios' && task.artifacts && (task.artifacts.ipa || task.artifacts.apk) && (
                    <>
                      <Button
                        icon={<CloudUploadOutlined />}
                        type="primary"
                        onClick={handleRepublish}
                      >
                        重新发布
                      </Button>
                      <Button
                        icon={<CloudUploadOutlined />}
                        onClick={handleDirectUpload}
                      >
                        直接上传（调试）
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            </>
          )}

          {task.error && (
            <>
              <Divider />
              <div>
                <Title level={4}>错误信息</Title>
                <Text type="danger">{task.error}</Text>
              </div>
            </>
          )}

          <Divider />
          <PublishStatus buildId={task.id} />

          <Divider />
          <div>
            <Title level={4}>构建日志</Title>
            <LogViewer logs={logs} />
          </div>
        </Space>
      </Card>

      <Modal
        title="重新发布"
        open={republishModalVisible}
        onOk={handleRepublishConfirm}
        onCancel={() => setRepublishModalVisible(false)}
        confirmLoading={republishing}
        okText="确认发布"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>选择要发布的平台：</Text>
        </div>
        <Checkbox.Group
          style={{ width: '100%' }}
          value={selectedPlatforms}
          onChange={(values) => setSelectedPlatforms(values as string[])}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {availablePlatforms.map((platform) => (
              <Checkbox
                key={platform.id}
                value={platform.id}
                disabled={!platform.enabled || !platform.configured}
              >
                {platform.name}
                {!platform.configured && (
                  <Tag color="default" style={{ marginLeft: 8 }}>
                    未配置
                  </Tag>
                )}
                {platform.configured && !platform.enabled && (
                  <Tag color="default" style={{ marginLeft: 8 }}>
                    未启用
                  </Tag>
                )}
                {platform.configured && platform.enabled && (
                  <Tag color="success" style={{ marginLeft: 8 }}>
                    已配置
                  </Tag>
                )}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
        {availablePlatforms.filter((p) => p.enabled && p.configured).length === 0 && (
          <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
            暂无可用的发布平台，请先在设置页面配置发布凭证
          </Text>
        )}
      </Modal>

      <Modal
        title="直接上传（调试模式）"
        open={uploadModalVisible}
        onOk={handleUploadConfirm}
        onCancel={() => setUploadModalVisible(false)}
        confirmLoading={uploading}
        okText="开始上传"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="warning">
            ⚠️ 此功能跳过构建状态检查，直接上传产物到指定平台，仅用于调试。
          </Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>选择要上传的平台：</Text>
        </div>
        <Checkbox.Group
          style={{ width: '100%' }}
          value={selectedUploadPlatforms}
          onChange={(values) => setSelectedUploadPlatforms(values as string[])}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {availablePlatforms.map((platform) => (
              <Checkbox
                key={platform.id}
                value={platform.id}
              >
                {platform.name}
                {!platform.configured && (
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    未配置（仍可尝试）
                  </Tag>
                )}
                {platform.configured && !platform.enabled && (
                  <Tag color="default" style={{ marginLeft: 8 }}>
                    未启用
                  </Tag>
                )}
                {platform.configured && platform.enabled && (
                  <Tag color="success" style={{ marginLeft: 8 }}>
                    已配置
                  </Tag>
                )}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Modal>
    </div>
  );
};

export default BuildDetail;
