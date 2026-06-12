import { Route, Routes } from 'react-router-dom';
import { AppDetailPage } from './pages/AppDetailPage';
import { AppsPage } from './pages/AppsPage';
import { LoginPage } from './pages/LoginPage';
import { RequireAuth } from './auth/RequireAuth';

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
            <AppDetailPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
