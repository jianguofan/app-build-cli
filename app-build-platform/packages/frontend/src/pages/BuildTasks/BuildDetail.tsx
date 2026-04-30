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
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  ReloadOutlined,
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
  status: 'pending' | 'running' | 'success' | 'failed';
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
}

const BuildDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<BuildTask | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!id) return;

    // 获取任务详情
    fetchTaskDetail();

    // 连接 WebSocket
    const socket = io(`${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/builds`, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      socket.emit('subscribe', id);
    });

    socket.on('log', (data: { taskId: string; log: string }) => {
      if (data.taskId === id) {
        setLogs((prev) => [...prev, data.log]);
      }
    });

    socket.on('status', (data: { taskId: string; status: string }) => {
      if (data.taskId === id) {
        setTask((prev) => (prev ? { ...prev, status: data.status as any } : null));
      }
    });

    return () => {
      socket.emit('unsubscribe', id);
      socket.disconnect();
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
    } catch (error: any) {
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '进行中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
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
              <Button icon={<ReloadOutlined />} onClick={fetchTaskDetail}>
                刷新
              </Button>
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

          {task.artifacts && (task.artifacts.ipa || task.artifacts.apk) && (
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
    </div>
  );
};

export default BuildDetail;
