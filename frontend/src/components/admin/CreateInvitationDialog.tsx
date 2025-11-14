import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import adminService from '@services/admin.service';
import type { Tenant } from '@types/index';

interface CreateInvitationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInvitationDialog = ({ open, onClose, onSuccess }: CreateInvitationDialogProps) => {
  const [organizations, setOrganizations] = useState<Tenant[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    role: 'viewer' as 'viewer' | 'editor' | 'admin',
    tenantId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadOrganizations();
    }
  }, [open]);

  const loadOrganizations = async () => {
    try {
      const { tenants } = await adminService.getAllTenants({ page: 1, limit: 100 });
      setOrganizations(tenants.filter(t => t.isActive));
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.tenantId) {
      setError('Please select an organization');
      return;
    }

    try {
      setIsLoading(true);
      await adminService.createInvitation({
        email: formData.email,
        tenantId: formData.tenantId,
        role: formData.role,
      });

      // Reset form
      setFormData({ email: '', role: 'viewer', tenantId: '' });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ email: '', role: 'viewer', tenantId: '' });
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Invitation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                disabled={isLoading}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                An invitation email will be sent to this address
              </p>
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                  <SelectItem value="editor">Editor - Can create and edit content</SelectItem>
                  <SelectItem value="admin">Admin - Full access including user management</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tenantId">Organization *</Label>
              <Select
                value={formData.tenantId}
                onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
              <p className="text-blue-400">
                <strong>Note:</strong> The invitation link will expire in 7 days. You can resend
                it from the invitations page if needed.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
