import { updateSettings, useSettings, type ViewMethod } from '../settings/store';
import { use3dSupport } from './support';

export interface ViewModeState {
  /** 実際に使う表示方法。3D が使えない端末では常に '2d' */
  method: ViewMethod;
  /** 利用者が選んだ表示方法 */
  requested: ViewMethod;
  supported3d: boolean;
  set: (m: ViewMethod) => void;
}

/** 現在の表示方法。画面は method を見て 2D/3D を出し分ける（既定は 2D） */
export function useViewMode(): ViewModeState {
  const { viewMethod } = useSettings();
  const supported3d = use3dSupport();
  return {
    method: supported3d ? viewMethod : '2d',
    requested: viewMethod,
    supported3d,
    set: (m) => updateSettings({ viewMethod: m }),
  };
}
