import OpenAI from 'openai';

export interface RedditPost {
    id: string;
    subreddit: string;
    title: string;
    body: string;
    author: string;
    score: number;
    permalink: string;
    createdUtc: number;
    comments?: string[];
    imageDescription?: string;
    flair?: string;
    upvoteRatio?: number;
    numComments?: number;
    url?: string;
}


export async function searchRedditViaGoogle(
    keywords: string[],
    apiKey: string,
    cseId: string,
    maxResults: number = 10,
    analyzeImages: boolean = false,
    openaiKey?: string,
    subreddits?: string[],
    strictSearch?: boolean,
    dateRange?: 'any' | 'day' | 'week' | 'month' | 'year' | 'custom',
    customStartDate?: string,
    customEndDate?: string,
    sortBy?: 'relevance' | 'date'
): Promise<RedditPost[]> {
    const posts: RedditPost[] = [];

    try {
        // Use top 3 keywords with AND logic for more focused results
        const topKeywords = keywords.slice(0, 3);
        const query = topKeywords.join(' ');

        let searchQuery = `site:reddit.com ${query}`;

        if (strictSearch && subreddits && subreddits.length > 0) {
            // Construct strict query: (site:reddit.com/r/sub1 OR site:reddit.com/r/sub2) query
            // Limit to first 5 subreddits to avoid query length limits
            const strictSubs = subreddits.slice(0, 5);
            const siteOperators = strictSubs.map(sub => `site:reddit.com/r/${sub}`).join(' OR ');
            searchQuery = `(${siteOperators}) ${query}`;
        }

        console.log(`Searching Google for: "${searchQuery}"`);

        // Build base URL
        let url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(searchQuery)}&num=${Math.min(maxResults, 10)}`;

        // Add date range filters
        if (dateRange && dateRange !== 'any') {
            if (dateRange === 'day') {
                url += '&dateRestrict=d1';
            } else if (dateRange === 'week') {
                url += '&dateRestrict=w1';
            } else if (dateRange === 'month') {
                url += '&dateRestrict=m1';
            } else if (dateRange === 'year') {
                url += '&dateRestrict=y1';
            } else if (dateRange === 'custom' && customStartDate && customEndDate) {
                // Convert YYYY-MM-DD to YYYYMMDD
                const start = customStartDate.replace(/-/g, '');
                const end = customEndDate.replace(/-/g, '');
                url += `&sort=date:r:${start}:${end}`;
            }
        }

        // Add sorting (only if not using custom date range, which already uses sort)
        if (sortBy === 'date' && dateRange !== 'custom') {
            url += '&sort=date';
        }

        // Retry logic with exponential backoff
        let response;
        let lastError;
        for (let i = 0; i < 3; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) break;

                // If 403 or 429, might be rate limit, wait longer
                if (response.status === 429 || response.status === 403) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                }

                lastError = new Error(`Google API error ${response.status}: ${await response.text()}`);
            } catch (e) {
                lastError = e;
                console.warn(`Attempt ${i + 1} failed:`, e);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }

        if (!response || !response.ok) {
            throw lastError || new Error('Failed to connect to Google Search API');
        }

        const data = await response.json();
        const items = data.items || [];

        console.log(`Found ${items.length} results from Google, fetching full details...`);

        // Process results sequentially to avoid rate limits
        const results: (RedditPost | null)[] = [];

        for (const item of items) {
            try {
                const subredditMatch = item.link.match(/reddit\.com\/r\/([^\/]+)/);
                const subreddit = subredditMatch ? subredditMatch[1] : 'unknown';

                const postIdMatch = item.link.match(/comments\/([^\/]+)/);
                const postId = postIdMatch ? postIdMatch[1] : `google_${Math.random().toString(36).substr(2, 9)}`;

                // Default values from Google snippet
                let body = item.snippet || '';
                let author = 'unknown';
                let score = 0;
                let createdUtc = Date.now() / 1000;
                let comments: string[] = [];
                let imageDescription: string | undefined;
                let flair: string | undefined;
                let upvoteRatio: number | undefined;
                let numComments: number | undefined;

                try {
                    // Fetch full post details from Reddit JSON API
                    // Add .json to the URL to get the JSON data
                    // Remove any query parameters first
                    const cleanLink = item.link.split('?')[0];
                    let jsonUrl = cleanLink.endsWith('/') ? `${cleanLink}.json?raw_json=1` : `${cleanLink}/.json?raw_json=1`;

                    // Add a small random delay between requests (200-700ms) to avoid rate limits while staying within Vercel timeouts
                    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));

                    const headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Referer': 'https://www.google.com/',
                        'Accept-Language': 'en-US,en;q=0.9'
                    };

                    let redditResponse = await fetch(jsonUrl, { headers });

                    // If www.reddit.com returns 403, try old.reddit.com as fallback
                    if (redditResponse.status === 403) {
                        console.log(`  ⚠️ 403 from www.reddit.com, trying old.reddit.com for ${item.link}`);
                        jsonUrl = jsonUrl.replace('www.reddit.com', 'old.reddit.com');
                        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
                        redditResponse = await fetch(jsonUrl, { headers });
                    }

                    if (redditResponse.ok) {
                        const redditData = await redditResponse.json();
                        if (Array.isArray(redditData) && redditData[0]?.data?.children?.[0]?.data) {
                            const postData = redditData[0].data.children[0].data;

                            // Update fields with real data
                            // Use selftext (body) or title if body is empty (e.g. image/link posts)
                            // If selftext is empty, it might be a link post or image post
                            body = postData.selftext || postData.url || item.snippet || '';

                            author = postData.author || 'unknown';
                            score = postData.score || 0;
                            createdUtc = postData.created_utc || createdUtc;
                            flair = postData.link_flair_text || undefined;
                            upvoteRatio = postData.upvote_ratio;
                            numComments = postData.num_comments;

                            // Extract top comments
                            if (redditData[1]?.data?.children) {
                                comments = redditData[1].data.children
                                    .slice(0, 3)
                                    .map((c: any) => c.data?.body)
                                    .filter((c: string) => c && c !== '[deleted]' && c !== '[removed]');
                            }

                            // Heavy Search: Image Analysis
                            if (analyzeImages && openaiKey && postData.url && postData.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
                                try {
                                    const openai = new OpenAI({ apiKey: openaiKey });
                                    const imageResponse = await openai.chat.completions.create({
                                        model: "gpt-4o",
                                        messages: [
                                            {
                                                role: "user",
                                                content: [
                                                    { type: "text", text: "Describe this image in detail for a blind user. Focus on text, main subjects, and mood." },
                                                    {
                                                        type: "image_url",
                                                        image_url: {
                                                            url: postData.url,
                                                        },
                                                    },
                                                ],
                                            },
                                        ],
                                        max_tokens: 150,
                                    });
                                    imageDescription = imageResponse.choices[0].message.content || undefined;
                                    console.log(`  ✓ Analyzed image for ${item.title.substring(0, 20)}...`);
                                } catch (imgErr) {
                                    console.warn(`  ⚠️ Failed to analyze image for ${item.link}:`, imgErr);
                                }
                            }

                            console.log(`  ✓ Fetched full content for: ${item.title.substring(0, 30)}...`);
                        }
                    } else {
                        console.warn(`  ⚠️ Failed to fetch JSON for ${item.link}: ${redditResponse.status}`);
                    }
                } catch (e) {
                    console.warn(`  ⚠️ Error fetching JSON for ${item.link}:`, e);
                }

                results.push({
                    id: postId,
                    subreddit,
                    title: item.title,
                    body: body,
                    author: author,
                    score: score,
                    permalink: item.link,
                    createdUtc: createdUtc,
                    comments,
                    imageDescription,
                    flair,
                    upvoteRatio,
                    numComments
                });
            } catch (err) {
                console.error('Error processing item:', err);
                results.push(null);
            }
        }
        const validPosts = results.filter((p): p is RedditPost => p !== null);
        posts.push(...validPosts);

        console.log(`Total posts found: ${posts.length}`);
        return posts;
    } catch (error) {
        console.error('Error searching via Google:', error);
        throw error; // Propagate error to API route
    }
}

export async function scrapeMultipleSubreddits(
    subreddits: string[],
    keywords: string[],
    maxPostsPerSub: number = 50,
    onProgress?: (current: number, total: number, subreddit: string) => void
): Promise<RedditPost[]> {
    console.log('Note: Using Google Custom Search instead of subreddit scraping');
    return [];
}
