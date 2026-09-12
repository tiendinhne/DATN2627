import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { ApiErrorBody, ErrorCode, ServerEvent } from '@datn/shared';

/**
 * Socket.IO KHÔNG dùng chung exception filter với HTTP.
 * Thiếu filter này thì lỗi trong gateway sẽ im lặng, client không biết gì.
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    let body: ApiErrorBody = {
      statusCode: 500,
      error: ErrorCode.INTERNAL_ERROR,
      message: 'Đã có lỗi xảy ra',
    };

    if (exception instanceof WsException) {
      const err = exception.getError() as any;
      body = typeof err === 'string'
        ? { statusCode: 400, error: ErrorCode.VALIDATION_ERROR, message: err }
        : { statusCode: 400, ...err };
    } else if (exception instanceof HttpException) {
      const raw = exception.getResponse() as any;
      body = {
        statusCode: exception.getStatus(),
        error: raw?.error ?? ErrorCode.VALIDATION_ERROR,
        message: Array.isArray(raw?.message) ? 'Dữ liệu không hợp lệ' : raw?.message,
        details: Array.isArray(raw?.message)
          ? raw.message.map((m: string) => ({ field: m.split(' ')[0], constraint: m }))
          : undefined,
      };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    client.emit(ServerEvent.ERROR, body);
  }
}
