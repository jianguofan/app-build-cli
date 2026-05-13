import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/publishes', cors: { origin: '*' } })
export class PublishGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PublishGateway.name);
  private buildSubscriptions: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to publishes namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from publishes namespace: ${client.id}`);
    // Clean up subscriptions
    for (const [buildId, clients] of this.buildSubscriptions.entries()) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.buildSubscriptions.delete(buildId);
      }
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, buildId: string) {
    this.logger.log(`Client ${client.id} subscribing to build: ${buildId}`);
    if (!this.buildSubscriptions.has(buildId)) {
      this.buildSubscriptions.set(buildId, new Set());
    }
    this.buildSubscriptions.get(buildId)!.add(client.id);
    client.join(`build:${buildId}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, buildId: string) {
    this.logger.log(`Client ${client.id} unsubscribing from build: ${buildId}`);
    const clients = this.buildSubscriptions.get(buildId);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.buildSubscriptions.delete(buildId);
      }
    }
    client.leave(`build:${buildId}`);
  }

  emitPublishStatus(buildId: string, publishRecord: any) {
    this.logger.log(`Emitting publish status for build ${buildId}: ${publishRecord.platform} - ${publishRecord.status}`);
    this.server.to(`build:${buildId}`).emit('publishStatus', {
      buildId,
      publish: publishRecord,
    });
  }
}
