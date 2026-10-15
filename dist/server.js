import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EnbekScraper } from "./scraper.js";
import { CITIES_BY_REGION, CITY_PHONE_CODES, REGION_PHONE_CODES, } from "./regions.js";
const scraper = new EnbekScraper();
const regions = [
    { name: "г.Астана", vacancies: 7520, resumes: 18662 },
    { name: "г.Алматы", vacancies: 11424, resumes: 24656 },
    { name: "г.Шымкент", vacancies: 2183, resumes: 8564 },
    { name: "Акмолинская область", vacancies: 3234, resumes: 5111 },
    { name: "Актюбинская область", vacancies: 2401, resumes: 11072 },
    { name: "Алматинская область", vacancies: 2360, resumes: 14430 },
    { name: "Атырауская область", vacancies: 2259, resumes: 11780 },
    { name: "Восточно-Казахстанская область", vacancies: 4253, resumes: 6644 },
    { name: "Жамбылская область", vacancies: 1958, resumes: 9553 },
    { name: "Западно-Казахстанская область", vacancies: 2952, resumes: 12213 },
    { name: "Карагандинская область", vacancies: 5179, resumes: 8249 },
    { name: "Костанайская область", vacancies: 4576, resumes: 5643 },
    { name: "Кызылординская область", vacancies: 1024, resumes: 9232 },
    { name: "Мангистауская область", vacancies: 1336, resumes: 14945 },
    { name: "Область Абай", vacancies: 3281, resumes: 4411 },
    { name: "Область Жетісу", vacancies: 1247, resumes: 7536 },
    { name: "Область Ұлытау", vacancies: 914, resumes: 1646 },
    { name: "Павлодарская область", vacancies: 3868, resumes: 7548 },
    { name: "Северо-Казахстанская область", vacancies: 2518, resumes: 2658 },
    { name: "Туркестанская область", vacancies: 1376, resumes: 11168 },
];
const categories = [
    { name: "Безопасность и ЧС", vacancies: 1347 },
    { name: "IT и телекоммуникации", vacancies: 1258 },
    { name: "HR и секретариат", vacancies: 1308 },
    { name: "ЖКХ и благоустройство", vacancies: 1590 },
    { name: "Индивидуальные услуги и сервис", vacancies: 1232 },
    { name: "Культура и спорт", vacancies: 1221 },
    { name: "Нефть, газ, добыча ресурсов", vacancies: 883 },
    { name: "Образование и воспитание", vacancies: 8855 },
    { name: "Производство", vacancies: 7593 },
    { name: "Профессии без квалификации", vacancies: 5300 },
    { name: "Руководители", vacancies: 858 },
    { name: "Сельское хозяйство", vacancies: 729 },
    { name: "Социальное обслуживание", vacancies: 365 },
    { name: "Торговля и складирование", vacancies: 4478 },
    { name: "Транспорт и логистика", vacancies: 4102 },
    { name: "Финансы и бухучет", vacancies: 3043 },
    { name: "Строительство и архитектура", vacancies: 2810 },
    { name: "Проживание и питание", vacancies: 2384 },
    { name: "Энергетика", vacancies: 1680 },
    { name: "Наука и консалтинг", vacancies: 441 },
    { name: "Юриспруденция", vacancies: 439 },
    { name: "Маркетинг и СМИ", vacancies: 562 },
    { name: "Госслужба", vacancies: 645 },
    { name: "Туризм", vacancies: 153 },
];
const text = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
const errorText = (error) => ({
    content: [
        {
            type: "text",
            text: JSON.stringify({ error: String(error), type: error instanceof Error ? error.name : typeof error }, null, 2),
        },
    ],
    isError: true,
});
export function createMcpServer() {
    const server = new McpServer({ name: "enbek-kz", version: "0.1.0", title: "enbek.kz MCP Server" });
    server.registerTool("search_vacancies", {
        title: "Search Vacancies",
        description: "Search for job vacancies on enbek.kz. Returns a list of vacancies matching the specified criteria.",
        inputSchema: {
            query: z.string().default(""),
            region: z.string().default(""),
            category: z.string().default(""),
            salary_min: z.number().int().optional(),
            salary_max: z.number().int().optional(),
            page: z.number().int().min(1).default(1),
        },
        annotations: {
            title: "Search Vacancies",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ query, region, category, salary_min, salary_max, page }) => {
        try {
            const result = await scraper.searchVacancies(query ?? "", region ?? "", category ?? "", salary_min ?? null, salary_max ?? null, page ?? 1);
            return text({
                total: result.total,
                page: result.page,
                total_pages: result.total_pages,
                count: result.items.length,
                items: result.items,
            });
        }
        catch (e) {
            return errorText(e);
        }
    });
    server.registerTool("get_vacancy", {
        title: "Get Vacancy Details",
        description: "Get detailed information about a specific vacancy by ID. Returns full job description, responsibilities, skills, and contact info.",
        inputSchema: {
            vacancy_id: z.string(),
        },
        annotations: {
            title: "Get Vacancy Details",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ vacancy_id }) => {
        try {
            const result = await scraper.getVacancy(vacancy_id);
            if (!result)
                return text({ error: `Vacancy with ID ${vacancy_id} not found` });
            return text(result);
        }
        catch (e) {
            return errorText(e);
        }
    });
    server.registerTool("search_resumes", {
        title: "Search Resumes",
        description: "Search for resumes on enbek.kz. Returns a list of resumes matching the specified criteria.",
        inputSchema: {
            query: z.string().default(""),
            region: z.string().default(""),
            category: z.string().default(""),
            page: z.number().int().min(1).default(1),
        },
        annotations: {
            title: "Search Resumes",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ query, region, category, page }) => {
        try {
            const result = await scraper.searchResumes(query ?? "", region ?? "", category ?? "", page ?? 1);
            return text({
                total: result.total,
                page: result.page,
                total_pages: result.total_pages,
                count: result.items.length,
                items: result.items,
            });
        }
        catch (e) {
            return errorText(e);
        }
    });
    server.registerTool("get_regions", {
        title: "Get Regions",
        description: "Get list of available regions on enbek.kz for filtering.",
        annotations: {
            title: "Get Regions",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async () => text(regions));
    server.registerTool("get_cities", {
        title: "Get Cities",
        description: "Get list of cities with phone codes by region on enbek.kz for filtering.",
        inputSchema: {
            region: z.string().default(""),
        },
        annotations: {
            title: "Get Cities",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ region }) => {
        const r = region ?? "";
        if (r) {
            const cities = CITIES_BY_REGION[r];
            if (!cities) {
                return text({
                    error: `Region '${r}' not found`,
                    available_regions: Object.keys(CITIES_BY_REGION),
                });
            }
            const regionCode = REGION_PHONE_CODES[r] ?? "";
            return text({
                region: r,
                region_phone_code: regionCode,
                cities: cities.map((city) => ({
                    name: city,
                    phone_code: CITY_PHONE_CODES[city] ?? regionCode,
                })),
            });
        }
        const result = {};
        for (const [reg, cities] of Object.entries(CITIES_BY_REGION)) {
            const regionCode = REGION_PHONE_CODES[reg] ?? "";
            result[reg] = {
                region_phone_code: regionCode,
                cities: cities.map((city) => ({
                    name: city,
                    phone_code: CITY_PHONE_CODES[city] ?? regionCode,
                })),
            };
        }
        return text(result);
    });
    server.registerTool("get_categories", {
        title: "Get Categories",
        description: "Get list of professional categories on enbek.kz for filtering.",
        annotations: {
            title: "Get Categories",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async () => text(categories));
    return server;
}
