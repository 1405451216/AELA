// AELA 可视化视频背景 — 全屏预览 + 播放控制
import { useState, useRef, useCallback } from 'react'
// @ts-ignore - Vite handles mp4 imports as URLs
import demoVideo from '../assets/demo-animation.mp4'

interface VideoPlayerProps {
  /** 视频源地址（外部覆盖） */
  src?: string
  /** 备用标题（视频无法显示时） */
  fallbackTitle?: string
  /** 是否默认静音 */
  defaultMuted?: boolean
}

export function VideoPlayer({
  src,
  fallbackTitle = '',
  defaultMuted = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(defaultMuted)
  const [showControls, setShowControls] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoError, setVideoError] = useState(false)

  const videoSrc = src || demoVideo

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play()
      setPlaying(true)
    } else {
      videoRef.current.pause()
      setPlaying(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setMuted(videoRef.current.muted)
  }, [])

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100
    setProgress(isNaN(pct) ? 0 : pct)
  }, [])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!videoRef.current) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = x / rect.width
      videoRef.current.currentTime = pct * videoRef.current.duration
    },
    []
  )

  const handleVideoError = useCallback(() => {
    setVideoError(true)
  }, [])

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden bg-black"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 视频层 */}
      {!videoError && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src={videoSrc}
          muted={muted}
          loop
          playsInline
          autoPlay
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
        />
      )}

      {/* 无视频 fallback */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
          <span className="text-6xl mb-4">🎬</span>
          <span className="text-lg font-medium opacity-80">{fallbackTitle || '演示视频'}</span>
        </div>
      )}

      {/* 顶部渐变遮罩 */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {/* 底部渐变遮罩 + 控制条 */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 底部渐变 */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

        {/* 进度条（可点击） */}
        <div
          className="absolute bottom-12 left-0 right-0 h-1.5 bg-white/20 cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-white/80 transition-all group-hover:h-2.5"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 控制按钮组 */}
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-between px-3">
          {/* 左侧：播放/暂停 */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white transition-colors bg-white/10 rounded-full hover:bg-white/20"
            title={playing ? '暂停' : '播放'}
          >
            {playing ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
                <rect x="3" y="3" width="3" height="8" rx="0.5" />
                <rect x="8" y="3" width="3" height="8" rx="0.5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 2v10l9-5-9-5z" />
              </svg>
            )}
          </button>

          {/* 右侧：静音/取消静音 */}
          <button
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white transition-colors bg-white/10 rounded-full hover:bg-white/20"
            title={muted ? '取消静音' : '静音'}
          >
            {muted ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 加载指示 */}
      {!videoError && progress === 0 && (
        <div className="absolute bottom-1 right-2 text-[9px] text-white/40">加载中...</div>
      )}
    </div>
  )
}
