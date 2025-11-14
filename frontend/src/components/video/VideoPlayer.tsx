import { useRef, useEffect, useState } from 'react';
import videojs from 'video.js';
import '@videojs/http-streaming'; // Enable HLS/DASH support
import 'video.js/dist/video-js.css';
import { Card } from '@components/ui/card';
import { Loader2 } from 'lucide-react';
import type Player from 'video.js/dist/types/player';

interface VideoPlayerProps {
  videoId: string;
  hlsUrl: string;
  fallbackMp4Url?: string;
  backendFallbackUrl?: string;
  poster?: string;
  autoplay?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  hlsUrl,
  fallbackMp4Url,
  backendFallbackUrl,
  poster,
  autoplay = false,
  onTimeUpdate,
  onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;

    // Use setTimeout to defer initialization to next tick (React StrictMode compatibility)
    const timer = setTimeout(() => {
      if (!videoRef.current) return;

      console.log('🎬 Initializing video.js player...');

      // Initialize Video.js player
      const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      aspectRatio: '16:9',
      autoplay: false, // Explicitly disable autoplay to avoid browser blocking
      preload: 'auto',
      poster,
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'remainingTimeDisplay',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Check if VHS plugin is loaded
    console.log('🔍 Checking VHS plugin...');
    console.log('video.js version:', videojs.VERSION);
    console.log('VHS available:', !!(videojs as any).Vhs);
    console.log('Tech:', player.tech_);

    // Detect video format and set appropriate source
    const isHLS = hlsUrl.includes('.m3u8');
    const isMp4 = hlsUrl.endsWith('.mp4') || hlsUrl.includes('.mp4?');

    if (isHLS) {
      // HLS streaming
      console.log('🎬 Loading HLS stream:', hlsUrl);
      console.log('🎬 Setting type: application/x-mpegURL');
      player.src({
        src: hlsUrl,
        type: 'application/x-mpegURL',
      });
    } else if (isMp4) {
      // Direct MP4 file
      player.src({
        src: hlsUrl,
        type: 'video/mp4',
      });
      console.log('Loading MP4 file:', hlsUrl);
    } else {
      // Fallback to direct URL (let browser determine type)
      player.src(hlsUrl);
      console.log('Loading video with auto-detection:', hlsUrl);
    }

    // Player events
    player.on('ready', () => {
      console.log('Player is ready');
      setIsReady(true);
      setIsLoading(false);
    });

    player.on('loadedmetadata', () => {
      console.log('✅ Metadata loaded');
      console.log('📹 Duration:', player.duration());
      console.log('📹 Current src:', player.currentSrc());
      console.log('📹 Ready state:', player.readyState());
      console.log('📹 Paused:', player.paused());
      console.log('📹 Video width:', player.videoWidth());
      console.log('📹 Video height:', player.videoHeight());

      // Try to play if not already playing
      if (player.paused()) {
        console.log('🎬 Video is paused, click play button to start');
      }
    });

    player.on('play', () => {
      console.log('Video playing');
    });

    player.on('pause', () => {
      console.log('Video paused');
    });

    player.on('timeupdate', () => {
      if (onTimeUpdate) {
        onTimeUpdate(player.currentTime() || 0);
      }
    });

    player.on('ended', () => {
      console.log('Video ended');
      if (onEnded) {
        onEnded();
      }
    });

    player.on('error', (error: any) => {
      const playerError = player.error();
      console.error('❌ Player error:', error);
      console.error('❌ Error code:', playerError?.code);
      console.error('❌ Error message:', playerError?.message);
      console.error('❌ Current source:', player.currentSrc());
      console.error('❌ Network state:', player.networkState());
      console.error('❌ Ready state:', player.readyState());
      setIsLoading(false);

      // If HLS fails (e.g., CDN 403 or content-type mismatch), fall back to MP4 if available
      const currentSrc: string = (player.currentSource() as any)?.src || '';
      const wasHls = currentSrc.includes('.m3u8');
      if (wasHls && fallbackMp4Url) {
        console.warn('HLS failed, falling back to MP4:', fallbackMp4Url);
        try {
          player.src({ src: fallbackMp4Url, type: 'video/mp4' });
          if (autoplay) {
            // Avoid unhandled promise rejection if browser blocks autoplay
            const p = player.play();
            if (p && typeof p.then === 'function') {
              p.catch(() => {});
            }
          }
        } catch (e) {
          console.error('MP4 fallback also failed:', e);
        }
      } else if (!wasHls && currentSrc.includes('.mp4') && backendFallbackUrl) {
        // MP4 failed as well; try backend direct streaming
        console.warn('MP4 failed, falling back to backend streaming:', backendFallbackUrl);
        try {
          // Let the browser/player detect type from response
          player.src({ src: backendFallbackUrl });
          if (autoplay) {
            const p = player.play();
            if (p && typeof p.then === 'function') {
              p.catch(() => {});
            }
          }
        } catch (e) {
          console.error('Backend streaming fallback also failed:', e);
        }
      }
    });

    player.on('waiting', () => {
      setIsLoading(true);
    });

    player.on('canplay', () => {
      setIsLoading(false);
    });
    }, 0); // End of setTimeout - defer to next tick

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [hlsUrl, fallbackMp4Url, backendFallbackUrl, poster, autoplay, onTimeUpdate, onEnded]);

  return (
    <div className="relative">
      <Card className="overflow-hidden bg-black" style={{ minHeight: '400px' }}>
        <div data-vjs-player style={{ width: '100%', minHeight: '400px' }}>
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered vjs-theme-fantasy"
            playsInline
            style={{ width: '100%', height: 'auto' }}
          />
        </div>

        {/* Loading Overlay */}
        {isLoading && !isReady && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        )}
      </Card>

      {/* Custom Styles */}
      <style>{`
        .vjs-theme-fantasy {
          --vjs-theme-fantasy--primary: hsl(var(--primary));
          --vjs-theme-fantasy--secondary: hsl(var(--secondary));
        }

        .video-js {
          width: 100% !important;
          border-radius: 0.5rem;
        }

        .video-js video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain;
        }

        .video-js .vjs-big-play-button {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          margin: 0;
          border-radius: 50%;
          width: 88px;
          height: 88px;
          border: 4px solid rgba(255, 255, 255, 0.9);
          background-color: rgba(0, 0, 0, 0.8);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .video-js .vjs-big-play-button .vjs-icon-placeholder:before {
          position: absolute;
          top: 70%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 40px;
        }

        .video-js .vjs-big-play-button:hover {
          background-color: rgba(59, 130, 246, 0.9);
          border-color: rgba(59, 130, 246, 1);
          transform: translate(-50%, -50%) scale(1.1);
        }

        .video-js .vjs-control-bar {
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
          height: 3.5rem;
          padding: 0 1rem;
        }

        .video-js .vjs-play-progress,
        .video-js .vjs-volume-level {
          background-color: rgb(59, 130, 246);
        }

        .video-js .vjs-progress-control .vjs-progress-holder {
          height: 6px;
          border-radius: 3px;
        }

        .video-js .vjs-slider {
          background-color: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }

        .video-js button {
          cursor: pointer;
        }

        .video-js .vjs-big-play-button:focus,
        .video-js button:focus {
          outline: 2px solid rgb(59, 130, 246);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
};
