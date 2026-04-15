'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import toast from 'react-hot-toast';
import { Play, Download, ArrowLeft, Video, Film, Sparkles, Search, Copy, Save } from 'lucide-react';

type GalleryVideo = {
  id: string;
  filename: string;
  gcsUrl?: string | null;
  prompt?: string;
  script?: string;
  chunks?: Array<{ chunkText?: string; chunk?: string }>;
  createdAt?: number;
  userId?: string;
  title?: string;
  description?: string;
  modelName?: string;
};

export default function GalleryPage() {
  const { user, isLoaded } = useUser();
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    let resolvedUserId = user?.id || '';
    if (!resolvedUserId && typeof window !== 'undefined') {
      resolvedUserId = localStorage.getItem('anonymous_user_id') || '';
      if (!resolvedUserId) {
        resolvedUserId = `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        localStorage.setItem('anonymous_user_id', resolvedUserId);
      }
    }
    setUserId(resolvedUserId);
  }, [isLoaded, user?.id]);

  useEffect(() => {
    if (!isLoaded) return;

    const query = new URLSearchParams();
    if (activeSearch) query.set('search', activeSearch);
    if (onlyMine) query.set('onlyMine', 'true');
    if (userId) query.set('userId', userId);

    setLoading(true);
    fetch(`/api/videos${query.toString() ? `?${query.toString()}` : ''}`)
      .then(res => res.json())
      .then(data => {
        setVideos(Array.isArray(data.videos) ? data.videos : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch videos', err);
        toast.error('Failed to load gallery');
        setLoading(false);
      });
  }, [activeSearch, isLoaded, onlyMine, userId]);

  const handleSave = async (video: GalleryVideo) => {
    if (!video.id) {
      toast.error('This video cannot be edited yet.');
      return;
    }

    setSavingId(video.id);
    try {
      const response = await fetch('/api/videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: video.id,
          filename: video.filename,
          gcsUrl: video.gcsUrl || '',
          title: video.title || '',
          description: video.description || '',
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || response.statusText);
      }

      const data = await response.json();
      setVideos(prev => prev.map(item => item.id === video.id ? data.video : item));
      toast.success('Video details updated');
    } catch (error: any) {
      toast.error(error.message || 'Unable to save video details');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <Film className="w-8 h-8 text-blue-600" />
                Video Gallery
              </h1>
              <p className="text-gray-500 mt-1">Search, filter, copy scripts, and edit video details</p>
            </div>

            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Creator</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3">
            <div className="flex-1 flex gap-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveSearch(searchInput.trim());
                  }
                }}
                placeholder="Search by video name, prompt, script, description, or model"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setActiveSearch(searchInput.trim())}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
            <label className="inline-flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show only my videos
            </label>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No videos found</h3>
            <p className="text-gray-500 mt-2 mb-6">Try a different search or create a new video</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fast Forward Video Generation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map((video) => (
              <div key={video.id || video.filename} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 group flex flex-col">
                <div className="aspect-video relative bg-gray-100">
                  <video controls preload="metadata" className="w-full h-full object-contain">
                    <source src={video.gcsUrl || `/${video.filename}`} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>

                <div className="p-4 flex flex-col flex-1 gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Video Name</p>
                      <input
                        value={video.title || ''}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setVideos(prev => prev.map(item => item.id === video.id ? { ...item, title: nextValue } : item));
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</p>
                      <input
                        value={video.description || ''}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setVideos(prev => prev.map(item => item.id === video.id ? { ...item, description: nextValue } : item));
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <p className="text-[10px] font-mono text-gray-400 truncate flex-1" title={video.filename}>
                      {video.filename}
                    </p>
                    {video.modelName && (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                        {video.modelName}
                      </span>
                    )}
                  </div>

                  {video.prompt && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Original Prompt</p>
                      <p className="text-xs text-gray-600 italic line-clamp-3 mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                        "{video.prompt}"
                      </p>
                    </div>
                  )}

                  {video.script && (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-400" />
                          Voiceover Script
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(video.script || '');
                              toast.success('Script copied');
                            } catch (error) {
                              toast.error('Unable to copy script');
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Script
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-5 bg-gray-50 p-3 rounded border border-gray-100 whitespace-pre-wrap">
                        {video.script}
                      </p>
                    </div>
                  )}

                  {video.chunks && video.chunks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        Script Segments
                      </p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {video.chunks.map((chunk, i) => (
                          <div key={i} className="text-[10px] text-gray-500 bg-blue-50/50 p-1.5 rounded border border-blue-100/30 leading-relaxed">
                            <span className="font-bold text-blue-400 mr-1">#{i + 1}</span>
                            {chunk.chunkText || chunk.chunk}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSave(video)}
                      disabled={savingId === video.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingId === video.id ? 'Saving...' : 'Save Details'}
                    </button>
                    <a
                      href={video.gcsUrl || `/${video.filename}`}
                      download={!video.gcsUrl}
                      target={video.gcsUrl ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-2 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <a
                      href={video.gcsUrl || `/${video.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-2 rounded-full hover:bg-purple-100 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
