// 製品の 3D ビュー（react-three-fiber）。Surface Ultra 風の仮置きモデルを、プロシージャルな形状だけで組み立てる（外部のモデルファイルなし）。
// 操作: ドラッグで回転、矢印キーで回転、＋/− キーとホイールで拡大・縮小（AC-013）。キャンバス自体が data-testid・フォーカス対象。
import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { SURFACE_COLORS } from './brand';

function Device({ yaw, zoom }: { yaw: number; zoom: number }) {
  return (
    <group rotation={[0, yaw, 0]} scale={zoom} position={[0, -0.3, 0]}>
      {/* 本体（キーボード側）: 薄い板 */}
      <mesh position={[0, 0, 0.35]}>
        <boxGeometry args={[2.6, 0.08, 1.7]} />
        <meshStandardMaterial color={SURFACE_COLORS.body} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* キー面 */}
      <mesh position={[0, 0.05, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 0.8]} />
        <meshStandardMaterial color={SURFACE_COLORS.keys} roughness={0.8} />
      </mesh>
      {/* トラックパッド */}
      <mesh position={[0, 0.05, 1.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshStandardMaterial color={SURFACE_COLORS.pad} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* 画面（背面の板と発光面）。後ろに少し傾ける */}
      <group position={[0, 0.04, -0.5]} rotation={[-0.3, 0, 0]}>
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[2.6, 1.7, 0.06]} />
          <meshStandardMaterial color={SURFACE_COLORS.body} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.85, 0.04]}>
          <planeGeometry args={[2.42, 1.52]} />
          <meshStandardMaterial color={SURFACE_COLORS.screen} emissive={SURFACE_COLORS.screenGlow} emissiveIntensity={0.9} />
        </mesh>
        {/* 画面の中の「ウィンドウ」風の帯 */}
        <mesh position={[-0.5, 0.95, 0.05]}>
          <planeGeometry args={[1.0, 0.7]} />
          <meshStandardMaterial color={SURFACE_COLORS.accent} emissive={SURFACE_COLORS.accent} emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0.6, 0.7, 0.05]}>
          <planeGeometry args={[0.9, 0.5]} />
          <meshStandardMaterial color={SURFACE_COLORS.accent2} emissive={SURFACE_COLORS.accent2} emissiveIntensity={0.5} />
        </mesh>
      </group>
      {/* 設置面 */}
      <mesh position={[0, -0.06, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color={SURFACE_COLORS.floor} roughness={0.9} />
      </mesh>
    </group>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function ProductScene3D({ label, testId }: { label: string; testId: string }) {
  const [yaw, setYaw] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.4, 5.2], fov: 42 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => {
        const el = gl.domElement;
        el.setAttribute('data-testid', testId);
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', label);
        el.style.touchAction = 'none';
        let down = false;
        let lastX = 0;
        el.addEventListener('pointerdown', (e) => {
          down = true;
          lastX = e.clientX;
          el.setPointerCapture?.(e.pointerId);
        });
        el.addEventListener('pointermove', (e) => {
          if (!down) return;
          const dx = e.clientX - lastX;
          lastX = e.clientX;
          setYaw((y) => y + dx * 0.01);
        });
        const up = () => {
          down = false;
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('wheel', (e) => {
          e.preventDefault();
          setZoom((z) => clamp(z - e.deltaY * 0.001, 0.6, 1.8));
        }, { passive: false });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') setYaw((y) => y - 0.2);
          else if (e.key === 'ArrowRight') setYaw((y) => y + 0.2);
          else if (e.key === '+' || e.key === '=') setZoom((z) => clamp(z + 0.1, 0.6, 1.8));
          else if (e.key === '-') setZoom((z) => clamp(z - 0.1, 0.6, 1.8));
          else return;
          e.preventDefault();
        });
      }}
    >
      <color attach="background" args={[SURFACE_COLORS.bg]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <pointLight position={[-3, 2, 2]} intensity={12} color={SURFACE_COLORS.accent} />
      <Device yaw={yaw} zoom={zoom} />
    </Canvas>
  );
}
