import { useEffect, useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { FormRenderer } from '../components/FormRenderer.js';
import { useAmadin } from '../context/AmadinContext.js';
import { useWindowManager } from '../context/WindowManagerContext.js';

export function FormPage() {
  const { formCode } = useParams();
  const { app, loadApp } = useAmadin();
  const { activeWindow, setWindowTitle } = useWindowManager();

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  if (!formCode) {
    return <Navigate to="/" replace />;
  }

  const formMeta = useMemo(() => app?.manifest.find((form) => form.code === formCode), [app, formCode]);

  useEffect(() => {
    if (formMeta && activeWindow && activeWindow.view.kind === 'form') {
      setWindowTitle(activeWindow.id, formMeta.name);
    }
  }, [activeWindow, formMeta, setWindowTitle]);

  if (!app) {
    return <p>Завантаження форми…</p>;
  }

  return <FormRenderer app={app} formCode={formCode} />;
}
