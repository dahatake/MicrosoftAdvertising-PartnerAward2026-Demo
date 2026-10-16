// シェルの共通操作（NFR-A11Y-001 AC-055）: どのアプリの画面でも、カメラワーク・レイアウト・素材登録に、
// Tab・Enter・矢印キー・Esc だけで到達できる。ダイアログは Esc で閉じ、フォーカスは開いたボタンに戻る。
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { CameraSettings, usePrefersReducedMotion } from '../camera';
import { useT } from '../i18n/useT';
import { resetAllLayouts } from '../layout';
import { AssetPanel } from '../app2/AssetPanel';

function ToolDialog({ label, testId, modal = true, children }: { label: string; testId: string; modal?: boolean; children: React.ReactNode }) {
  const t = useT();
  // 動きを減らす設定では、ダイアログの開閉の動き（Web Animations）も止める（NFR-A11Y-002 AC-057）
  const reduce = usePrefersReducedMotion();
  return (
    <Dialog modalType={modal ? 'modal' : 'non-modal'} surfaceMotion={reduce ? null : undefined}>
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="subtle" data-testid={testId}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogSurface backdropMotion={reduce ? null : undefined} style={{ maxWidth: '960px', width: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label={t('shell.close')} icon={<Dismiss24Regular />} />
              </DialogTrigger>
            }
          >
            {label}
          </DialogTitle>
          <DialogContent>{children}</DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function ShellTools() {
  const t = useT();
  return (
    <>
      <ToolDialog label={t('shell.camera')} testId="shell-camera" modal={false}>
        <CameraSettings />
      </ToolDialog>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button appearance="subtle" data-testid="shell-layout">
            {t('shell.layout')}
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem onClick={resetAllLayouts}>{t('cmd.layoutReset')}</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <ToolDialog label={t('shell.registerAsset')} testId="shell-register-asset">
        <AssetPanel />
      </ToolDialog>
    </>
  );
}
