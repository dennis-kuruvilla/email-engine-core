import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class WebSocketGatewayService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private userClientMap: Map<string, string> = new Map();

  // TODO: authenticate websocket connections
  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    const userId = Array.from(this.userClientMap.entries()).find(
      ([, clientId]) => clientId === client.id,
    )?.[0];
    if (userId) {
      this.userClientMap.delete(userId);
      console.log(`Client disconnected: ${userId}`);
    }
  }

  @SubscribeMessage('authenticate')
  handleUserAuthentication(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    if (userId) {
      this.userClientMap.set(userId, client.id);
      console.log(`User ${userId} authenticated and connected.`);
      client.emit('authenticated', { message: `User ${userId} authenticated` });
    } else {
      console.log('User ID is missing or invalid');
    }
  }

  sendEventToUser(userId: string, payload: any) {
    const clientId = this.userClientMap.get(userId);
    if (clientId) {
      const client = this.server.sockets.sockets.get(clientId);
      if (client) {
        setTimeout(() => {
          client.emit('user-event', payload);
          console.log(`Event sent to user ${userId}`);
        }, 2000);
      } else {
        console.log(`Client with ID ${clientId} not found`);
      }
    } else {
      console.log(`User ${userId} not connected`);
    }
  }
}
