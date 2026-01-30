/**
 * Scrapes Mills Baker's Substack Notes page.
 * 
 * This is intentionally fragile - Substack's HTML structure may change.
 * Run this manually when needed, or before the main build.
 * 
 * Usage: node scrape-notes.js
 * 
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const NOTES_URL = 'https://substack.com/@mills';
const MAX_NOTES = 5;
const OUTPUT_FILE = path.join(__dirname, 'notes.json');

async function scrapeNotes() {
    console.log('Launching browser...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log(`Navigating to ${NOTES_URL}...`);
    await page.goto(NOTES_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for content to load - Substack uses React, so we need to wait for JS
    console.log('Waiting for content to load...');
    await page.waitForSelector('[class*="post"]', { timeout: 15000 }).catch(() => {
        console.log('No posts found with standard selector, trying alternatives...');
    });
    
    // Give it a bit more time for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract notes - this selector may need updating if Substack changes their markup
    const notes = await page.evaluate((maxNotes) => {
        const results = [];
        
        // Try to find note/post containers - Substack's structure varies
        // Look for links that go to notes or posts
        const postLinks = document.querySelectorAll('a[href*="/note/"], a[href*="/p/"]');
        
        const seen = new Set();
        
        for (const link of postLinks) {
            if (results.length >= maxNotes) break;
            
            const href = link.href;
            if (seen.has(href)) continue;
            seen.add(href);
            
            // Skip if it's not a note (we want notes, not full posts for this column)
            // Notes have /note/ in the URL
            if (!href.includes('/note/')) continue;
            
            // Try to find the text content
            // Notes typically have the content as text inside or nearby
            let title = '';
            
            // Look for text content within the link or its parent
            const textContent = link.textContent?.trim() || 
                               link.closest('[class*="post"]')?.textContent?.trim() || '';
            
            if (textContent) {
                // Truncate long notes for display
                title = textContent.length > 80 
                    ? textContent.substring(0, 77) + '...' 
                    : textContent;
            }
            
            if (title && title.length > 5) {
                // Try to find a date
                const parentContainer = link.closest('[class*="post"]') || link.parentElement;
                const timeEl = parentContainer?.querySelector('time');
                const dateText = timeEl?.textContent?.trim() || 
                                timeEl?.getAttribute('datetime') || '';
                
                let formattedDate = '';
                if (dateText) {
                    try {
                        const date = new Date(dateText);
                        if (!isNaN(date)) {
                            formattedDate = date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            });
                        }
                    } catch (e) {
                        formattedDate = dateText;
                    }
                }
                
                results.push({
                    title: title.replace(/\s+/g, ' ').trim(),
                    link: href,
                    date: formattedDate
                });
            }
        }
        
        return results;
    }, MAX_NOTES);
    
    await browser.close();
    
    if (notes.length === 0) {
        console.log('Warning: No notes found. The scraper may need updating.');
        console.log('Falling back to placeholder...');
        return [{
            title: 'Visit my Substack for notes',
            link: NOTES_URL,
            date: ''
        }];
    }
    
    console.log(`Found ${notes.length} notes`);
    return notes;
}

async function main() {
    try {
        const notes = await scrapeNotes();
        
        // Write to JSON file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(notes, null, 2));
        console.log(`Saved ${notes.length} notes to ${OUTPUT_FILE}`);
        
        // Print what we found
        console.log('\nScraped notes:');
        notes.forEach((note, i) => {
            console.log(`${i + 1}. ${note.title}`);
            console.log(`   ${note.link}`);
            console.log(`   ${note.date || '(no date)'}`);
        });
        
    } catch (err) {
        console.error('Scraping failed:', err.message);
        
        // Write a fallback
        const fallback = [{
            title: 'Visit my Substack for notes',
            link: NOTES_URL,
            date: ''
        }];
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fallback, null, 2));
        console.log('Wrote fallback to notes.json');
        
        process.exit(1);
    }
}

main();
