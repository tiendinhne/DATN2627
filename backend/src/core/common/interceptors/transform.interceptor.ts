import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * _id -> id, bỏ __v. Đã chốt: KHÔNG để _id rò ra ngoài API.
 * Làm một lần ở đây thay vì map thủ công trong từng service.
 */
function normalize(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  const plain = typeof value.toObject === 'function' ? value.toObject() : value;
  if (plain?.constructor && plain.constructor.name === 'ObjectId') return plain.toString();

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(plain)) {
    if (k === '__v') continue;
    if (k === '_id') { out.id = String(v); continue; }
    out[k] = normalize(v);
  }
  return out;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(normalize));
  }
}
