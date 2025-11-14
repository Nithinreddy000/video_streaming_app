import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileVideo, Loader2 } from 'lucide-react';
import { useVideoUpload } from '@hooks/useVideoUpload';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Progress } from '@components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Checkbox } from '@components/ui/checkbox';
import { formatBytes } from '@utils/formatters';
import { VIDEO_CATEGORIES } from '@utils/constants';
import organizationService from '@services/organization.service';
import { useAuthStore } from '@store/authStore';

interface VideoUploaderProps {
  onUploadComplete?: () => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onUploadComplete }) => {
  const { user } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');

  // Access Control
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['viewer', 'editor', 'admin']);
  const [isPublic, setIsPublic] = useState(false);

  const { uploadVideo, isUploading, uploadProgress, error, reset } = useVideoUpload();

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const { tenants } = await organizationService.getAllOrganizations();
      setOrganizations(tenants || []);
      // Auto-select user's organization if they belong to one
      if (user?.tenant) {
        setSelectedOrganization(user.tenant);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      // Auto-fill title from filename if not set
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleRemoveFile = () => {
    setSelectedFile(null);
    reset();
  };

  const handleRoleToggle = (role: string) => {
    setAllowedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !title) {
      return;
    }

    const metadata = {
      title,
      description: description || undefined,
      category: category || undefined,
      tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
      // Access Control
      accessControl: {
        isPublic,
        organization: selectedOrganization || undefined,
        allowedRoles: isPublic ? ['viewer', 'editor', 'admin'] : allowedRoles,
      },
    };

    const video = await uploadVideo(selectedFile, metadata);

    if (video) {
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setCategory('');
      setTags('');
      // Reset access control
      setIsPublic(false);
      setSelectedOrganization(user?.tenant || '');
      setAllowedRoles(['viewer', 'editor', 'admin']);
      reset();

      if (onUploadComplete) {
        onUploadComplete();
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
        <CardDescription>
          Upload your video file and add metadata for better organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dropzone */}
          <div>
            <Label>Video File</Label>
            <div
              {...getRootProps()}
              className={`
                mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                ${isUploading ? 'pointer-events-none opacity-50' : ''}
              `}
            >
              <input {...getInputProps()} />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2"
              >
                {isDragActive ? (
                  <>
                    <Upload className="w-12 h-12 text-primary" />
                    <p className="text-sm text-primary">Drop your video here</p>
                  </>
                ) : (
                  <>
                    <FileVideo className="w-12 h-12 text-muted-foreground" />
                    <p className="text-sm text-foreground font-medium">
                      Drag & drop your video here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse (MP4, MOV, AVI, MKV, WEBM - Max 2GB)
                    </p>
                  </>
                )}
              </motion.div>
            </div>
          </div>

          {/* Selected File Preview */}
          <AnimatePresence>
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded">
                          <FileVideo className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                      {!isUploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleRemoveFile}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Progress */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-destructive/10 border border-destructive/20 rounded-md"
              >
                <p className="text-sm text-destructive">{error.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Metadata Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                required
                disabled={isUploading}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your video (optional)"
                rows={3}
                disabled={isUploading}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={isUploading}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Enter tags separated by commas"
                disabled={isUploading}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Separate tags with commas (e.g., tutorial, react, javascript)
              </p>
            </div>

            {/* Access Control Section */}
            <div className="pt-4 border-t space-y-4">
              <div>
                <Label className="text-base font-semibold">Access Control</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Control who can view this video
                </p>
              </div>

              {/* Public/Private Toggle */}
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id="isPublic"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                  disabled={isUploading}
                />
                <div className="flex-1">
                  <Label htmlFor="isPublic" className="cursor-pointer">
                    Make this video public
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Public videos are accessible to everyone
                  </p>
                </div>
              </div>

              {/* Organization Selection */}
              {!isPublic && (
                <>
                  <div>
                    <Label htmlFor="organization">Organization</Label>
                    <Select
                      value={selectedOrganization}
                      onValueChange={setSelectedOrganization}
                      disabled={isUploading}
                    >
                      <SelectTrigger className="mt-2">
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select which organization can access this video
                    </p>
                  </div>

                  {/* User Group Selection */}
                  <div>
                    <Label>Allowed User Groups</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
                        <Checkbox
                          id="role-viewer"
                          checked={allowedRoles.includes('viewer')}
                          onCheckedChange={() => handleRoleToggle('viewer')}
                          disabled={isUploading}
                        />
                        <div className="flex-1">
                          <Label htmlFor="role-viewer" className="cursor-pointer font-medium">
                            Viewer Group
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Read-only access
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
                        <Checkbox
                          id="role-editor"
                          checked={allowedRoles.includes('editor')}
                          onCheckedChange={() => handleRoleToggle('editor')}
                          disabled={isUploading}
                        />
                        <div className="flex-1">
                          <Label htmlFor="role-editor" className="cursor-pointer font-medium">
                            Editor Group
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Can create and edit content
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
                        <Checkbox
                          id="role-admin"
                          checked={allowedRoles.includes('admin')}
                          onCheckedChange={() => handleRoleToggle('admin')}
                          disabled={isUploading}
                        />
                        <div className="flex-1">
                          <Label htmlFor="role-admin" className="cursor-pointer font-medium">
                            Admin Group
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Full access including management
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Select which user groups can view this video
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!selectedFile || !title || isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
