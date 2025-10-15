import { useEffect, useState } from 'react';
import { fetchEntityRows } from '../api/index.js';
import type { AppManifest, UiField } from '../api/index.js';

interface FormRendererProps {
  app: AppManifest;
}

export function FormRenderer({ app }: FormRendererProps) {
  const primaryForm = app.manifest[0];
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    const entityCode = primaryForm?.layout[0]?.entity;
    if (!primaryForm || !entityCode) {
      setRows([]);
      return;
    }
    fetchEntityRows(app.meta.id, entityCode)
      .then(setRows)
      .catch((error) => {
        console.error('Failed to load entity rows', error);
      });
  }, [app, primaryForm]);

  if (!primaryForm) {
    return <p>Жодної форми не знайдено 🤷‍♀️</p>;
  }

  return (
    <section>
      <header>
        <h2>{primaryForm.name}</h2>
        <p>Щоб побачити форму, відредагуйте `examples/demo-config.json`.</p>
      </header>
      <div style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
        {primaryForm.layout.map((field: UiField) => (
          <label key={field.field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span>{field.label}</span>
            <input type="text" placeholder={field.field} />
          </label>
        ))}
      </div>
      <pre style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5' }}>
        {JSON.stringify(rows, null, 2)}
      </pre>
    </section>
  );
}
