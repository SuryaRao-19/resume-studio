// Deterministic mock AI provider, used only when AI_PROVIDER=mock (tests / CI).
// No network, no model — returns canned, well-formed responses shaped by the
// system prompt so the full request → DB → UI flow can run without a real LLM.

const BUILD_TEXT = `**PROFESSIONAL SUMMARY**
Experienced engineer with a track record of shipping reliable software and mentoring teammates.

**SKILLS**
- TypeScript
- Node.js
- PostgreSQL

**EXPERIENCE**
Senior Engineer, Example Corp (2019-Present)
- Led initiatives that improved performance and reliability.
- Mentored engineers and drove engineering best practices.

**EDUCATION**
B.S. Computer Science`;

const COVER_TEXT = `Dear Hiring Manager,

I am excited to bring my backend engineering experience to your team. My background maps closely to your needs, from building reliable services to mentoring peers.

In recent roles I have delivered measurable improvements and collaborated across functions to ship impactful work that moved key metrics.

I would welcome the chance to discuss how I can contribute.

Sincerely,`;

const CHECK_JSON = {
  score: 82,
  strengths: ["Clear structure", "Relevant technical skills", "Quantified impact"],
  issues: [
    "Add more metrics to experience bullets",
    "Tighten the professional summary",
    "Expand the education section",
  ],
  ats_flags: [],
};

const OPTIMIZE_JSON = {
  match_score: 68,
  matched_keywords: ["Node.js", "PostgreSQL", "AWS"],
  missing_keywords: ["Go", "Kubernetes", "Kafka"],
  rewrite_suggestions: [
    "Emphasize distributed-systems experience",
    "Add observability and on-call ownership",
    "Quantify latency and throughput improvements",
  ],
  tailored_summary:
    "Backend engineer aligning proven Node.js and cloud experience with the role's distributed-systems needs.",
  tailored_resume: `**PROFESSIONAL SUMMARY**
Backend engineer tailored to high-throughput, distributed systems.

**SKILLS**
- Node.js
- PostgreSQL
- Distributed systems

**EXPERIENCE**
Backend Engineer, Acme Corp
- Built and scaled services with an emphasis on reliability and observability.`,
};

// Pick a canned response using markers unique to each mode's system prompt.
function responseFor(system: string): string {
  if (system.includes("match_score")) return JSON.stringify(OPTIMIZE_JSON);
  if (system.includes("ats_flags")) return JSON.stringify(CHECK_JSON);
  if (system.includes("cover-letter")) return COVER_TEXT;
  return BUILD_TEXT;
}

export async function callMock(opts: { system: string }): Promise<string> {
  return responseFor(opts.system);
}

export async function* callMockStream(opts: { system: string }): AsyncGenerator<string> {
  const text = responseFor(opts.system);
  // Emit in a few chunks so the streaming UI path is exercised.
  const size = Math.ceil(text.length / 6);
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
    await new Promise((r) => setTimeout(r, 10));
  }
}
