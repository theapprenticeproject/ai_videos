'use client';

import { useEffect, useState } from 'react';
import { Play, Download, ArrowLeft, Video, Film, Sparkles } from 'lucide-react';

export default function GalleryPage() {
    const [videos, setVideos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/videos')
            .then(res => res.json())
            .then(data => {
                setVideos(data.videos || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch videos', err);
                setLoading(false);
            });
    }, []);

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
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Film className="w-8 h-8 text-blue-600" />
                            Video Gallery
                        </h1>
                        <p className="text-gray-500 mt-1">Browse your generated videos</p>
                    </div>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Creator</span>
                    </button>
                </div>

                {/* Gallery Grid */}
                {videos.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Video className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No videos yet</h3>
                        <p className="text-gray-500 mt-2 mb-6">Create your first video to see it here</p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Fast Forward Video Generation
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((video, index) => (
                            <div key={index} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 group flex flex-col">
                                <div className="aspect-video relative bg-gray-100">
                                    <video
                                        controls
                                        preload="metadata"
                                        className="w-full h-full object-contain"
                                    >
                                        <source src={video.gcsUrl || `/${video.filename}`} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>

                                <div className="p-4 flex flex-col flex-1">
                                    <div className="flex items-start justify-between gap-2 overflow-hidden">
                                        <p className="text-[10px] font-mono text-gray-400 truncate flex-1" title={video.filename}>
                                            {video.filename}
                                        </p>
                                    </div>

                                    {video.prompt && (
                                        <div className="mt-3">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Original Prompt</p>
                                            <p className="text-xs text-gray-600 italic line-clamp-3 mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                                                "{video.prompt}"
                                            </p>
                                        </div>
                                    )}

                                    {video.chunks && video.chunks.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Sparkles className="w-3 h-3 text-blue-400" />
                                                Script Segments
                                            </p>
                                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                                {video.chunks.map((chunk: any, i: number) => (
                                                    <div key={i} className="text-[10px] text-gray-500 bg-blue-50/50 p-1.5 rounded border border-blue-100/30 leading-relaxed">
                                                        <span className="font-bold text-blue-400 mr-1">#{i + 1}</span>
                                                        {chunk.chunkText || chunk.chunk}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 flex justify-end">
                                        <a
                                            href={video.gcsUrl || `/${video.filename}`}
                                            download={!video.gcsUrl}
                                            target={video.gcsUrl ? "_blank" : undefined}
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>Download</span>
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
