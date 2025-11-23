# Readit - AI-Powered Reddit Research Tool

A Next.js application that uses AI to help you research topics across Reddit communities.

## Features

- 🤖 **AI Query Expansion** - OpenAI suggests relevant subreddits based on your topic
- 🔍 **Reddit Scraping** - Automatically scrapes posts from multiple subreddits
- 📊 **Smart Summarization** - Generates grounded summaries with citations
- 🎨 **Dark Mode UI** - Beautiful, modern interface
- ⚡ **Real-time Progress** - See scraping progress in real-time
- 🚀 **Easy Deployment** - [Deploy to Vercel](DEPLOYMENT.md) in minutes

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

4. **Set up your OpenAI API key:**
   - Click "Settings" in the top right
   - Enter your OpenAI API key (get one at https://platform.openai.com/api-keys)
   - Set max posts to scrape (default: 100)
   - Click "Save"

## How to Use

1. **Enter a topic** you want to research (e.g., "best budget laptops for students")

2. **Click "Expand Query with AI"** - The app will suggest relevant subreddits

3. **Review and edit subreddits** - Add or remove subreddits as needed

4. **Click "Start Research"** - The app will:
   - Scrape posts from selected subreddits
   - Generate an AI summary with citations
   - Display results in an organized format

5. **View results:**
   - **Summary tab**: AI-generated narrative and key insights with citations
   - **Sources tab**: All scraped posts with links to Reddit

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **OpenAI API** - Query expansion and summarization
- **Cheerio** - Reddit scraping
- **Zustand** - State management

## API Routes

- `/api/expand` - Expands queries using OpenAI
- `/api/scrape` - Scrapes Reddit posts (SSE streaming)
- `/api/summarize` - Generates summaries with citations

## Notes

- Your OpenAI API key is stored locally in your browser
- Reddit scraping uses old.reddit.com (no API key needed)
- Rate limiting is built-in (1 second between subreddits)
- Maximum 100 posts per subreddit by default

## Future Enhancements

- Export results to JSON/PDF
- Advanced analytics and charts
- Theme clustering with embeddings
- Comment analysis
- Custom time ranges

## License

MIT
