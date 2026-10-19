// 製品の 3D ビュー（react-three-fiber）。Surface Ultra 風の仮置きモデルを、プロシージャルな形状だけで組み立てる（外部のモデル・画像・環境マップのファイルなし）。
// 操作: ドラッグで回転、矢印キーで回転、＋/− キーとホイールで拡大・縮小（AC-013）。キャンバス自体が data-testid・フォーカス対象。
// NFR-UX-004 AC-094: 製品は落ち着いた金属色（brand.ts の PRODUCT_FINISHES。既定は Dune）で、metalness/roughness と
// 手続き的な環境マップ（RoomEnvironment）で金属の映り込みを、画面はクリアコートのガラスに光のグラデーション（PARAM-023）を映す。
// 暗い面（PARAM-022）の上でも輪郭が埋もれないよう、背後からのリムライトと、縁の色（edge）の薄い縁取りを付ける。
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { BackSide, CanvasTexture, PMREMGenerator, SRGBColorSpace, type Texture } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DEFAULT_FINISH, PRODUCT_FINISHES, PRODUCT_GLASS, PRODUCT_LIGHTING, withAlpha, type ProductFinish, type ProductFinishId } from './brand';

// ---------- 手続き的なテクスチャ（2D の canvas に描く。描けない環境では null） ----------
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (!g) return null;
  draw(g);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 画面: 細い黒の縁の内側に、暗い面の上の光のグラデーション（ロゴ・シンボルは描かない抽象的な光）と、ガラスのカード 2 枚 */
function drawScreen(g: CanvasRenderingContext2D) {
  const W = g.canvas.width;
  const H = g.canvas.height;
  const [g1, g2, g3] = PRODUCT_GLASS.glow;
  g.fillStyle = PRODUCT_GLASS.bezel;
  g.fillRect(0, 0, W, H);
  const inset = 10;
  g.save();
  roundRect(g, inset, inset, W - inset * 2, H - inset * 2, 6);
  g.clip();
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, PRODUCT_GLASS.base);
  bg.addColorStop(1, PRODUCT_GLASS.baseEnd);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string, a: number) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, withAlpha(color, a));
    rg.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  };
  glow(W * 0.28, H * 0.78, W * 0.62, g1, 0.95);
  glow(W * 0.7, H * 0.42, W * 0.42, g2, 0.75);
  glow(W * 0.86, H * 0.16, W * 0.26, g3, 0.6);
  // ガラスのカード（半透明の白の面と縁）
  const card = (x: number, y: number, w: number, h: number) => {
    roundRect(g, x, y, w, h, 12);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.30)';
    g.lineWidth = 2;
    g.stroke();
  };
  card(W * 0.08, H * 0.14, W * 0.42, H * 0.46);
  card(W * 0.56, H * 0.52, W * 0.34, H * 0.3);
  g.restore();
}

/** キー面: 地の色の上に、影の色を薄く重ねたキーの並び */
function drawKeys(g: CanvasRenderingContext2D, f: ProductFinish) {
  const W = g.canvas.width;
  const H = g.canvas.height;
  g.fillStyle = f.keys;
  g.fillRect(0, 0, W, H);
  g.fillStyle = withAlpha(f.shade, 0.5);
  const cols = 14;
  const rows = 5;
  const gap = 6;
  const kw = (W - gap * (cols + 1)) / cols;
  const kh = (H - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === rows - 1 && c > 3 && c < 10) continue; // スペースバーの位置
      roundRect(g, gap + c * (kw + gap), gap + r * (kh + gap), kw, kh, 4);
      g.fill();
    }
  }
  roundRect(g, gap + 4 * (kw + gap), gap + (rows - 1) * (kh + gap), kw * 6 + gap * 5, kh, 4);
  g.fill();
}

/** 設置面: 中央の柔らかい影と、外周の光の青の淡い輪 */
function drawFloor(g: CanvasRenderingContext2D) {
  const W = g.canvas.width;
  const c = W / 2;
  const shadow = g.createRadialGradient(c, c, 0, c, c, c);
  shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
  shadow.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  shadow.addColorStop(0.8, withAlpha(PRODUCT_GLASS.glow[1], 0.14));
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shadow;
  g.fillRect(0, 0, W, W);
}

function useTexture(make: () => Texture | null, deps: unknown[]) {
  const t = useMemo(make, deps);
  useEffect(() => () => t?.dispose(), [t]);
  return t;
}

// ---------- 形状（角を丸めた板と、その外側の縁取り用の一回り大きい板） ----------
const OUTLINE = 0.012;
function useSlab(w: number, h: number, d: number, radius: number) {
  const g = useMemo(() => {
    const body = new RoundedBoxGeometry(w, h, d, 4, radius);
    const hull = new RoundedBoxGeometry(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2, 4, radius + OUTLINE);
    return { body, hull };
  }, [w, h, d, radius]);
  useEffect(
    () => () => {
      g.body.dispose();
      g.hull.dispose();
    },
    [g],
  );
  return g;
}

/** 金属の板と、背面側だけを描く縁取り（暗い面の上で外形を見分けやすくする） */
function MetalSlab({ w, h, d, radius, finish, position }: { w: number; h: number; d: number; radius: number; finish: ProductFinish; position: [number, number, number] }) {
  const { body, hull } = useSlab(w, h, d, radius);
  return (
    <group position={position}>
      <mesh geometry={body}>
        <meshStandardMaterial color={finish.base} metalness={finish.metalness} roughness={finish.roughness} />
      </mesh>
      <mesh geometry={hull}>
        <meshBasicMaterial color={finish.edge} side={BackSide} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Device({ yaw, zoom, finish }: { yaw: number; zoom: number; finish: ProductFinish }) {
  const screenTex = useTexture(() => canvasTexture(512, 320, drawScreen), []);
  const keysTex = useTexture(() => canvasTexture(512, 180, (g) => drawKeys(g, finish)), [finish]);
  const floorTex = useTexture(() => canvasTexture(256, 256, drawFloor), []);
  return (
    <group rotation={[0, yaw, 0]} scale={zoom} position={[0, -0.3, 0]}>
      {/* 本体（キーボード側）: 角を丸めた薄い金属の板 */}
      <MetalSlab w={2.6} h={0.08} d={1.7} radius={0.035} finish={finish} position={[0, 0, 0.35]} />
      {/* キー面（つや消し） */}
      <mesh position={[0, 0.042, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 0.8]} />
        <meshStandardMaterial color={keysTex ? '#FFFFFF' : finish.keys} map={keysTex ?? undefined} roughness={0.85} metalness={0} />
      </mesh>
      {/* トラックパッド（ガラス） */}
      <mesh position={[0, 0.042, 1.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshPhysicalMaterial color={finish.highlight} metalness={0.3} roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      {/* ヒンジ */}
      <mesh position={[0, 0.03, -0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 2.3, 24]} />
        <meshStandardMaterial color={finish.shade} metalness={finish.metalness} roughness={finish.roughness + 0.08} />
      </mesh>
      {/* 画面（金属の背面とガラスの表示面）。後ろに少し傾ける */}
      <group position={[0, 0.04, -0.5]} rotation={[-0.3, 0, 0]}>
        <MetalSlab w={2.6} h={1.7} d={0.05} radius={0.03} finish={finish} position={[0, 0.85, 0]} />
        <mesh position={[0, 0.85, 0.027]}>
          <planeGeometry args={[2.5, 1.6]} />
          <meshPhysicalMaterial
            color={PRODUCT_GLASS.base}
            emissive="#FFFFFF"
            emissiveMap={screenTex ?? undefined}
            emissiveIntensity={screenTex ? 1 : 0.4}
            metalness={0}
            roughness={0.12}
            clearcoat={PRODUCT_GLASS.clearcoat}
            clearcoatRoughness={PRODUCT_GLASS.clearcoatRoughness}
          />
        </mesh>
      </group>
      {/* 設置面（柔らかい影と淡い光の輪） */}
      <mesh position={[0, -0.05, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.4, 48]} />
        <meshBasicMaterial map={floorTex ?? undefined} color={floorTex ? '#FFFFFF' : PRODUCT_GLASS.base} transparent opacity={floorTex ? 1 : 0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function ProductScene3D({ label, testId, finish = DEFAULT_FINISH }: { label: string; testId: string; finish?: ProductFinishId }) {
  const [yaw, setYaw] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const f = PRODUCT_FINISHES[finish];
  const L = PRODUCT_LIGHTING;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.4, 5.2], fov: 42 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      onCreated={({ gl, scene }) => {
        // 金属の映り込み: 外部のファイルを読まない手続き的な環境マップ（1 回だけ作る）
        const pmrem = new PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = L.environmentIntensity;
        pmrem.dispose();
        const el = gl.domElement;
        el.setAttribute('data-testid', testId);
        el.setAttribute('data-product-finish', f.name);
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
      <ambientLight color={L.ambient.color} intensity={L.ambient.intensity} />
      <directionalLight color={L.key.color} position={[...L.key.position]} intensity={L.key.intensity} />
      <directionalLight color={L.fill.color} position={[...L.fill.position]} intensity={L.fill.intensity} />
      {L.rim.map((r, i) => (
        <directionalLight key={i} color={r.color} position={[...r.position]} intensity={r.intensity} />
      ))}
      <Device yaw={yaw} zoom={zoom} finish={f} />
    </Canvas>
  );
}
