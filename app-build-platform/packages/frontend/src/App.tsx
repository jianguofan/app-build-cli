import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import BuildTasks from '@/pages/BuildTasks';
import NewBuild from '@/pages/BuildTasks/NewBuild';
import BuildDetail from '@/pages/BuildTasks/BuildDetail';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          {/* 登录页 */}
          <Route path="/login" element={<Login />} />

          {/* 默认重定向到仪表盘 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 受保护的路由 */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/builds" element={<BuildTasks />} />
            <Route path="/builds/new" element={<NewBuild />} />
            <Route path="/builds/:id" element={<BuildDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
