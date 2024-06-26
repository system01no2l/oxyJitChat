import { Injectable } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { Server } from 'socket.io';

import { RedisService } from '../redis/redis.service';
import { SocketStateService } from '../socket-state/socket-state.service';

import { EventEmitterRequest } from './events/event-emit';
import { RedisSocketEventSendDTO } from './events/event-send';
import {
    REDIS_SOCKET_EVENT_EMIT_ALL_NAME,
    REDIS_SOCKET_EVENT_EMIT_AUTHENTICATED_NAME,
    REDIS_SOCKET_EVENT_SEND_NAME,
} from './constants';

@Injectable()
export class RedisPropagatorService {
    private socketServer: Server;

    public constructor(
        private readonly socketStateService: SocketStateService,
        private readonly redisService: RedisService,
    ) {
        this.redisService
            .fromEvent(REDIS_SOCKET_EVENT_SEND_NAME)
            .pipe(tap(this.consumeSendEvent))
            .subscribe();

        this.redisService
            .fromEvent(REDIS_SOCKET_EVENT_EMIT_ALL_NAME)
            .pipe(tap(this.consumeEmitToAllEvent))
            .subscribe();

        this.redisService
            .fromEvent(REDIS_SOCKET_EVENT_EMIT_AUTHENTICATED_NAME)
            .pipe(tap(this.consumeEmitToAuthenticatedEvent))
            .subscribe();
    }

    public injectSocketServer(server: Server): RedisPropagatorService {
        this.socketServer = server;

        return this;
    }

    private consumeSendEvent = (eventInfo: RedisSocketEventSendDTO): void => {
        const { userId, event, data, socketId, roomId } = eventInfo;
        return this.socketStateService
            .getAllSocketForRoom(roomId)
            .filter((socket) => socket.socketId !== socketId)
            .forEach((socket) => {
                console.log(socket,'xxxxxxxx');
                this.socketServer.to(socket.socketId).emit(event, data)
            });
    };

    private consumeEmitToAllEvent = (
        eventInfo: EventEmitterRequest,
    ): void => {
        this.socketServer.emit(eventInfo.event, eventInfo.data);
    };

    private consumeEmitToAuthenticatedEvent = (
        eventInfo: EventEmitterRequest,
    ): void => {
        const { event, data } = eventInfo;

        // return this.socketStateService
        //   .getAll()
        //   .forEach((socket) => socket.emit(event, data));
    };

    public propagateEvent(eventInfo: RedisSocketEventSendDTO): boolean {
        console.log('propagateEvent with data ... ');
        if (!eventInfo.userId) {
            return false;
        }

        this.redisService.publish(REDIS_SOCKET_EVENT_SEND_NAME, eventInfo);

        return true;
    }

    public emitToAuthenticated(eventInfo: EventEmitterRequest): boolean {
        this.redisService.publish(
            REDIS_SOCKET_EVENT_EMIT_AUTHENTICATED_NAME,
            eventInfo,
        );

        return true;
    }

    public emitToAll(eventInfo: EventEmitterRequest): boolean {
        this.redisService.publish(REDIS_SOCKET_EVENT_EMIT_ALL_NAME, eventInfo);

        return true;
    }
}
