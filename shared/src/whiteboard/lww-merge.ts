import type { WbElement } from './element.types';

/**
 * Last-Write-Wins theo từng element, dùng đúng cơ chế của Excalidraw.
 *
 * HÀM THUẦN — không import Redis, Mongo, Nest. Đây là phần dễ sai nhất
 * của hệ thống nên phải test được trong vài ms.
 *
 * Dùng CHUNG cho cả server và client. Không viết hai bản.
 */
export function wins(incoming: WbElement, existing: WbElement): boolean {
  if (incoming.version !== existing.version) {
    return incoming.version > existing.version;
  }
  // hoà version -> versionNonce nhỏ hơn thắng (quy ước của Excalidraw)
  return incoming.versionNonce < existing.versionNonce;
}

export interface MergeResult {
  /** state sau khi merge */
  merged: Map<string, WbElement>;
  /** chỉ những element THỰC SỰ thay đổi -> chỉ broadcast những cái này */
  accepted: WbElement[];
}

export function mergeElements(
  current: Map<string, WbElement>,
  incoming: WbElement[],
): MergeResult {
  const accepted: WbElement[] = [];

  for (const el of incoming) {
    const existing = current.get(el.id);
    if (!existing || wins(el, existing)) {
      current.set(el.id, el);
      accepted.push(el);
    }
  }

  return { merged: current, accepted };
}

export function toArray(state: Map<string, WbElement>): WbElement[] {
  return Array.from(state.values());
}

export function toMap(elements: WbElement[]): Map<string, WbElement> {
  return new Map(elements.map((e) => [e.id, e]));
}

/** Số element còn sống (không tính tombstone) — dùng để check hard limit. */
export function countAlive(state: Map<string, WbElement>): number {
  let n = 0;
  for (const el of state.values()) if (!el.isDeleted) n++;
  return n;
}
