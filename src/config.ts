import dotenv from "dotenv";

dotenv.config();

export const settings = {
  host: process.env.ENBEK_HOST ?? "127.0.0.1",
  port: Number(process.env.ENBEK_PORT ?? 8000),
  baseUrl: process.env.ENBEK_BASE_URL ?? "https://enbek.kz",
  defaultLang: process.env.ENBEK_DEFAULT_LANG ?? "ru",
  requestTimeout: Number(process.env.ENBEK_REQUEST_TIMEOUT ?? 30),
  maxRetries: Number(process.env.ENBEK_MAX_RETRIES ?? 3),
  rateLimitDelay: Number(process.env.ENBEK_RATE_LIMIT_DELAY ?? 1),
  userAgent:
    process.env.ENBEK_USER_AGENT ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as const;
