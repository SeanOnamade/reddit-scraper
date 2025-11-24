'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

interface SettingsProps {
    onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
    const { settings, setSettings } = useAppStore();
    const [localKey, setLocalKey] = useState(settings.openaiKey);
    const [localMaxPosts, setLocalMaxPosts] = useState(settings.maxPosts);
    const [localResultCount, setLocalResultCount] = useState(settings.resultCount || 10);
    const [hasServerKey, setHasServerKey] = useState(false);

    useEffect(() => {
        fetch('/api/config/check')
            .then(res => res.json())
            .then(data => setHasServerKey(data.hasOpenAiKey))
            .catch(err => console.error('Failed to check config:', err));
    }, []);

    const handleSave = () => {
        setSettings({
            openaiKey: localKey,
            maxPosts: localMaxPosts,
            resultCount: localResultCount,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold mb-6">Settings</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            OpenAI API Key
                        </label>
                        <input
                            type="password"
                            value={localKey}
                            onChange={(e) => setLocalKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-zinc-500 mt-1 flex justify-between items-center">
                            <span>Stored locally in your browser</span>
                            {hasServerKey && (
                                <span className="text-green-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Server key active
                                </span>
                            )}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Max Posts to Scrape
                        </label>
                        <input
                            type="number"
                            value={localMaxPosts}
                            onChange={(e) => setLocalMaxPosts(parseInt(e.target.value) || 100)}
                            min="10"
                            max="500"
                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Search Results Count
                        </label>
                        <select
                            value={localResultCount}
                            onChange={(e) => setLocalResultCount(parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={5}>5 results</option>
                            <option value={10}>10 results</option>
                            <option value={20}>20 results</option>
                        </select>
                        <p className="text-xs text-zinc-500 mt-1">
                            Number of posts to find via Google Search
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                    >
                        Save
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
