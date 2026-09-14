import type { WbElement } from './element.types.js';

export function wins(incoming: WbElement, existing: WbElement): boolean {
  if (incoming.version !== existing.version) {
    return incoming.version > existing.version;
  }
  return incoming.versionNonce < existing.versionNonce;
}

export interface MergeResult {
  merged: Map<string, WbElement>;
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

export function countAlive(state: Map<string, WbElement>): number {
  let n = 0;
  for (const el of state.values()) if (!el.isDeleted) n++;
  return n;
}
