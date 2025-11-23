# Deploying Readit to Vercel

This guide explains how to deploy Readit to Vercel. Since you are the only user, we will focus on a simple deployment with environment variables.

## Prerequisites

1.  A [GitHub](https://github.com/) account.
2.  A [Vercel](https://vercel.com/) account.
3.  Your Google Custom Search API keys (`GOOGLE_API_KEY` and `GOOGLE_CSE_ID`).

## Step 1: Push to GitHub

Ensure your project is pushed to a GitHub repository.

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 2: Import to Vercel

1.  Log in to your Vercel dashboard.
2.  Click **"Add New..."** -> **"Project"**.
3.  Select your `reddit-scraper` repository and click **"Import"**.

## Step 3: Configure Project

Vercel will automatically detect that this is a Next.js project. You don't need to change the build settings.

## Step 4: Environment Variables

**Crucial Step:** You must set the environment variables for the server-side scraping to work.

Expand the **"Environment Variables"** section and add the following:

| Name | Value | Description |
|------|-------|-------------|
| `GOOGLE_API_KEY` | `your_google_api_key` | Required for finding Reddit posts via Google. |
| `GOOGLE_CSE_ID` | `your_google_cse_id` | Required for finding Reddit posts via Google. |
| `OPENAI_API_KEY` | `your_openai_key` | (Optional) You can set a default key here. |

> **Note:** The `OPENAI_API_KEY` is optional in Vercel. If you don't set it here, you (or any user) can still enter it manually in the app's "Settings" menu, and it will be stored in the browser.

## Step 5: Deploy

Click **"Deploy"**. Vercel will build your application and assign it a domain (e.g., `readit-app.vercel.app`).

## Post-Deployment

-   Visit your new URL.
-   If you didn't set `OPENAI_API_KEY` in Vercel, go to **Settings** in the app and paste your key.
-   Start researching!

## Troubleshooting

-   **Search not working?** Check your Vercel logs. If you see errors about Google API, verify your `GOOGLE_API_KEY` and `GOOGLE_CSE_ID` in the Vercel project settings.
-   **"429 Too Many Requests"**: This usually comes from the Google API if you exceed the free quota (100 queries/day).
