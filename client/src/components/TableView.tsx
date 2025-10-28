import { useEffect, useMemo, useState } from 'react';
import { fetchEntityRows } from '../api/index.js';

interface TableViewProps {
  entityCode: string;
}

export function TableView({ entityCode }: TableViewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityCode) {
      setRows([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchEntityRows(entityCode)
      .then((data) => {
        if (cancelled) {
          return;
        }
        if (!Array.isArray(data)) {
          setRows([]);
          return;
        }
        const normalized = data.filter(isRecord);
        setRows(normalized);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load entity rows', fetchError);
        setRows([]);
        setError('Не вдалося завантажити дані.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entityCode]);

  const columns = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => unique.add(key));
    }
    const ordered = Array.from(unique);
    ordered.sort((a, b) => {
      if (a === 'id') {
        return -1;
      }
      if (b === 'id') {
        return 1;
      }
      return a.localeCompare(b);
    });
    return ordered;
  }, [rows]);

  if (!entityCode) {
    return <div>Сутність не вибрана.</div>;
  }

  return (
    <div>
      {isLoading && <div>Завантаження…</div>}
      {error && <div style={{ color: '#c0392b' }}>{error}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                style={{
                  borderBottom: '2px solid #444',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  fontWeight: 600
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex)}>
              {columns.map((column) => (
                <td key={column} style={{ border: '1px solid #ddd', padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                  {formatCellValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length || 1} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                Даних немає.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRowKey(row: Record<string, unknown>, fallback: number): string {
  const candidate = row.id ?? row.ID ?? row.code;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate);
  }
  return `row-${fallback}`;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}
