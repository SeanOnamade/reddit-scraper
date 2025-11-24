'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { RedditPost } from '@/lib/scraper';

export default function QuickAskPage() {
    const { settings } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [answer, setAnswer] = useState('');
    const [sources, setSources] = useState<RedditPost[]>([]);
    const [query, setQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hasServerKey, setHasServerKey] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    // Wait for client-side hydration
    useEffect(() => {
        setHydrated(true);
        fetch('/api/config/check')
            .then(res => res.json())
            .then(data => setHasServerKey(data.hasOpenAiKey))
            .catch(err => console.error('Failed to check config:', err));
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        const quickAskQuery = sessionStorage.getItem('quickAskQuery');
        if (!quickAskQuery) {
            window.location.href = '/';
            return;
        }

        setQuery(quickAskQuery);

        const runQuickAsk = async () => {
            try {
                if (!settings.openaiKey && !hasServerKey) {
                    // Wait briefly for check
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (!settings.openaiKey && !hasServerKey) {
                        throw new Error('OpenAI API key not configured. Please add it in settings.');
                    }
                }

                // Scrape 5-10 posts using streaming API
                const scrapeResponse = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        keywords: [quickAskQuery],
                        maxPosts: 10,
                        apiKey: settings.openaiKey,
                    }),
                });

                if (!scrapeResponse.ok) throw new Error('Failed to scrape');

                // Handle streaming response
                const reader = scrapeResponse.body?.getReader();
                const decoder = new TextDecoder();
                let scrapedPosts: RedditPost[] = [];

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.type === 'complete' && data.posts) {
                                        scrapedPosts = data.posts;
                                    }
                                } catch (e) {
                                    // Ignore parsing errors for incomplete chunks
                                }
                            }
                        }
                    }
                }

                if (scrapedPosts.length === 0) {
                    throw new Error('No posts found');
                }

                setSources(scrapedPosts);

                // Get quick answer from LLM
                const answerResponse = await fetch('/api/quickask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: quickAskQuery,
                        posts: scrapedPosts,
                        apiKey: settings.openaiKey,
                    }),
                });

                if (!answerResponse.ok) {
                    const errorData = await answerResponse.json();
                    throw new Error(errorData.error || 'Failed to get answer');
                }

                const answerData = await answerResponse.json();
                setAnswer(answerData.answer);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Quick Ask failed';
                setError(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        runQuickAsk();
    }, [hydrated, settings.openaiKey]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-zinc-400">Getting your answer...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-400">{error}</p>
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
            <header className="border-b border-zinc-800 p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Readit
                    </h1>
                    <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">BETA</span>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all"
                        >
                            New Search
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Question */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-sm font-medium text-zinc-500 mb-2">Your Question</h2>
                        <p className="text-xl text-zinc-100">{query}</p>
                    </div>

                    {/* Answer */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-4">📝 Answer</h2>
                        <div className="prose prose-invert max-w-none">
                            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{answer}</p>
                        </div>
                    </div>

                    {/* Sources */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-2xl font-bold mb-4">📚 Sources ({sources.length})</h2>
                        <div className="space-y-3">
                            {sources.map((post, idx) => (
                                <div key={idx} className="border-l-2 border-zinc-700 pl-4 py-2">
                                    <a
                                        href={post.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 font-medium"
                                    >
                                        {post.title}
                                    </a>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        r/{post.subreddit} • {post.score} upvotes
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upgrade to Deep Research */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-6 text-center">
                        <h3 className="text-lg font-bold mb-2">Want more detailed insights?</h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            Run a Deep Research to get comprehensive analysis, charts, and more sources
                        </p>
                        <button
                            onClick={() => {
                                sessionStorage.setItem('searchParams', JSON.stringify({
                                    topic: query,
                                    keywords: [query],
                                    subreddits: [],
                                    maxPosts: 50,
                                    analyzeImages: false,
                                    strictSearch: false,
                                    dateRange: 'all',
                                    sortBy: 'relevance',
                                    maxResults: 50
                                }));
                                window.location.href = '/results';
                            }}
                            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all"
                        >
                            Upgrade to Deep Research
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
