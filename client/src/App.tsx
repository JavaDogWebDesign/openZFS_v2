import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { AuthProvider } from '@/hooks/useAuth';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PoolsPage } from '@/pages/PoolsPage';
import { PoolDetailPage } from '@/pages/PoolDetailPage';
import { DrivesPage } from '@/pages/DrivesPage';
import { DatasetsPage } from '@/pages/DatasetsPage';
import { SnapshotsPage } from '@/pages/SnapshotsPage';
import { SharesPage } from '@/pages/SharesPage';
import { UsersPage } from '@/pages/UsersPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="zfs-manager-theme">
        <AuthProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/pools" element={<PoolsPage />} />
                <Route path="/pools/:name" element={<PoolDetailPage />} />
                <Route path="/drives" element={<DrivesPage />} />
                <Route path="/datasets" element={<DatasetsPage />} />
                <Route path="/snapshots" element={<SnapshotsPage />} />
                <Route path="/shares" element={<SharesPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
