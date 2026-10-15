import * as cheerio from "cheerio";
import { chromium, type Browser } from "playwright";

import { settings } from "./config.js";
import type {
  ResumeSearchResult,
  ResumeSummary,
  VacancyDetail,
  VacancySearchResult,
  VacancySummary,
} from "./models.js";

export class EnbekScraper {
  private browser: Browser | null = null;
  private base_url = settings.baseUrl;
  private lang = settings.defaultLang;
  private timeout = settings.requestTimeout * 1000;

  async getPage(url: string, params?: Record<string, unknown>): Promise<string> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
    }

    const context = await this.browser.newContext({
      userAgent: settings.userAgent,
      locale: "ru-RU",
      viewport: { width: 1920, height: 1080 },
    });

    try {
      const page = await context.newPage();
      let fullUrl = url;
      if (params && Object.keys(params).length > 0) {
        const query = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
          if (v !== null && v !== undefined) query.append(k, String(v));
        }
        fullUrl = `${url}?${query.toString()}`;
      }

      await page.goto(fullUrl, { waitUntil: "networkidle", timeout: this.timeout });
      await page.waitForTimeout(2000);
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await page.waitForTimeout(1000);

      return await page.content();
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private parseSalary(text: string): [number | null, number | null] {
    if (!text) return [null, null];

    text = text.replace(/\xa0/g, " ");

    let match = text.match(/от\s+([\d\s]+)\s+до\s+([\d\s]+)/i);
    if (match) {
      return [
        parseInt(match[1].replace(/\s/g, ""), 10),
        parseInt(match[2].replace(/\s/g, ""), 10),
      ];
    }

    match = text.match(/от\s+([\d\s]+)/i);
    if (match) {
      return [parseInt(match[1].replace(/\s/g, ""), 10), null];
    }

    match = text.match(/([\d\s]+)\s*(?:тг|тенге)/i);
    if (match) {
      return [parseInt(match[1].replace(/\s/g, ""), 10), null];
    }

    return [null, null];
  }

  private extractId(href: string): string {
    const match = href.match(/~(\d+)/);
    return match ? match[1] : "";
  }

  async searchVacancies(
    query = "",
    region = "",
    category = "",
    salary_min: number | null = null,
    salary_max: number | null = null,
    page = 1,
  ): Promise<VacancySearchResult> {
    const url = `${this.base_url}/${this.lang}/search/vacancy`;
    const params: Record<string, unknown> = { page };
    if (query) params.q = query;
    if (region) params.region = region;
    if (category) params.category = category;
    if (salary_min) params.salary_min = salary_min;
    if (salary_max) params.salary_max = salary_max;

    const html = await this.getPage(url, params);
    const $ = cheerio.load(html);

    const items: VacancySummary[] = [];
    const seen = new Set<string>();

    const vacancyLinks = $(`a[href*="/${this.lang}/vacancy/"]`);
    vacancyLinks.each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const vacId = this.extractId(href);
      if (vacId && !seen.has(vacId)) {
        seen.add(vacId);
        const title = $(el).text().trim();
        if (title && title.length > 3) {
          items.push({
            id: vacId,
            title,
            category: "",
            salary_min: null,
            salary_max: null,
            company: "",
            region: "",
            experience: "",
            schedule: "",
            education: "",
            published_at: "",
            url: `${this.base_url}${href}`,
          });
        }
      }
    });

    let total = 0;
    const pageText = $.text();
    const totalPatterns = [
      /(\d+)\s*(?:объявлений|вакансий|результатов)/i,
      /(\d+)\s*(?:announcements|vacancies|results)/i,
    ];
    for (const pattern of totalPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        total = parseInt(match[1], 10);
        break;
      }
    }

    let totalPages = 1;
    const pageNumbers: number[] = [];
    $("a[href*='page=']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/page=(\d+)/);
      if (match) pageNumbers.push(parseInt(match[1], 10));
    });
    if (pageNumbers.length > 0) totalPages = Math.max(...pageNumbers);

    return { items, total, page, total_pages: totalPages };
  }

  async getVacancy(vacancyId: string): Promise<VacancyDetail | null> {
    const url = `${this.base_url}/${this.lang}/vacancy/~${vacancyId}`;
    const html = await this.getPage(url);
    const $ = cheerio.load(html);

    // DEBUG: log JSON-LD scripts found
    console.error(`[DEBUG] JSON-LD scripts found: ${$('script[type="application/ld+json"]').length}`);
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const content = $(el).html() ?? "";
        console.error(`[DEBUG] Script ${i}:`, content.slice(0, 200));
        const data = JSON.parse(content);
        console.error(`[DEBUG] Parsed @type:`, data["@type"]);
      } catch (e) {
        console.error(`[DEBUG] Parse error:`, e);
      }
    });

    // --- Parse JSON-LD (schema.org JobPosting) first ---
    let jsonLd: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? "");
        if (data["@type"] === "JobPosting") {
          jsonLd = data;
          return false; // break
        }
      } catch {}
    });

    console.error(`[DEBUG] jsonLd found:`, jsonLd ? "YES" : "NO");
    if (jsonLd) {
      console.error(`[DEBUG] jsonLd title:`, jsonLd.title);
      console.error(`[DEBUG] jsonLd company:`, jsonLd.hiringOrganization?.name);
    }

    // Title
    let title = jsonLd?.title ?? "";
    if (!title) {
      const titleEl = $(".title").first();
      if (titleEl.length) title = titleEl.text().trim();
    }

    // Company
    let company = jsonLd?.hiringOrganization?.name ?? "";
    if (!company) {
      const comEl = $(".company-box .name, .company-name, .employer, [data-testid='company-name']").first();
      if (comEl.length) company = comEl.text().trim();
    }

    // Category - from .category class
    let category = "";
    const catEl = $(".category").first();
    if (catEl.length) category = catEl.text().trim();

    // Salary from JSON-LD
    let salary_min: number | null = null;
    let salary_max: number | null = null;
    if (jsonLd?.baseSalary?.value?.value) {
      salary_min = jsonLd.baseSalary.value.value;
      // If there's a max, it might be in a different field
    }
    // Fallback to .price element
    if (salary_min === null) {
      const priceEl = $(".price").first();
      if (priceEl.length) {
        [salary_min, salary_max] = this.parseSalary(priceEl.text());
      }
    }

    // Location/Region/Address from JSON-LD
    let region = "";
    let address = "";
    if (jsonLd?.jobLocation?.address) {
      const addr = jsonLd.jobLocation.address;
      address = addr.streetAddress ?? "";
      region = addr.addressLocality ?? "";
    }
    if (!region) {
      const locEl = $(".location").first();
      if (locEl.length) region = locEl.text().trim();
    }

    // Employment type from JSON-LD
    let employment_type = jsonLd?.employmentType ?? "";
    if (employment_type === "OTHER") employment_type = "";

    // Experience from JSON-LD
    let experience = jsonLd?.experienceRequirements ?? "";

    // Education from JSON-LD
    let education = jsonLd?.educationRequirements ?? "";

    // Published date from JSON-LD
    let published_at = jsonLd?.datePosted ?? "";

    // Description from JSON-LD
    let description = jsonLd?.description ?? "";

    // Skills from JSON-LD
    let skills: string[] = [];
    if (jsonLd?.skills) {
      skills = String(jsonLd.skills).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    // Get full page text for additional fields
    let contentElem = $(".content").first();
    if (!contentElem.length) contentElem = $(".vacancy-content").first();
    if (!contentElem.length) contentElem = $(".description").first();
    if (!contentElem.length) contentElem = $("main").first();
    const fullText = contentElem.length
      ? contentElem.text().replace(/\s+/g, "\n").trim()
      : "";

    // Extract additional fields from full text
    const pick = (patterns: RegExp[]): string => {
      for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match) return match[1].trim();
      }
      return "";
    };

    const schedule = pick([
      /График работы[:\s]*(.+?)(?:\n|$)/i,
      /Schedule[:\s]*(.+?)(?:\n|$)/i,
    ]);
    
    const conditions = pick([
      /Условия[:\s]*(.+?)(?:\n|$)/i,
      /Conditions[:\s]*(.+?)(?:\n|$)/i,
    ]);

    const internship = pick([
      /Стажировка[:\s]*(.+?)(?:\n|$)/i,
      /Internship[:\s]*(.+?)(?:\n|$)/i,
    ]);

    const positionsCountMatch = fullText.match(/Количество мест[:\s]*(\d+)/i);
    const positions_count = positionsCountMatch ? parseInt(positionsCountMatch[1], 10) : 0;

    // Responsibilities - try to extract from description
    let responsibilities: string[] = [];
    if (description) {
      // Split by common delimiters
      responsibilities = description
        .split(/[;\n•·]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5 && s.length < 200)
        .slice(0, 10);
    }

    // Contact info from full text
    let contact_phone = "";
    const phoneMatch = fullText.match(
      /\+?7\s*[\(]?\d{3}[\)]?\s*\d{3}[\s-]*\d{2}[\s-]*\d{2}/,
    );
    if (phoneMatch) contact_phone = phoneMatch[0];

    let contact_email = "";
    const emailMatch = fullText.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) contact_email = emailMatch[0];

    // Company field/size - try to find in page
    let company_field = "";
    let company_size = "";
    const companyFieldEl = $(".company-field, .company-industry, .industry").first();
    if (companyFieldEl.length) company_field = companyFieldEl.text().trim();
    const companySizeEl = $(".company-size, .company-employees").first();
    if (companySizeEl.length) company_size = companySizeEl.text().trim();

    // Contact person
    let contact_person = "";
    const contactPersonEl = $(".contact-person, .contact-name, [data-contact-person]").first();
    if (contactPersonEl.length) contact_person = contactPersonEl.text().trim();

    return {
      id: vacancyId,
      title,
      category,
      salary_min,
      salary_max,
      company,
      company_field,
      company_size,
      region,
      address,
      employment_type,
      schedule,
      conditions,
      internship,
      experience,
      education,
      positions_count,
      responsibilities,
      skills,
      personal_qualities: [],
      languages: [],
      contact_person,
      contact_phone,
      contact_email,
      published_at,
      url,
    };
  }

  async searchResumes(
    query = "",
    region = "",
    category = "",
    page = 1,
  ): Promise<ResumeSearchResult> {
    const url = `${this.base_url}/${this.lang}/search/resume`;
    const params: Record<string, unknown> = { page };
    if (query) params.q = query;
    if (region) params.region = region;
    if (category) params.category = category;

    const html = await this.getPage(url, params);
    const $ = cheerio.load(html);

    const items: ResumeSummary[] = [];
    const seen = new Set<string>();

    const resumeLinks = $(`a[href*="/${this.lang}/resume/"]`);
    resumeLinks.each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const resumeId = this.extractId(href);
      if (resumeId && !seen.has(resumeId)) {
        seen.add(resumeId);
        const title = $(el).text().trim();
        if (title && title.length > 3) {
          items.push({
            id: resumeId,
            title,
            category: "",
            region: "",
            education: "",
            experience: "",
            salary: null,
            published_at: "",
            url: `${this.base_url}${href}`,
          });
        }
      }
    });

    let total = 0;
    const totalElem = $(".pagination-total, .total-count, [data-total]").first();
    if (totalElem.length) {
      const numbers = totalElem.text().match(/\d+/g);
      if (numbers && numbers.length > 0) total = parseInt(numbers[0], 10);
    }

    let totalPages = 1;
    const pageNumbers: number[] = [];
    $("a[href*='page=']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/page=(\d+)/);
      if (match) pageNumbers.push(parseInt(match[1], 10));
    });
    if (pageNumbers.length > 0) totalPages = Math.max(...pageNumbers);

    return { items, total, page, total_pages: totalPages };
  }
}
