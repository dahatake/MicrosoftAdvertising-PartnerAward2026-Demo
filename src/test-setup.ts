// vitest の共通設定: jsdom には ResizeObserver がなく、3D（react-three-fiber の Canvas）が遅延読み込みで描画されると、
// テストの実行タイミングによって未捕捉のエラーになる。何もしない代替を置いて、描画の有無に左右されないようにする。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}
