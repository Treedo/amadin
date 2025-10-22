import { useEffect, useState } from 'react';
import { fetchEntityRows } from '../api/index.js';

interface TableViewProps {
  appId: string;
  entityCode: string;
}

export function TableView({ appId, entityCode }: TableViewProps) {
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    if (!entityCode) {
      setRows([]);
      return;
    }
    fetchEntityRows(appId, entityCode)
      .then(setRows)
      .catch((error) => console.error(error));
  }, [appId, entityCode]);

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
