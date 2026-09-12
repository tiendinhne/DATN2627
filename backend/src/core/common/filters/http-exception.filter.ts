import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorBody, ErrorCode } from '@datn/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = {
      statusCode: status,
      error: ErrorCode.INTERNAL_ERROR,
      message: 'Đã có lỗi xảy ra',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse() as any;

      if (Array.isArray(raw?.message)) {
        // output của ValidationPipe -> map sang details, hiển thị ngay tại field
        body = {
          statusCode: status,
          error: ErrorCode.VALIDATION_ERROR,
          message: 'Dữ liệu không hợp lệ',
          details: raw.message.map((m: string) => ({
            field: m.split(' ')[0],
            constraint: m,
          })),
        };
      } else {
        body = {
          statusCode: status,
          error: (raw?.error as ErrorCode) ?? ErrorCode.INTERNAL_ERROR,
          message: raw?.message ?? exception.message,
          details: raw?.details,
        };
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json(body);
  }
}
