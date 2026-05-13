import React, { useState } from 'react';
import { Card, Row, Col, Typography, Space, Tag, Tooltip, Button } from 'antd';
import {
  AppleOutlined,
  AndroidOutlined,
  LinkOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  ShoppingOutlined,
  CloudOutlined,
  MobileOutlined,
  QqOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface StoreEntry {
  platform: string;
  label: string;
  account: string;
  password: string;
  configured: boolean;
  finished: boolean;
  consoleUrl: string;
  appUrl?: string;
  appId?: string;
  isApple: boolean;
  isWebsite: boolean;
}

const STORE_DATA: StoreEntry[] = [
  {
    platform: 'tencent',
    label: '应用宝',
    account: '18926453103',
    password: 'snapmaker123456',
    configured: true,
    finished: true,
    consoleUrl: 'https://app.open.qq.com/p/basic/basic-info/info?appId=1112397935',
    appUrl: 'https://a.app.qq.com/o/simple.jsp?pkgname=com.snapmaker.lavaapp.cn',
    appId: '1112397935',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'xiaomi',
    label: '小米应用商店',
    account: '18926453103',
    password: 'snapmaker@2016',
    configured: true,
    finished: true,
    consoleUrl: 'https://dev.mi.com/xiaomihyperos/console/apps/app-detail?appId=2882303761520481540&isOffStore=false',
    appId: '2882303761520481540',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'huawei',
    label: '华为应用市场（鸿蒙）',
    account: '18926453103',
    password: 'snapmaker@2016',
    configured: true,
    finished: true,
    consoleUrl: 'https://developer.huawei.com/consumer/cn/',
    appUrl: 'https://appgallery.huawei.com/app/detail?id=com.snapmaker.lavaapp.cn',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'oppo',
    label: 'OPPO 软件商店',
    account: '18926453103',
    password: 'snapmaker123456',
    configured: true,
    finished: true,
    consoleUrl: 'https://open.oppomobile.com/new/corporatePayment/enterpriseInfomationValidation',
    appId: '36655483',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'honor',
    label: '荣耀应用市场',
    account: '18926453103',
    password: 'snapmaker123456',
    configured: true,
    finished: true,
    consoleUrl: 'https://developer.honor.com/cn/verify',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'vivo',
    label: 'VIVO 应用商店',
    account: '18926453103',
    password: 'Snapmaker123456',
    configured: true,
    finished: true,
    consoleUrl: 'https://developer.vivo.com.cn/',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'samsung',
    label: '三星应用商店',
    account: 'snapmaker-app@snapmaker.com / 18926453103',
    password: 'Snapmaker2016@',
    configured: false,
    finished: false,
    consoleUrl: 'https://seller.samsungapps.com/',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'qihu360',
    label: '360 手机助手',
    account: '',
    password: '',
    configured: false,
    finished: false,
    consoleUrl: 'https://dev.360.cn/',
    isApple: false,
    isWebsite: false,
  },
  {
    platform: 'appstore',
    label: 'App Store (CN)',
    account: '',
    password: '',
    configured: true,
    finished: true,
    consoleUrl: 'https://appstoreconnect.apple.com/',
    isApple: true,
    isWebsite: false,
  },
  {
    platform: 'appstore_over',
    label: 'App Store (OVER)',
    account: '',
    password: '',
    configured: true,
    finished: true,
    consoleUrl: 'https://appstoreconnect.apple.com/',
    isApple: true,
    isWebsite: false,
  },
  {
    platform: 'website_cn',
    label: '国内官网',
    account: '',
    password: '',
    configured: true,
    finished: true,
    consoleUrl: 'https://snapmaker.cn/snapmaker-app',
    isApple: false,
    isWebsite: true,
  },
  {
    platform: 'website_overseas',
    label: '海外官网',
    account: '',
    password: '',
    configured: true,
    finished: true,
    consoleUrl: 'https://snapmaker.com/snapmaker-app',
    isApple: false,
    isWebsite: true,
  },
];

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  appstore: <AppleOutlined style={{ fontSize: 22 }} />,
  appstore_over: <AppleOutlined style={{ fontSize: 22 }} />,
  xiaomi: <ShoppingOutlined style={{ fontSize: 22 }} />,
  huawei: <CloudOutlined style={{ fontSize: 22 }} />,
  oppo: <MobileOutlined style={{ fontSize: 22 }} />,
  vivo: <MobileOutlined style={{ fontSize: 22 }} />,
  tencent: <QqOutlined style={{ fontSize: 22 }} />,
  qihu360: <SafetyCertificateOutlined style={{ fontSize: 22 }} />,
  honor: <CrownOutlined style={{ fontSize: 22 }} />,
  samsung: <AndroidOutlined style={{ fontSize: 22 }} />,
  website_cn: <GlobalOutlined style={{ fontSize: 22, color: '#E60012' }} />,
  website_overseas: <GlobalOutlined style={{ fontSize: 22, color: '#0052D9' }} />,
};

const PLATFORM_COLOR: Record<string, string> = {
  appstore: '#007AFF',
  appstore_over: '#007AFF',
  xiaomi: '#FF6900',
  huawei: '#CF0A2C',
  oppo: '#1BA784',
  vivo: '#415FFF',
  tencent: '#12B7F5',
  qihu360: '#3CB44B',
  honor: '#0AB2D8',
  samsung: '#1428A0',
  website_cn: '#E60012',
  website_overseas: '#0052D9',
};

const StoreAccounts: React.FC = () => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePassword = (platform: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {},
      () => {},
    );
  };

  const openUrl = (url: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        应用商店账号
      </Title>

      {/* App Stores */}
      <Title level={5} style={{ marginBottom: 16, color: '#666' }}>
        应用市场
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {STORE_DATA.filter((s) => !s.isWebsite).map((store) => (
          <Col xs={24} sm={12} md={8} lg={6} key={store.platform}>
            <Card
              hoverable
              size="small"
              style={{
                borderTop: `3px solid ${PLATFORM_COLOR[store.platform] || '#d9d9d9'}`,
              }}
              onClick={() => openUrl(store.consoleUrl)}
              title={
                <Space size={8}>
                  <span style={{ color: PLATFORM_COLOR[store.platform] }}>
                    {PLATFORM_ICON[store.platform]}
                  </span>
                  <span style={{ fontSize: 14 }}>{store.label}</span>
                  {store.configured ? (
                    <Tag color="green" style={{ marginLeft: 4, fontSize: 11 }}>
                      已配置
                    </Tag>
                  ) : (
                    <Tag color="default" style={{ marginLeft: 4, fontSize: 11 }}>
                      未配置
                    </Tag>
                  )}
                  {store.finished && (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                  )}
                </Space>
              }
              extra={
                store.consoleUrl ? (
                  <Tooltip title="打开控制台">
                    <LinkOutlined
                      style={{ fontSize: 14, color: '#1890ff', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openUrl(store.consoleUrl);
                      }}
                    />
                  </Tooltip>
                ) : null
              }
            >
              {store.isApple ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <EyeInvisibleOutlined style={{ fontSize: 18, color: '#bbb' }} />
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      登录信息不予显示
                    </Text>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      点击前往 App Store Connect
                    </Text>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Account */}
                  {store.account ? (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                        账户
                      </Text>
                      <Space size={4} style={{ display: 'flex', alignItems: 'center' }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: 'monospace',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {store.account}
                        </Text>
                        <Tooltip title="复制账号">
                          <CopyOutlined
                            style={{ cursor: 'pointer', color: '#999', fontSize: 12, flexShrink: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(store.account);
                            }}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>未配置</Text>
                    </div>
                  )}

                  {/* Password */}
                  {store.password ? (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
                        密码
                      </Text>
                      <Space size={4} style={{ display: 'flex', alignItems: 'center' }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: 'monospace',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {visiblePasswords[store.platform]
                            ? store.password
                            : '••••••••'}
                        </Text>
                        <Tooltip title={visiblePasswords[store.platform] ? '隐藏密码' : '显示密码'}>
                          {visiblePasswords[store.platform] ? (
                            <EyeInvisibleOutlined
                              style={{ cursor: 'pointer', color: '#999', fontSize: 12, flexShrink: 0 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePassword(store.platform);
                              }}
                            />
                          ) : (
                            <EyeOutlined
                              style={{ cursor: 'pointer', color: '#999', fontSize: 12, flexShrink: 0 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePassword(store.platform);
                              }}
                            />
                          )}
                        </Tooltip>
                        <Tooltip title="复制密码">
                          <CopyOutlined
                            style={{ cursor: 'pointer', color: '#999', fontSize: 12, flexShrink: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(store.password);
                            }}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  ) : null}

                  {/* App ID */}
                  {store.appId && (
                    <div style={{ marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        App ID: {store.appId}
                      </Text>
                    </div>
                  )}

                  {/* App URL */}
                  {store.appUrl && (
                    <div style={{ marginBottom: 4 }}>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openUrl(store.appUrl!);
                        }}
                      >
                        <LinkOutlined style={{ marginRight: 4 }} />
                        应用页面
                      </Button>
                    </div>
                  )}

                  {/* Footer hint */}
                  <div style={{ marginTop: 4, opacity: 0.5 }}>
                    <Text style={{ fontSize: 10 }}>
                      点击卡片前往开发者控制台
                    </Text>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Websites */}
      <Title level={5} style={{ marginBottom: 16, color: '#666' }}>
        官方网站
      </Title>
      <Row gutter={[16, 16]}>
        {STORE_DATA.filter((s) => s.isWebsite).map((site) => (
          <Col xs={24} sm={12} md={8} lg={6} key={site.platform}>
            <Card
              hoverable
              size="small"
              style={{
                borderTop: `3px solid ${PLATFORM_COLOR[site.platform]}`,
              }}
              onClick={() => openUrl(site.consoleUrl)}
            >
              <Space direction="vertical" size={4} style={{ width: '100%', textAlign: 'center' }}>
                {PLATFORM_ICON[site.platform]}
                <Text strong>{site.label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {site.consoleUrl}
                </Text>
                <Button
                  type="link"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openUrl(site.consoleUrl);
                  }}
                >
                  打开网站
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default StoreAccounts;
