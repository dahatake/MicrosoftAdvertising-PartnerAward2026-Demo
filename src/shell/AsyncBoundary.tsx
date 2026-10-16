// 状態表示の共通部品（NFR-UX-002）: 読み込み中・失敗の表示と再試行。
// 失敗は role="alert"（原因と次の行動）、読み込み中は role="status" で支援技術に通知する。入力済みの内容は、境界の外側の状態なので失われない。
import { Component, Suspense, type ReactNode } from 'react';
import { Button, Caption1, MessageBar, MessageBarActions, MessageBarBody, Spinner } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import type { MessageKey } from '../i18n';

export function LoadingStatus({ labelKey = 'status.loading' as MessageKey }: { labelKey?: MessageKey }) {
  const t = useT();
  return (
    <div role="status" data-testid="status-loading">
      <Spinner size="small" label={t(labelKey)} />
    </div>
  );
}

export function ErrorStatus({ messageKey, onRetry }: { messageKey: MessageKey; onRetry?: () => void }) {
  const t = useT();
  return (
    <MessageBar intent="error" role="alert" data-testid="status-error">
      <MessageBarBody>
        {t(messageKey)} <Caption1>{t('status.nextAction')}</Caption1>
      </MessageBarBody>
      {onRetry && (
        <MessageBarActions>
          <Button size="small" onClick={onRetry} data-testid="status-retry">
            {t('status.retry')}
          </Button>
        </MessageBarActions>
      )}
    </MessageBar>
  );
}

interface BoundaryProps {
  messageKey: MessageKey;
  onRetry?: () => void;
  children: ReactNode;
}
class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorStatus
        messageKey={this.props.messageKey}
        onRetry={() => {
          this.props.onRetry?.();
          this.setState({ failed: false });
        }}
      />
    );
  }
}

/** 遅延読み込みする画面を包む。読み込み中は status、失敗は alert と再試行（再試行で再読み込みを試みる） */
export function AsyncBoundary({
  children,
  errorKey = 'status.loadFailed' as MessageKey,
  loadingKey,
  onRetry,
}: {
  children: ReactNode;
  errorKey?: MessageKey;
  loadingKey?: MessageKey;
  onRetry?: () => void;
}) {
  return (
    <Boundary messageKey={errorKey} onRetry={onRetry}>
      <Suspense fallback={<LoadingStatus labelKey={loadingKey} />}>{children}</Suspense>
    </Boundary>
  );
}
