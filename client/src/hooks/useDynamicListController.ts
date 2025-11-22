import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteEntityRecord, fetchDynamicList, persistListItem } from '../api/dynamicList.js';
import type { DynamicListColumn, DynamicListResponse } from '../api/dynamicList.js';
import { useAmadin } from '../context/AmadinContext.js';
import type { ListContext, ListSort } from '../types/dynamicList.js';

const AUTOSAVE_DELAY = 600;
const DELETE_DELAY = 5000;
const DEFAULT_PAGE_SIZE = 50;

type ItemStatus = 'draft' | 'dirty' | 'saving' | 'saved' | 'deleted' | 'error';

export interface GridItem {
  clientId: string;
  serverId?: string;
  cursor?: string;
  values: Record<string, unknown>;
  syncedValues: Record<string, unknown>;
  status: ItemStatus;
  error?: string;
  pendingSaveToken: number;
  deleteExpiresAt?: number;
  position: number;
}

interface PendingSave {
  timer: number;
  snapshot: GridItem;
}

const createDefaultContext = (): ListContext => ({
  filters: [],
  sorts: [],
  pagination: { direction: 'forward', limit: DEFAULT_PAGE_SIZE }
});

export interface DynamicListController {
  columns: DynamicListColumn[];
  items: GridItem[];
  visibleItems: GridItem[];
  isLoading: boolean;
  isAppending: boolean;
  error: string | null;
  canLoadMore: boolean;
  addDraftRow: () => GridItem | null;
  updateField: (clientId: string, field: string, value: unknown) => void;
  cancelChanges: (clientId: string) => void;
  retrySave: (clientId: string) => void;
  softDelete: (clientId: string) => void;
  undoDelete: (clientId: string) => void;
  loadMore: () => void;
  inlineEditingEnabled: boolean;
  sortDescriptor: ListSort | null;
  cycleSort: (field: string) => void;
}

export function useDynamicListController(entityCode: string): DynamicListController {
  const { app } = useAmadin();
  const appCode = app?.meta.id ?? 'app';
  const [columns, setColumns] = useState<DynamicListColumn[]>([]);
  const [items, setItems] = useState<GridItem[]>([]);
  const [pageInfo, setPageInfo] = useState<DynamicListResponse['pageInfo'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseContext, setBaseContext] = useState<ListContext>(() => createDefaultContext());
  const contextRef = useRef<ListContext>(baseContext);
  const [inlineEditingEnabled, setInlineEditingEnabled] = useState(false);
  const autosaveTimers = useRef<Map<string, PendingSave>>(new Map());
  const deleteTimers = useRef<Map<string, number>>(new Map());
  const [canLoadMore, setCanLoadMore] = useState(false);
  const previousEntityRef = useRef<string | undefined>(entityCode);

  useEffect(() => {
    contextRef.current = baseContext;
  }, [baseContext]);

  useEffect(() => {
    if (previousEntityRef.current === entityCode) {
      return;
    }
    previousEntityRef.current = entityCode;
    setBaseContext(createDefaultContext());
    setItems([]);
    setColumns([]);
    setPageInfo(null);
    setCanLoadMore(false);
  }, [entityCode]);

  const cleanupTimers = useCallback(() => {
    autosaveTimers.current.forEach(({ timer }) => clearTimeout(timer));
    deleteTimers.current.forEach((timer) => clearTimeout(timer));
    autosaveTimers.current.clear();
    deleteTimers.current.clear();
  }, []);

  useEffect(() => cleanupTimers, [cleanupTimers]);

  useEffect(() => {
    if (!entityCode) {
      setItems([]);
      setColumns([]);
      setPageInfo(null);
      setError(null);
      setInlineEditingEnabled(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchDynamicList(appCode, entityCode, baseContext)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const mapped = response.rows.map((row, index) => buildSavedItem(row, index));
        setItems(mapped);
        setColumns(response.columns);
        setPageInfo(response.pageInfo);
        setCanLoadMore(response.pageInfo.hasNextPage);
        setInlineEditingEnabled(Boolean(response.capabilities?.inlineEditing));
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося отримати список');
        setItems([]);
        setColumns([]);
        setPageInfo(null);
        setCanLoadMore(false);
        setInlineEditingEnabled(false);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [appCode, baseContext, entityCode]);

  const visibleItems = useMemo(() => items, [items]);
  const sortDescriptor = baseContext.sorts[0] ?? null;

  const cycleSort = useCallback(
    (field: string) => {
      setBaseContext((prev) => {
        const current = prev.sorts[0];
        let nextDirection: ListSort['direction'] | undefined;
        if (!current || current.field !== field) {
          nextDirection = 'desc';
        } else if (current.direction === 'desc') {
          nextDirection = 'asc';
        } else {
          nextDirection = undefined;
        }
        return {
          ...prev,
          sorts: nextDirection ? [{ field, direction: nextDirection }] : [],
          pagination: { ...prev.pagination, after: undefined, before: undefined }
        };
      });
    },
    []
  );

  const scheduleAutosave = useCallback(
    (item: GridItem) => {
      if (item.status === 'deleted') {
        return;
      }
      const existing = autosaveTimers.current.get(item.clientId);
      if (existing) {
        clearTimeout(existing.timer);
      }
      const snapshot: GridItem = {
        ...item,
        values: { ...item.values },
        syncedValues: { ...item.syncedValues }
      };
      const timer = window.setTimeout(() => {
        autosaveTimers.current.delete(item.clientId);
        persistSnapshot(entityCode, snapshot, setItems);
      }, AUTOSAVE_DELAY);
      autosaveTimers.current.set(item.clientId, { timer, snapshot });
    },
    [entityCode]
  );

  const addDraftRow = useCallback(() => {
    if (!columns.length) {
      return null;
    }
    const clientId = generateClientId();
    const base: GridItem = {
      clientId,
      values: {},
      syncedValues: {},
      status: 'draft',
      pendingSaveToken: 0,
      position: items.length,
      cursor: undefined
    };
    setItems((prev) => [...prev, base]);
    return base;
  }, [columns.length, items.length]);

  const updateField = useCallback(
    (clientId: string, field: string, value: unknown) => {
      let scheduled: GridItem | null = null;
      setItems((prev) =>
        prev.map((item) => {
          if (item.clientId !== clientId) {
            return item;
          }
          const nextItem: GridItem = {
            ...item,
            values: { ...item.values, [field]: value },
            status: item.status === 'draft' ? 'draft' : 'dirty',
            error: undefined,
            pendingSaveToken: item.pendingSaveToken + 1
          };
          scheduled = nextItem;
          return nextItem;
        })
      );
      if (scheduled) {
        scheduleAutosave(scheduled);
      }
    },
    [scheduleAutosave]
  );

  const cancelChanges = useCallback((clientId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) {
          return item;
        }
        return {
          ...item,
          values: { ...item.syncedValues },
          status: item.serverId ? 'saved' : 'draft',
          error: undefined
        };
      })
    );
  }, []);

  const retrySave = useCallback(
    (clientId: string) => {
      const target = items.find((item) => item.clientId === clientId);
      if (target) {
        scheduleAutosave({ ...target, pendingSaveToken: target.pendingSaveToken + 1 });
      }
    },
    [items, scheduleAutosave]
  );

  const softDelete = useCallback(
    (clientId: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.clientId !== clientId) {
            return item;
          }
          return {
            ...item,
            status: 'deleted',
            deleteExpiresAt: Date.now() + DELETE_DELAY
          };
        })
      );
      const timer = window.setTimeout(async () => {
        deleteTimers.current.delete(clientId);
        await finalizeDelete(entityCode, clientId, setItems);
      }, DELETE_DELAY);
      const existing = deleteTimers.current.get(clientId);
      if (existing) {
        clearTimeout(existing);
      }
      deleteTimers.current.set(clientId, timer);
    },
    [entityCode]
  );

  const undoDelete = useCallback((clientId: string) => {
    const timer = deleteTimers.current.get(clientId);
    if (timer) {
      clearTimeout(timer);
      deleteTimers.current.delete(clientId);
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) {
          return item;
        }
        return {
          ...item,
          status: item.serverId ? 'saved' : 'draft',
          deleteExpiresAt: undefined
        };
      })
    );
  }, []);

  const loadMore = useCallback(() => {
    if (!canLoadMore || isAppending || !pageInfo?.endCursor) {
      return;
    }
    setIsAppending(true);
    const nextContext: ListContext = {
      ...contextRef.current,
      pagination: { ...contextRef.current.pagination, after: pageInfo.endCursor, before: undefined }
    };
    fetchDynamicList(appCode, entityCode, nextContext)
      .then((response) => {
        setPageInfo(response.pageInfo);
        setCanLoadMore(response.pageInfo.hasNextPage);
        setItems((prev) => mergeRows(prev, response.rows));
        if (!columns.length) {
          setColumns(response.columns);
        }
      })
      .catch((appendError: unknown) => {
        console.error(appendError);
        setError(appendError instanceof Error ? appendError.message : 'Не вдалося дозавантажити дані');
      })
      .finally(() => setIsAppending(false));
  }, [appCode, canLoadMore, columns.length, entityCode, isAppending, pageInfo]);

  return {
    columns,
    items,
    visibleItems,
    isLoading,
    isAppending,
    error,
    canLoadMore,
    addDraftRow,
    updateField,
    cancelChanges,
    retrySave,
    softDelete,
    undoDelete,
    loadMore,
    inlineEditingEnabled,
    sortDescriptor,
    cycleSort
  };
}

function buildSavedItem(row: DynamicListResponse['rows'][number], index: number): GridItem {
  const values = row.values ?? {};
  const recordId = readRecordId(values) ?? extractRecordIdFromCursor(row.cursor);
  const clientId = (recordId ?? row.cursor ?? `row-${index}-${generateClientId()}`) as string;
  return {
    clientId,
    serverId: recordId,
    cursor: row.cursor,
    values,
    syncedValues: { ...values },
    status: 'saved',
    pendingSaveToken: 0,
    position: index
  };
}

function readRecordId(values: Record<string, unknown>): string | undefined {
  const candidate = values.id ?? values.ID ?? values.code;
  if (candidate === undefined || candidate === null) {
    return undefined;
  }
  return String(candidate);
}

function extractRecordIdFromCursor(cursor?: string | null): string | undefined {
  if (!cursor) {
    return undefined;
  }
  try {
    const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    let decoded: string;
    if (typeof atob === 'function') {
      decoded = atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(padded, 'base64').toString('utf8');
    } else {
      return undefined;
    }
    const parsed = JSON.parse(decoded) as { key?: unknown[] };
    const primaryValue = parsed.key?.[0];
    return primaryValue === undefined || primaryValue === null ? undefined : String(primaryValue);
  } catch {
    return undefined;
  }
}

function generateClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 9)}`;
}

async function persistSnapshot(
  entityCode: string,
  snapshot: GridItem,
  setItems: Dispatch<SetStateAction<GridItem[]>>
): Promise<void> {
  setItems((prev) =>
    prev.map((item) => (item.clientId === snapshot.clientId ? { ...item, status: 'saving', error: undefined } : item))
  );
  try {
    const payload = await persistListItem(entityCode, snapshot.serverId, snapshot.values);
    const serverId = readRecordId(payload) ?? snapshot.serverId ?? snapshot.clientId;
    setItems((prev) =>
      prev.map((item) => {
        if (item.clientId !== snapshot.clientId) {
          return item;
        }
        const nextSynced = { ...item.syncedValues, ...payload };
        return {
          ...item,
          serverId,
          values: { ...item.values, ...payload },
          syncedValues: nextSynced,
          status: 'saved',
          pendingSaveToken: 0,
          cursor: item.cursor ?? snapshot.cursor
        };
      })
    );
  } catch (error) {
    console.error(error);
    setItems((prev) =>
      prev.map((item) =>
        item.clientId === snapshot.clientId
          ? {
              ...item,
              status: 'error',
              error: error instanceof Error ? error.message : 'Помилка збереження'
            }
          : item
      )
    );
  }
}

async function finalizeDelete(
  entityCode: string,
  clientId: string,
  setItems: Dispatch<SetStateAction<GridItem[]>>
): Promise<void> {
  let serverId: string | undefined;
  setItems((prev) => {
    const target = prev.find((item) => item.clientId === clientId);
    serverId = target?.serverId;
    return prev.filter((item) => item.clientId !== clientId);
  });
  if (serverId) {
    try {
      await deleteEntityRecord(entityCode, serverId);
    } catch (error) {
      console.error(error);
    }
  }
}

function mergeRows(existing: GridItem[], incoming: DynamicListResponse['rows']): GridItem[] {
  const seen = new Set(existing.map((item) => item.cursor ?? item.clientId));
  const appended = incoming
    .filter((row) => {
      const key = row.cursor ?? readRecordId(row.values) ?? '';
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((row, index) => buildSavedItem(row, existing.length + index));
  return [...existing, ...appended];
}
