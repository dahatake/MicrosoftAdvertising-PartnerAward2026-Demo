// 3D の実カメラにカメラワークをかける（R3F の Canvas の中に置く）。durationMs=0（静止・動きを減らす）のときは動かさない。
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera } from 'three';
import type { Camera3d } from './model';

export function CameraRig3D({ config }: { config: Camera3d }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const start = useRef(performance.now());

  useEffect(() => {
    start.current = performance.now();
    const cam = camera as PerspectiveCamera;
    cam.fov = config.fov;
    cam.position.set(...config.from);
    cam.lookAt(...config.lookAt);
    cam.rotateZ(config.roll);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, config, invalidate]);

  useFrame(() => {
    if (config.durationMs <= 0) return;
    const cam = camera as PerspectiveCamera;
    const p = ((performance.now() - start.current) % config.durationMs) / config.durationMs;
    const k = 0.5 - 0.5 * Math.cos(p * Math.PI * 2); // 往復
    if (config.orbit) {
      const r = Math.hypot(config.from[0], config.from[2]);
      const a = p * Math.PI * 2;
      cam.position.set(Math.sin(a) * r, config.from[1], Math.cos(a) * r);
    } else {
      cam.position.set(
        config.from[0] + (config.to[0] - config.from[0]) * k,
        config.from[1] + (config.to[1] - config.from[1]) * k,
        config.from[2] + (config.to[2] - config.from[2]) * k,
      );
    }
    cam.lookAt(...config.lookAt);
    cam.rotateZ(config.roll);
    invalidate();
  });
  return null;
}
