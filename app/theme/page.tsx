'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import ExportMenu from '@/components/ExportMenu';

interface ThemeAnalysis {
    overview: string;
    themes: {
        name: string;
        description: string;
        sentiment: 'positive' | 'neutral' | 'negative';
        postCount: number;
    }[];
    topDiscussions: string[];
    keywords?: {
        word: string;
        importance: number;
        category: 'technical' | 'community' | 'content' | 'general';
    }[];
}

export default function ThemePage() {
    const { settings, progress, setProgress, clearProgress } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<ThemeAnalysis | null>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [subreddit, setSubreddit] = useState('');
    const [timeRange, setTimeRange] = useState('');
    const [analyzeImages, setAnalyzeImages] = useState(false);
    const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        const paramsStr = sessionStorage.getItem('themeParams');
        if (!paramsStr) {
            window.location.href = '/';
            return;
        }

        const { subreddit, time, analyzeImages } = JSON.parse(paramsStr);
        setSubreddit(subreddit);
        setTimeRange(time);
        setAnalyzeImages(analyzeImages);

        // Wait for key
        if (!settings.openaiKey) {
            setLoading(false);
            return;
        }

        const runAnalysis = async () => {
            setLoading(true);
            setError(null);
            setProgress(10, `Fetching top posts from r/${subreddit}...`);

            try {
                // Simulate progress for better UX since the API is single-shot
                let currentProgress = 10;
                const progressInterval = setInterval(() => {
                    if (currentProgress < 40) {
                        currentProgress += 5;
                        setProgress(currentProgress, 'Fetching top posts...');
                    }
                }, 500);

                const response = await fetch('/api/analyze-theme', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subreddit,
                        time,
                        analyzeImages,
                        apiKey: settings.openaiKey
                    })
                });

                clearInterval(progressInterval);
                setProgress(50, 'Analyzing themes and sentiment...');

                // Simulate analysis progress
                let analysisProgress = 50;
                const analysisInterval = setInterval(() => {
                    if (analysisProgress < 90) {
                        analysisProgress += 2;
                        setProgress(analysisProgress, 'Analyzing themes and sentiment...');
                    }
                }, 300);

                if (!response.ok) {
                    clearInterval(analysisInterval);
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to analyze theme');
                }

                const data = await response.json();

                clearInterval(analysisInterval);
                setProgress(100, 'Complete!');

                setAnalysis(data.analysis);
                setPosts(data.posts);

                setTimeout(() => clearProgress(), 1000);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        runAnalysis();
    }, [settings.openaiKey]);

    if (!hydrated) return null; // Prevent flash of content

    if (!settings.openaiKey) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="text-center max-w-md p-8 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="text-4xl mb-4">🔑</div>
                    <h2 className="text-xl font-bold mb-2">API Key Required</h2>
                    <p className="text-zinc-400 mb-6">
                        To analyze themes with AI, you need to provide your OpenAI API key.
                    </p>
                    <button
                        onClick={() => document.querySelector<HTMLButtonElement>('button[aria-label="Settings"]')?.click() || alert('Please open settings via the gear icon on the home page.')}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                    >
                        Enter API Key
                    </button>
                    <p className="text-xs text-zinc-500 mt-4">
                        Your key is stored locally in your browser.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="text-center max-w-md w-full px-4">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold mb-2">Analyzing r/{subreddit}...</h2>
                    <p className="text-zinc-400 mb-4">{progress.phase || 'Starting analysis...'}</p>

                    {progress.percent >= 0 && (
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${Math.max(progress.percent, 5)}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="text-center max-w-md p-6 bg-zinc-900 rounded-xl border border-red-900/50">
                    <div className="text-4xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-red-400 mb-2">Analysis Failed</h2>
                    <p className="text-zinc-300 mb-6">{error}</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur print:hidden">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                Readit
                            </h1>
                            <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
                                <span>Analysis for:</span>
                                <span className="text-zinc-200 font-medium bg-zinc-800 px-2 py-0.5 rounded">r/{subreddit}</span>
                                <span>•</span>
                                <span className="text-zinc-200 font-medium bg-zinc-800 px-2 py-0.5 rounded capitalize">{timeRange}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <ExportMenu
                                posts={posts}
                                summary={analysis ? {
                                    narrative: analysis.overview,
                                    bulletPoints: analysis.topDiscussions,
                                    citations: []
                                } : null}
                                searchQuery={`r/${subreddit} (${timeRange})`}
                            />
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all"
                            >
                                New Search
                            </button>
                        </div>
                    </div>

                    {/* Methodology / Data Source Info */}
                    <div className="flex items-center gap-4 text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50 inline-flex">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>Deep Analysis Active</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-800"></div>
                        <div>
                            Analyzed <span className="text-zinc-300 font-medium">{posts.length} Top Posts</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-800"></div>
                        <div>
                            Includes <span className="text-zinc-300 font-medium">Titles, Body Text{analyzeImages ? ', Images' : ''} & Top 3 Comments</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 print:hidden">
                <div className="max-w-5xl mx-auto space-y-8">
                    {/* Overview */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                        <h2 className="text-2xl font-bold mb-4">Community Overview</h2>
                        <p className="text-lg text-zinc-300 leading-relaxed">
                            {analysis?.overview}
                        </p>
                    </div>

                    {/* Keyword Cloud */}
                    {analysis?.keywords && analysis.keywords.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                            <h2 className="text-2xl font-bold mb-6">Key Concepts</h2>
                            <div className="flex flex-wrap gap-3 justify-center">
                                {analysis.keywords
                                    .sort((a, b) => b.importance - a.importance)
                                    .map((keyword, idx) => {
                                        // Calculate size based on importance (1-10)
                                        const sizeClass = keyword.importance >= 8 ? 'text-3xl' :
                                            keyword.importance >= 6 ? 'text-2xl' :
                                                keyword.importance >= 4 ? 'text-xl' :
                                                    'text-lg';

                                        // Color based on category
                                        const colorClass = keyword.category === 'technical' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                            keyword.category === 'community' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' :
                                                keyword.category === 'content' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                                    'text-zinc-400 border-zinc-500/30 bg-zinc-500/10';

                                        return (
                                            <div
                                                key={idx}
                                                className={`${sizeClass} ${colorClass} px-4 py-2 rounded-lg border font-medium transition-all hover:scale-110 hover:shadow-lg cursor-default`}
                                                title={`Category: ${keyword.category} | Importance: ${keyword.importance}/10`}
                                            >
                                                {keyword.word}
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30"></div>
                                    <span>Technical</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30"></div>
                                    <span>Community</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></div>
                                    <span>Content</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-zinc-500/20 border border-zinc-500/30"></div>
                                    <span>General</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Themes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {analysis?.themes.map((theme, idx) => (
                            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-xl font-bold text-zinc-100">{theme.name}</h3>
                                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${theme.sentiment === 'positive' ? 'bg-green-900/30 text-green-400' :
                                        theme.sentiment === 'negative' ? 'bg-red-900/30 text-red-400' :
                                            'bg-zinc-800 text-zinc-400'
                                        }`}>
                                        {theme.sentiment}
                                    </span>
                                </div>
                                <p className="text-zinc-400 mb-4 text-sm max-h-32 overflow-y-auto custom-scrollbar flex-grow">
                                    {theme.description}
                                </p>
                                <div className="mt-auto">
                                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                        <span>Prevalence</span>
                                        <span>{theme.postCount} posts</span>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${theme.sentiment === 'positive' ? 'bg-green-500' :
                                                theme.sentiment === 'negative' ? 'bg-red-500' :
                                                    'bg-zinc-500'
                                                }`}
                                            style={{ width: `${Math.min((theme.postCount / 10) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Top Discussions */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                        <h2 className="text-xl font-bold mb-6">Top Discussions</h2>
                        <ul className="space-y-4">
                            {analysis?.topDiscussions.map((discussion, idx) => (
                                <li key={idx} className="flex gap-4 items-start">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm font-bold">
                                        {idx + 1}
                                    </span>
                                    <span className="text-zinc-300">{discussion}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Top Posts Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-800">
                            <h2 className="text-xl font-bold">Top Posts</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-zinc-950/50 text-zinc-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Score</th>
                                        <th className="px-6 py-3 font-medium">Date</th>
                                        <th className="px-6 py-3 font-medium">Title</th>
                                        <th className="px-6 py-3 font-medium">Author</th>
                                        <th className="px-6 py-3 font-medium">Link</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {posts.slice(0, 10).map((post: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-zinc-300">
                                                {post.score === 0 && post.author === 'unknown' ? (
                                                    <span className="text-zinc-600 text-xs">N/A</span>
                                                ) : (
                                                    post.score
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                                                {new Date(post.createdUtc * 1000).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-200 font-medium">
                                                <div className="flex items-start gap-2">
                                                    <span>{post.title}</span>
                                                    {post.imageDescription && (
                                                        <div
                                                            className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500/20 text-blue-400 cursor-help"
                                                            onMouseEnter={(e) => {
                                                                setHoveredPostId(post.permalink);
                                                                setMousePos({ x: e.clientX, y: e.clientY });
                                                            }}
                                                            onMouseLeave={() => setHoveredPostId(null)}
                                                            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    {post.author === 'unknown' && (
                                                        <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700 whitespace-nowrap">
                                                            External Source
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {post.author === 'unknown' ? (
                                                    <span className="text-zinc-600 italic">Unknown</span>
                                                ) : (
                                                    `u/${post.author}`
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <a
                                                    href={post.permalink.replace('old.reddit.com', 'www.reddit.com')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300"
                                                >
                                                    View
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            {/* Fixed Tooltip Overlay */}
            {
                hoveredPostId && (
                    <div
                        className="fixed z-[100] w-80 p-4 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl shadow-2xl text-sm text-zinc-300 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                        style={{
                            top: Math.min(mousePos.y + 20, window.innerHeight - 300), // Prevent going off bottom
                            left: Math.min(mousePos.x - 160, window.innerWidth - 340) // Keep centered but on screen
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-bold text-blue-400">AI Image Analysis</span>
                        </div>
                        <p className="leading-relaxed">
                            {posts.find(p => p.permalink === hoveredPostId)?.imageDescription}
                        </p>
                    </div>
                )
            }

            {/* Print View - Hidden normally, visible when printing */}
            <div className="hidden print:block p-8 bg-white text-black absolute top-0 left-0 w-full min-h-screen z-50">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Readit Theme Report</h1>
                    <p className="text-xl text-gray-600">Subreddit: r/{subreddit} ({timeRange})</p>
                    <p className="text-sm text-gray-500 mt-2">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {analysis && (
                    <>
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Community Overview</h2>
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap mb-6">{analysis.overview}</p>
                        </div>

                        {analysis.keywords && analysis.keywords.length > 0 && (
                            <div className="mb-8 break-inside-avoid">
                                <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Key Concepts</h2>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywords
                                        .sort((a, b) => b.importance - a.importance)
                                        .map((keyword, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1 rounded border border-gray-300 text-gray-700 bg-gray-50 print:bg-gray-50 print:text-black print-color-adjust-exact"
                                            >
                                                {keyword.word} <span className="text-gray-400 text-xs">({keyword.category})</span>
                                            </span>
                                        ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Themes</h2>
                            <div className="grid grid-cols-2 gap-6">
                                {analysis.themes.map((theme, idx) => (
                                    <div key={idx} className="break-inside-avoid border border-gray-200 rounded p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-bold">{theme.name}</h3>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${theme.sentiment === 'positive' ? 'text-green-700 bg-green-100 print:bg-green-100' :
                                                theme.sentiment === 'negative' ? 'text-red-700 bg-red-100 print:bg-red-100' :
                                                    'text-gray-700 bg-gray-100 print:bg-gray-100'
                                                } print-color-adjust-exact`}>
                                                {theme.sentiment}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-sm mb-3">{theme.description}</p>
                                        <div className="text-xs text-gray-500">
                                            Prevalence: {theme.postCount} posts
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mb-8 break-inside-avoid">
                            <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Top Discussions</h2>
                            <ul className="space-y-2">
                                {analysis.topDiscussions.map((discussion, idx) => (
                                    <li key={idx} className="flex gap-2">
                                        <span className="font-bold text-blue-600">{idx + 1}.</span>
                                        <span className="text-gray-800">{discussion}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {posts.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Top Posts</h2>
                        <div className="space-y-4">
                            {posts.slice(0, 10).map((post: any, idx: number) => (
                                <div key={idx} className="break-inside-avoid border-b border-gray-200 pb-4 mb-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-medium text-blue-800 mb-1">
                                                {idx + 1}. {post.title}
                                            </h3>
                                            {post.imageDescription && (
                                                <div className="text-xs text-gray-600 italic mb-1 bg-gray-100 p-2 rounded border border-gray-200">
                                                    <strong>AI Image Analysis:</strong> {post.imageDescription}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500 mb-2">
                                        Score: {post.score} • Author: u/{post.author} • {new Date(post.createdUtc * 1000).toLocaleDateString()}
                                    </div>
                                    <a href={post.permalink.replace('old.reddit.com', 'www.reddit.com')} className="text-xs text-gray-400 underline">
                                        View on Reddit
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
