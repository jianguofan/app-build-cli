import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/builds',
  cors: {
    origin: '*',
  },
})
export class BuildGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BuildGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, taskId: string) {
    client.join(`task-${taskId}`);
    this.logger.log(`Client ${client.id} subscribed to task ${taskId}`);
    return { event: 'subscribed', data: { taskId } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, taskId: string) {
    client.leave(`task-${taskId}`);
    this.logger.log(`Client ${client.id} unsubscribed from task ${taskId}`);
    return { event: 'unsubscribed', data: { taskId } };
  }

  emitLog(taskId: string, log: string) {
    this.server.to(`task-${taskId}`).emit('log', {
      taskId,
      log,
      timestamp: new Date().toISOString(),
    });
  }

  emitStatusChange(taskId: string, status: string) {
    this.server.to(`task-${taskId}`).emit('status', {
      taskId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}
