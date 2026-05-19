import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { NodesPage } from '@/pages/NodesPage';
import { ContainersPage } from '@/pages/ContainersPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { DeploymentsPage } from '@/pages/DeploymentsPage';
import { MetricsPage } from '@/pages/MetricsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/nodes" element={<NodesPage />} />
              <Route path="/containers" element={<ContainersPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/deployments" element={<DeploymentsPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
