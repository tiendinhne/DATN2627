// Script Lua wb-apply — merge LWW batch element vào Redis Hash, atomic (spec whiteboard_sync_spec.md §4.2).
// Redis chạy từng script một → 2 instance cùng ghi 1 board không mất op.
// KEYS[1] = wb:{meetingId} (Hash id → JSON) · KEYS[2] = wb:seq:{meetingId} · KEYS[3] = wb:alive:{meetingId} · KEYS[4] = wb:closed:{meetingId} (có = board đã đóng)
// ARGV[1] = maxAlive · ARGV[2] = maxTotal · ARGV[3] = ttlSeconds
// ARGV[4..] = mỗi element 5 giá trị: id, version, versionNonce, isDeleted ('0'|'1'), json
// Trả về: {'CLOSED'} · {'LIMIT'} · {'NOOP'} · {'OK', seq, idx…} (idx = vị trí element thắng trong batch, đếm từ 0)
export const WB_APPLY_SCRIPT = `
-- Board đã đóng (hết buổi): từ chối mọi op, không ghi gì
if redis.call('EXISTS', KEYS[4]) == 1 then return {'CLOSED'} end

local maxAlive = tonumber(ARGV[1])
local maxTotal = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local winners = {}
local aliveDelta = 0
local newIds = 0

-- Lượt 1: tính thắng / thua và thay đổi số element còn hiển thị, CHƯA ghi gì
local i = 0
for a = 4, #ARGV, 5 do
  local version = tonumber(ARGV[a + 1])
  local nonce = tonumber(ARGV[a + 2])
  local deleted = ARGV[a + 3] == '1'
  local stored = redis.call('HGET', KEYS[1], ARGV[a])
  local wins
  if not stored then
    wins = true
    newIds = newIds + 1
    if not deleted then aliveDelta = aliveDelta + 1 end
  else
    local s = cjson.decode(stored)
    -- Luật shouldDiscardRemoteElement của Excalidraw 0.18.1: bỏ bản tới khi bản đang lưu mới hơn
    wins = not (s.version > version or (s.version == version and s.versionNonce < nonce))
    if wins then
      local storedDeleted = s.isDeleted == true
      if storedDeleted and not deleted then aliveDelta = aliveDelta + 1 end
      if not storedDeleted and deleted then aliveDelta = aliveDelta - 1 end
    end
  end
  if wins then winners[#winners + 1] = i end
  i = i + 1
end

-- Kiểm giới hạn trước khi ghi: 5.000 element còn hiển thị, 20.000 tính cả tombstone.
-- Batch không thêm gì (aliveDelta ≤ 0, không có id mới) luôn qua, để bảng đầy vẫn sửa / xoá được (spec §4.2)
local alive = tonumber(redis.call('GET', KEYS[3]) or '0')
if (aliveDelta > 0 and alive + aliveDelta > maxAlive) or (newIds > 0 and redis.call('HLEN', KEYS[1]) + newIds > maxTotal) then
  return {'LIMIT'}
end
if #winners == 0 then return {'NOOP'} end

-- Lượt 2: ghi element thắng (lưu nguyên chuỗi JSON, không encode lại), cập nhật đếm, seq, TTL
for _, idx in ipairs(winners) do
  local a = 4 + idx * 5
  redis.call('HSET', KEYS[1], ARGV[a], ARGV[a + 4])
end
redis.call('INCRBY', KEYS[3], aliveDelta)
local seq = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[1], ttl)
redis.call('EXPIRE', KEYS[2], ttl)
redis.call('EXPIRE', KEYS[3], ttl)
local result = {'OK', seq}
for _, idx in ipairs(winners) do result[#result + 1] = idx end
return result
`;
