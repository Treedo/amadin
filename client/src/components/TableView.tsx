import { useEffect, useState } from 'react';
import { fetchEntityRows } from '../api/index.js';

interface TableViewProps {
  entityCode: string;
}

export function TableView({ entityCode }: TableViewProps) {
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    if (!entityCode) {
      setRows([]);
      return;
    }
    fetchEntityRows(entityCode)
      .then(setRows)
  .catch((error) => console.error('Failed to load entity rows', error));
  }, [entityCode]);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map((row: unknown, index: number) => (
          <tr key={index}>
            <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(row, null, 2)}</pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
