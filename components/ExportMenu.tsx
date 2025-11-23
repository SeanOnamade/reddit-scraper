import { useState } from 'react';
import { RedditPost } from '@/lib/scraper';

interface ExportMenuProps {
    posts: RedditPost[];
    summary: {
        narrative: string;
        bulletPoints: string[];
        citations: any[];
    } | null;
    searchQuery: string;
}

export default function ExportMenu({ posts, summary, searchQuery }: ExportMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleExportJSON = () => {
        const data = {
            topic: searchQuery,
            exportedAt: new Date().toISOString(),
            summary,
            posts
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readit-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };

    const handleExportCSV = () => {
        // CSV Header
        let csvContent = "Title,Subreddit,Author,Score,Upvote Ratio,Comments,Flair,Date,URL,Body\n";

        // CSV Rows
        posts.forEach(post => {
            const row = [
                `"${post.title.replace(/"/g, '""')}"`,
                post.subreddit,
                post.author,
                post.score,
                post.upvoteRatio ? `${Math.round(post.upvoteRatio * 100)}%` : "N/A",
                post.numComments || 0,
                post.flair ? `"${post.flair.replace(/"/g, '""')}"` : "",
                new Date(post.createdUtc * 1000).toLocaleDateString(),
                post.permalink,
                `"${(post.body || "").replace(/"/g, '""').replace(/\n/g, ' ')}"` // Flatten body
            ].join(",");
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readit-posts-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };

    const handlePrintPDF = () => {
        const originalTitle = document.title;
        document.title = `Readit-Report-${searchQuery.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}`;
        window.print();
        document.title = originalTitle;
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
                <span>Download Report</span>
                <span className="text-xs">▼</span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden">
                        <button
                            onClick={handleExportJSON}
                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800"
                        >
                            Export JSON
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800"
                        >
                            Export CSV (Posts)
                        </button>
                        <button
                            onClick={handlePrintPDF}
                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                            Save as PDF
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
