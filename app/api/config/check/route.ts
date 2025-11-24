import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        hasOpenAiKey: !!process.env.OPENAI_API_KEY
    });
}
