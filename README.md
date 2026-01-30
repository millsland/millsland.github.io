# mills.land

Personal website for Mills Baker. Fetches posts from Substack via RSS and displays them.

## Structure

- `index.html` - Template with placeholders
- `build.js` - Fetches RSS feeds and generates final HTML
- `scrape-notes.js` - Scrapes Substack Notes (requires Puppeteer)
- `notes.json` - Cached notes data (updated by scraper)
- `dist/` - Generated output (deployed to GitHub Pages)

## Local Development

```bash
# Install dependencies
npm install

# Scrape notes (optional, requires headed browser)
npm run scrape

# Build the site
npm run build

# Or do both
npm run update
```

## GitHub Actions

The site automatically rebuilds daily at 6am UTC via GitHub Actions. It will:

1. Attempt to scrape Notes (continues even if this fails)
2. Fetch RSS from both Substacks
3. Generate the HTML
4. Deploy to GitHub Pages

## Manual Notes Update

If the Notes scraper breaks (Substack changes their HTML), you can manually update `notes.json`:

```json
[
  {
    "title": "Your note text here...",
    "link": "https://substack.com/note/xxxxx",
    "date": "Jan 30, 2025"
  }
]
```

Then push to main—the GitHub Action will rebuild with your manual data.

## Feeds

- Rats from Rocks: `https://ratsfromrocks.substack.com/feed`
- Dead Horses: `https://thedeadhorses.substack.com/feed`
- Notes: Scraped from `https://substack.com/@mills`
