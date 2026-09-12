import { mergeElements, toMap, countAlive } from '../src/whiteboard/lww-merge';
import { can, toLiveKitGrant } from '../src/permissions/can';
import { Action } from '../src/permissions/matrix';
import { RoomRole, MeetingMode } from '../src/enums';

let ok = 0, bad = 0;
const t = (n: string, c: boolean) => c ? (ok++, console.log('  PASS ', n)) : (bad++, console.log('  FAIL ', n));

const el = (id: string, version: number, versionNonce: number, isDeleted = false) =>
  ({ id, version, versionNonce, isDeleted });

console.log('\n[LWW merge]');
let s = toMap([el('a', 1, 100)]);
t('element mới được nhận', mergeElements(s, [el('b', 1, 5)]).accepted.length === 1);

s = toMap([el('a', 5, 100)]);
t('version cao hơn thắng', mergeElements(s, [el('a', 6, 999)]).accepted.length === 1);

s = toMap([el('a', 5, 100)]);
t('version thấp hơn bị bỏ', mergeElements(s, [el('a', 4, 1)]).accepted.length === 0);

s = toMap([el('a', 5, 100)]);
t('hoà version: nonce nhỏ hơn thắng', mergeElements(s, [el('a', 5, 50)]).accepted.length === 1);

s = toMap([el('a', 5, 100)]);
t('hoà version: nonce lớn hơn thua', mergeElements(s, [el('a', 5, 200)]).accepted.length === 0);

s = toMap([el('a', 5, 100)]);
const r1 = mergeElements(s, [el('a', 6, 10)]);
const r2 = mergeElements(r1.merged, [el('a', 6, 10)]);
t('idempotent: áp lại cùng op -> 0 thay đổi', r2.accepted.length === 0);

s = toMap([el('a', 1, 1), el('b', 1, 1)]);
mergeElements(s, [el('a', 2, 1, true)]);
t('tombstone không bị xoá khỏi map', s.size === 2);
t('countAlive bỏ qua tombstone', countAlive(s) === 1);

console.log('\n[Permissions]');
t('MEMBER vẽ được ở DISCUSSION', can(RoomRole.MEMBER, MeetingMode.DISCUSSION, Action.DRAW_WHITEBOARD));
t('MEMBER KHÔNG vẽ được ở LECTURE', !can(RoomRole.MEMBER, MeetingMode.LECTURE, Action.DRAW_WHITEBOARD));
t('VIEWER không publish media', !can(RoomRole.VIEWER, MeetingMode.DISCUSSION, Action.PUBLISH_MEDIA));
t('VIEWER vẫn chat được', can(RoomRole.VIEWER, MeetingMode.DISCUSSION, Action.SEND_CHAT));
t('CO_HOST không dissolve room', !can(RoomRole.CO_HOST, MeetingMode.DISCUSSION, Action.DISSOLVE_ROOM));
t('LiveKit grant: MEMBER ở LECTURE canPublish=false',
  toLiveKitGrant(RoomRole.MEMBER, MeetingMode.LECTURE).canPublish === false);

console.log(`\n${ok} passed, ${bad} failed\n`);
process.exit(bad === 0 ? 0 : 1);
