import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('name');

    if (!subreddit) {
        return NextResponse.json({ error: 'Subreddit name is required' }, { status: 400 });
    }

    try {
        // Use Reddit's public API to check if subreddit exists
        // We use about.json which returns 200 for valid, 403 for private, 404 for invalid
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Even if 200, check if it's a valid subreddit kind
            if (data.kind === 't5' || data.data?.display_name) {
                return NextResponse.json({
                    valid: true,
                    icon: (data.data.icon_img || data.data.community_icon || '').replace(/&amp;/g, '&') || null,
                    subscribers: data.data.subscribers
                });
            }
        }

        if (response.status === 403) {
            return NextResponse.json({ valid: true, private: true }, { status: 200 });
        }

        return NextResponse.json({ valid: false }, { status: 200 });

    } catch (error) {
        console.error('Subreddit validation error:', error);
        return NextResponse.json({ valid: false, error: 'Failed to validate' }, { status: 500 });
    }
}
