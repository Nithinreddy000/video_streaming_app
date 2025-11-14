import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import adminService from '@services/admin.service';
import type { Tenant } from '@types/index';

interface EditOrganizationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization: Tenant | null;
}

export const EditOrganizationDialog = ({ open, onClose, onSuccess, organization }: EditOrganizationDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    plan: 'free',
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        description: organization.description || '',
        plan: organization.subscription?.plan || 'free',
        isActive: organization.isActive,
      });
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setIsLoading(true);
      await adminService.updateTenant(organization.id, {
        name: formData.name,
        description: formData.description || undefined,
        isActive: formData.isActive,
        subscription: {
          ...organization.subscription,
          plan: formData.plan,
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
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

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Company"
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug (Read-only)</Label>
              <Input
                id="slug"
                value={organization.slug}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Organization slug cannot be changed after creation
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the organization"
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="plan">Subscription Plan</Label>
              <select
                id="plan"
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isLoading}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={isLoading}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Organization is active
              </Label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
