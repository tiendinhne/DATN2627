# Development

## 1. Repo layout [CONFIRMED]

```
DATN2627/
├── pnpm-workspace.yaml     packages: shared, backend, frontend
├── .npmrc                  public-hoist-pattern cho class-validator/transformer
├── shared/                 contract dùng chung FE/BE
├── backend/                NestJS (ESM)
├── frontend/               Next.js 15
├── docker/                 docker-compose.dev.yml
└── infrastructure/         docker, nginx, livekit, redis
```

## 2. Setup

```bash
pnpm install
pnpm --filter @datn/shared build     # backend/frontend dùng shared/dist, KHÔNG dùng source
cp backend/.env.example backend/.env # đổi JWT secret thành chuỗi ngẫu nhiên >= 32 ký tự
pnpm infra:up                        # mongo + redis + minio
pnpm -w run verify:schema            # phải PASS trước khi code tiếp
pnpm -w run dev:backend
```

Dev hằng ngày nên mở 2 terminal: `pnpm watch:shared` (tsc --watch) và `pnpm -w run dev:backend`.

## 3. Hosts file — BẮT BUỘC

```
127.0.0.1  app.localhost
127.0.0.1  api.localhost
```

Frontend ở `app.localhost:3000`, backend ở `api.localhost:4000`. Nếu dùng `localhost` cho cả hai thì là **cùng origin**, vấn đề cookie cross-origin sẽ bị giấu tới lúc deploy Vercel mới lộ — và lúc đó phải viết lại toàn bộ auth client.

## 4. ESM — quy tắc dễ quên nhất

`"type": "module"` + `moduleResolution: nodenext` → **mọi import tương đối phải có đuôi `.js`**:

```ts
import { AuthService } from './auth.service.js';       // đúng
import { AuthService } from './auth.service';          // SAI, runtime error
```

## 5. Bẫy tooling đã gặp [đã giải, ghi lại để không mất thời gian lần hai]

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `CannotDetermineTypeError: Cannot determine a type for "X"` | `Date \| null` là union, `emitDecoratorMetadata` không suy ra được | khai `@Prop({ type: Date, default: null })` tường minh |
| `Duplicate schema index on {...}` | `@Prop({ index: true })` trùng compound index | single-field khai ở `@Prop`, compound/partial/TTL khai ở `Schema.index()` |
| `Cannot find module 'dist/main'` | `paths` trỏ `@datn/shared` sang `../shared/src` → file ngoài `backend/` bị kéo vào, `rootDir` đẩy lên root repo | bỏ `@datn/shared` khỏi `paths`, resolve qua node_modules; thêm `tsconfig.build.json` với `rootDir: "./src"`, exclude `scripts/` |
| `The "class-validator" package is missing` | `class-validator`/`class-transformer` là **optional peer** của `@nestjs/common`; pnpm strict không link vào `.pnpm` store | `.npmrc` ở root: `public-hoist-pattern[]=*class-validator*` và `*class-transformer*`. **Không** dùng `shamefully-hoist=true` |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | pnpm từ chối package vừa publish (chính sách chống supply-chain attack) | `pnpm clean --lockfile` rồi `pnpm install`; hoặc chờ. **Không tắt policy** |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm chặn build script của native module | `pnpm approve-builds`, dùng **phím space** chọn rồi Enter (Enter suông = từ chối tất cả) |
| `Command "dev:backend" not found` | pnpm v12 chạy script ở workspace root theo chế độ recursive | `pnpm -w run dev:backend` hoặc `pnpm --filter @datn/backend start:dev` |

## 6. Test

- `shared/` có test sanity cho `lww-merge` và permission matrix — **14/14 pass**
- Backend dùng vitest; e2e có config riêng
- `backend/scripts/verify-schema.ts` kiểm tra 4 ràng buộc DB, chạy được trước khi có API

## 7. Lint / format

oxlint + prettier (theo nhánh đồng đội).

## 8. Chia việc

Người A: Auth / Room / Meeting / LiveKit / Deploy.
Người B: Socket / Whiteboard / AI / Import-Export.
Giao điểm là `shared/` — chốt contract ở đó **trước khi** tách việc.
