import mongoose, { Types } from 'mongoose';
import { MeetingSchema } from '../src/modules/meetings/schemas/meeting.schema.js';
import { MessageSchema } from '../src/modules/chat/schemas/message.schema.js';
import { RoomMemberSchema } from '../src/modules/rooms/schemas/room-member.schema.js';
import { WhiteboardSchema } from '../src/modules/whiteboard/schemas/whiteboard.schema.js';

const URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/datn2627_verify';

const Meeting = mongoose.model('Meeting', MeetingSchema);
const Message = mongoose.model('Message', MessageSchema);
const RoomMember = mongoose.model('RoomMember', RoomMemberSchema);
const Whiteboard = mongoose.model('Whiteboard', WhiteboardSchema);

let passed = 0;
let failed = 0;

function report(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function isDuplicateKeyError(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e: any) {
    return e?.code === 11000;
  }
}

async function main() {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([
    Meeting.syncIndexes(),
    Message.syncIndexes(),
    RoomMember.syncIndexes(),
    Whiteboard.syncIndexes(),
  ]);

  const roomId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  console.log('\n[1] Một room chỉ được có 1 meeting ACTIVE');
  await Meeting.create({ roomId, title: 'M1', createdBy: userId });
  report(
    'meeting ACTIVE thứ 2 bị chặn',
    await isDuplicateKeyError(() => Meeting.create({ roomId, title: 'M2', createdBy: userId })),
  );
  await Meeting.updateOne({ roomId }, { $set: { status: 'ENDED', endedAt: new Date() } });
  const m2 = await Meeting.create({ roomId, title: 'M2', createdBy: userId });
  report('tạo được meeting mới sau khi meeting cũ ENDED', !!m2);

  console.log('\n[2] Chống gửi trùng tin nhắn (clientMsgId)');
  const msg = {
    meetingId: m2._id,
    roomId,
    senderId: userId,
    senderName: 'A',
    content: 'hello',
    clientMsgId: 'cmid-1',
  };
  await Message.create(msg);
  report('message trùng clientMsgId bị chặn', await isDuplicateKeyError(() => Message.create(msg)));

  console.log('\n[3] Import member idempotent');
  await RoomMember.create({ roomId, userId, role: 'MEMBER' });
  report(
    'member trùng (roomId,userId) bị chặn',
    await isDuplicateKeyError(() => RoomMember.create({ roomId, userId, role: 'VIEWER' })),
  );
  report(
    'vẫn chỉ có đúng 1 bản ghi',
    (await RoomMember.countDocuments({ roomId, userId })) === 1,
  );

  console.log('\n[4] Whiteboard không bị ghi đè ngược (guard lastSeq)');
  await Whiteboard.create({
    meetingId: m2._id,
    roomId,
    elementsGzip: Buffer.from('new'),
    elementCount: 10,
    lastSeq: 100,
  });
  const stale = await Whiteboard.updateOne(
    { meetingId: m2._id, lastSeq: { $lt: 50 } },
    { $set: { elementsGzip: Buffer.from('old'), lastSeq: 50 } },
  );
  report('ghi với seq cũ hơn bị bỏ qua (matchedCount = 0)', stale.matchedCount === 0, `(matched=${stale.matchedCount})`);
  const fresh = await Whiteboard.updateOne(
    { meetingId: m2._id, lastSeq: { $lt: 150 } },
    { $set: { elementsGzip: Buffer.from('newer'), lastSeq: 150 } },
  );
  report('ghi với seq mới hơn được chấp nhận', fresh.modifiedCount === 1);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
