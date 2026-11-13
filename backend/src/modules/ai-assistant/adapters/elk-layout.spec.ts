import { describe, expect, it } from 'vitest';
import { CHAR_PX, layoutDiagram, nodeSize } from './elk-layout.js';
import { AiRequestKind } from '../../../shared/enums.js';
import type { DiagramDsl } from '../domain/diagram-dsl.js';

// Flowchart đăng nhập: có rẽ nhánh, nhãn cạnh và 1 cạnh quay lại (vòng)
const flowchart: DiagramDsl = {
  nodes: [
    { id: 'n1', label: 'Bắt đầu', shape: 'ellipse' },
    { id: 'n2', label: 'Nhập email và mật khẩu', shape: 'rectangle' },
    { id: 'n3', label: 'Mật khẩu đúng?', shape: 'diamond' },
    { id: 'n4', label: 'Vào trang chính', shape: 'rectangle' },
    { id: 'n5', label: 'Báo lỗi sai mật khẩu', shape: 'rectangle' },
    { id: 'n6', label: 'Kết thúc', shape: 'ellipse' },
  ],
  edges: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4', label: 'Có' },
    { from: 'n3', to: 'n5', label: 'Không' },
    { from: 'n5', to: 'n2' },
    { from: 'n4', to: 'n6' },
  ],
};

// Mindmap: 1 gốc + 8 nhánh, có 1 nhãn dài 80 ký tự
const mindmap: DiagramDsl = {
  nodes: [
    { id: 'root', label: 'Đồ án tốt nghiệp', shape: 'ellipse' },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `c${i + 1}`,
      label: i === 0 ? 'Đ'.repeat(80) : `Nhánh số ${i + 1}`,
      shape: 'rectangle' as const,
    })),
  ],
  edges: Array.from({ length: 8 }, (_, i) => ({ from: 'root', to: `c${i + 1}` })),
};

type Box = { id: string; x: number; y: number; width: number; height: number };
// Hai khung chồng lên nhau (chạm mép không tính)
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('nodeSize', () => {
  it('nhãn ngắn → cao tối thiểu theo hình', () => {
    expect(nodeSize('rectangle', 'A')).toEqual({ width: 200, height: 60 });
    expect(nodeSize('ellipse', 'A')).toEqual({ width: 240, height: 70 });
    expect(nodeSize('diamond', 'A')).toEqual({ width: 280, height: 80 });
  });

  // Đổi CHAR_PX (Task 8) thì tính lại 3 số dưới: L = ceil(80 × CHAR_PX / bề rộng chữ) với bề rộng chữ
  // rectangle 190, ellipse 160, diamond 130; cao: rectangle 25L + 10, ellipse ceil((25L + 10) × √2), diamond 2 × (25L + 10)
  it('nhãn 80 ký tự → cao theo số dòng ước lượng', () => {
    expect(CHAR_PX).toBe(12);
    const label = 'x'.repeat(80); // 80 × 12 = 960 px chữ
    expect(nodeSize('rectangle', label)).toEqual({ width: 200, height: 160 }); // ceil(960 / 190) = 6 dòng
    expect(nodeSize('ellipse', label)).toEqual({ width: 240, height: 227 }); // 6 dòng → ceil(160 × √2)
    expect(nodeSize('diamond', label)).toEqual({ width: 280, height: 420 }); // ceil(960 / 130) = 8 dòng
  });
});

describe('layoutDiagram', () => {
  it.each<[AiRequestKind, DiagramDsl]>([
    [AiRequestKind.FLOWCHART, flowchart],
    [AiRequestKind.DIAGRAM, flowchart],
    [AiRequestKind.MINDMAP, mindmap],
  ])('%s: mọi node có toạ độ hữu hạn, không hai node nào chồng nhau', async (kind, dsl) => {
    const { nodes } = await layoutDiagram(dsl, kind);
    expect(nodes).toHaveLength(dsl.nodes.length);
    for (const n of nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(overlap(nodes[i], nodes[j]), `${nodes[i].id} chồng ${nodes[j].id}`).toBe(false);
      }
    }
  });

  it('giữ id, nhãn, hình; kích thước đúng nodeSize', async () => {
    const { nodes } = await layoutDiagram(flowchart, AiRequestKind.FLOWCHART);
    expect(nodes.map((n) => [n.id, n.label, n.shape])).toEqual(flowchart.nodes.map((n) => [n.id, n.label, n.shape]));
    for (const n of nodes) {
      expect({ width: n.width, height: n.height }).toEqual(nodeSize(n.shape, n.label));
    }
  });

  it('mỗi cạnh ≥ 2 điểm hữu hạn, giữ from / to / nhãn; cạnh không nhãn thì không có field label', async () => {
    const { edges } = await layoutDiagram(flowchart, AiRequestKind.FLOWCHART);
    expect(edges).toHaveLength(flowchart.edges.length);
    for (const e of edges) {
      expect(e.points.length).toBeGreaterThanOrEqual(2);
      expect(e.points.flat().every((value) => Number.isFinite(value))).toBe(true);
    }
    expect(edges[2]).toMatchObject({ from: 'n3', to: 'n4', label: 'Có' });
    expect(edges[0]).not.toHaveProperty('label');
  });

  it('FLOWCHART đi từ trên xuống: node đích của n1 → n2 nằm dưới', async () => {
    const { nodes } = await layoutDiagram(flowchart, AiRequestKind.FLOWCHART);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get('n2')!.y).toBeGreaterThan(byId.get('n1')!.y);
  });

  it('MINDMAP toả sang phải: mọi nhánh nằm bên phải gốc', async () => {
    const { nodes } = await layoutDiagram(mindmap, AiRequestKind.MINDMAP);
    const root = nodes.find((n) => n.id === 'root')!;
    for (const n of nodes.filter((item) => item.id !== 'root')) {
      expect(n.x).toBeGreaterThan(root.x + root.width);
    }
  });
});
