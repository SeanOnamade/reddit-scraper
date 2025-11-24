import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
    try {
        const { topic, apiKey } = await request.json();

        const finalApiKey = apiKey || process.env.OPENAI_API_KEY;

        if (!finalApiKey) {
            return NextResponse.json(
                { error: 'OpenAI API key is required' },
                { status: 400 }
            );
        }

        const openai = new OpenAI({
            apiKey: finalApiKey,
            dangerouslyAllowBrowser: false,
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'You expand Reddit research queries. Return strict JSON only with fields: keywords (array), synonyms (array), interpretations (array), suggestedSubreddits (array). Keep subreddit names lowercase without r/ prefix.',
                },
                {
                    role: 'user',
                    content: `Topic: ${topic}\n\nProvide keywords, synonyms, interpretations, and 5-10 relevant subreddit suggestions.`,
                },
            ],
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');

        return NextResponse.json({
            keywords: result.keywords || [],
            synonyms: result.synonyms || [],
            interpretations: result.interpretations || [],
            suggestedSubreddits: result.suggestedSubreddits || [],
        });
    } catch (error) {
        console.error('Expand error:', error);
        return NextResponse.json(
            { error: 'Failed to expand query' },
            { status: 500 }
        );
    }
}
