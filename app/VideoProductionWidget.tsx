'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Loader2, Minimize2, Maximize2, X, Play, Video, Pause, PlayCircle, StopCircle } from 'lucide-react';
import Link from 'next/link';

const getVideoHref = (url: string) => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `http:${url}`;
  return url.startsWith('/') ? url : `/${url}`;
};

export default function VideoProductionWidget() {
  const { user, isLoaded } = useUser();
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Poll for job updates
  const fetchJobs = useCallback(async () => {
    if (!isLoaded) return;
    
    // Determine the user's ID
    const userId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('anonymous_user_id') : null);
    
    // If no userId and not signed in, we can't fetch. Just return.
    if (!userId) {
      // Create an anonymous ID to track local session jobs without auth
      if (typeof window !== 'undefined' && !user?.id) {
        const newAnonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        localStorage.setItem('anonymous_user_id', newAnonId);
      }
      return;
    }

    try {
      const res = await fetch(`/api/queue?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const hidden = JSON.parse(localStorage.getItem('hidden_video_jobs') || '[]');
        
        const activeOrRecent = data.jobs?.filter((job: any) => {
          if (hidden.includes(job.jobId)) return false;
          
          // Keep active jobs (including paused), or jobs that finished recently (within last 24h)
          if (job.status === 'running' || job.status === 'pending' || job.status === 'paused') return true;
          // Keep completed/failed jobs visible if they finished less than 24h ago
          const oneDay = 24 * 60 * 60 * 1000;
          return job.finishedAt && (Date.now() - job.finishedAt < oneDay);
        }) || [];
        
        setActiveJobs(activeOrRecent);
        
        // Show widget if there's at least one active job
        setIsVisible(activeOrRecent.length > 0);
      }
    } catch (e) {
      console.error("Failed to poll active jobs", e);
    }
  }, [user?.id, isLoaded]);

  // Initial fetch and set interval
  useEffect(() => {
    fetchJobs();
    
    // Poll every 3 seconds
    const interval = setInterval(fetchJobs, 3000);
    
    // Listen for custom event from the creation form to trigger an immediate fetch
    const handleJobStarted = () => fetchJobs();
    window.addEventListener('video-job-started', handleJobStarted);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('video-job-started', handleJobStarted);
    };
  }, [fetchJobs]);

  const hideJob = (jobId: string) => {
    const hidden = JSON.parse(localStorage.getItem('hidden_video_jobs') || '[]');
    if (!hidden.includes(jobId)) {
      hidden.push(jobId);
      localStorage.setItem('hidden_video_jobs', JSON.stringify(hidden));
    }
    
    setActiveJobs(prev => prev.filter(j => j.jobId !== jobId));
    if (activeJobs.length <= 1) {
      setIsVisible(false);
    }
  };

  const handleAction = async (jobId: string, action: 'pause' | 'resume' | 'abort') => {
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action }),
      });
      if (res.ok) {
        fetchJobs(); // Refresh immediately
      }
    } catch (e) {
      console.error(`Failed to ${action} job`, e);
    }
  };

  if (!isLoaded || !isVisible || activeJobs.length === 0) return null;

  const runningCount = activeJobs.filter(j => j.status === 'running' || j.status === 'pending').length;
  const isAllDone = runningCount === 0;

  if (!isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 bg-white/80 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 p-2.5 pr-5 flex items-center gap-3 rounded-full cursor-pointer hover:bg-white/90 hover:scale-105 hover:shadow-[0_8px_30px_rgba(59,130,246,0.3)] transition-all duration-300 z-50 animate-in fade-in slide-in-from-bottom-6 group"
      >
        <div className="relative">
          {isAllDone ? (
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30">
              <Video className="w-5 h-5" />
            </div>
          ) : (
            <>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:rotate-12 transition-transform duration-300">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 border-2 border-white"></span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            {isAllDone ? "Production Complete" : "Studio Active"}
          </span>
          <span className="text-[10px] font-medium text-gray-500">
            {isAllDone ? "All videos ready!" : `${runningCount} video${runningCount > 1 ? 's' : ''} rendering...`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-white/80 backdrop-blur-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)] border border-white/60 rounded-3xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between text-white shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="font-bold flex items-center gap-2.5 relative z-10 tracking-wide text-sm">
          <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center backdrop-blur-md">
            <Loader2 className={`w-4 h-4 text-white ${!isAllDone && 'animate-spin'}`} />
          </div>
          Production Queue
        </div>
        <div className="flex gap-1 relative z-10">
          <button onClick={() => setIsExpanded(false)} className="p-1.5 bg-white/10 hover:bg-white/25 rounded-xl transition duration-200">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {activeJobs.map(job => {
          const isReviewPlan = job.params?.type === 'review_plan' || job.params?.type === 'preview_batch';
          const isVisualReview = (Boolean(job.params?.preferences?.reviewPrompts) && !Boolean(job.params?.preferences?.reviewChunks)) || job.params?.type === 'preview_batch';
          const isPromptsOnly = job.params?.preferences?.visualReviewMode === 'prompts_only';
          const reviewItems = Array.isArray(job.reviewDataReady?.items) ? job.reviewDataReady.items : [];
          const visualsReady = !isVisualReview || isPromptsOnly || (reviewItems.length > 0 && reviewItems.every((item: any) => Boolean(item.previewUrl || item.mediaPath)));

          return (
          <div key={job.jobId} className="bg-white/60 backdrop-blur-md border border-gray-100 shadow-sm rounded-2xl p-4 relative group hover:bg-white/90 hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-semibold text-gray-800 line-clamp-2 pr-8 leading-snug">
                {job.params?.prompt ? `"${job.params.prompt}"` : `Video Project ${job.jobId.slice(0, 6)}`}
              </div>
              {(job.status === 'done' || job.status === 'failed') && (
                <button 
                  onClick={(e) => { e.stopPropagation(); hideJob(job.jobId); }}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 p-1.5 rounded-full hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {job.status === 'done' ? (
              <div className="space-y-3 mt-1">
                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 inline-block px-2.5 py-1 rounded-md uppercase tracking-wider">
                  ✓ Ready for you
                </div>
                <div className="flex gap-2.5 mt-2">
                  {isReviewPlan ? (
                    visualsReady ? (
                    <button 
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-review-mode', { detail: { job } }));
                        setIsExpanded(false);
                      }}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all duration-300"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Open Review
                    </button>
                    ) : (
                      <div className="flex-1 bg-amber-50 text-amber-700 text-xs font-semibold py-2.5 px-3 rounded-xl border border-amber-100 text-center">
                        Generating image previews...
                      </div>
                    )
                  ) : (
                    <a href={getVideoHref(job.videoUrl)} target="_blank" rel="noreferrer" className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-300">
                      <Play className="w-3.5 h-3.5 fill-current" /> Play Video
                    </a>
                  )}
                  <Link href="/gallery" className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center hover:bg-gray-50 hover:shadow-sm transition-all duration-300">
                    Gallery
                  </Link>
                </div>
              </div>
            ) : job.status === 'failed' ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-100 inline-block px-2.5 py-1.5 rounded-lg w-full">
                  <span className="font-bold flex items-center gap-1 mb-0.5"><X className="w-3 h-3"/> Generation Failed</span>
                  <span className="opacity-90 leading-tight">{job.error || 'An unexpected error occurred.'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-500">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                    {job.status === 'paused' ? 'Paused' : (job.statusMessage || "Processing...")}
                  </span>
                  <span className="text-blue-600">{Math.round(job.progress || 0)}%</span>
                </div>
                
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner border border-gray-200/50">
                  <div 
                    className={`h-full bg-gradient-to-r ${job.status === 'paused' ? 'from-amber-400 to-orange-500' : 'from-blue-500 to-indigo-500'} rounded-full transition-all duration-500 ease-out relative`}
                    style={{ width: `${Math.max(5, Math.min(100, job.progress || 0))}%` }}
                  >
                    {job.status !== 'paused' && <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>}
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  {job.status === 'paused' ? (
                    <button 
                      onClick={() => handleAction(job.jobId, 'resume')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                    >
                      <PlayCircle className="w-3 h-3" /> Resume
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAction(job.jobId, 'pause')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-colors"
                    >
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  )}
                  <button 
                    onClick={() => handleAction(job.jobId, 'abort')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors"
                  >
                    <StopCircle className="w-3 h-3" /> Stop
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
