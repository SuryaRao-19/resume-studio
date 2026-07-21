export type Mode = "build" | "check" | "optimize" | "cover";

// Optional analysis report saved alongside a check/optimize resume.
export interface SaveReport {
  type: "check" | "optimize";
  score: number;
  report_json: unknown;
  job_description?: string | null;
}

export interface CheckReport {
  score: number;
  strengths: string[];
  issues: string[];
  ats_flags: string[];
}

export interface OptimizeReport {
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  rewrite_suggestions: string[];
  tailored_summary: string;
  tailored_resume: string;
}

export interface ResumeListItem {
  id: string;
  title: string;
  modeOrigin: Mode;
  updatedAt: string;
}

export interface ResumeDetail {
  id: string;
  title: string;
  content: string;
  mode_origin: Mode;
  updated_at: string;
  latest_report: {
    type: "check" | "optimize";
    score: number;
    report_json: unknown;
    job_description: string | null;
    created_at: string;
  } | null;
}
