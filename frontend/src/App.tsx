import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  UploadPage,
  LibraryPage,
  VideoDetailPage,
  DashboardPage,
  AdminModerationPage,
  LoginPage,
  RegisterPage,
  OrganizationsPage,
  UsersPage,
  InvitationsPage,
  AcceptInvitationPage,
} from '@pages/index';
import { ProtectedRoute } from '@/components/routes/ProtectedRoute';
import { useSocket } from '@hooks/useSocket';
import { useUIStore } from '@store/uiStore';
import { ROUTES } from '@utils/constants';
import { Toaster } from '@components/ui/toaster';
import './App.css';

function App() {
  const { theme } = useUIStore();
  useSocket(); // Initialize socket connection

  // Apply theme on mount
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          {/* Auth Routes */}
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

          {/* Main Routes */}
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
          <Route path={ROUTES.LIBRARY} element={<LibraryPage />} />
          <Route
            path={ROUTES.UPLOAD}
            element={
              <ProtectedRoute minimumRole="editor">
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route path={`${ROUTES.VIDEOS}/:id`} element={<VideoDetailPage />} />

          {/* Admin Routes */}
          <Route
            path="/admin/moderation"
            element={
              <ProtectedRoute minimumRole="admin">
                <AdminModerationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/organizations"
            element={
              <ProtectedRoute minimumRole="admin">
                <OrganizationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute minimumRole="admin">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invitations"
            element={
              <ProtectedRoute minimumRole="admin">
                <InvitationsPage />
              </ProtectedRoute>
            }
          />

          {/* Public Routes */}
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

          {/* 404 - Catch all */}
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
        <Toaster />
      </div>
    </BrowserRouter>
  );
}

export default App;
