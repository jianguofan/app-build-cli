import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  return (
    <div>
      <Title level={2}>仪表盘</Title>
      <p>欢迎使用 App Build Platform</p>
    </div>
  );
};

export default Dashboard;
