import { describe, expect, it } from 'vitest';
import { normalizeLabel, parseDiagramDsl } from './diagram-dsl.js';

// Node / DSL tối thiểu cho test
const node = (id: string, label = `Bước ${id}`, shape = 'rectangle') => ({ id, label, shape });
const json = (nodes: unknown[], edges: unknown[]) => JSON.stringify({ nodes, edges });
// Chuỗi n1 → n2 → … → nCount (mọi node đều có cạnh)
function chain(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => node(`n${i + 1}`));
  const edges = nodes.slice(1).map((n, i) => ({ from: `n${i + 1}`, to: n.id }));
  return { nodes, edges };
}

describe('normalizeLabel', () => {
  it('gộp khoảng trắng và xuống dòng thành 1 dấu cách, cắt hai đầu', () => {
    expect(normalizeLabel('  Nhập\n  email\tvà  mật khẩu ')).toBe('Nhập email và mật khẩu');
  });

  it('tiếng Việt tổ hợp (NFD) → dựng sẵn (NFC)', () => {
    const decomposed = 'Đăng nhập'.normalize('NFD');
    expect(decomposed).not.toBe('Đăng nhập'.normalize('NFC'));
    expect(normalizeLabel(decomposed)).toBe('Đăng nhập'.normalize('NFC'));
  });

  it('đúng 80 ký tự → giữ nguyên', () => {
    expect(normalizeLabel('a'.repeat(80))).toBe('a'.repeat(80));
  });

  it('81 ký tự → cắt còn 79 + "…" (tổng 80)', () => {
    const out = normalizeLabel('a'.repeat(81));
    expect(out).toBe(`${'a'.repeat(79)}…`);
    expect(out.length).toBe(80);
  });
});

describe('parseDiagramDsl', () => {
  it('DSL hợp lệ → ok; nhãn đã chuẩn hoá; nhãn cạnh rỗng bị bỏ', () => {
    const result = parseDiagramDsl(
      json([node('n1', ' Bắt  đầu ', 'ellipse'), node('n2')], [{ from: 'n1', to: 'n2', label: '   ' }]),
    );
    expect(result).toEqual({
      ok: true,
      dsl: {
        nodes: [
          { id: 'n1', label: 'Bắt đầu', shape: 'ellipse' },
          { id: 'n2', label: 'Bước n2', shape: 'rectangle' },
        ],
        edges: [{ from: 'n1', to: 'n2' }],
      },
    });
  });

  it('giữ nhãn cạnh có chữ (đã chuẩn hoá)', () => {
    const result = parseDiagramDsl(
      json([node('n1', 'Hỏi', 'diamond'), node('n2')], [{ from: 'n1', to: 'n2', label: ' Có ' }]),
    );
    expect(result.ok && result.dsl.edges[0].label).toBe('Có');
  });

  it('1 node, không cạnh → hợp lệ', () => {
    expect(parseDiagramDsl(json([node('n1')], [])).ok).toBe(true);
  });

  it('đúng 40 node → hợp lệ', () => {
    const { nodes, edges } = chain(40);
    expect(parseDiagramDsl(json(nodes, edges)).ok).toBe(true);
  });

  it('không phải JSON → BAD_JSON', () => {
    expect(parseDiagramDsl('{"nodes": [')).toEqual({ ok: false, errorCode: 'BAD_JSON' });
  });

  const twoNodes = [node('n1'), node('n2')];
  it.each([
    ['0 node', json([], [])],
    ['41 node', json(chain(41).nodes, chain(41).edges)],
    ['81 cạnh', json(twoNodes, Array.from({ length: 81 }, () => ({ from: 'n1', to: 'n2' })))],
    ['id trùng', json([node('n1'), node('n1'), node('n2')], [{ from: 'n1', to: 'n2' }])],
    ['id có ký tự lạ', json([node('n 1')], [])],
    ['cạnh trỏ tới id không có', json(twoNodes, [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n9' }])],
    ['cạnh tự vòng', json(twoNodes, [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n2' }])],
    ['node mồ côi', json([node('n1'), node('n2'), node('n3')], [{ from: 'n1', to: 'n2' }])],
    ['shape lạ', json([node('n1', 'A', 'circle')], [])],
    ['nhãn rỗng sau chuẩn hoá', json([node('n1', '  \n ')], [])],
    ['thiếu edges', JSON.stringify({ nodes: [node('n1')] })],
  ])('%s → BAD_DSL', (_name, text) => {
    expect(parseDiagramDsl(text)).toEqual({ ok: false, errorCode: 'BAD_DSL' });
  });
});
