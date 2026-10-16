import { translate, type MessageKey } from './index';
import { useSettings } from '../settings/store';

/** 画面の文言を選択中の言語で返す: const t = useT(); t('shell.language') */
export function useT() {
  const { lang } = useSettings();
  return (key: MessageKey) => translate(lang, key);
}
