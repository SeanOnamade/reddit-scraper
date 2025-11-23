import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Settings {
    openaiKey: string;
    maxPosts: number;
    resultCount: number;
}

interface AppState {
    settings: Settings;
    setSettings: (settings: Partial<Settings>) => void;
    progress: {
        percent: number;
        phase: string | null;
    };
    setProgress: (percent: number, phase: string | null) => void;
    clearProgress: () => void;
    error: string | null;
    setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            settings: {
                openaiKey: '',
                maxPosts: 100,
                resultCount: 10,
            },
            setSettings: (newSettings) =>
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                })),
            progress: {
                percent: 0,
                phase: null,
            },
            setProgress: (percent, phase) =>
                set({ progress: { percent, phase } }),
            clearProgress: () =>
                set({ progress: { percent: 0, phase: null } }),
            error: null,
            setError: (error) => set({ error }),
        }),
        {
            name: 'readit-settings',
            partialize: (state) => ({ settings: state.settings }),
        }
    )
);
