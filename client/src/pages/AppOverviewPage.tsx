import { useEffect, useMemo } from 'react';

import { FormRenderer } from '../components/FormRenderer.js';
import { TableView } from '../components/TableView.js';
import { useAmadin } from '../context/AmadinContext.js';
import { useWindowManager } from '../context/WindowManagerContext.js';

export function AppOverviewPage() {
  const { app } = useAmadin();
  const { activeWindow, setWindowTitle } = useWindowManager();

  const primaryForm = useMemo(() => {
    const overviewForm = app?.manifest.find((form) => form.code === 'overview');
    return overviewForm ?? app?.manifest[0];
  }, [app]);

  const primaryEntity = primaryForm?.primaryEntity ?? '';

  useEffect(() => {
    if (app && activeWindow && activeWindow.view.kind === 'overview') {
      setWindowTitle(activeWindow.id, primaryForm?.name ?? app.meta.name);
    }
  }, [activeWindow, app, primaryForm, setWindowTitle]);

  if (!app) {
    return <p>Застосунок ще завантажується…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <FormRenderer app={app} />
      {primaryEntity ? (
        <TableView entityCode={primaryEntity} />
      ) : (
        <p style={{ color: '#6b7280' }}>
          Додайте поле з повʼязаною сутністю, щоби побачити табличні дані у нижньому блоці.
        </p>
      )}
    </div>
  );
}
