import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Upload, Button, Select, Space, Typography, message, Progress, Tag, Table, Tooltip, Spin, Input } from 'antd';
import { InboxOutlined, CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Dragger } = Upload;

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

const DirectUpload: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('appstore');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileList, setFileList] = useState<any[]>([]);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [pgyerAccountType, setPgyerAccountType] = useState<string>('lupeilong');
  const [publishes, setPublishes] = useState<PublishRecord[]>([]);
  const [publishesLoading, setPublishesLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const platforms = [
    { value: 'appstore', label: 'App Store (CN)', fileType: '.ipa' },
    { value: 'appstore_over', label: 'App Store (OVER)', fileType: '.ipa' },
    { value: 'pgyer', label: '蒲公英', fileType: '.ipa,.apk' },
    // Android uploads are done manually via web console
    // { value: 'xiaomi', label: '小米应用商店', fileType: '.apk' },
    // { value: 'huawei', label: '华为应用市场', fileType: '.apk' },
    // { value: 'honor', label: '荣耀应用市场', fileType: '.apk' },
    // { value: 'oppo', label: 'OPPO 软件商店', fileType: '.apk' },
    // { value: 'vivo', label: 'VIVO 应用商店', fileType: '.apk' },
    // { value: 'tencent', label: '应用宝', fileType: '.apk' },
    // { value: 'qihu360', label: '360 手机助手', fileType: '.apk' },
    // { value: 'samsung', label: '三星应用商店', fileType: '.apk' },
  ];

  const selectedPlatformInfo = platforms.find((p) => p.value === selectedPlatform);

  // 从 localStorage 加载历史 upload buildId
  const getUploadHistory = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('upload-history') || '[]');
    } catch { return []; }
  };

  const saveUploadHistory = (buildId: string) => {
    const history = getUploadHistory();
    if (!history.includes(buildId)) {
      history.unshift(buildId);
      localStorage.setItem('upload-history', JSON.stringify(history.slice(0, 20)));
    }
  };

  // 轮询所有 upload publish 的状态
  const fetchAllPublishes = useCallback(async () => {
    const history = getUploadHistory();
    if (history.length === 0) return;

    setPublishesLoading(true);
    try {
      const allRecords: PublishRecord[] = [];
      for (const buildId of history) {
        try {
          const res = await api.get(`/publishes/build/${buildId}`);
          allRecords.push(...res.data);
        } catch { /* ignore */ }
      }
      // Sort by newest first
      allRecords.sort((a, b) => {
        const aTime = a.publishedAt || a.id;
        const bTime = b.publishedAt || b.id;
        return bTime.localeCompare(aTime);
      });
      setPublishes(allRecords);
    } catch {
      // ignore
    } finally {
      setPublishesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPublishes();
    pollingRef.current = setInterval(fetchAllPublishes, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchAllPublishes]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    accept: selectedPlatformInfo?.fileType || '.ipa,.apk',
    beforeUpload: (file) => {
      const isIPA = file.name.toLowerCase().endsWith('.ipa');
      const isAPK = file.name.toLowerCase().endsWith('.apk');

      if (!isIPA && !isAPK) {
        message.error('只支持 .ipa 或 .apk 文件');
        return false;
      }

      if ((selectedPlatform === 'appstore' || selectedPlatform === 'appstore_over') && !isIPA) {
        message.error('App Store 只支持 .ipa 文件');
        return false;
      }

      // Android uploads are done manually via web console
      // if (selectedPlatform !== 'appstore' && selectedPlatform !== 'appstore_over' && selectedPlatform !== 'pgyer' && !isAPK) {
      //   message.error('该平台只支持 .apk 文件');
      //   return false;
      // }

      const isLt2G = file.size / 1024 / 1024 / 1024 < 2;
      if (!isLt2G) {
        message.error('文件大小不能超过 2GB');
        return false;
      }

      setFileList([file]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileList[0]);
    if (releaseNotes) {
      formData.append('releaseNotes', releaseNotes);
    }
    if (selectedPlatform === 'pgyer' && pgyerAccountType && pgyerAccountType !== 'none') {
      formData.append('pgyerAccountType', pgyerAccountType);
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const response = await api.post(`/publishes/upload-file/${selectedPlatform}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(percentCompleted);
        },
      });

      saveUploadHistory(response.data.buildId);
      message.success('文件上传成功，发布任务已创建');
      setFileList([]);
      setReleaseNotes('');
      setUploadProgress(0);
      fetchAllPublishes();
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed': return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      case 'uploading': return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'reviewing': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      default: return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      uploading: { color: 'processing', text: '上传中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
      reviewing: { color: 'warning', text: '审核中' },
    };
    const c = config[status] || config.pending;
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      pgyer: '蒲公英', appstore: 'App Store (CN)', appstore_over: 'App Store (OVER)',
      xiaomi: '小米', huawei: '华为', honor: '荣耀',
      oppo: 'OPPO', vivo: 'VIVO', tencent: '应用宝',
      qihu360: '360', samsung: '三星',
    };
    return names[platform] || platform;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败'),
    );
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => getStatusIcon(status),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => getPlatformName(platform),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'statusTag',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error: string) => error ? (
        <Space>
          <Text type="danger" style={{ fontSize: 12, maxWidth: 300 }} ellipsis={{ tooltip: error }}>
            {error}
          </Text>
          <Tooltip title="复制错误信息">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(error)} />
          </Tooltip>
        </Space>
      ) : '-',
    },
    {
      title: '审核链接',
      dataIndex: 'reviewUrl',
      key: 'reviewUrl',
      width: 120,
      render: (url: string, record: PublishRecord) =>
        record.status === 'success' && url ? (
          <Button type="link" size="small" icon={<LinkOutlined />} href={url} target="_blank">
            查看审核
          </Button>
        ) : '-',
    },
    {
      title: '完成时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 180,
      render: (time: string) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={2}>直接上传文件</Title>
              <Text type="secondary">选择本地的 IPA 或 APK 文件，直接上传到指定平台</Text>
            </div>

            <div>
              <Text strong>选择目标平台：</Text>
              <Select
                style={{ width: 300, marginTop: 8 }}
                value={selectedPlatform}
                onChange={setSelectedPlatform}
                options={platforms}
                disabled={uploading}
              />
            </div>

            <div>
              <Text strong>选择文件：</Text>
              <Dragger {...uploadProps} style={{ marginTop: 8 }}>
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">支持 {selectedPlatformInfo?.fileType} 文件，最大 2GB</p>
              </Dragger>
            </div>

            {(selectedPlatform === 'appstore' || selectedPlatform === 'appstore_over') && (
              <div>
                <Text strong>此版本的新增内容：</Text>
                <Input.TextArea
                  rows={4}
                  placeholder="输入此版本的新增内容（更新日志），将提交到 App Store Connect"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  disabled={uploading}
                  style={{ marginTop: 8 }}
                  maxLength={4000}
                  showCount
                />
              </div>
            )}

            {selectedPlatform === 'pgyer' && (
              <div>
                <Text strong>蒲公英上传账号：</Text>
                <Select
                  style={{ width: 300, marginTop: 8 }}
                  value={pgyerAccountType}
                  onChange={setPgyerAccountType}
                  disabled={uploading}
                  options={[
                  { value: 'lupeilong', label: 'LuPeiLong (默认)' },
                    { value: 'allenli', label: 'AllenLi' },
                    { value: 'alanwu', label: 'AlanWu' },
                    { value: 'lb', label: 'LB' },
                    { value: 'jianguo', label: 'JianGuo' },
                  ]}
                />
              </div>
            )}

            {uploading && (
              <div>
                <Text>上传进度：</Text>
                <Progress percent={uploadProgress} status="active" />
              </div>
            )}

            <div>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={handleUpload}
                loading={uploading}
                disabled={fileList.length === 0}
                size="large"
              >
                开始上传
              </Button>
            </div>
          </Space>
        </Card>

        {/* 发布记录列表 */}
        <Card
          title={
            <Space>
              <span>上传记录</span>
              {publishesLoading && <Spin size="small" />}
            </Space>
          }
        >
          {publishes.length === 0 ? (
            <Text type="secondary">暂无上传记录</Text>
          ) : (
            <Table
              dataSource={publishes}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: 16 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div><Text strong>发布 ID：</Text><Text copyable>{record.id}</Text></div>
                      <div><Text strong>构建 ID：</Text><Text copyable>{record.buildId}</Text></div>
                      {record.error && (
                        <div>
                          <Text strong style={{ color: '#f5222d' }}>错误详情：</Text>
                          <div style={{
                            background: '#f5f5f5',
                            padding: 12,
                            borderRadius: 4,
                            marginTop: 4,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: 300,
                            overflow: 'auto',
                          }}>
                            {record.error}
                          </div>
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(record.error || '')}
                            style={{ marginTop: 8 }}
                          >
                            复制错误信息
                          </Button>
                        </div>
                      )}
                      {record.status === 'success' && record.downloadUrl && (
                        <div>
                          <Text strong>下载链接：</Text>
                          <Button type="link" href={record.downloadUrl} target="_blank">打开</Button>
                        </div>
                      )}
                      {record.status === 'success' && record.reviewUrl && (
                        <div>
                          <Text strong>审核链接：</Text>
                          <Button type="link" icon={<LinkOutlined />} href={record.reviewUrl} target="_blank">在 App Store Connect 中查看</Button>
                        </div>
                      )}
                    </Space>
                  </div>
                ),
              }}
            />
          )}
        </Card>
      </Space>
    </div>
  );
};

export default DirectUpload;
