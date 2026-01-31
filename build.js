const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const RATS_FROM_ROCKS_RSS = 'https://ratsfromrocks.substack.com/feed';
const DEAD_HORSES_RSS = 'https://thedeadhorses.substack.com/feed';
const MAX_POSTS = 5;

// Simple XML parsing for RSS (no dependencies)
function parseRSS(xml) {
    const items = [];
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const itemXml of itemMatches.slice(0, MAX_POSTS)) {
        const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || 'Untitled';
        const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '#';
        const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';

        let formattedDate = '';
        if (pubDate) {
            const date = new Date(pubDate);
            formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }

        items.push({ title: decodeHTMLEntities(title), link, date: formattedDate });
    }

    return items;
}

function decodeHTMLEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
}

function fetch(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MillsLandBot/1.0; +https://mills.land)',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        };

        protocol.get(options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location).then(resolve).catch(reject);
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function generatePostsHTML(posts) {
    return posts.map(post => `
                    <li class="nav-item">
                        <a href="${post.link}" target="_blank" rel="noopener">
                            ${escapeHTML(post.title)}
                            <span>${post.date}</span>
                        </a>
                    </li>`).join('');
}

function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function build() {
    console.log('Fetching RSS feeds...');

    // Fetch both RSS feeds
    let ratsFromRocksPosts = [];
    let deadHorsesPosts = [];

    try {
        const ratsRSS = await fetch(RATS_FROM_ROCKS_RSS);
        ratsFromRocksPosts = parseRSS(ratsRSS);
        console.log(`Fetched ${ratsFromRocksPosts.length} posts from Rats from Rocks`);
    } catch (err) {
        console.error('Error fetching Rats from Rocks RSS:', err.message);
    }

    try {
        const deadHorsesRSS = await fetch(DEAD_HORSES_RSS);
        deadHorsesPosts = parseRSS(deadHorsesRSS);
        console.log(`Fetched ${deadHorsesPosts.length} posts from Dead Horses`);
    } catch (err) {
        console.error('Error fetching Dead Horses RSS:', err.message);
    }

    // Load Notes from JSON file (populated by scraper)
    let notesPosts = [];
    const notesPath = path.join(__dirname, 'notes.json');
    if (fs.existsSync(notesPath)) {
        try {
            notesPosts = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
            console.log(`Loaded ${notesPosts.length} notes from notes.json`);
        } catch (err) {
            console.error('Error loading notes.json:', err.message);
        }
    } else {
        console.log('No notes.json found, using placeholder');
        notesPosts = [
            { title: 'Notes coming soon...', link: 'https://substack.com/@mills', date: '' }
        ];
    }

    // Read template
    const templatePath = path.join(__dirname, 'index.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders
    html = html.replace(
        '<!-- RATS_FROM_ROCKS_POSTS -->',
        generatePostsHTML(ratsFromRocksPosts)
    );

    html = html.replace(
        '<!-- DEAD_HORSES_POSTS -->',
        generatePostsHTML(deadHorsesPosts)
    );

    html = html.replace(
        '<!-- NOTES_POSTS -->',
        generatePostsHTML(notesPosts)
    );

    // Write output
    const outputPath = path.join(__dirname, 'dist', 'index.html');
    fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
    fs.writeFileSync(outputPath, html);

    console.log(`Built site to ${outputPath}`);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
