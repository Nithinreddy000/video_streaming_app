import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, SortAsc, ArrowLeft } from 'lucide-react';
import { VideoGrid } from '@components/video';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { Header } from '@components/layout';
import { useVideoStore } from '@store/videoStore';
import { useAuthStore } from '@store/authStore';
import { useDebounce } from '@hooks/useDebounce';
import videoService from '@services/video.service';
import { ROUTES, VIDEO_CATEGORIES } from '@utils/constants';
import { getRolePermissions } from '@utils/rbac';

export const LibraryPage = () => {
  const navigate = useNavigate();
  const {
    videos,
    filters,
    pagination,
    isLoading,
    setVideos,
    setFilters,
    setPagination,
    setLoading,
    setError,
  } = useVideoStore();
  const { user } = useAuthStore();

  // Check permissions
  const permissions = user ? getRolePermissions(user.role) : null;

  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchInput, 500);

  // Fetch videos on mount and when filters change
  useEffect(() => {
    fetchVideos();
  }, [filters, pagination.page]);

  // Update search filter when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await videoService.getVideos({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });

      setVideos(response.videos);
      setPagination({
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      });
    } catch (error: any) {
      console.error('Failed to fetch videos:', error);
      setError(error.message || 'Failed to load videos');
    }
  };

  const handleVideoClick = (video: any) => {
    navigate(`${ROUTES.VIDEOS}/${video.id}`);
  };

  const handleCategoryFilter = (category: string) => {
    setFilters({
      category: filters.category === category ? undefined : category,
    });
  };

  const handleStatusFilter = (status: string) => {
    setFilters({
      status: filters.status === status ? undefined : (status as any),
    });
  };

  const handleAIStatusFilter = (classification: string) => {
    setFilters({
      classification: filters.classification === classification ? undefined : classification,
    });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setFilters({
      status: undefined,
      category: undefined,
      classification: undefined,
      search: undefined,
    });
  };

  const hasActiveFilters =
    filters.status || filters.category || filters.classification || filters.search;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(ROUTES.DASHBOARD)}
          className="mb-6 flex items-center gap-2 hover:bg-slate-700/50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Video Library</h1>
          <p className="text-muted-foreground">
            Browse and manage your video collection
          </p>
        </div>

      {/* Filters Bar */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters:
          </span>

          {/* Status Filters */}
          <Button
            variant={filters.status === 'ready' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusFilter('ready')}
          >
            Ready
          </Button>
          <Button
            variant={filters.status === 'processing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusFilter('processing')}
          >
            Processing
          </Button>

          {/* Divider */}
          <span className="text-muted-foreground">|</span>

          {/* AI Status Filters */}
          <Button
            variant={filters.classification === 'safe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAIStatusFilter('safe')}
            className={filters.classification === 'safe' ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            Safe
          </Button>
          <Button
            variant={filters.classification === 'flagged' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAIStatusFilter('flagged')}
            className={filters.classification === 'flagged' ? 'bg-red-500 hover:bg-red-600' : ''}
          >
            Flagged
          </Button>
          <Button
            variant={filters.classification === 'analyzing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAIStatusFilter('analyzing')}
            className={filters.classification === 'analyzing' ? 'bg-purple-500 hover:bg-purple-600' : ''}
          >
            Analyzing
          </Button>

          {/* Divider */}
          <span className="text-muted-foreground">|</span>

          {/* Category Filters */}
          {VIDEO_CATEGORIES.slice(0, 5).map((category) => (
            <Button
              key={category}
              variant={filters.category === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCategoryFilter(category)}
            >
              {category}
            </Button>
          ))}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Videos Grid */}
      <VideoGrid
        videos={videos}
        isLoading={isLoading}
        onVideoClick={handleVideoClick}
        emptyMessage={
          hasActiveFilters
            ? 'No videos match your filters. Try adjusting your search.'
            : permissions?.canUpload
            ? 'No videos yet. Upload your first video to get started!'
            : 'No videos available to watch yet.'
        }
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPagination({ page: pagination.page - 1 })}
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPagination({ page: pagination.page + 1 })}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
      </div>
    </div>
  );
};
