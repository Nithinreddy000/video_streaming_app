import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Users, Plus, X, Loader2 } from 'lucide-react';
import userService from '@services/user.service';
import { useToast } from '@hooks/use-toast';

interface ManageUserGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: any;
  onSuccess: () => void;
}

interface UserGroup {
  role: 'viewer' | 'editor' | 'admin';
  label: string;
  description: string;
  users: any[];
}

export const ManageUserGroupsDialog = ({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: ManageUserGroupsDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedGroupRole, setSelectedGroupRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');

  const [userGroups, setUserGroups] = useState<UserGroup[]>([
    {
      role: 'viewer',
      label: 'Viewer Group',
      description: 'Read-only access to content',
      users: [],
    },
    {
      role: 'editor',
      label: 'Editor Group',
      description: 'Can create and edit content',
      users: [],
    },
    {
      role: 'admin',
      label: 'Admin Group',
      description: 'Full access including user management',
      users: [],
    },
  ]);

  useEffect(() => {
    if (open && organization) {
      loadUsers();
    }
  }, [open, organization]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { users } = await userService.getAllUsers({
        tenantId: organization.id,
      });

      setAllUsers(users || []);

      // Group users by their roles
      const grouped: UserGroup[] = [
        {
          role: 'viewer',
          label: 'Viewer Group',
          description: 'Read-only access to content',
          users: users.filter((u: any) => u.role === 'viewer'),
        },
        {
          role: 'editor',
          label: 'Editor Group',
          description: 'Can create and edit content',
          users: users.filter((u: any) => u.role === 'editor'),
        },
        {
          role: 'admin',
          label: 'Admin Group',
          description: 'Full access including user management',
          users: users.filter((u: any) => u.role === 'admin'),
        },
      ];

      setUserGroups(grouped);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUserToGroup = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);

      // Update user role
      await userService.updateUser(selectedUserId, {
        role: selectedGroupRole,
      });

      toast({
        title: 'Success',
        description: 'User added to group successfully',
      });

      // Reload users
      await loadUsers();
      setSelectedUserId('');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add user to group',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUserFromGroup = async (userId: string, currentRole: string) => {
    try {
      setIsLoading(true);

      // Change to viewer role (default)
      await userService.updateUser(userId, {
        role: 'viewer',
      });

      toast({
        title: 'Success',
        description: 'User removed from group',
      });

      await loadUsers();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to remove user from group',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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

  // Get users not in the selected group
  const getAvailableUsers = () => {
    return allUsers.filter((user) => user.role !== selectedGroupRole);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Manage User Groups - {organization?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Organize users into groups based on their roles and permissions
          </p>
        </DialogHeader>

        {isLoading && !userGroups[0].users.length ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Add User to Group */}
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm font-semibold mb-3">Add User to Group</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={selectedGroupRole} onValueChange={(value: any) => setSelectedGroupRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer Group</SelectItem>
                    <SelectItem value="editor">Editor Group</SelectItem>
                    <SelectItem value="admin">Admin Group</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUsers().map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={handleAddUserToGroup} disabled={isLoading || !selectedUserId}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Group
                </Button>
              </div>
            </div>

            {/* User Groups */}
            <div className="space-y-4">
              {userGroups.map((group) => (
                <div key={group.role} className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{group.label}</h3>
                        <Badge className={getRoleBadgeColor(group.role)}>
                          {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    </div>
                  </div>

                  {group.users.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-slate-600 rounded">
                      No users in this group
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {group.users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between bg-slate-700/30 p-3 rounded border border-slate-600"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-500/20 p-2 rounded-full">
                              <Users className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium">{user.username}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUserFromGroup(user.id, group.role)}
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
