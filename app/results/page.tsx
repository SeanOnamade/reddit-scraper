'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { RedditPost } from '@/lib/scraper';
import ExportMenu from '@/components/ExportMenu';
import {
    calculateSentimentDistribution,
    calculateActivityTimeline,
    calculateSubredditBreakdown
} from '@/lib/analytics';

interface Citation {
    postId: string;
    permalink: string;
    quote: string;
}

interface Summary {
    narrative: string;
    bulletPoints: string[];
    citations: Citation[];
}

export default function ResultsPage() {
    const { settings, progress, setProgress, clearProgress, setError } = useAppStore();
    const [posts, setPosts] = useState<RedditPost[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'summary' | 'analytics' | 'sources'>('summary');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchMetadata, setSearchMetadata] = useState<{
        resultCount: number;
        searchTime: number;
        subreddits: string[];
    } | null>(null);
    const [error, setErrorState] = useState<string | null>(null);
    const [filteredSubreddit, setFilteredSubreddit] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const hasRunSearch = useRef(false);
    const [hydrated, setHydrated] = useState(false);

    // Wait for client-side hydration
    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        const searchParams = sessionStorage.getItem('searchParams');
        if (!searchParams) {
            window.location.href = '/';
            return;
        }

        const { topic, keywords, subreddits, maxPosts, analyzeImages, strictSearch, dateRange, customStartDate, customEndDate, sortBy, maxResults } = JSON.parse(searchParams);
        setSearchQuery(topic);

        const runSearch = async () => {
            // Prevent double execution in React StrictMode
            if (hasRunSearch.current) return;
            hasRunSearch.current = true;

            const startTime = Date.now();
            try {
                setProgress(10, 'Searching Reddit via Google...');

                const scrapePromise = new Promise<RedditPost[]>((resolve, reject) => {
                    fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            keywords: keywords || [topic],
                            subreddits,
                            strictSearch,
                            maxPosts: settings.resultCount || 10,
                            analyzeImages,
                            apiKey: settings.openaiKey,
                            // Advanced filters
                            dateRange,
                            customStartDate,
                            customEndDate,
                            sortBy,
                            maxResults: maxResults || 10,
                        }),
                    }).then(async (response) => {
                        const reader = response.body?.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let collectedPosts: RedditPost[] = [];

                        while (reader) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    const data = JSON.parse(line.slice(6));

                                    if (data.type === 'complete') {
                                        collectedPosts = data.posts;
                                    } else if (data.type === 'error') {
                                        reject(new Error(data.error));
                                    }
                                }
                            }
                        }

                        resolve(collectedPosts);
                    });
                });

                const scrapedPosts = await scrapePromise;
                setPosts(scrapedPosts);
                setProgress(50, `Found ${scrapedPosts.length} posts`);

                // Calculate metadata
                const searchTime = Date.now() - startTime;
                const foundSubreddits = [...new Set(scrapedPosts.map(p => p.subreddit))];
                setSearchMetadata({
                    resultCount: scrapedPosts.length,
                    searchTime: Math.round(searchTime / 1000),
                    subreddits: foundSubreddits,
                });

                setProgress(60, 'Generating summary...');

                const summaryResponse = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        posts: scrapedPosts,
                        apiKey: settings.openaiKey,
                        topic: topic,
                    }),
                });

                if (!summaryResponse.ok) throw new Error('Failed to generate summary');

                const summaryData = await summaryResponse.json();
                setSummary(summaryData);
                setProgress(100, 'Complete!');

                setTimeout(() => clearProgress(), 2000);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Search failed';
                setError(errorMsg);
                setErrorState(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        runSearch();
    }, [hydrated, settings.openaiKey]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100">
                <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                Readit
                            </h1>
                            {searchQuery && (
                                <p className="text-sm text-zinc-400 mt-1">
                                    Searching: <span className="text-zinc-300">{searchQuery}</span>
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('searchParams');
                                window.location.href = '/';
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all"
                        >
                            New Search
                        </button>
                    </div>
                </header>
                <main className="container mx-auto px-4 py-12">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="mb-8">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-xl text-zinc-400">{progress.phase || 'Loading...'}</p>
                            {progress.percent > 0 && (
                                <div className="mt-4 w-full bg-zinc-800 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress.percent}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">


            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur print:hidden">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Readit
                        </h1>
                        {searchQuery && (
                            <p className="text-sm text-zinc-400 mt-1">
                                Searching: <span className="text-zinc-300">{searchQuery}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <ExportMenu posts={posts} summary={summary} searchQuery={searchQuery} />
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('searchParams');
                                window.location.href = '/';
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all"
                        >
                            New Search
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 print:hidden">
                <div className="max-w-6xl mx-auto">
                    {/* Error State */}
                    {error && (
                        <div className="mb-6 bg-red-900/20 border border-red-800 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <span className="text-red-400 text-xl">⚠️</span>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-400 mb-1">Search Error</h3>
                                    <p className="text-zinc-300 text-sm">{error}</p>
                                    <p className="text-zinc-400 text-xs mt-2">Try checking your API keys in Settings or using a different search query.</p>
                                </div>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Search Metadata */}
                    {searchMetadata && (
                        <div className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-400">
                            <div className="flex items-center gap-2">
                                <span>{searchMetadata.resultCount} results</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>{searchMetadata.searchTime}s</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>{searchMetadata.subreddits.length} subreddits</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 mb-8 border-b border-zinc-800">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'summary'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                        >
                            Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'analytics'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                        >
                            Analytics
                        </button>
                        <button
                            onClick={() => setActiveTab('sources')}
                            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'sources'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                        >
                            Sources ({posts.length})
                        </button>
                    </div>

                    {activeTab === 'summary' && summary && (
                        <div className="space-y-8">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold">Summary</h2>
                                    <button
                                        onClick={() => {
                                            const text = [
                                                summary.narrative,
                                                '\nKey Insights:',
                                                ...summary.bulletPoints.map(p => `• ${p}`),
                                                '\nCitations:',
                                                ...summary.citations.map(c => `"${c.quote}" - ${c.permalink}`)
                                            ].join('\n');
                                            navigator.clipboard.writeText(text);
                                            const btn = document.getElementById('copy-btn');
                                            if (btn) {
                                                const originalText = btn.innerText;
                                                btn.innerText = 'Copied!';
                                                setTimeout(() => btn.innerText = originalText, 2000);
                                            }
                                        }}
                                        id="copy-btn"
                                        className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy
                                    </button>
                                </div>
                                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{summary.narrative}</p>
                            </div>

                            {summary.bulletPoints.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h2 className="text-2xl font-bold mb-4">Key Insights</h2>
                                    <ul className="space-y-3">
                                        {summary.bulletPoints.map((point, idx) => (
                                            <li key={idx} className="flex gap-3">
                                                <span className="text-blue-400 mt-1">•</span>
                                                <span className="text-zinc-300">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {summary.citations.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h2 className="text-2xl font-bold mb-4">Citations</h2>
                                    <div className="space-y-3">
                                        {summary.citations.map((citation, idx) => (
                                            <div key={idx} className="border-l-2 border-zinc-700 pl-4">
                                                <p className="text-zinc-400 text-sm mb-1">"{citation.quote}"</p>
                                                <a
                                                    href={citation.permalink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 text-sm"
                                                >
                                                    View source →
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'analytics' && posts.length > 0 && (
                        <div className="space-y-6">
                            {/* Sentiment Distribution */}
                            {(() => {
                                const sentimentData = calculateSentimentDistribution(posts);
                                const total = sentimentData.positive + sentimentData.neutral + sentimentData.negative;

                                return (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                        <h2 className="text-2xl font-bold mb-6">Sentiment Distribution</h2>
                                        <div className="space-y-4">
                                            {/* Positive */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-green-400">Positive</span>
                                                    <span className="text-sm text-zinc-400">{sentimentData.positive} posts ({Math.round((sentimentData.positive / total) * 100)}%)</span>
                                                </div>
                                                <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-1000 ease-out"
                                                        style={{ width: `${(sentimentData.positive / total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Neutral */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-yellow-400">Neutral</span>
                                                    <span className="text-sm text-zinc-400">{sentimentData.neutral} posts ({Math.round((sentimentData.neutral / total) * 100)}%)</span>
                                                </div>
                                                <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-1000 ease-out"
                                                        style={{ width: `${(sentimentData.neutral / total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Negative */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-red-400">Negative</span>
                                                    <span className="text-sm text-zinc-400">{sentimentData.negative} posts ({Math.round((sentimentData.negative / total) * 100)}%)</span>
                                                </div>
                                                <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-1000 ease-out"
                                                        style={{ width: `${(sentimentData.negative / total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}



                            {/* Subreddit Breakdown */}
                            {(() => {
                                const subredditData = calculateSubredditBreakdown(posts);
                                const maxCount = Math.max(...subredditData.map(d => d.count));

                                return (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                        <h2 className="text-2xl font-bold mb-6">Top Subreddits</h2>
                                        <div className="space-y-3">
                                            {subredditData.map((data) => (
                                                <div key={data.subreddit}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-zinc-300">r/{data.subreddit}</span>
                                                        <span className="text-sm text-zinc-500">{data.count} posts</span>
                                                    </div>
                                                    <div className="h-6 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                                            style={{ width: `${(data.count / maxCount) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {activeTab === 'sources' && (
                        <div>
                            {/* Search Input */}
                            <div className="mb-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        placeholder="Search in sources... (Ctrl+F)"
                                        className="w-full px-4 py-3 pl-10 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                    <svg className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                    {searchText && (
                                        <button
                                            onClick={() => setSearchText('')}
                                            className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {searchText && (
                                    <p className="text-xs text-zinc-500 mt-2">
                                        {posts.filter(post => {
                                            const searchLower = searchText.toLowerCase();
                                            return post.title.toLowerCase().includes(searchLower) ||
                                                post.body.toLowerCase().includes(searchLower) ||
                                                (post.comments?.some(c => c.toLowerCase().includes(searchLower)));
                                        }).length} results found
                                    </p>
                                )}
                            </div>

                            {/* Subreddit Filter */}
                            {searchMetadata && searchMetadata.subreddits.length > 1 && (
                                <div className="mb-4 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setFilteredSubreddit(null)}
                                        className={`px-3 py-1 rounded-full text-sm transition-colors ${filteredSubreddit === null
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                    >
                                        All ({posts.length})
                                    </button>
                                    {searchMetadata.subreddits.map((sub) => {
                                        const count = posts.filter(p => p.subreddit === sub).length;
                                        return (
                                            <button
                                                key={sub}
                                                onClick={() => setFilteredSubreddit(sub)}
                                                className={`px-3 py-1 rounded-full text-sm transition-colors ${filteredSubreddit === sub
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                    }`}
                                            >
                                                r/{sub} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="space-y-4">
                                {posts
                                    .filter(post => {
                                        // Filter by subreddit
                                        if (filteredSubreddit && post.subreddit !== filteredSubreddit) return false;

                                        // Filter by search text
                                        if (searchText) {
                                            const searchLower = searchText.toLowerCase();
                                            return post.title.toLowerCase().includes(searchLower) ||
                                                post.body.toLowerCase().includes(searchLower) ||
                                                (post.comments?.some(c => c.toLowerCase().includes(searchLower)));
                                        }

                                        return true;
                                    })
                                    .map((post) => {
                                        // Helper function to highlight search text
                                        const highlightText = (text: string) => {
                                            if (!searchText || !text) return <>{text}</>;

                                            try {
                                                // Escape special regex characters
                                                const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));

                                                return (
                                                    <>
                                                        {parts.map((part, i) =>
                                                            part.toLowerCase() === searchText.toLowerCase()
                                                                ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</mark>
                                                                : <span key={i}>{part}</span>
                                                        )}
                                                    </>
                                                );
                                            } catch (e) {
                                                // If regex fails, return original text
                                                return <>{text}</>;
                                            }
                                        };

                                        return (
                                            <a
                                                key={post.id}
                                                href={post.permalink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group relative"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-start gap-2">
                                                            <h3 className="font-medium text-zinc-200 mb-2 group-hover:text-blue-400 transition-colors">
                                                                {highlightText(post.title)}
                                                            </h3>
                                                            {post.imageDescription && (
                                                                <div className="group/image relative">
                                                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500/20 text-blue-400">
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                        </svg>
                                                                    </span>
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-xs text-zinc-300 opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none z-20">
                                                                        <p className="font-medium text-blue-400 mb-1">AI Image Analysis:</p>
                                                                        {post.imageDescription}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                            <span>r/{post.subreddit}</span>
                                                            <span>•</span>
                                                            <span>u/{post.author}</span>
                                                            <span>•</span>
                                                            <span>{new Date(post.createdUtc * 1000).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 ml-4">
                                                        <span className="text-sm font-medium text-zinc-300">↑ {post.score}</span>
                                                        {post.upvoteRatio && (
                                                            <span className={`text-xs ${post.upvoteRatio >= 0.9 ? 'text-green-400' :
                                                                post.upvoteRatio >= 0.8 ? 'text-emerald-400' :
                                                                    post.upvoteRatio >= 0.7 ? 'text-yellow-400' :
                                                                        post.upvoteRatio >= 0.6 ? 'text-orange-400' :
                                                                            'text-red-400'
                                                                }`}>
                                                                {Math.round(post.upvoteRatio * 100)}% upvoted
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {post.body && (
                                                    <div className="mb-4">
                                                        <p className="text-zinc-400 text-sm line-clamp-3 whitespace-pre-wrap">{highlightText(post.body)}</p>
                                                    </div>
                                                )}

                                                {/* Engagement & Comments */}
                                                <div className="mt-4 pt-4 border-t border-zinc-800/50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                                                            <span className="flex items-center gap-1.5">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                                                                {post.numComments || 0} comments
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            View on Reddit
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    {post.comments && post.comments.length > 0 && (
                                                        <div className="mt-3 bg-zinc-950/50 rounded-lg p-3 space-y-2">
                                                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Top Comments</p>
                                                            {post.comments.slice(0, 2).map((comment: string, cIdx: number) => (
                                                                <div key={cIdx} className="text-sm text-zinc-400 pl-2 border-l-2 border-zinc-800">
                                                                    "{comment.length > 150 ? comment.substring(0, 150) + '...' : comment}"
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </a>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Print View - Hidden normally, visible when printing */}
            <div className="hidden print:block p-8 bg-white text-black absolute top-0 left-0 w-full min-h-screen z-50">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Readit Report</h1>
                    <p className="text-xl text-gray-600">Topic: {searchQuery}</p>
                    <p className="text-sm text-gray-500 mt-2">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {summary && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Summary</h2>
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap mb-6">{summary.narrative}</p>

                        {summary.bulletPoints.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold mb-3">Key Insights</h3>
                                <ul className="space-y-2">
                                    {summary.bulletPoints.map((point, idx) => (
                                        <li key={idx} className="flex gap-2">
                                            <span className="text-blue-600">•</span>
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {posts.length > 0 && (
                    <div className="mb-8 break-inside-avoid">
                        <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Analytics</h2>

                        <div className="grid grid-cols-2 gap-8">
                            {/* Sentiment */}
                            <div>
                                <h3 className="text-lg font-bold mb-3">Sentiment Distribution</h3>
                                {(() => {
                                    const sentimentData = calculateSentimentDistribution(posts);
                                    const total = sentimentData.positive + sentimentData.neutral + sentimentData.negative;
                                    return (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-green-700 font-medium">Positive</span>
                                                <span>{Math.round((sentimentData.positive / total) * 100)}%</span>
                                            </div>
                                            <div className="h-4 bg-gray-200 rounded overflow-hidden print:bg-gray-200">
                                                <div className="h-full bg-green-500 print:bg-green-500 print-color-adjust-exact" style={{ width: `${(sentimentData.positive / total) * 100}%` }} />
                                            </div>

                                            <div className="flex justify-between text-sm">
                                                <span className="text-yellow-700 font-medium">Neutral</span>
                                                <span>{Math.round((sentimentData.neutral / total) * 100)}%</span>
                                            </div>
                                            <div className="h-4 bg-gray-200 rounded overflow-hidden print:bg-gray-200">
                                                <div className="h-full bg-yellow-500 print:bg-yellow-500 print-color-adjust-exact" style={{ width: `${(sentimentData.neutral / total) * 100}%` }} />
                                            </div>

                                            <div className="flex justify-between text-sm">
                                                <span className="text-red-700 font-medium">Negative</span>
                                                <span>{Math.round((sentimentData.negative / total) * 100)}%</span>
                                            </div>
                                            <div className="h-4 bg-gray-200 rounded overflow-hidden print:bg-gray-200">
                                                <div className="h-full bg-red-500 print:bg-red-500 print-color-adjust-exact" style={{ width: `${(sentimentData.negative / total) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Top Subreddits */}
                            <div>
                                <h3 className="text-lg font-bold mb-3">Top Subreddits</h3>
                                {(() => {
                                    const subredditData = calculateSubredditBreakdown(posts);
                                    const maxCount = Math.max(...subredditData.map(d => d.count));
                                    return (
                                        <div className="space-y-3">
                                            {subredditData.slice(0, 5).map((data) => (
                                                <div key={data.subreddit}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium">r/{data.subreddit}</span>
                                                        <span className="text-gray-500">{data.count}</span>
                                                    </div>
                                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden print:bg-gray-200">
                                                        <div
                                                            className="h-full bg-purple-500 print:bg-purple-500 print-color-adjust-exact"
                                                            style={{ width: `${(data.count / maxCount) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-4 border-b pb-2 border-gray-300">Sources</h2>
                    <div className="space-y-4">
                        {posts.map((post, idx) => (
                            <div key={post.id} className="break-inside-avoid border-b border-gray-200 pb-4 mb-4">
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
                                    r/{post.subreddit} • {post.score} upvotes • {new Date(post.createdUtc * 1000).toLocaleDateString()}
                                </div>
                                <a href={post.permalink} className="text-xs text-gray-400 underline">{post.permalink}</a>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
