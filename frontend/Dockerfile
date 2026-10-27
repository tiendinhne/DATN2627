# Frontend chạy chế độ dev trong Docker Compose (ADR-016) — giống backend: mount src/ để sửa code tự reload
FROM node:22-alpine

WORKDIR /app

# Cài dependency theo lockfile trước để Docker cache lớp này khi chỉ sửa code
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
