import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Badge } from '@components/ui/badge';
import adminService from '@services/admin.service';
import type { User } from '@types/index';

interface ChangeRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}

export const ChangeRoleDialog = ({ open, onClose, onSuccess, user }: ChangeRoleDialogProps) => {
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedRole === user.role) {
      setError('Please select a different role');
      return;
    }

    setError(null);

    try {
      setIsLoading(true);
      await adminService.changeUserRole(user.id, selectedRole);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  if (!user) return null;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'editor': return 'bg-yellow-500';
      case 'viewer': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Full access to all features including user management and system settings';
      case 'editor':
        return 'Can create, edit, and delete content. Cannot manage users or system settings';
      case 'viewer':
        return 'Read-only access. Can view content but cannot make changes';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">User</p>
              <p className="font-semibold">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">
                {user.email} • @{user.username}
              </p>
              <div className="mt-2">
                <Badge className={getRoleBadgeColor(user.role)}>
                  Current: {user.role}
                </Badge>
              </div>
            </div>

            <div>
              <Label>Select New Role</Label>
              <div className="space-y-3 mt-2">
                {(['admin', 'editor', 'viewer'] as const).map((role) => (
                  <label
                    key={role}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRole === role
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={selectedRole === role}
                      onChange={(e) => setSelectedRole(e.target.value as any)}
                      disabled={isLoading}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold capitalize">{role}</span>
                        <Badge className={getRoleBadgeColor(role)} variant="outline">
                          {role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getRoleDescription(role)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {selectedRole !== user.role && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This will change the user's permissions immediately.
                  Make sure the user understands their new role responsibilities.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || selectedRole === user.role}>
              {isLoading ? 'Changing...' : 'Change Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
