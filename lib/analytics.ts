import { RedditPost } from './scraper';

// Sentiment analysis based on keyword matching
const POSITIVE_WORDS = [
    'love', 'great', 'awesome', 'amazing', 'excellent', 'best', 'perfect',
    'wonderful', 'fantastic', 'good', 'happy', 'thanks', 'appreciate',
    'helpful', 'nice', 'beautiful', 'brilliant', 'outstanding', 'impressive'
];

const NEGATIVE_WORDS = [
    'hate', 'terrible', 'awful', 'worst', 'bad', 'horrible', 'disappointing',
    'useless', 'broken', 'sucks', 'poor', 'frustrating', 'annoying', 'trash',
    'garbage', 'pathetic', 'disgusting', 'fail', 'failed'
];

export function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    POSITIVE_WORDS.forEach(word => {
        if (lowerText.includes(word)) positiveCount++;
    });

    NEGATIVE_WORDS.forEach(word => {
        if (lowerText.includes(word)) negativeCount++;
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
}

export interface SentimentData {
    positive: number;
    neutral: number;
    negative: number;
}

export function calculateSentimentDistribution(posts: RedditPost[]): SentimentData {
    const distribution: SentimentData = { positive: 0, neutral: 0, negative: 0 };

    posts.forEach(post => {
        const text = `${post.title} ${post.body}`;
        const sentiment = analyzeSentiment(text);
        distribution[sentiment]++;
    });

    return distribution;
}

export interface TimelineData {
    date: string;
    count: number;
}

export function calculateActivityTimeline(posts: RedditPost[]): TimelineData[] {
    if (posts.length === 0) return [];

    const dateCounts: { [key: string]: number } = {};

    // Collect all post dates
    posts.forEach(post => {
        const date = new Date(post.createdUtc * 1000);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
    });

    // Get date range
    const dates = Object.keys(dateCounts).sort();
    if (dates.length === 0) return [];

    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // If range is too large, group by month
    if (daysDiff > 90) {
        // Group by month
        const monthCounts: { [key: string]: number } = {};
        Object.entries(dateCounts).forEach(([date, count]) => {
            const monthKey = date.substring(0, 7); // YYYY-MM
            monthCounts[monthKey] = (monthCounts[monthKey] || 0) + count;
        });

        return Object.entries(monthCounts)
            .map(([date, count]) => ({ date: date + '-01', count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Return only days with posts (no gap filling)
    return Object.entries(dateCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SubredditData {
    subreddit: string;
    count: number;
}

export function calculateSubredditBreakdown(posts: RedditPost[]): SubredditData[] {
    const subredditCounts: { [key: string]: number } = {};

    posts.forEach(post => {
        subredditCounts[post.subreddit] = (subredditCounts[post.subreddit] || 0) + 1;
    });

    return Object.entries(subredditCounts)
        .map(([subreddit, count]) => ({ subreddit, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 subreddits
}
