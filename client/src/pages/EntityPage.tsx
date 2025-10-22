import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { TableView } from '../components/TableView.js';
import { useAmadin } from '../context/AmadinContext.js';
import { useWindowManager } from '../context/WindowManagerContext.js';

export function EntityPage() {
  const { entityCode } = useParams();
  const { loadApp } = useAmadin();
  const { activeWindow, setWindowTitle } = useWindowManager();

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  useEffect(() => {
    if (entityCode && activeWindow && activeWindow.view.kind === 'entity') {
      setWindowTitle(activeWindow.id, `Каталог ${entityCode}`);
    }
  }, [activeWindow, entityCode, setWindowTitle]);

  if (!entityCode) {
    return <Navigate to="/" replace />;
  }

  return <TableView entityCode={entityCode} />;
}
