'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function QueryInput() {
    const router = useRouter();
    const { settings, setError, setProgress } = useAppStore();
    const [topic, setTopic] = useState('');
    const [keywords, setKeywords] = useState<string[]>([]);
    const [subreddits, setSubreddits] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [manualSub, setManualSub] = useState('');
    const [analyzeImages, setAnalyzeImages] = useState(false);
    const [strictSearch, setStrictSearch] = useState(false);

    // Advanced filters
    const [showFilters, setShowFilters] = useState(false);
    const [dateRange, setDateRange] = useState<'any' | 'day' | 'week' | 'month' | 'year' | 'custom'>('any');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
    const [maxResults, setMaxResults] = useState(10);

    const handleExpand = async () => {
        if (!topic.trim()) return;

        if (!settings.openaiKey) {
            setError('Please set your OpenAI API key in Settings');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/expand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, apiKey: settings.openaiKey }),
            });

            if (!response.ok) throw new Error('Failed to expand query');

            const data = await response.json();
            setKeywords(data.keywords || []);
            setSubreddits(data.suggestedSubreddits || []);
            setExpanded(true);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to expand query');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSubreddit = () => {
        if (manualSub.trim() && !subreddits.includes(manualSub.trim())) {
            setSubreddits([...subreddits, manualSub.trim()]);
            setManualSub('');
        }
    };

    const handleRemoveSubreddit = (sub: string) => {
        setSubreddits(subreddits.filter(s => s !== sub));
    };

    const handleSearch = async () => {
        if (subreddits.length === 0) {
            setError('Please add at least one subreddit');
            return;
        }

        setProgress(0, 'Starting search...');

        // Store search params and navigate to results
        sessionStorage.setItem('searchParams', JSON.stringify({
            topic,
            keywords: keywords.length > 0 ? keywords : [topic],
            subreddits,
            maxPosts: settings.maxPosts,
            analyzeImages,
            strictSearch,
            // Advanced filters
            dateRange,
            customStartDate,
            customEndDate,
            sortBy,
            maxResults,
        }));

        router.push('/results');
    };

    return (
        <div className="space-y-6">
            <div>
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="What would you like to research? (e.g., 'best budget laptops for students')"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
                    disabled={loading}
                />
            </div>

            {!expanded ? (
                <button
                    onClick={handleExpand}
                    disabled={!topic.trim() || loading}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-medium transition-colors"
                >
                    {loading ? 'Expanding...' : 'Expand Query with AI'}
                </button>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Suggested Subreddits
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {subreddits.map((sub) => (
                                <span
                                    key={sub}
                                    className="px-3 py-1 bg-zinc-800 rounded-full text-sm flex items-center gap-2"
                                >
                                    r/{sub}
                                    <button
                                        onClick={() => handleRemoveSubreddit(sub)}
                                        className="text-zinc-400 hover:text-zinc-200"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualSub}
                                onChange={(e) => setManualSub(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddSubreddit()}
                                placeholder="Add subreddit manually..."
                                className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleAddSubreddit}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 cursor-pointer" onClick={() => setAnalyzeImages(!analyzeImages)}>
                            <div className="flex items-center h-5">
                                <input
                                    id="analyze-images-research"
                                    type="checkbox"
                                    checked={analyzeImages}
                                    onChange={(e) => setAnalyzeImages(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="analyze-images-research" className="text-sm font-medium text-zinc-200 cursor-pointer">
                                    Heavy Search (Beta)
                                </label>
                                <span className="text-xs text-zinc-500">
                                    Uses AI Vision to analyze images. Slower and uses more tokens.
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 cursor-pointer" onClick={() => setStrictSearch(!strictSearch)}>
                            <div className="flex items-center h-5">
                                <input
                                    id="strict-search"
                                    type="checkbox"
                                    checked={strictSearch}
                                    onChange={(e) => setStrictSearch(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="strict-search" className="text-sm font-medium text-zinc-200 cursor-pointer">
                                    Strict Search
                                </label>
                                <span className="text-xs text-zinc-500">
                                    Only search within the selected subreddits above.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="w-full px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 transition-colors flex items-center justify-between text-sm font-medium text-zinc-300"
                        >
                            <span>Advanced Filters (Optional)</span>
                            <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>

                        {showFilters && (
                            <div className="p-4 space-y-4 bg-zinc-950/30">
                                {/* Date Range */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Date Range</label>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'any', label: 'Any time' },
                                            { value: 'day', label: 'Past 24 hours' },
                                            { value: 'week', label: 'Past week' },
                                            { value: 'month', label: 'Past month' },
                                            { value: 'year', label: 'Past year' },
                                            { value: 'custom', label: 'Custom range' },
                                        ].map((option) => (
                                            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="dateRange"
                                                    value={option.value}
                                                    checked={dateRange === option.value}
                                                    onChange={(e) => setDateRange(e.target.value as any)}
                                                    className="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-700 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span className="text-sm text-zinc-400">{option.label}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {dateRange === 'custom' && (
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-zinc-500 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={customStartDate}
                                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-zinc-500 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={customEndDate}
                                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sort By */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Sort By</label>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'relevance', label: 'Relevance (default)' },
                                            { value: 'date', label: 'Date (newest first)' },
                                        ].map((option) => (
                                            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="sortBy"
                                                    value={option.value}
                                                    checked={sortBy === option.value}
                                                    onChange={(e) => setSortBy(e.target.value as any)}
                                                    className="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-700 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span className="text-sm text-zinc-400">{option.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Max Results */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Results per search</label>
                                    <select
                                        value={maxResults}
                                        onChange={(e) => setMaxResults(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        <option value={5}>5 results</option>
                                        <option value={10}>10 results (default)</option>
                                        <option value={20}>20 results</option>
                                        <option value={30}>30 results</option>
                                        <option value={50}>50 results</option>
                                    </select>
                                    <p className="text-xs text-zinc-600 mt-1">Higher values may take longer and use more API quota</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={subreddits.length === 0}
                        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-medium transition-colors"
                    >
                        Start Research
                    </button>
                </div>
            )}
        </div>
    );
}
