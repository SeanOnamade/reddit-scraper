import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { subreddit, time, apiKey, analyzeImages } = await request.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 });
        }

        // Headers to mimic a real browser
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };

        // 1. Try Fetching via RSS (often less restricted than JSON)
        let posts: any[] = [];

        try {
            // Try old.reddit.com as it sometimes has different rate limits/blocking rules
            const rssUrl = `https://old.reddit.com/r/${subreddit}/top/.rss?t=${time}&limit=50`;
            console.log(`Fetching RSS from: ${rssUrl}`);

            const rssResponse = await fetch(rssUrl, { headers });

            if (rssResponse.ok) {
                const xml = await rssResponse.text();
                // Simple regex parsing for RSS to avoid heavy cheerio dependency if not needed
                const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
                const titleRegex = /<title>([\s\S]*?)<\/title>/;
                const linkRegex = /<link href="([^"]+)"/;
                const contentRegex = /<content type="html">([\s\S]*?)<\/content>/;
                const authorRegex = /<author><name>([\s\S]*?)<\/name><\/author>/;
                const updatedRegex = /<updated>([\s\S]*?)<\/updated>/;

                let match;
                const rssItems: any[] = [];
                while ((match = entryRegex.exec(xml)) !== null) {
                    const entry = match[1];
                    const title = titleRegex.exec(entry)?.[1] || '';
                    const link = linkRegex.exec(entry)?.[1] || '';
                    const content = contentRegex.exec(entry)?.[1] || '';
                    const author = authorRegex.exec(entry)?.[1] || 'unknown';
                    const updated = updatedRegex.exec(entry)?.[1];

                    rssItems.push({ title, link, content, author, updated });
                }

                // Deep Fetch: Get full details (Score, Comments, Type) for each RSS item
                // Limit to 15 to avoid hitting rate limits too hard/fast
                const deepFetchPromises = rssItems.slice(0, 15).map(async (item) => {
                    let score = 0;
                    let comments: string[] = [];
                    let imageDescription: string | undefined;
                    let postType = 'text';
                    let realAuthor = item.author.replace('/u/', '');
                    let body = item.content
                        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    // Default to RSS date if available, else now
                    let createdUtc = item.updated ? new Date(item.updated).getTime() / 1000 : Date.now() / 1000;

                    let imageUrl = item.link;

                    try {
                        const jsonUrl = item.link.split('?')[0] + '.json';
                        const res = await fetch(jsonUrl, { headers });
                        if (res.ok) {
                            const data = await res.json();
                            const postData = data[0]?.data?.children?.[0]?.data;
                            const commentsData = data[1]?.data?.children;

                            if (postData) {
                                score = postData.score;
                                realAuthor = postData.author;
                                postType = postData.post_hint || (postData.is_video ? 'video' : 'text');
                                createdUtc = postData.created_utc; // Prefer API timestamp
                                // Prefer selftext if available, else use RSS content
                                if (postData.selftext) body = postData.selftext;

                                // Get actual image URL if available
                                if (postData.url && postData.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
                                    imageUrl = postData.url;
                                }
                            }

                            if (commentsData) {
                                comments = commentsData
                                    .slice(0, 3)
                                    .map((c: any) => c.data.body)
                                    .filter((b: string) => b && b !== '[deleted]' && b !== '[removed]');
                            }
                        }
                    } catch (e) {
                        console.warn(`Failed deep fetch for ${item.link}`, e);
                    }

                    // Heavy Search: Image Analysis
                    // Only analyze if we have a valid image URL (not just a reddit permalink)
                    if (analyzeImages && (postType === 'image' || imageUrl.match(/\.(jpg|jpeg|png|webp)$/i))) {
                        try {
                            const openai = new OpenAI({ apiKey });
                            const imageResponse = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    {
                                        role: "user",
                                        content: [
                                            { type: "text", text: "Describe this image in detail for a blind user. Focus on text, main subjects, and mood." },
                                            { type: "image_url", image_url: { url: imageUrl } }
                                        ],
                                    },
                                ],
                                max_tokens: 150,
                            });
                            const description = imageResponse.choices[0].message.content || undefined;
                            imageDescription = description;
                            body += `\n\n[AI Image Analysis: ${description}]`;
                            console.log(`Analyzed image for ${imageUrl}`);
                        } catch (imgError) {
                            console.warn(`Failed to analyze image for ${imageUrl}`, imgError);
                        }
                    }

                    return {
                        title: item.title,
                        body,
                        score,
                        author: realAuthor,
                        permalink: item.link,
                        createdUtc,
                        url: item.link,
                        type: postType,
                        comments, // Pass comments to OpenAI
                        imageDescription
                    };
                });

                posts = await Promise.all(deepFetchPromises);
                console.log(`Fetched ${posts.length} posts via RSS (with deep details)`);
            } else {
                throw new Error(`RSS Blocked: ${rssResponse.status}`);
            }
        } catch (rssError) {
            console.warn('RSS fetch failed, falling back to Google Search:', rssError);

            // 2. Fallback to Google Custom Search
            const googleKey = process.env.GOOGLE_API_KEY;
            const googleCseId = process.env.GOOGLE_CSE_ID;

            if (googleKey && googleCseId) {
                // Force "comments" in URL to avoid subreddit homepage
                let query = `site:reddit.com/r/${subreddit}/comments`;

                // Add time filter to Google query if possible
                const now = new Date();
                if (time === 'year') {
                    const date = new Date();
                    date.setFullYear(now.getFullYear() - 1);
                    query += ` after:${date.toISOString().split('T')[0]}`;
                } else if (time === 'month') {
                    const date = new Date();
                    date.setMonth(now.getMonth() - 1);
                    query += ` after:${date.toISOString().split('T')[0]}`;
                } else if (time === 'week') {
                    const date = new Date();
                    date.setDate(now.getDate() - 7);
                    query += ` after:${date.toISOString().split('T')[0]}`;
                }

                const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCseId}&q=${encodeURIComponent(query)}&num=10`;

                const googleRes = await fetch(googleUrl);
                if (googleRes.ok) {
                    const data = await googleRes.json();
                    const items = data.items || [];

                    // Fetch full details for each Google result
                    const detailedPostsPromises = items.map(async (item: any) => {
                        let score = 0;
                        let author = 'unknown';
                        let body = item.snippet;
                        let createdUtc = Date.now() / 1000;
                        let comments: string[] = [];
                        let imageDescription: string | undefined;
                        let postType = 'text';

                        try {
                            // Extract ID from Google link
                            const match = item.link.match(/comments\/([a-z0-9]+)\//);
                            if (match && match[1]) {
                                const postId = match[1];
                                const redditUrl = `https://www.reddit.com/comments/${postId}.json`;

                                const res = await fetch(redditUrl, {
                                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                                });

                                if (res.ok) {
                                    const data = await res.json();
                                    const postData = data[0]?.data?.children[0]?.data;

                                    if (postData) {
                                        score = postData.score;
                                        author = postData.author;
                                        body = postData.selftext || postData.title;
                                        createdUtc = postData.created_utc;

                                        // Get comments
                                        if (data[1]?.data?.children) {
                                            comments = data[1].data.children
                                                .slice(0, 3)
                                                .map((c: any) => c.data.body)
                                                .filter(Boolean);
                                        }

                                        // Determine type
                                        if (postData.url && (postData.url.endsWith('.jpg') || postData.url.endsWith('.png'))) {
                                            postType = 'image';
                                        } else if (postData.is_video) {
                                            postType = 'video';
                                        }

                                        // Heavy Search: Image Analysis
                                        if (analyzeImages && (postType === 'image' || (postData.url && postData.url.includes('i.redd.it')))) {
                                            try {
                                                const imageUrl = postData.url;
                                                const visionResponse = await openai.chat.completions.create({
                                                    model: "gpt-4o",
                                                    messages: [
                                                        {
                                                            role: "user",
                                                            content: [
                                                                { type: "text", text: "Describe this image in detail for research purposes." },
                                                                { type: "image_url", image_url: { url: imageUrl } },
                                                            ],
                                                        },
                                                    ],
                                                    max_tokens: 300,
                                                });
                                                const imageDesc = visionResponse.choices[0]?.message?.content || "";
                                                if (imageDesc) {
                                                    imageDescription = imageDesc;
                                                    body += `\n\n[Image Description: ${imageDesc}]`;
                                                }
                                            } catch (imgError) {
                                                console.error("Image analysis failed:", imgError);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Deep fetch error:', e);
                        }

                        return {
                            title: item.title,
                            body: body,
                            score: score,
                            author: author,
                            permalink: item.link,
                            createdUtc: createdUtc,
                            url: item.link,
                            type: postType,
                            comments,
                            imageDescription
                        };
                    });

                    posts = await Promise.all(detailedPostsPromises);
                    console.log(`Fetched ${posts.length} posts via Google Fallback (with details)`);
                }
            }
        }

        if (posts.length === 0) {
            throw new Error('Could not fetch posts from Reddit (Blocked via JSON/RSS and Google Fallback failed)');
        }

        // 2. Analyze with OpenAI
        const openai = new OpenAI({ apiKey });

        const prompt = `
        Analyze the following top posts from r/${subreddit} (Time range: ${time}).
        Identify the major themes, recurring topics, and overall sentiment of the community.
        
        Posts Data:
        ${JSON.stringify(posts.map((p: any) => ({
            title: p.title,
            body: p.body.substring(0, 500), // Increased limit for image descriptions
            score: p.score,
            type: p.type,
            top_comments: p.comments ? p.comments.slice(0, 2) : []
        })))}

        Return a JSON object with the following structure:
        {
            "overview": "A brief 2-3 sentence overview of what this subreddit is about. Mention if it's mostly text discussions, images/memes, or videos.",
            "themes": [
                {
                    "name": "Theme Name",
                    "description": "Description of this theme. Reference specific comments if relevant.",
                    "sentiment": "positive" | "neutral" | "negative",
                    "postCount": number (approximate)
                }
            ],
            "topDiscussions": [
                "Key discussion point 1",
                "Key discussion point 2",
                "Key discussion point 3",
                "Key discussion point 4",
                "Key discussion point 5"
            ],
            "keywords": [
                {
                    "word": "keyword or short phrase",
                    "importance": number (1-10, where 10 is most important),
                    "category": "technical" | "community" | "content" | "general"
                }
            ]
        }
        
        For keywords:
        - Extract 15-25 key concepts, terms, or phrases that define this community
        - Filter out common stop words (the, and, is, etc.)
        - Include technical terms, popular topics, recurring themes, and community-specific jargon
        - Rate importance based on frequency and relevance to the community's identity
        - Categorize each keyword appropriately
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an expert community analyst. You analyze Reddit communities to understand their culture, themes, and interests. Output valid JSON only." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json({
            posts,
            analysis
        });

    } catch (error) {
        console.error('Theme analysis error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to analyze theme' },
            { status: 500 }
        );
    }
}
