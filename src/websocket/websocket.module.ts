import { Module } from '@nestjs/common';
import { WebSocketGatewayService } from './websocket.gateway';

@Module({
  providers: [WebSocketGatewayService],
  exports: [WebSocketGatewayService],
})
export class WebsocketModule {}
