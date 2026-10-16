// 2D/3D で共有する意味づけ: 種類 → 色・形、グループ → 3D の空間配置（純関数）。
import { kindPalette } from '../theme/theme';

export type Shape = 'circle' | 'square' | 'triangle' | 'diamond';
export const SHAPES: readonly Shape[] = ['circle', 'square', 'triangle', 'diamond'];

/** 種類の定義（凡例の 1 行）。color/shape を省くと、並び順から決まる */
export interface KindDef {
  id: string;
  label: string;
  color?: string;
  shape?: Shape;
}

/** 表示する情報項目。2D と 3D で同じ id の集合が表示される */
export interface ViewItem {
  id: string;
  label: string;
  kind: string;
  /** グルーピング（2D は見出しごとの区画、3D は空間の列） */
  group?: string;
}

export interface ResolvedKind {
  id: string;
  label: string;
  color: string;
  shape: Shape;
}

export function resolveKinds(kinds: readonly KindDef[]): ResolvedKind[] {
  return kinds.map((k, i) => ({
    id: k.id,
    label: k.label,
    color: k.color ?? kindPalette[i % kindPalette.length],
    shape: k.shape ?? SHAPES[i % SHAPES.length],
  }));
}

export interface Placement {
  id: string;
  position: [number, number, number];
}

/** 3D の空間配置: グループを x 方向の列に、列の中の項目を z 方向に並べる（2D と同じ構造） */
export function layout3d(items: readonly ViewItem[]): Placement[] {
  const groups: string[] = [];
  const counts = new Map<string, number>();
  for (const it of items) {
    const g = it.group ?? '';
    if (!groups.includes(g)) groups.push(g);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return items.map((it) => {
    const g = it.group ?? '';
    const gi = groups.indexOf(g);
    const i = seen.get(g) ?? 0;
    seen.set(g, i + 1);
    const n = counts.get(g) ?? 1;
    return { id: it.id, position: [(gi - (groups.length - 1) / 2) * 3, 0, (i - (n - 1) / 2) * 1.6] };
  });
}
