import { useVirtualizer } from '@tanstack/react-virtual';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAmadin } from '../context/AmadinContext.js';
import { useWindowManager } from '../context/WindowManagerContext.js';
import type { GridItem } from '../hooks/useDynamicListController.js';
import { useDynamicListController } from '../hooks/useDynamicListController.js';

interface TableViewProps {
  entityCode: string;
}

const ROW_HEIGHT = 56;
const ACTIONS_COLUMN_WIDTH = 120;

export function TableView({ entityCode }: TableViewProps) {
  const { app } = useAmadin();
  const { openView } = useWindowManager();
  const {
    columns,
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
  } = useDynamicListController(entityCode);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorIndexRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportHeight = useViewportBoundedHeight(containerRef, 16);

  const itemFormCode = useMemo(() => {
    if (!entityCode || !app) {
      return undefined;
    }
    return app.defaults.entities[entityCode]?.item.formCode;
  }, [app, entityCode]);

  const itemFormName = useMemo(() => {
    if (!itemFormCode || !app) {
      return undefined;
    }
    return app.manifest.find((form) => form.code === itemFormCode)?.name;
  }, [app, itemFormCode]);

  const gridTemplate = useMemo(
    () => `repeat(${Math.max(columns.length, 1)}, minmax(140px, 1fr)) ${ACTIONS_COLUMN_WIDTH}px`,
    [columns.length]
  );

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!virtualItems.length || !canLoadMore || isAppending) {
      return;
    }
    const last = virtualItems[virtualItems.length - 1];
    if (last.index >= visibleItems.length - 4) {
      loadMore();
    }
  }, [virtualItems, visibleItems.length, canLoadMore, isAppending, loadMore]);

  useEffect(() => {
    setSelectedIds((previous) => {
      if (!previous.size) {
        anchorIndexRef.current = null;
        return previous;
      }
      const available = new Set(visibleItems.map((row) => row.clientId));
      let changed = false;
      const nextIds = new Set<string>();
      previous.forEach((id) => {
        if (available.has(id)) {
          nextIds.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed) {
        anchorIndexRef.current = findFirstSelectedIndex(previous, visibleItems);
        return previous;
      }
      anchorIndexRef.current = findFirstSelectedIndex(nextIds, visibleItems);
      return nextIds;
    });
  }, [visibleItems]);

  const selectableRows = useMemo(() => visibleItems.filter((row) => isRowSelectable(row)), [visibleItems]);
  const hasDeletableSelection = visibleItems.some((row) => selectedIds.has(row.clientId) && row.status !== 'deleted');

  const handleRowSelection = useCallback(
    (event: MouseEvent<HTMLDivElement>, row: GridItem, rowIndex: number) => {
      if (!isRowSelectable(row) || event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || event.detail > 1 || isInteractiveElement(event.target)) {
        return;
      }
      const shiftPressed = Boolean(event.shiftKey);
      const togglePressed = event.metaKey || event.ctrlKey;

      setSelectedIds((previous) => {
        if (shiftPressed && anchorIndexRef.current !== null) {
          return buildRangeSelection(anchorIndexRef.current, rowIndex, visibleItems);
        }

        const nextIds = new Set(previous);
        if (togglePressed) {
          if (nextIds.has(row.clientId)) {
            nextIds.delete(row.clientId);
          } else {
            nextIds.add(row.clientId);
          }
          anchorIndexRef.current = rowIndex;
          return nextIds;
        }

        anchorIndexRef.current = rowIndex;
        return new Set([row.clientId]);
      });
    },
    [visibleItems]
  );

  const handleInlineAdd = useCallback(() => {
    if (!inlineEditingEnabled) {
      return;
    }
    const draft = addDraftRow();
    if (draft && columns[0]) {
      setEditingCell({ rowId: draft.clientId, field: columns[0].field });
    }
  }, [addDraftRow, columns, inlineEditingEnabled]);

  const handleAddAction = useCallback(() => {
    if (inlineEditingEnabled) {
      handleInlineAdd();
      return;
    }
    if (!itemFormCode) {
      return;
    }
    const title = itemFormName ?? `Форма ${itemFormCode}`;
    openView({ kind: 'form', formCode: itemFormCode }, { newWindow: true, title });
  }, [handleInlineAdd, inlineEditingEnabled, itemFormCode, itemFormName, openView]);

  const handleShortcut = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(() => {
          if (!selectableRows.length) {
            anchorIndexRef.current = null;
            return new Set();
          }
          const nextIds = new Set(selectableRows.map((row) => row.clientId));
          const firstRowId = selectableRows[0]?.clientId;
          anchorIndexRef.current = firstRowId ? visibleItems.findIndex((row) => row.clientId === firstRowId) : null;
          return nextIds;
        });
        return;
      }

      if (!inlineEditingEnabled) {
        return;
      }

      if (isModifier && event.key === 'Enter') {
        event.preventDefault();
        handleInlineAdd();
      }
    },
    [handleInlineAdd, inlineEditingEnabled, selectableRows, visibleItems]
  );

  const handleDeleteSelected = useCallback(() => {
    const idsToDelete = visibleItems
      .filter((row) => selectedIds.has(row.clientId) && row.status !== 'deleted')
      .map((row) => row.clientId);
    if (!idsToDelete.length) {
      return;
    }
    idsToDelete.forEach((id) => softDelete(id));
    setSelectedIds((previous) => {
      const nextIds = new Set(previous);
      idsToDelete.forEach((id) => nextIds.delete(id));
      anchorIndexRef.current = findFirstSelectedIndex(nextIds, visibleItems);
      return nextIds;
    });
  }, [selectedIds, softDelete, visibleItems]);

  const handleOpenRecord = useCallback(
    (row: GridItem) => {
      if (!itemFormCode || !row.serverId) {
        return;
      }
      const title = itemFormName ? `${itemFormName} · ${row.serverId}` : `Запис ${row.serverId}`;
      openView({ kind: 'form', formCode: itemFormCode, recordId: row.serverId }, { newWindow: true, title });
    },
    [itemFormCode, itemFormName, openView]
  );

  if (!entityCode) {
    return <div>Сутність не вибрана.</div>;
  }

  const rootStyle: CSSProperties = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: viewportHeight ? `${viewportHeight}px` : '100%',
      minHeight: viewportHeight ? `${viewportHeight}px` : '100%',
      gap: '0.75rem'
    }),
    [viewportHeight]
  );

  const addDisabled = !inlineEditingEnabled && !itemFormCode;

  return (
    <div ref={containerRef} style={rootStyle} onKeyDown={handleShortcut} tabIndex={0}>
      {isLoading && <InlineNotice tone="info">Завантаження…</InlineNotice>}
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleAddAction}
            disabled={addDisabled}
            style={{
              ...primaryButtonStyle,
              opacity: addDisabled ? 0.5 : 1,
              cursor: addDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            + Додати
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={!hasDeletableSelection}
            style={{
              ...dangerButtonStyle,
              opacity: hasDeletableSelection ? 1 : 0.5,
              cursor: hasDeletableSelection ? 'pointer' : 'not-allowed'
            }}
          >
            Видалити
          </button>
        </div>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>
          {inlineEditingEnabled ? 'Ctrl/Cmd + Enter — новий рядок' : 'Додавання відбувається через форму'}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          fontWeight: 600,
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid #ddd'
        }}
      >
        {columns.map((column) => (
          <ColumnHeader key={column.field} column={column} sortDescriptor={sortDescriptor} onToggle={cycleSort} />
        ))}
        <span style={{ textAlign: 'right', color: '#777', fontSize: '0.85rem' }}>Стан</span>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          background: '#fff'
        }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualItems.map((virtualRow) => {
            const row = visibleItems[virtualRow.index];
            if (!row) {
              return null;
            }
            const isSelected = selectedIds.has(row.clientId);
            return (
              <VirtualRow
                key={row.clientId}
                row={row}
                rowIndex={virtualRow.index}
                columns={columns}
                virtualStart={virtualRow.start}
                gridTemplate={gridTemplate}
                isEditing={(editingCell?.rowId === row.clientId && editingCell.field) || null}
                setEditingCell={setEditingCell}
                updateField={updateField}
                cancelChanges={cancelChanges}
                retrySave={retrySave}
                undoDelete={undoDelete}
                inlineEditingEnabled={inlineEditingEnabled}
                isSelected={isSelected}
                isSelectable={isRowSelectable(row)}
                onRowClick={handleRowSelection}
                onOpenRecord={handleOpenRecord}
              />
            );
          })}
        </div>
        {!visibleItems.length && !isLoading && (
          <EmptyState onAdd={handleAddAction} inlineEditingEnabled={inlineEditingEnabled} addDisabled={addDisabled} />
        )}
        {isAppending && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              fontSize: '0.8rem',
              padding: '0.25rem 0.5rem',
              color: '#555'
            }}
          >
            Дозавантаження…
          </div>
        )}
      </div>
    </div>
  );
}

interface VirtualRowProps {
  row: GridItem;
  rowIndex: number;
  columns: { field: string; label: string }[];
  gridTemplate: string;
  virtualStart: number;
  isEditing: string | null;
  setEditingCell: (cell: { rowId: string; field: string } | null) => void;
  updateField: (rowId: string, field: string, value: unknown) => void;
  cancelChanges: (rowId: string) => void;
  retrySave: (rowId: string) => void;
  undoDelete: (rowId: string) => void;
  inlineEditingEnabled: boolean;
  isSelected: boolean;
  isSelectable: boolean;
  onRowClick: (event: MouseEvent<HTMLDivElement>, row: GridItem, rowIndex: number) => void;
  onOpenRecord: (row: GridItem) => void;
}

function VirtualRow({
  row,
  rowIndex,
  columns,
  gridTemplate,
  virtualStart,
  isEditing,
  setEditingCell,
  updateField,
  cancelChanges,
  retrySave,
  undoDelete,
  inlineEditingEnabled,
  isSelected,
  isSelectable,
  onRowClick,
  onOpenRecord
}: VirtualRowProps) {
  const rowStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    transform: `translateY(${virtualStart}px)`,
    transition: 'transform 0.1s ease-out',
    opacity: row.status === 'draft' ? 0.9 : undefined,
    background: isSelected ? '#f0f4ff' : row.status === 'error' ? 'rgba(192,57,43,0.08)' : undefined,
    borderLeft: `4px solid ${statusAccent(row)}`
  };

  return (
    <div style={rowStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          alignItems: 'center',
          minHeight: ROW_HEIGHT - 8
        }}
        onClick={(event) => {
          if (isSelectable) {
            onRowClick(event, row, rowIndex);
          }
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onOpenRecord(row);
        }}
      >
        {columns.map((column) => (
          <EditableCell
            key={column.field}
            row={row}
            column={column}
            isEditing={inlineEditingEnabled && isEditing === column.field}
            inlineEditingEnabled={inlineEditingEnabled}
            onStartEdit={() => {
              if (inlineEditingEnabled) {
                setEditingCell({ rowId: row.clientId, field: column.field });
              }
            }}
            onChange={(value) => updateField(row.clientId, column.field, value)}
            onCancel={() => {
              cancelChanges(row.clientId);
              setEditingCell(null);
            }}
            onCommit={() => setEditingCell(null)}
          />
        ))}
        <RowActions row={row} onUndoDelete={() => undoDelete(row.clientId)} onRetry={() => retrySave(row.clientId)} />
      </div>
    </div>
  );
}

interface EditableCellProps {
  row: GridItem;
  column: { field: string; label: string };
  isEditing: boolean;
  inlineEditingEnabled: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
}

function EditableCell({ row, column, isEditing, inlineEditingEnabled, onStartEdit, onChange, onCancel, onCommit }: EditableCellProps) {
  const value = row.values[column.field];
  if (!inlineEditingEnabled) {
    return (
      <div
        style={{
          minHeight: 36,
          padding: '0.35rem 0.5rem',
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent'
        }}
      >
        {renderValue(value)}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div
        onDoubleClick={(event) => {
          event.stopPropagation();
          onStartEdit();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onStartEdit();
          }
        }}
        style={{
          minHeight: 36,
          padding: '0.35rem 0.5rem',
          border: '1px solid transparent',
          borderRadius: 6,
          cursor: 'text'
        }}
      >
        {renderValue(value)}
      </div>
    );
  }
  return (
    <input
      autoFocus
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      style={{
        width: '100%',
        borderRadius: 6,
        border: '1px solid #999',
        padding: '0.35rem 0.5rem',
        font: 'inherit'
      }}
    />
  );
}

function RowActions({ row, onUndoDelete, onRetry }: { row: GridItem; onUndoDelete: () => void; onRetry: () => void }) {
  if (row.status === 'deleted') {
    return (
      <div style={{ textAlign: 'right' }}>
        <button
          type="button"
          style={ghostButtonStyle}
          onClick={(event) => {
            event.stopPropagation();
            onUndoDelete();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          Повернути ({Math.max(0, Math.ceil(((row.deleteExpiresAt ?? Date.now()) - Date.now()) / 1000))}с)
        </button>
      </div>
    );
  }
  if (row.status === 'error') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={ghostButtonStyle}
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          Повторити
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#6b7280' }}>{statusLabel(row.status)}</div>
  );
}

function ColumnHeader({
  column,
  sortDescriptor,
  onToggle
}: {
  column: { field: string; label: string; sortable?: boolean };
  sortDescriptor: { field: string; direction: 'asc' | 'desc' } | null;
  onToggle: (field: string) => void;
}) {
  const sortable = column.sortable !== false;
  if (!sortable) {
    return <span>{column.label ?? column.field}</span>;
  }
  const active = sortDescriptor?.field === column.field;
  const direction = active ? sortDescriptor?.direction : undefined;
  const indicator = direction === 'desc' ? '↓' : direction === 'asc' ? '↑' : '↕';
  return (
    <button
      type="button"
      onClick={() => onToggle(column.field)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontWeight: 600
      }}
    >
      <span>{column.label ?? column.field}</span>
      <span style={{ color: active ? '#2563eb' : '#999', fontSize: '0.85rem' }}>{indicator}</span>
    </button>
  );
}

function InlineNotice({ children, tone }: { children: ReactNode; tone: 'info' | 'error' }) {
  const palette = tone === 'info' ? { bg: '#f0f4ff', color: '#2c3e50' } : { bg: '#fdecea', color: '#c0392b' };
  return (
    <div style={{ background: palette.bg, color: palette.color, padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.9rem' }}>{children}</div>
  );
}

function EmptyState({ onAdd, inlineEditingEnabled, addDisabled }: { onAdd: () => void; inlineEditingEnabled: boolean; addDisabled: boolean }) {
  const label = inlineEditingEnabled ? '+ Додати перший запис' : 'Відкрити форму';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#777' }}>
        <p>Поки немає записів.</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          style={{
            ...primaryButtonStyle,
            opacity: addDisabled ? 0.5 : 1,
            cursor: addDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function statusAccent(row: GridItem): string {
  switch (row.status) {
    case 'draft':
      return '#6c5ce7';
    case 'dirty':
      return '#f1c40f';
    case 'error':
      return '#c0392b';
    case 'deleted':
      return '#95a5a6';
    default:
      return '#2ecc71';
  }
}

function statusLabel(status: GridItem['status']): string {
  switch (status) {
    case 'draft':
      return 'Чернетка';
    case 'dirty':
      return 'Не збережено';
    case 'saving':
      return 'Збереження…';
    case 'deleted':
      return 'Позначено на видалення';
    case 'error':
      return 'Помилка збереження';
    default:
      return 'Збережено';
  }
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function isRowSelectable(row: GridItem | undefined): row is GridItem {
  return Boolean(row && row.status !== 'deleted');
}

function findFirstSelectedIndex(selectedIds: Set<string>, rows: GridItem[]): number | null {
  if (!selectedIds.size) {
    return null;
  }
  const matchIndex = rows.findIndex((current) => selectedIds.has(current.clientId));
  return matchIndex >= 0 ? matchIndex : null;
}

function buildRangeSelection(anchorIndex: number, targetIndex: number, rows: GridItem[]): Set<string> {
  if (!rows.length) {
    return new Set();
  }
  const maxIndex = rows.length - 1;
  const rawStart = Math.min(anchorIndex, targetIndex);
  const rawEnd = Math.max(anchorIndex, targetIndex);
  const start = Math.max(0, Math.min(rawStart, maxIndex));
  const end = Math.max(0, Math.min(rawEnd, maxIndex));
  const nextIds = new Set<string>();
  for (let index = start; index <= end; index += 1) {
    const candidate = rows[index];
    if (isRowSelectable(candidate)) {
      nextIds.add(candidate.clientId);
    }
  }
  return nextIds;
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest('button, input, textarea, select, [contenteditable="true"]'));
}

const primaryButtonStyle: CSSProperties = {
  background: '#1f7aec',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '0.5rem 0.9rem',
  cursor: 'pointer',
  fontWeight: 600
};

const dangerButtonStyle: CSSProperties = {
  background: '#fff',
  color: '#c0392b',
  border: '1px solid #c0392b',
  borderRadius: 8,
  padding: '0.5rem 0.9rem',
  cursor: 'pointer',
  fontWeight: 600
};

const ghostButtonStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: '0.25rem 0.5rem',
  cursor: 'pointer'
};

function useViewportBoundedHeight(ref: RefObject<HTMLElement>, bottomOffset = 0): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (!ref.current || typeof window === 'undefined') {
        return;
      }
      const rect = ref.current.getBoundingClientRect();
      const next = Math.max(240, window.innerHeight - rect.top - bottomOffset);
      setHeight(next);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [bottomOffset, ref]);

  return height;
}
