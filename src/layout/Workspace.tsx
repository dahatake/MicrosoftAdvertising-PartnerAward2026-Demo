// 共通のワークスペース: 複数のパネルの移動・並べる方向・大きさ・タブ化・表示/非表示・最大化と、保存・復元・既定に戻す。
// パネルは常にマウントしたまま CSS で並べ替え・隠すため、入力中の内容や選択はレイアウトを変えても失われない（AC-037）。
// 画面が狭い（720px 以下）・拡大率が高いときは、縦の積み重ねに縮退する（AC-036）。
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Button,
  Caption1,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tab,
  TabList,
  Subtitle2,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { MoreHorizontal20Regular } from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { registerCommands } from '../commands/registry';
import { spacing } from '../theme/theme';
import {
  activeTabOf,
  isShown,
  moveBy,
  moveTo,
  resizeBy,
  setActiveTab,
  setDirection,
  tabGroup,
  toggleHidden,
  toggleMaximized,
  toggleTabbed,
  type LayoutDefaults,
  type LayoutState,
} from './model';
import { getLayout, resetLayout, setLayout, useLayout } from './store';

export interface WorkspacePanel {
  /** パネルの ID（data-testid は layout-panel-<id> / layout-menu-<id>） */
  id: string;
  title: string;
  content: ReactNode;
}

export interface WorkspaceProps {
  /** 画面ごとの保存キー */
  screenId: string;
  panels: readonly WorkspacePanel[];
  defaults?: LayoutDefaults;
  /** 現在のペルソナ（FR-021）。指定すると、保存・復元・既定に戻すはペルソナ×画面の組ごとになる */
  persona?: string;
  /** ペルソナごとの既定のレイアウト（パネルの配置・表示/非表示・順序）。なければ defaults */
  personaDefaults?: Readonly<Record<string, LayoutDefaults>>;
  /** 1 画面に収める画面（App2。FR-024）向けに、余白とボタンを小さくする */
  dense?: boolean;
}

const NARROW = '@media (max-width: 720px)';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  rootDense: { gap: spacing.xs },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  row: { display: 'flex', flexDirection: 'row', gap: spacing.m, alignItems: 'stretch', [NARROW]: { flexDirection: 'column' } },
  column: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  panel: {
    position: 'relative',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.s,
    padding: `${spacing.xs} ${spacing.s}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'grab',
  },
  title: { flexGrow: 1, minWidth: 0 },
  body: { padding: spacing.m, minWidth: 0, overflow: 'auto' },
  bodyDense: { padding: spacing.xs },
  headerDense: { paddingBlock: '2px' },
  handle: {
    position: 'absolute',
    insetBlock: 0,
    insetInlineEnd: '-10px',
    width: '12px',
    cursor: 'col-resize',
    border: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    touchAction: 'none',
    ':hover': { backgroundColor: tokens.colorBrandBackground2 },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}` },
    [NARROW]: { display: 'none' },
  },
  handleColumn: {
    insetBlock: 'auto',
    insetInline: 0,
    insetBlockEnd: '-10px',
    width: 'auto',
    height: '12px',
    cursor: 'row-resize',
  },
});

const PX_PER_UNIT = 160;

export function Workspace({ screenId: baseScreenId, panels, defaults: baseDefaults, persona, personaDefaults, dense }: WorkspaceProps) {
  const s = useStyles();
  const t = useT();
  const ids = panels.map((p) => p.id);
  // 保存単位は「ペルソナ×画面」（FR-021 AC-081）。ペルソナなしのときは従来どおり画面ごと
  const screenId = persona ? `${baseScreenId}:${persona}` : baseScreenId;
  const defaults = persona ? (personaDefaults?.[persona] ?? baseDefaults) : baseDefaults;
  const layout = useLayout(screenId, ids, defaults);
  const dragId = useRef<string | null>(null);

  const update = (fn: (l: LayoutState) => LayoutState) => {
    const cur = getLayout(screenId, ids, defaults);
    const next = fn(cur);
    if (next !== cur) setLayout(screenId, next);
  };

  // コマンドの検索から、この画面のレイアウトを操作できるようにする（AC-038）
  const titleOf = (id: string) => panels.find((p) => p.id === id)?.title ?? id;
  useEffect(() => {
    return registerCommands(`layout:${baseScreenId}`, [
      { id: `layout.${baseScreenId}.reset`, label: `${t('layout.reset')}`, keywords: 'layout reset default', run: () => resetLayout(screenId) },
      { id: `layout.${baseScreenId}.horizontal`, label: `${t('layout.horizontal')}`, keywords: 'layout horizontal row', run: () => update((l) => setDirection(l, 'row')) },
      { id: `layout.${baseScreenId}.vertical`, label: `${t('layout.vertical')}`, keywords: 'layout vertical column', run: () => update((l) => setDirection(l, 'column')) },
      ...layout.hidden.map((id) => ({
        id: `layout.${baseScreenId}.show.${id}`,
        label: `${t('layout.showPanels')}: ${titleOf(id)}`,
        keywords: 'layout show panel',
        run: () => update((l) => toggleHidden(l, id)),
      })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, layout, t('layout.reset')]);

  const active = activeTabOf(layout);
  const group = tabGroup(layout);
  const row = layout.direction === 'row';

  const startResize = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const startPos = row ? e.clientX : e.clientY;
    const startSize = layout.sizes[id] ?? 1;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const d = ((row ? ev.clientX : ev.clientY) - startPos) / PX_PER_UNIT;
      update((l) => resizeBy(l, id, startSize + d - (l.sizes[id] ?? 1)));
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  return (
    <div
      className={mergeClasses(s.root, dense && s.rootDense)}
      data-testid="layout-root"
      data-layout-persona={persona}
      data-layout-order={layout.order.filter((id) => isShown(layout, id)).join(',')}
    >
      <div className={s.toolbar}>
        <Button data-testid="layout-reset" appearance="secondary" size={dense ? 'small' : undefined} onClick={() => resetLayout(screenId)}>
          {t('layout.reset')}
        </Button>
        <Button appearance="subtle" size={dense ? 'small' : undefined} onClick={() => update((l) => setDirection(l, 'row'))} aria-pressed={row}>
          {t('layout.horizontal')}
        </Button>
        <Button appearance="subtle" size={dense ? 'small' : undefined} onClick={() => update((l) => setDirection(l, 'column'))} aria-pressed={!row}>
          {t('layout.vertical')}
        </Button>
        {layout.hidden.length > 0 && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" data-testid="layout-show-menu">
                {t('layout.showPanels')} ({layout.hidden.length})
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {layout.hidden.map((id) => (
                  <MenuItem key={id} onClick={() => update((l) => toggleHidden(l, id))}>
                    {titleOf(id)}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
        <Caption1 data-testid="layout-save-note">{t('layout.saveNote')}</Caption1>
      </div>
      <div className={row ? s.row : s.column} data-direction={layout.direction}>
        {panels.map((p) => {
          const shown = isShown(layout, p.id);
          const maximized = layout.maximized === p.id;
          const size = layout.sizes[p.id] ?? 1;
          const inTabs = group.length > 1 && group.includes(p.id);
          return (
            <section
              key={p.id}
              data-testid={`layout-panel-${p.id}`}
              data-maximized={maximized}
              aria-label={p.title}
              className={s.panel}
              style={{
                order: layout.order.indexOf(p.id),
                flex: maximized ? '1 1 0' : `${size} 1 0`,
                display: shown ? undefined : 'none',
              }}
              onDragOver={(e) => dragId.current && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId.current;
                dragId.current = null;
                if (from && from !== p.id) update((l) => moveTo(l, from, p.id));
              }}
            >
              <div
                className={mergeClasses(s.header, dense && s.headerDense)}
                draggable
                title={t('layout.drag')}
                onDragStart={(e) => {
                  dragId.current = p.id;
                  e.dataTransfer.setData('text/plain', p.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => (dragId.current = null)}
              >
                {inTabs ? (
                  <TabList
                    size="small"
                    selectedValue={active ?? undefined}
                    onTabSelect={(_, d) => update((l) => setActiveTab(l, String(d.value)))}
                    className={s.title}
                  >
                    {group.map((id) => (
                      <Tab key={id} value={id}>
                        {titleOf(id)}
                      </Tab>
                    ))}
                  </TabList>
                ) : (
                  <Subtitle2 as="h3" className={s.title}>
                    {p.title}
                  </Subtitle2>
                )}
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<MoreHorizontal20Regular />}
                      aria-label={`${t('layout.menu')}: ${p.title}`}
                      data-testid={`layout-menu-${p.id}`}
                    />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={() => update((l) => resizeBy(l, p.id, 0.5))}>{t('layout.widen')}</MenuItem>
                      <MenuItem onClick={() => update((l) => moveBy(l, p.id, 1))}>{t('layout.moveLater')}</MenuItem>
                      <MenuItem onClick={() => update((l) => moveBy(l, p.id, -1))}>{t('layout.moveEarlier')}</MenuItem>
                      <MenuItem onClick={() => update((l) => resizeBy(l, p.id, -0.5))}>{t('layout.narrow')}</MenuItem>
                      <MenuItem onClick={() => update((l) => toggleTabbed(l, p.id))}>
                        {layout.tabbed.includes(p.id) ? t('layout.untab') : t('layout.tab')}
                      </MenuItem>
                      <MenuItem onClick={() => update((l) => toggleMaximized(l, p.id))}>
                        {maximized ? t('layout.restore') : t('layout.maximize')}
                      </MenuItem>
                      <MenuItem onClick={() => update((l) => toggleHidden(l, p.id))}>{t('layout.hide')}</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>
              <div className={mergeClasses(s.body, dense && s.bodyDense)}>{p.content}</div>
              <button
                type="button"
                role="separator"
                aria-orientation={row ? 'vertical' : 'horizontal'}
                aria-label={`${t('layout.resize')}: ${p.title}`}
                aria-valuenow={size}
                aria-valuemin={0.5}
                aria-valuemax={4}
                className={`${s.handle} ${row ? '' : s.handleColumn}`}
                onPointerDown={startResize(p.id)}
                onKeyDown={(e) => {
                  const grow = row ? 'ArrowRight' : 'ArrowDown';
                  const shrink = row ? 'ArrowLeft' : 'ArrowUp';
                  if (e.key === grow) update((l) => resizeBy(l, p.id, 0.25));
                  else if (e.key === shrink) update((l) => resizeBy(l, p.id, -0.25));
                  else return;
                  e.preventDefault();
                }}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
