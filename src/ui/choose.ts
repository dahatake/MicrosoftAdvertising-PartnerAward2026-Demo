// テスト用: ボタン群（ChoiceButtons）で値を選ぶ（コンボボックスの fireEvent.change の代わり）。
import { fireEvent } from '@testing-library/react';

export function choose(group: HTMLElement, value: string) {
  const btn = group.querySelector<HTMLElement>(`[role="radio"][data-value="${CSS.escape(value)}"]`);
  if (!btn) throw new Error(`選択肢 ${value} が見つかりません`);
  fireEvent.click(btn);
}
