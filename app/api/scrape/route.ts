import { NextRequest } from 'next/server';
import { searchRedditViaGoogle } from '@/lib/scraper';

export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();
    const { keywords, maxPosts, analyzeImages, apiKey: openaiKey, subreddits, strictSearch, dateRange, customStartDate, customEndDate, sortBy, maxResults } = await request.json();

    // Get Google API credentials from environment
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    // Use server-side OpenAI key if client key is missing
    const finalOpenaiKey = openaiKey || process.env.OPENAI_API_KEY;

    if (!apiKey || !cseId) {
        return new Response(
            JSON.stringify({ error: 'Google API credentials not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (analyzeImages && !finalOpenaiKey) {
        return new Response(
            JSON.stringify({ error: 'OpenAI API key is required for image analysis' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
            };

            try {
                send({ type: 'start', message: 'Searching Reddit via Google...' });

                const posts = await searchRedditViaGoogle(
                    keywords,
                    apiKey,
                    cseId,
                    maxResults || maxPosts || 10,
                    analyzeImages,
                    finalOpenaiKey,
                    subreddits,
                    strictSearch,
                    dateRange,
                    customStartDate,
                    customEndDate,
                    sortBy
                );

                send({ type: 'complete', posts });
                controller.close();
            } catch (error) {
                send({
                    type: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
