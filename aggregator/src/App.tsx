import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { Theme } from '@astryxdesign/core/theme';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FramesView, type Slot } from './views/FramesView';
import { IndexView } from './views/IndexView';
import {
  HEARTBEAT,
  fetchModels,
  isTyping,
  probe,
  type Filters,
  type FrameWidth,
  type LoadState,
  type Model,
  type Telemetry,
} from './lib/models';
import { arenaTheme } from './theme';

type View = 'index' | 'duo' | 'quad';

const SLOT_KEYS = ['A', 'B', 'Q1', 'Q2', 'Q3', 'Q4'] as const;
const SLOT_PARAM: Record<(typeof SLOT_KEYS)[number], string> = {
  A: 'a',
  B: 'b',
  Q1: 'q1',
  Q2: 'q2',
  Q3: 'q3',
  Q4: 'q4',
};

const WIDTH_OPTIONS = [
  { value: 'desktop', label: 'Full width' },
  { value: 'tablet', label: '768 px' },
  { value: 'mobile', label: '375 px' },
];

const readMode = (): 'light' | 'dark' =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

// The view, the chosen models and the preview width live in the query string,
// so a comparison can be linked, reloaded and shared.
function readLocation() {
  const params = new URLSearchParams(location.search);
  const viewParam = params.get('view');
  const view: View = viewParam === 'duo' || viewParam === 'quad' ? viewParam : 'index';
  const widthParam = params.get('w');
  const width: FrameWidth =
    widthParam === 'tablet' || widthParam === 'mobile' ? widthParam : 'desktop';
  const slots: Record<string, string> = {};
  for (const key of SLOT_KEYS) {
    const value = params.get(SLOT_PARAM[key]);
    if (value) slots[key] = value;
  }
  return { view, width, slots };
}

const initialLocation = readLocation();

export function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry>>({});
  const [view, setView] = useState<View>(initialLocation.view);
  const [filters, setFilters] = useState<Filters>({ q: '', tag: 'ALL' });
  const [width, setWidth] = useState<FrameWidth>(initialLocation.width);
  const [mode, setMode] = useState<'light' | 'dark'>(readMode);
  const [toast, setToast] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, string>>(initialLocation.slots);
  const [nonces, setNonces] = useState<Record<string, number>>({});
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  /* ---- data ------------------------------------------------------------- */

  const loadModels = useCallback(async () => {
    setLoad('loading');
    try {
      const list = await fetchModels();
      setModels(list);
      setLoad('ready');
      setLoadError('');
    } catch (error) {
      setModels([]);
      setLoad('error');
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const probeAll = useCallback(async (list: Model[]) => {
    if (list.length === 0) return;
    const results = await Promise.all(
      list.map(async (model) => [model.id, await probe(model)] as const),
    );
    setTelemetry(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    if (models.length === 0) return;
    void probeAll(models);
    const timer = window.setInterval(() => {
      if (!document.hidden) void probeAll(models);
    }, HEARTBEAT);
    const onVisible = () => {
      if (!document.hidden) void probeAll(models);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [models, probeAll]);

  // Default each slot once the roster arrives, keeping choices the user made.
  useEffect(() => {
    if (models.length === 0) return;
    setSlots((held) => {
      const last = models.length - 1;
      const fallback: Record<string, number> = { A: 0, B: 1, Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
      const next = { ...held };
      for (const [key, index] of Object.entries(fallback)) {
        const chosen = models.some((model) => model.id === next[key]);
        if (!chosen) next[key] = models[Math.min(index, last)].id;
      }
      return next;
    });
  }, [models]);

  /* ---- theme ------------------------------------------------------------ */

  const toggleMode = useCallback((dark: boolean) => {
    const next = dark ? 'dark' : 'light';
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ai-arena-theme', next);
    } catch {
      /* private mode: the theme still applies to this page view */
    }
  }, []);

  /* ---- commands --------------------------------------------------------- */

  const recheck = useCallback(async () => {
    await probeAll(models);
    showToast('Route check finished.');
  }, [models, probeAll, showToast]);

  const compareFrom = useCallback((id: string) => {
    setSlots((held) => ({ ...held, A: id }));
    setView('duo');
  }, []);

  const selectSlot = useCallback((slot: string, modelId: string) => {
    setSlots((held) => ({ ...held, [slot]: modelId }));
  }, []);

  const bump = useCallback((keys: string[]) => {
    setNonces((held) => {
      const next = { ...held };
      for (const key of keys) next[key] = (next[key] ?? 0) + 1;
      return next;
    });
  }, []);

  /* ---- shortcuts -------------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event)) {
        if (event.key === 'Escape') {
          (event.target as HTMLElement).blur();
          setFilters({ q: '', tag: 'ALL' });
        }
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const next = ({ 1: 'index', 2: 'duo', 3: 'quad' } as Record<string, View>)[event.key];
      if (next) {
        setView(next);
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        setView('index');
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
        });
      } else if (event.key === 'r' || event.key === 'R') {
        void recheck();
      } else if (event.key === 'Escape') {
        setFilters({ q: '', tag: 'ALL' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recheck]);

  /* ---- url state -------------------------------------------------------- */

  const lastView = useRef<View>(initialLocation.view);

  useEffect(() => {
    if (load !== 'ready') return;
    const params = new URLSearchParams();
    if (view !== 'index') {
      params.set('view', view);
      if (view === 'duo' && width !== 'desktop') params.set('w', width);
      for (const key of SLOT_KEYS) {
        const value = slots[key];
        if (!value) continue;
        if (view === 'duo' && key !== 'A' && key !== 'B') continue;
        if (view === 'quad' && key !== 'Q1' && key !== 'Q2' && key !== 'Q3' && key !== 'Q4') continue;
        params.set(SLOT_PARAM[key], value);
      }
    }
    const query = params.toString();
    const url = query ? `${location.pathname}?${query}` : location.pathname;
    if (view !== lastView.current) {
      lastView.current = view;
      history.pushState(null, '', url);
    } else {
      history.replaceState(null, '', url);
    }
  }, [view, width, slots, load]);

  useEffect(() => {
    const onPop = () => {
      const next = readLocation();
      lastView.current = next.view;
      setView(next.view);
      setWidth(next.width);
      setSlots(next.slots);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* ---- render ----------------------------------------------------------- */

  const duoSlots: Slot[] = [
    { key: 'A', label: 'A', modelId: slots.A ?? '' },
    { key: 'B', label: 'B', modelId: slots.B ?? '' },
  ];
  const quadSlots: Slot[] = ['Q1', 'Q2', 'Q3', 'Q4'].map((key) => ({
    key,
    label: key,
    modelId: slots[key] ?? '',
  }));

  return (
    <Theme theme={arenaTheme} mode={mode}>
      <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark display" aria-hidden="true">
            /
          </span>
          <span className="brand__text">
            <Text as="h1" size="2xl" weight="normal" className="display brand__name">
              AI Arena
            </Text>
            <span className="brand__host mono">{location.host}</span>
          </span>
        </div>

        <SegmentedControl
          label="Views"
          value={view}
          onChange={(next: string) => setView(next as View)}
          size="sm"
        >
          <SegmentedControlItem value="index" label="Index" />
          <SegmentedControlItem value="duo" label="Side by side" />
          <SegmentedControlItem value="quad" label="Four up" />
        </SegmentedControl>

        <div className="topbar__tools">
          {view === 'duo' ? (
            <Selector
              label="Preview width"
              isLabelHidden
              options={WIDTH_OPTIONS}
              value={width}
              onChange={(next: string) => setWidth(next as FrameWidth)}
              size="sm"
              width="8.5rem"
            />
          ) : null}
          <Button
            label={mode === 'dark' ? 'Light' : 'Dark'}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            size="sm"
            variant="secondary"
            onClick={() => toggleMode(mode !== 'dark')}
          />
        </div>
      </header>

      <main id="main">
        {view === 'index' ? (
          <IndexView
            models={models}
            load={load}
            loadError={loadError}
            telemetry={telemetry}
            filters={filters}
            onFilters={setFilters}
            onCompare={compareFrom}
          />
        ) : null}

        {view === 'duo' ? (
          <FramesView
            title="Side by side"
            slots={duoSlots}
            models={models}
            width={width}
            nonces={nonces}
            onSelect={selectSlot}
            onReload={(slot) => bump([slot])}
          />
        ) : null}

        {view === 'quad' ? (
          <FramesView
            title="Four up"
            slots={quadSlots}
            models={models}
            width={width}
            nonces={nonces}
            onSelect={selectSlot}
            onReload={(slot) => bump([slot])}
          />
        ) : null}
      </main>

      <div className={toast ? 'toast is-on' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
      </div>
    </Theme>
  );
}
