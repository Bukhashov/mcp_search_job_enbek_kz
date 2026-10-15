# enbek.kz MCP Server

MCP (Model Context Protocol) сервер для парсинга данных с сайта [enbek.kz](https://enbek.kz) — государственного портала занятости Казахстана.

Переписан на Node.js/TypeScript.

## Возможности

- **Поиск вакансий** — по ключевым словам, региону, категории, зарплате
- **Детали вакансии** — полная информация: обязанности, навыки, контакты
- **Поиск резюме** — по ключевым словам, региону, категории
- **Справочники** — список регионов, городов и профессиональных категорий

## Требования

- Node.js 20+
- Установленный браузер Chromium для Playwright (`npm run playwright:install`)

## Установка

```bash
cd enbek_kz
npm install
npm run playwright:install
npm run build
```

## Запуск

```bash
npm start
```

Сервер запустится на `http://127.0.0.1:8000`

### Endpoints

| Endpoint | Описание |
|----------|----------|
| `/sse` | SSE соединение для MCP |
| `/messages/` | POST endpoint для MCP сообщений |
| `/health` | Проверка состояния сервера |

## MCP Tools

| Tool | Описание | Параметры |
|------|----------|-----------|
| `search_vacancies` | Поиск вакансий | `query`, `region`, `category`, `salary_min`, `salary_max`, `page` |
| `get_vacancy` | Детали вакансии | `vacancy_id` |
| `search_resumes` | Поиск резюме | `query`, `region`, `category`, `page` |
| `get_regions` | Список регионов | — |
| `get_cities` | Список городов с телефонными кодами | `region` |
| `get_categories` | Список категорий | — |

## Архитектура

```
enbek_kz/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts      # Точка входа, Express + SSE
│   ├── server.ts     # MCP сервер и инструменты
│   ├── scraper.ts    # Парсер сайта (Playwright + Cheerio)
│   ├── regions.ts    # Данные регионов и городов
│   ├── models.ts     # Типы данных
│   └── config.ts     # Конфигурация
└── README.md
```
