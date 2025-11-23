'use client';

import { useState, useEffect } from 'react';
import Settings from '@/components/Settings';
import QueryInput from '@/components/QueryInput';

export default function Home() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mode, setMode] = useState<'quickask' | 'research' | 'theme'>('research');
    const [themeSubreddit, setThemeSubreddit] = useState('');
    const [themeTime, setThemeTime] = useState('all');
    const [analyzeImages, setAnalyzeImages] = useState(false);

    // Validation State
    const [isValidating, setIsValidating] = useState(false);
    const [isValidSubreddit, setIsValidSubreddit] = useState<boolean | null>(null);
    const [subredditIcon, setSubredditIcon] = useState<string | null>(null);

    // Debounced validation
    useEffect(() => {
        const validateSubreddit = async () => {
            if (!themeSubreddit || themeSubreddit.length < 3) {
                setIsValidSubreddit(null);
                setSubredditIcon(null);
                return;
            }

            setIsValidating(true);
            setIsValidSubreddit(null);

            try {
                const res = await fetch(`/api/validate-subreddit?name=${themeSubreddit}`);
                const data = await res.json();
                setIsValidSubreddit(data.valid);
                setSubredditIcon(data.icon || null);
            } catch (error) {
                setIsValidSubreddit(false);
            } finally {
                setIsValidating(false);
            }
        };

        const timeoutId = setTimeout(validateSubreddit, 500);
        return () => clearTimeout(timeoutId);
    }, [themeSubreddit]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
            <header className="border-b border-zinc-800 p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Readit
                </h1>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                >
                    ⚙️
                </button>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-2xl space-y-8">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-bold tracking-tight">
                            What do you want to <span className="text-blue-400">discover</span>?
                        </h2>
                        <p className="text-zinc-400 text-lg">
                            {mode === 'quickask' && 'Get quick answers from Reddit in seconds.'}
                            {mode === 'research' && 'Research topics across Reddit or analyze a specific community.'}
                            {mode === 'theme' && 'Analyze a specific subreddit to discover its themes and patterns.'}
                        </p>
                    </div>

                    {/* Mode Switcher */}
                    <div className="flex justify-center">
                        <div className="bg-zinc-900 p-1 rounded-lg border border-zinc-800 flex gap-1">
                            <button
                                onClick={() => setMode('quickask')}
                                className={`px-4 py-2 rounded-md font-medium transition-all relative ${mode === 'quickask'
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                            >
                                Quick Ask
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">BETA</span>
                            </button>
                            <button
                                onClick={() => setMode('research')}
                                className={`px-6 py-2 rounded-md font-medium transition-all ${mode === 'research'
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                            >
                                Research Mode
                            </button>
                            <button
                                onClick={() => setMode('theme')}
                                className={`px-6 py-2 rounded-md font-medium transition-all ${mode === 'theme'
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                            >
                                Theme Mode
                            </button>
                        </div>
                    </div>

                    {mode === 'quickask' ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Ask a Question
                                </label>
                                <textarea
                                    placeholder="e.g., What laptop do redditors recommend for students?"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px] resize-none"
                                    onChange={(e) => {
                                        sessionStorage.setItem('quickAskQuery', e.target.value);
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const query = sessionStorage.getItem('quickAskQuery');
                                    if (query) {
                                        window.location.href = '/quickask';
                                    }
                                }}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition-all"
                            >
                                Get Answer
                            </button>
                            <p className="text-xs text-zinc-500 text-center">
                                ⚡ Quick Ask scrapes 5-10 posts and provides a fast answer in ~10-15 seconds
                            </p>
                        </div>
                    ) : mode === 'research' ? (
                        <QueryInput />
                    ) : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Subreddit Name
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-zinc-500">r/</span>
                                    <input
                                        type="text"
                                        value={themeSubreddit}
                                        onChange={(e) => setThemeSubreddit(e.target.value.replace(/^r\//, ''))}
                                        placeholder="philosophy"
                                        className={`w-full bg-zinc-950 border rounded-xl py-3 pl-8 pr-12 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 transition-all ${isValidSubreddit === true ? 'border-green-500/50 focus:ring-green-500/20' :
                                            isValidSubreddit === false ? 'border-red-500/50 focus:ring-red-500/20' :
                                                'border-zinc-800 focus:ring-blue-500/50'
                                            } ${isValidating ? 'animate-pulse' : ''}`}
                                    />
                                    <div className="absolute right-4 top-3 flex items-center pointer-events-none">
                                        {isValidating ? (
                                            <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : isValidSubreddit === true ? (
                                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                                {subredditIcon && (
                                                    <img src={subredditIcon} alt="" className="w-5 h-5 rounded-full object-cover" />
                                                )}
                                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        ) : isValidSubreddit === false ? (
                                            <svg className="w-5 h-5 text-red-500 animate-in fade-in zoom-in duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        ) : null}
                                    </div>
                                </div>
                                {isValidSubreddit === false && (
                                    <p className="text-xs text-red-400 mt-2 ml-1">
                                        Subreddit not found or private
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Time Range
                                </label>
                                <div className="relative">
                                    <select
                                        value={themeTime}
                                        onChange={(e) => setThemeTime(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="all">All Time</option>
                                        <option value="year">Past Year</option>
                                        <option value="month">Past Month</option>
                                        <option value="week">Past Week</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 cursor-pointer" onClick={() => setAnalyzeImages(!analyzeImages)}>
                                <div className="flex items-center h-5">
                                    <input
                                        id="analyze-images"
                                        type="checkbox"
                                        checked={analyzeImages}
                                        onChange={(e) => setAnalyzeImages(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="analyze-images" className="text-sm font-medium text-zinc-200 cursor-pointer">
                                        Heavy Search (Beta)
                                    </label>
                                    <span className="text-xs text-zinc-500">
                                        Uses AI Vision to analyze images. Slower and uses more tokens.
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (!themeSubreddit) return;
                                    // Store params and navigate
                                    sessionStorage.setItem('themeParams', JSON.stringify({
                                        subreddit: themeSubreddit,
                                        time: themeTime,
                                        analyzeImages
                                    }));
                                    window.location.href = '/theme';
                                }}
                                disabled={!themeSubreddit || isValidSubreddit === false}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-lg transition-all shadow-lg shadow-blue-900/20"
                            >
                                Analyze Community
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
        </div>
    );
}
