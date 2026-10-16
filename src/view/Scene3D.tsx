// 3D の描画（react-three-fiber）。DualView から遅延読み込みされる。
import { Canvas } from '@react-three/fiber';
import { layout3d, type ResolvedKind, type ViewItem } from './kinds';

export interface Scene3DProps {
  items: readonly ViewItem[];
  kinds: readonly ResolvedKind[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

function Geometry({ shape }: { shape: ResolvedKind['shape'] }) {
  switch (shape) {
    case 'circle':
      return <sphereGeometry args={[0.5, 24, 16]} />;
    case 'square':
      return <boxGeometry args={[0.8, 0.8, 0.8]} />;
    case 'triangle':
      return <coneGeometry args={[0.55, 0.9, 3]} />;
    case 'diamond':
      return <octahedronGeometry args={[0.6]} />;
  }
}

export default function Scene3D({ items, kinds, selectedId, onSelect }: Scene3DProps) {
  const pos = new Map(layout3d(items).map((p) => [p.id, p.position]));
  const kindOf = new Map(kinds.map((k) => [k.id, k]));
  return (
    <Canvas camera={{ position: [0, 5, 8], fov: 50 }} dpr={[1, 1.5]} frameloop="demand">
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} />
      {items.map((it) => {
        const k = kindOf.get(it.kind);
        if (!k) return null;
        const selected = it.id === selectedId;
        return (
          <mesh
            key={it.id}
            position={pos.get(it.id)}
            scale={selected ? 1.35 : 1}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(it.id);
            }}
          >
            <Geometry shape={k.shape} />
            <meshStandardMaterial color={k.color} emissive={selected ? k.color : '#000000'} emissiveIntensity={selected ? 0.5 : 0} />
          </mesh>
        );
      })}
    </Canvas>
  );
}
