// Đo độ trễ đồng bộ whiteboard — spec docs/task/whiteboard/whiteboard_sync_spec.md §11
// Chạy (PowerShell, từ gốc repo, backend + LiveKit đang chạy trong Docker): node tests/load/wb-latency.mjs
// Mỗi N: tạo N tài khoản bench_*, 1 phòng, 1 meeting; đo 2 kịch bản; kết thúc meeting.
// Phải xong trước MEETING_AUTO_END_AFTER_MIN (ADR-022) — không ai vào LiveKit nên room tự đóng sau vài phút
import { createRequire } from 'node:module';

// Lấy socket.io-client từ frontend/node_modules — không thêm dependency (gốc repo không có dependencies)
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { io } = require('socket.io-client');

const API = process.env.API_URL || 'http://localhost:3001';
const SIZES = (process.env.WB_SIZES || '2,10,20').split(',').map(Number);
const DURATION_MS = 10_000; // mỗi kịch bản 10 s
const TICK_MS = 50; // đúng chu kỳ throttle của client (spec §9)
const POINTS_PER_TICK = 3; // ~60 điểm/giây cho nét vẽ tay

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// N tài khoản mới cùng 1 phòng; người đầu là HOST, bắt đầu meeting
async function setup(n) {
  const run = Date.now().toString(36);
  const tokens = [];
  for (let i = 0; i < n; i++) {
    const username = `bench_${run}_${i}`;
    const { accessToken } = await api('/auth/register', {
      body: { email: `${username}@example.com`, username, displayName: `Bench ${i}`, password: 'bench123' },
    });
    tokens.push(accessToken);
  }
  const room = await api('/rooms', { token: tokens[0], body: { name: `Bench ${run} N=${n}` } });
  for (const token of tokens.slice(1)) await api('/rooms/join', { token, body: { code: room.joinCode } });
  const meeting = await api(`/rooms/${room.id}/meetings`, { token: tokens[0], body: { title: `Bench N=${n}` } });
  return { tokens, meetingId: meeting.id };
}

// Kết nối + meeting:join, xong khi nhận snapshot
function connect(token, meetingId) {
  return new Promise((resolve, reject) => {
    const socket = io(`${API}/meeting`, { auth: { token }, transports: ['websocket'] });
    socket.on('connect_error', reject);
    socket.on('error', (error) => console.error('socket error', error));
    socket.on('connect', () => socket.emit('meeting:join', { meetingId }));
    socket.once('meeting:snapshot', () => resolve(socket));
  });
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

// A gửi 1 element mỗi 50 ms trong 10 s; người nhận đo (nhận − sentAt) và đếm byte
async function scenario(name, sender, receivers, meetingId, makeElement) {
  const samples = [];
  let bytes = 0;
  let lastPayloadBytes = 0;
  const onOps = (envelope) => {
    const sentAt = envelope.data.elements[0]?.customData?.sentAt;
    if (typeof sentAt === 'number') samples.push(Date.now() - sentAt);
    bytes += Buffer.byteLength(JSON.stringify(envelope));
  };
  for (const receiver of receivers) receiver.on('wb:ops', onOps);

  const started = Date.now();
  for (let tick = 1; Date.now() - started < DURATION_MS; tick++) {
    const element = makeElement(tick);
    lastPayloadBytes = Buffer.byteLength(JSON.stringify(element));
    sender.emit('wb:ops', { meetingId, elements: [element] });
    await sleep(TICK_MS);
  }
  await sleep(1000); // chờ gói cuối
  for (const receiver of receivers) receiver.off('wb:ops', onOps);

  samples.sort((a, b) => a - b);
  return {
    scenario: name,
    samples: samples.length,
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    max_ms: samples.at(-1),
    lastPayloadBytes,
    bytesPerSecPerReceiver: Math.round(bytes / receivers.length / (DURATION_MS / 1000)),
  };
}

// Kịch bản A: 1 hình chữ nhật nhỏ, version tăng mỗi tick
const rectangle = (id) => (tick) => ({
  id, type: 'rectangle', version: tick, versionNonce: tick, isDeleted: false,
  x: tick, y: 0, width: 100, height: 60, customData: { sentAt: Date.now() },
});

// Kịch bản B: 1 nét vẽ tay dài dần, mỗi lần gửi TOÀN BỘ points (như Excalidraw)
const freedraw = (id) => {
  const points = [];
  return (tick) => {
    for (let k = 0; k < POINTS_PER_TICK; k++) {
      const i = points.length;
      points.push([i * 1.37, Math.sin(i / 10) * 40.123]);
    }
    return {
      id, type: 'freedraw', version: tick, versionNonce: tick, isDeleted: false,
      x: 0, y: 0, points, pressures: [], simulatePressure: true, customData: { sentAt: Date.now() },
    };
  };
};

const results = [];
for (const n of SIZES) {
  const { tokens, meetingId } = await setup(n);
  const sockets = await Promise.all(tokens.map((token) => connect(token, meetingId)));
  const [sender, ...receivers] = sockets;
  results.push({ N: n, ...(await scenario('A element nhỏ', sender, receivers, meetingId, rectangle(`rect${n}`))) });
  results.push({ N: n, ...(await scenario('B nét vẽ tay', sender, receivers, meetingId, freedraw(`free${n}`))) });
  for (const socket of sockets) socket.disconnect();
  await api(`/meetings/${meetingId}/end`, { token: tokens[0] });
}
console.table(results);
