import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Shield, Edit, Eye, Settings, Users, Building2, Mail, Video, Library, Upload, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import { Button } from '@components/ui/button';
import { ROUTES, STORAGE_KEYS } from '@utils/constants';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);

    // Clear authStore
    logout();

    // Navigate to login
    navigate(ROUTES.LOGIN);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'editor':
        return <Edit className="w-4 h-4" />;
      case 'viewer':
        return <Eye className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'editor':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'viewer':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (!user) return null;

  return (
    <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white hidden sm:inline">VideoSentinel</span>
          </div>

          {/* Admin Navigation Menu */}
          {user?.role === 'admin' && (
            <nav className="hidden md:flex items-center gap-2">
              <Button
                variant={isActive('/admin/organizations') ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate('/admin/organizations')}
                className="text-white"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Organizations
              </Button>
              <Button
                variant={isActive('/admin/users') ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate('/admin/users')}
                className="text-white"
              >
                <Users className="w-4 h-4 mr-2" />
                Users
              </Button>
              <Button
                variant={isActive('/admin/invitations') ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate('/admin/invitations')}
                className="text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                Invitations
              </Button>
            </nav>
          )}

          {/* User Info & Logout */}
          <div className="flex items-center gap-3">
            {/* User Info */}
            <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2 border border-slate-600/50">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-1.5 rounded-full">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.username || user.email}
                  </p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
              </div>

              {/* Role Badge */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                {getRoleIcon(user.role)}
                <span className="capitalize">{user.role}</span>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
