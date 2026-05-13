# 发布状态实时更新修复

## 问题描述
用户报告蒲公英上传成功后，详情页面一直显示"上传中"状态，并且没有显示下载地址。

## 根本原因
1. **缺少 WebSocket 推送**：发布状态更新后，后端没有通过 WebSocket 推送给前端
2. **轮询间隔过长**：前端每 10 秒轮询一次，导致状态更新延迟
3. **内存存储**：发布记录存储在内存中，重启后会丢失

## 解决方案

### 后端改进

#### 1. 创建 PublishGateway (WebSocket)
**文件**: `packages/backend/src/modules/publish/publish.gateway.ts`

- 创建 `/publishes` WebSocket 命名空间
- 支持客户端订阅特定构建的发布状态
- 提供 `emitPublishStatus` 方法推送状态更新

#### 2. 修改 PublishService
**文件**: `packages/backend/src/modules/publish/publish.service.ts`

- 注入 `PublishGateway`
- 在 `updatePublishStatus` 方法中，状态更新后立即通过 WebSocket 推送

#### 3. 添加 StorageService 方法
**文件**: `packages/backend/src/modules/storage/storage.service.ts`

- 添加 `getPublishById(id: string)` 方法，用于获取单个发布记录

#### 4. 注册 PublishGateway
**文件**: `packages/backend/src/modules/publish/publish.module.ts`

- 在 providers 中添加 `PublishGateway`

### 前端改进

#### 修改 PublishStatus 组件
**文件**: `packages/frontend/src/components/PublishStatus/index.tsx`

- 连接到 `/publishes` WebSocket 命名空间
- 订阅当前构建的发布状态更新
- 监听 `publishStatus` 事件，实时更新发布记录
- 将轮询间隔从 10 秒增加到 30 秒（作为 WebSocket 的备用方案）

## 工作流程

```
1. 用户触发上传
   ↓
2. 后端创建发布记录 (status: pending)
   ↓
3. 发布队列处理上传任务
   ↓
4. 状态更新: pending → uploading
   → WebSocket 推送到前端
   ↓
5. 上传完成
   ↓
6. 状态更新: uploading → success (包含 downloadUrl)
   → WebSocket 推送到前端
   ↓
7. 前端实时显示成功状态和下载链接
```

## WebSocket 事件

### 后端发送
- `publishStatus`: 发布状态更新
  ```json
  {
    "buildId": "xxx",
    "publish": {
      "id": "xxx",
      "platform": "pgyer",
      "status": "success",
      "downloadUrl": "https://www.pgyer.com/xxx",
      "publishedAt": "2024-05-13T..."
    }
  }
  ```

### 前端发送
- `subscribe`: 订阅构建的发布状态
  ```javascript
  socket.emit('subscribe', buildId);
  ```
- `unsubscribe`: 取消订阅
  ```javascript
  socket.emit('unsubscribe', buildId);
  ```

## 测试步骤

1. **重启后端服务**
   ```bash
   cd packages/backend
   npm run dev:backend
   ```

2. **重启前端服务**
   ```bash
   cd packages/frontend
   npm run dev:frontend
   ```

3. **测试上传**
   - 创建一个新的构建任务
   - 选择蒲公英作为发布平台
   - 提交构建
   - 观察构建详情页面的发布状态

4. **验证实时更新**
   - 打开浏览器开发者工具的 Console
   - 查看 WebSocket 连接日志
   - 确认收到 `publishStatus` 事件
   - 验证状态从 "上传中" 变为 "成功"
   - 验证显示蒲公英下载链接

## 预期结果

✅ 上传开始时，立即显示"上传中"状态
✅ 上传完成后，1-2 秒内状态更新为"成功"
✅ 显示蒲公英下载链接
✅ 无需手动刷新页面

## 注意事项

1. **内存存储限制**：发布记录仍然存储在内存中，重启后端服务会丢失历史记录
2. **WebSocket 连接**：确保前端 `.env` 文件配置了正确的 WebSocket URL
3. **备用轮询**：即使 WebSocket 连接失败，前端仍会每 30 秒轮询一次

## 未来改进建议

1. **持久化存储**：将发布记录保存到数据库或 JSON 文件
2. **上传进度**：显示上传进度百分比
3. **错误重试**：自动重试失败的上传
4. **通知提醒**：上传完成后发送浏览器通知
