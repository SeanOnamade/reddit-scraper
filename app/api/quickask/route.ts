import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
    try {
        const { question, posts, apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key required' }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey });

        // Create a concise prompt for quick answers
        const prompt = `Answer the following question based ONLY on these Reddit posts. Be concise but informative (2-3 paragraphs max).

Question: ${question}

Reddit Posts:
${posts.map((p: any, idx: number) => `
${idx + 1}. r/${p.subreddit} - ${p.title}
${p.body ? p.body.substring(0, 300) : ''}
Score: ${p.score} upvotes
`).join('\n')}

Provide a direct, helpful answer that synthesizes the information from these posts. Focus on practical advice and common opinions. If there are conflicting views, mention them briefly.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that answers questions based on Reddit discussions. Be concise, practical, and cite the general sentiment from the posts.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        const answer = completion.choices[0]?.message?.content || 'Unable to generate answer';

        return NextResponse.json({ answer });
    } catch (error) {
        console.error('Quick Ask error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate answer' },
            { status: 500 }
        );
    }
}
