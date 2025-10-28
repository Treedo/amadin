import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.js';
import { AppOverviewPage } from './pages/AppOverviewPage.js';
import { EntityPage } from './pages/EntityPage.js';
import { FormPage } from './pages/FormPage.js';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<AppOverviewPage />} />
        <Route path="forms/:formCode/records/:recordId" element={<FormPage />} />
        <Route path="forms/:formCode" element={<FormPage />} />
        <Route path="entities/:entityCode" element={<EntityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
