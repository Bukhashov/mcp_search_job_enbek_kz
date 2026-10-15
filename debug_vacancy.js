import * as cheerio from "cheerio";
import { chromium } from "playwright";

const BASE_URL = "https://enbek.kz";
const LANG = "ru";

async function debugVacancy(vacancyId) {
  console.log(`\n=== Debugging vacancy ${vacancyId} ===`);
  
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    locale: "ru-RU",
    viewport: { width: 1920, height: 1080 },
  });
  
  try {
    const page = await context.newPage();
    const url = `${BASE_URL}/${LANG}/vacancy/~${vacancyId}`;
    console.log('Fetching:', url);
    
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    
    // Save HTML for inspection
    const fs = await import('fs');
    fs.writeFileSync(`vacancy_${vacancyId}.html`, html);
    console.log(`Saved HTML to vacancy_${vacancyId}.html (${html.length} chars)`);
    
    const $ = cheerio.load(html);
    
    // Try various selectors for title
    console.log('\n--- Title selectors ---');
    const titleSelectors = [
      'h1',
      '.vacancy-title',
      '[data-testid="vacancy-title"]',
      '.vacancy-header h1',
      '.job-title',
      '.vacancy-name',
      'h1.vacancy-title',
      '.title',
    ];
    for (const sel of titleSelectors) {
      const el = $(sel).first();
      if (el.length) console.log(`  ${sel}: "${el.text().trim()}"`);
    }
    
    // Company
    console.log('\n--- Company selectors ---');
    const companySelectors = [
      '.company-name',
      '.employer',
      '[data-testid="company-name"]',
      '.vacancy-company',
      '.company',
      '.employer-name',
      'a[href*="/company/"]',
    ];
    for (const sel of companySelectors) {
      const el = $(sel).first();
      if (el.length) console.log(`  ${sel}: "${el.text().trim()}"`);
    }
    
    // Category
    console.log('\n--- Category selectors ---');
    const catSelectors = [
      '.category',
      '.vacancy-category',
      '.professional-area',
      '.job-category',
      '[data-category]',
    ];
    for (const sel of catSelectors) {
      const el = $(sel).first();
      if (el.length) console.log(`  ${sel}: "${el.text().trim()}"`);
    }
    
    // Region/Location
    console.log('\n--- Region/Location selectors ---');
    const regionSelectors = [
      '.region',
      '.location',
      '.vacancy-region',
      '.address',
      '[data-region]',
      '.city',
    ];
    for (const sel of regionSelectors) {
      const el = $(sel).first();
      if (el.length) console.log(`  ${sel}: "${el.text().trim()}"`);
    }
    
    // Salary
    console.log('\n--- Salary selectors ---');
    const salarySelectors = [
      '.salary',
      '.vacancy-salary',
      '.price',
      '[data-salary]',
      '.amount',
    ];
    for (const sel of salarySelectors) {
      const el = $(sel).first();
      if (el.length) console.log(`  ${sel}: "${el.text().trim()}"`);
    }
    
    // Experience
    console.log('\n--- Experience selectors ---');
    const expSelectors = [
      '.experience',
      '.vacancy-experience',
      '[data-experience]',
      '.work-experience',
    ];
    for (const sel of expSelectors) {
      const el = $(sel).first();
      if (el.length) console.log(`  ${sel}: "${el.text().trim()}"`);
    }
    
    // Description/Content
    console.log('\n--- Content/Description selectors ---');
    const contentSelectors = [
      '.vacancy-content',
      '.description',
      '.vacancy-description',
      '.job-description',
      'main',
      '[data-description]',
      '.content',
    ];
    for (const sel of contentSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().replace(/\s+/g, ' ').trim().slice(0, 200);
        console.log(`  ${sel}: "${text}..."`);
      }
    }
    
    // Look for structured data (JSON-LD)
    console.log('\n--- JSON-LD structured data ---');
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        console.log(`  Found JSON-LD:`, JSON.stringify(data, null, 2).slice(0, 500));
      } catch {}
    });
    
    // Look for any data-* attributes
    console.log('\n--- Elements with data-* attributes ---');
    $('[data-vacancy-id], [data-id], [data-testid]').each((i, el) => {
      const attrs = el.attribs;
      console.log(`  ${el.tagName}:`, Object.keys(attrs).filter(k => k.startsWith('data')).map(k => `${k}="${attrs[k]}"`).join(', '));
    });
    
    // Print all class names found
    console.log('\n--- Common class names ---');
    const classes = new Set();
    $('[class]').each((i, el) => {
      const cls = $(el).attr('class');
      if (cls) cls.split(/\s+/).forEach(c => classes.add(c));
    });
    [...classes].filter(c => c.includes('vacancy') || c.includes('job') || c.includes('company') || c.includes('salary') || c.includes('region') || c.includes('experience')).forEach(c => console.log(`  .${c}`));
    
  } finally {
    await context.close();
    await browser.close();
  }
}

// Test with a few IDs from our search results
const ids = ['6136763', '6136762', '6136761'];
for (const id of ids) {
  await debugVacancy(id);
  console.log('\n==========================================\n');
}