// Typed API client. Talks ONLY to our own backend (VITE_API_BASE_URL).
// Never imports the Anthropic SDK and never calls api.anthropic.com.

import type {
  CheckReport,
  OptimizeReport,
  ResumeListItem,
  ResumeDetail,
  Mode,
  SaveReport,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null) ?? "Something went wrong. Try again.";
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export const api = {
  // Auth
  requestLink: (email: string) =>
    request<{ ok: true; message: string }>("/api/auth/request-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verify: (token: string) =>
    request<{ ok: true; email: string }>(
      `/api/auth/verify?token=${encodeURIComponent(token)}`
    ),
  me: () => request<{ email: string }>("/api/auth/me"),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  // AI
  build: (input: {
    role: string;
    tone: string;
    history: string;
    skills: string;
    education: string;
  }) =>
    request<{ resumeText: string }>("/api/build", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  // Streaming build: calls onDelta with each token chunk, resolves to the full
  // text. Falls back to throwing ApiError on network/HTTP errors.
  buildStream: async (
    input: {
      role: string;
      tone: string;
      history: string;
      skills: string;
      education: string;
    },
    onDelta: (chunk: string) => void
  ): Promise<string> => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/build/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw new ApiError("Network error. Check your connection and try again.", 0);
    }
    if (!res.ok || !res.body) {
      let message = "Something went wrong. Try again.";
      try {
        const body = await res.json();
        if (body && typeof body === "object" && "error" in body) {
          message = String((body as { error: unknown }).error);
        }
      } catch {
        /* non-JSON */
      }
      throw new ApiError(message, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let streamError: string | null = null;

    // Parse Server-Sent Events: events separated by a blank line; each has
    // optional `event:` and one or more `data:` lines.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        const dataStr = dataLines.join("\n");
        if (eventName === "error") {
          try {
            streamError = String(JSON.parse(dataStr).error);
          } catch {
            streamError = "Something went wrong. Try again.";
          }
        } else if (eventName === "message" && dataStr) {
          try {
            const chunk = String(JSON.parse(dataStr).delta ?? "");
            if (chunk) {
              full += chunk;
              onDelta(chunk);
            }
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    }
    if (streamError) throw new ApiError(streamError, 502);
    return full;
  },
  check: (resumeText: string) =>
    request<CheckReport>("/api/check", {
      method: "POST",
      body: JSON.stringify({ resumeText }),
    }),
  optimize: (resumeText: string, jobDescription: string) =>
    request<OptimizeReport>("/api/optimize", {
      method: "POST",
      body: JSON.stringify({ resumeText, jobDescription }),
    }),
  coverLetter: (resumeText: string, jobDescription: string, tone: string) =>
    request<{ letterText: string }>("/api/cover-letter", {
      method: "POST",
      body: JSON.stringify({ resumeText, jobDescription, tone }),
    }),

  // Resumes
  listResumes: () =>
    request<{ resumes: ResumeListItem[] }>("/api/resumes"),
  getResume: (id: string) => request<ResumeDetail>(`/api/resumes/${id}`),
  saveResume: (
    title: string,
    content: string,
    mode_origin: Mode,
    report?: SaveReport
  ) =>
    request<ResumeListItem>("/api/resumes", {
      method: "POST",
      body: JSON.stringify({ title, content, mode_origin, report }),
    }),
  deleteResume: (id: string) =>
    request<{ ok: true }>(`/api/resumes/${id}`, { method: "DELETE" }),
};
