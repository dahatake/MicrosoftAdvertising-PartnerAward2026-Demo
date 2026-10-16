// 単体テスト（jsdom）の共通設定: jsdom にない ResizeObserver を何もしない実装で補う（react-three-fiber の Canvas が必要とする）。
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
