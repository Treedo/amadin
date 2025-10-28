import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type ViewDescriptor =
  | { kind: 'overview' }
  | { kind: 'form'; formCode: string; recordId?: string }
  | { kind: 'entity'; entityCode: string };

interface WindowEntry {
  id: string;
  path: string;
  title: string;
  view: ViewDescriptor;
}

interface WindowManagerValue {
  windows: WindowEntry[];
  activeWindow?: WindowEntry;
  openView: (view: ViewDescriptor, options?: { newWindow?: boolean; title?: string }) => void;
  activateWindow: (windowId: string) => void;
  closeWindow: (windowId: string) => void;
  setWindowTitle: (windowId: string, title: string) => void;
  replaceView: (windowId: string, view: ViewDescriptor, options?: { title?: string }) => void;
}

const WindowManagerContext = createContext<WindowManagerValue | undefined>(undefined);

export function useWindowManager() {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const windowsRef = useRef<WindowEntry[]>([]);
  windowsRef.current = windows;
  const [activeWindowId, setActiveWindowId] = useState<string | undefined>();
  const activeIdRef = useRef<string | undefined>();
  activeIdRef.current = activeWindowId;

  const ensureWindowForLocation = useCallback(
    (path: string, view: ViewDescriptor) => {
      const activeEntry = activeIdRef.current
        ? windowsRef.current.find((entry) => entry.id === activeIdRef.current)
        : undefined;
      if (activeEntry && activeEntry.path === path) {
        return;
      }

      const existing = findLastByPath(windowsRef.current, path);
      if (existing) {
        if (activeIdRef.current !== existing.id) {
          setActiveWindowId(existing.id);
        }
        return;
      }

      const entry: WindowEntry = {
        id: createWindowId(view),
        path,
        title: defaultTitle(view),
        view
      };

      const nextWindows = [...windowsRef.current, entry];
      windowsRef.current = nextWindows;
      setWindows(nextWindows);
      setActiveWindowId(entry.id);
    },
    []
  );

  useEffect(() => {
    const view = parseViewFromPath(location.pathname);
    if (!view) {
      if (windowsRef.current.length > 0) {
        windowsRef.current = [];
        setWindows([]);
      }
      if (activeIdRef.current) {
        setActiveWindowId(undefined);
      }
      return;
    }

    ensureWindowForLocation(location.pathname, view);
  }, [ensureWindowForLocation, location.pathname]);

  const openView = useCallback(
    (view: ViewDescriptor, options?: { newWindow?: boolean; title?: string }) => {
      const path = buildPath(view);
      const existing = findLastByPath(windowsRef.current, path);
      if (existing && !options?.newWindow) {
        if (options?.title && options.title !== existing.title) {
          const updated = windowsRef.current.map((entry) =>
            entry.id === existing.id ? { ...entry, title: options.title ?? entry.title } : entry
          );
          windowsRef.current = updated;
          setWindows(updated);
        }
        if (activeIdRef.current !== existing.id) {
          setActiveWindowId(existing.id);
        }
        navigate(path);
        return;
      }

      const entry: WindowEntry = {
        id: createWindowId(view),
        path,
        title: options?.title ?? defaultTitle(view),
        view
      };

      const nextWindows = options?.newWindow ? [...windowsRef.current, entry] : [...windowsRef.current, entry];
      windowsRef.current = nextWindows;
      setWindows(nextWindows);
      setActiveWindowId(entry.id);
      navigate(path);
    },
    [navigate]
  );

  const activateWindow = useCallback(
    (windowId: string) => {
      const entry = windowsRef.current.find((window) => window.id === windowId);
      if (!entry) {
        return;
      }
      if (activeIdRef.current !== entry.id) {
        setActiveWindowId(entry.id);
      }
      navigate(entry.path);
    },
    [navigate]
  );

  const closeWindow = useCallback(
    (windowId: string) => {
      const index = windowsRef.current.findIndex((window) => window.id === windowId);
      if (index === -1) {
        return;
      }

      const updated = [...windowsRef.current.slice(0, index), ...windowsRef.current.slice(index + 1)];
      windowsRef.current = updated;
      setWindows(updated);

      if (activeIdRef.current === windowId) {
        const fallback = updated[index - 1] ?? updated[index] ?? undefined;
        if (fallback) {
          setActiveWindowId(fallback.id);
          navigate(fallback.path);
        } else {
          setActiveWindowId(undefined);
          navigate('/');
        }
      }
    },
    [navigate]
  );

  const setWindowTitle = useCallback((windowId: string, title: string) => {
    const exists = windowsRef.current.find((entry) => entry.id === windowId);
    if (!exists || exists.title === title) {
      return;
    }
    const updated = windowsRef.current.map((entry) => (entry.id === windowId ? { ...entry, title } : entry));
    windowsRef.current = updated;
    setWindows(updated);
  }, []);

  const replaceView = useCallback(
    (windowId: string, view: ViewDescriptor, options?: { title?: string }) => {
      const entry = windowsRef.current.find((window) => window.id === windowId);
      if (!entry) {
        return;
      }

      const path = buildPath(view);
      const next: WindowEntry = {
        ...entry,
        path,
        view,
        title: options?.title ?? entry.title
      };

      const updated = windowsRef.current.map((window) => (window.id === windowId ? next : window));
      windowsRef.current = updated;
      setWindows(updated);
      if (activeIdRef.current === windowId) {
        navigate(path, { replace: true });
      }
    },
    [navigate]
  );

  const activeWindow = useMemo(() => windows.find((window) => window.id === activeWindowId), [windows, activeWindowId]);

  const value = useMemo<WindowManagerValue>(
    () => ({ windows, activeWindow, openView, activateWindow, closeWindow, setWindowTitle, replaceView }),
    [windows, activeWindow, openView, activateWindow, closeWindow, setWindowTitle, replaceView]
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}

function buildPath(view: ViewDescriptor): string {
  if (view.kind === 'overview') {
    return `/`;
  }
  if (view.kind === 'form') {
    if (view.recordId) {
      return `/forms/${view.formCode}/records/${view.recordId}`;
    }
    return `/forms/${view.formCode}`;
  }
  return `/entities/${view.entityCode}`;
}

function parseViewFromPath(path: string): ViewDescriptor | undefined {
  if (path === '/' || path === '') {
    return { kind: 'overview' };
  }

  const formRecordMatch = path.match(/^\/forms\/([^/]+)\/records\/([^/]+)$/);
  if (formRecordMatch) {
    return { kind: 'form', formCode: formRecordMatch[1], recordId: formRecordMatch[2] };
  }

  const formMatch = path.match(/^\/forms\/([^/]+)$/);
  if (formMatch) {
    return { kind: 'form', formCode: formMatch[1] };
  }

  const entityMatch = path.match(/^\/entities\/([^/]+)$/);
  if (entityMatch) {
    return { kind: 'entity', entityCode: entityMatch[1] };
  }
  return undefined;
}

function defaultTitle(view: ViewDescriptor): string {
  switch (view.kind) {
    case 'overview':
      return 'Панель';
    case 'form':
      return view.recordId ? `Форма ${view.formCode}` : `Форма ${view.formCode}`;
    case 'entity':
      return `Каталог ${view.entityCode}`;
    default:
      return 'Вікно';
  }
}

function createWindowId(view: ViewDescriptor): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  if (view.kind === 'overview') {
    return `overview-${suffix}`;
  }
  if (view.kind === 'form') {
    if (view.recordId) {
      return `form-${view.formCode}-${view.recordId}-${suffix}`;
    }
    return `form-${view.formCode}-${suffix}`;
  }
  return `entity-${view.entityCode}-${suffix}`;
}

function findLastByPath(windows: WindowEntry[], path: string): WindowEntry | undefined {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (windows[index].path === path) {
      return windows[index];
    }
  }
  return undefined;
}
