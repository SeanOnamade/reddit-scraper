import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RedditPost } from '@/lib/scraper';

interface Citation {
    postId: string;
    permalink: string;
    quote: string;
}

interface SummaryResult {
    narrative: string;
    bulletPoints: string[];
    citations: Citation[];
}

export async function POST(request: NextRequest) {
    try {
        const { posts, apiKey, topic } = await request.json();

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key required' },
                { status: 400 }
            );
        }

        if (!posts || posts.length === 0) {
            return NextResponse.json({
                narrative: 'No posts found to summarize',
                bulletPoints: [],
                citations: [],
            });
        }

        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: false,
        });

        // Limit to top 50 posts to avoid token limits, but now we have full bodies
        // so we might need to be more careful with length.
        // Let's truncate bodies to 1000 chars to balance context vs tokens.
        const excerpts = posts.slice(0, 30).map((post: RedditPost) => ({
            postId: post.id,
            permalink: post.permalink,
            title: post.title,
            body: post.body?.substring(0, 1000) || '',
            score: post.score,
            flair: post.flair,
            upvoteRatio: post.upvoteRatio,
            numComments: post.numComments,
            topComments: post.comments ? post.comments.slice(0, 3) : []
        }));

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant that summarizes Reddit discussions found via Google Search.
You will be provided with a list of Reddit posts and the user's original question/topic. Some posts may have full content, while others might only have snippets.
You now have access to additional metadata:
- **Flair**: The tag applied to the post.
- **Upvote Ratio**: The percentage of upvotes (indicates controversy).
- **Num Comments**: Total number of comments (indicates engagement).
- **Top Comments**: The actual text of the top comments.

**CRITICAL**: Your summary must directly answer the user's original question. Stay focused on what they asked about. If the posts mention related topics, only include them if they help answer the main question.

Format your response as a JSON object with the following structure:
{
    "narrative": "A 2-3 paragraph summary that DIRECTLY ANSWERS the user's question. Start by addressing their specific query, then provide supporting details from the posts. Use the top comments to gauge community sentiment. Be specific and cite specific users or posts where appropriate.",
    "bulletPoints": ["A list of 3-5 key takeaways that are RELEVANT TO THE USER'S QUESTION. Mention if a topic is controversial based on upvote ratios."],
    "citations": [
        {
            "postId": "id of the post",
            "permalink": "url of the post",
            "quote": "A direct quote or specific reference from the post (or a top comment) that supports the summary"
        }
    ]
}

Important guidelines:
- **Stay focused on the user's question** - don't get sidetracked by tangential topics in the posts.
- If multiple posts discuss the same sub-topic, synthesize them.
- Highlight any conflicting opinions or diverse viewpoints.
- Ensure citations are accurate and link back to the correct post.
- If the content is limited, do your best to extract meaningful insights.`
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        userQuestion: topic || "General discussion",
                        excerpts
                    }),
                },
            ],
        });

        const result: SummaryResult = JSON.parse(
            response.choices[0].message.content || '{}'
        );

        return NextResponse.json({
            narrative: result.narrative || 'No summary available',
            bulletPoints: result.bulletPoints || [],
            citations: result.citations || [],
        });
    } catch (error) {
        console.error('Summarize error:', error);
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        );
    }
}
