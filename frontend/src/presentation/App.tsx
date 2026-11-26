import { Route, Routes } from 'react-router-dom';
import { AppsPage } from './pages/AppsPage';
import { FlagDetailPage } from './pages/FlagDetailPage';
import { FlagsTab } from './pages/FlagsTab';
import { legacyTab } from './pages/LegacyTab';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './layout/AppLayout';
import { RequireAuth } from './auth/RequireAuth';

const ConfigsTab = legacyTab('configs');
const EnvironmentsTab = legacyTab('environments');
const ApiKeysTab = legacyTab('apiKeys');

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/apps/:appId"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<FlagsTab />} />
        <Route path="flags/:flagId" element={<FlagDetailPage />} />
        <Route path="configs" element={<ConfigsTab />} />
        <Route path="environments" element={<EnvironmentsTab />} />
        <Route path="api-keys" element={<ApiKeysTab />} />
      </Route>
    </Routes>
  );
}
