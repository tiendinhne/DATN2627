import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';
import type { Env } from '../../../config/env.schema';

/**
 * instanceId trong mọi dòng log là BẮT BUỘC — nó là thứ chứng minh
 * load balancer phân phối đều khi chạy nhiều instance (thí nghiệm E3).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly instanceId: string;

  constructor(config: ConfigService<Env, true>) {
    this.instanceId = config.get('INSTANCE_ID', { infer: true });
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    req.requestId = requestId;

    const started = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          JSON.stringify({
            instanceId: this.instanceId,
            requestId,
            method: req.method,
            url: req.originalUrl,
            ms: Date.now() - started,
          }),
        );
      }),
    );
  }
}
