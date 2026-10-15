export interface VacancySummary {
  id: string;
  title: string;
  category: string;
  salary_min: number | null;
  salary_max: number | null;
  company: string;
  region: string;
  experience: string;
  schedule: string;
  education: string;
  published_at: string;
  url: string;
}

export interface VacancyDetail extends VacancySummary {
  company_field: string;
  company_size: string;
  address: string;
  employment_type: string;
  conditions: string;
  internship: string;
  positions_count: number;
  responsibilities: string[];
  skills: string[];
  personal_qualities: string[];
  languages: string[];
  contact_person: string;
  contact_phone: string;
  contact_email: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  category: string;
  experience: string;
  region: string;
  salary: number | null;
  education: string;
  published_at: string;
  url: string;
}

export interface VacancySearchResult {
  items: VacancySummary[];
  total: number;
  page: number;
  total_pages: number;
}

export interface ResumeSearchResult {
  items: ResumeSummary[];
  total: number;
  page: number;
  total_pages: number;
}
