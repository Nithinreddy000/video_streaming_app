import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { VideoUploader } from '@components/video';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Header } from '@components/layout';
import { useVideoStore } from '@store/videoStore';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@utils/constants';
import { getRolePermissions } from '@utils/rbac';

export const UploadPage = () => {
  const navigate = useNavigate();
  const { videos } = useVideoStore();
  const { user } = useAuthStore();
  const [showSuccess, setShowSuccess] = useState(false);

  // Check permissions
  const permissions = user ? getRolePermissions(user.role) : null;

  // Redirect if user doesn't have upload permission (defense-in-depth)
  useEffect(() => {
    if (user && !permissions?.canUpload) {
      console.warn('Access denied: User does not have upload permission');
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [user, permissions, navigate]);

  // Get recent uploads (last 5)
  const recentUploads = videos.slice(0, 5);

  const handleUploadComplete = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      navigate(ROUTES.LIBRARY);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(ROUTES.DASHBOARD)}
          className="mb-6 flex items-center gap-2 hover:bg-slate-700/50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
            <p className="font-medium">Video uploaded successfully!</p>
            <p className="text-sm">Redirecting to your library...</p>
          </div>
        )}

      {/* Upload Section */}
      <div className="mb-8">
        <VideoUploader onUploadComplete={handleUploadComplete} />
      </div>

      {/* Recent Uploads */}
      {recentUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>Your last {recentUploads.length} uploaded videos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUploads.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`${ROUTES.VIDEOS}/${video.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {video.status === 'processing' && 'Processing...'}
                      {video.status === 'ready' && 'Ready to watch'}
                      {video.status === 'uploading' && 'Uploading...'}
                      {video.status === 'failed' && 'Upload failed'}
                    </p>
                  </div>
                  <div>
                    {video.status === 'processing' && (
                      <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded">
                        Processing
                      </span>
                    )}
                    {video.status === 'ready' && (
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
};
