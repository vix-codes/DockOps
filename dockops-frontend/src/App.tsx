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
import { FileBrowserPage } from '@/pages/FileBrowserPage';
import { TerminalPage } from '@/pages/TerminalPage';
import { ImagesPage } from '@/pages/ImagesPage';
import { VolumesPage } from '@/pages/VolumesPage';
import { NetworksPage } from '@/pages/NetworksPage';
import { AppRegistryPage } from '@/pages/AppRegistryPage';

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
              <Route path="/files" element={<FileBrowserPage />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/images" element={<ImagesPage />} />
              <Route path="/volumes" element={<VolumesPage />} />
              <Route path="/networks" element={<NetworksPage />} />
              <Route path="/apps" element={<AppRegistryPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
