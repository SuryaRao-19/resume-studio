import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth.js";

const EMAIL = "e2e@resume.test";

const RESUME = `PROFESSIONAL SUMMARY
Backend engineer with 5 years building Node.js services.

EXPERIENCE
Backend Engineer, Acme Corp (2019-Present)
- Built REST APIs and background workers on AWS.

SKILLS
Node.js, JavaScript, PostgreSQL, AWS

EDUCATION
B.Tech Computer Science, 2019`;

const JOB = `Staff Backend Engineer: strong Go, Kubernetes, event-driven
architecture (Kafka) and observability to scale high-throughput payments.`;

// Wait for either a success locator or the inline error banner; fail loudly.
async function expectResult(page: Page, successText: string, label: string) {
  const err = page.locator(".msg.error");
  const winner = await Promise.race([
    page.getByText(successText).first().waitFor({ state: "visible" }).then(() => "ok"),
    err.first().waitFor({ state: "visible" }).then(() => "err"),
  ]);
  if (winner === "err") throw new Error(`${label} errored: ${await err.first().innerText()}`);
}

test.beforeEach(async ({ page }) => {
  await signIn(page, EMAIL);
});

test("build streams a draft with edit and export controls", async ({ page }) => {
  await page.getByPlaceholder("e.g. Product Manager").fill("Backend Engineer");
  await page.getByPlaceholder(/Rough notes about roles/).fill(
    "5 years Node.js and Go. Cut latency 40%. Mentored 4 engineers."
  );
  await page.getByRole("button", { name: "Draft resume" }).click();

  await expect(page.locator(".output.md")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save this resume" })).toBeVisible();
  for (const name of ["Edit", "Copy", "PDF", "DOCX"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }

  // Edit toggle reveals an editable, prefilled textarea.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const ta = page.getByLabel("Edit draft resume");
  await expect(ta).toBeVisible();
  expect((await ta.inputValue()).length).toBeGreaterThan(50);
});

test("check scores a resume", async ({ page }) => {
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByPlaceholder("Paste the full text of your resume…").fill(RESUME);
  await page.getByRole("button", { name: "Check resume" }).click();
  await expectResult(page, "Resume score", "Check");
  await expect(page.locator(".marked-list.good li").first()).toBeVisible();
});

test("optimize saves a resume and persists its report", async ({ page }) => {
  await page.getByRole("button", { name: "Optimize", exact: true }).first().click();
  await page.getByPlaceholder("Paste your resume…").fill(RESUME);
  await page.getByPlaceholder("Paste the job posting…").fill(JOB);
  await page.getByRole("button", { name: "Optimize", exact: true }).nth(1).click();
  await expectResult(page, "Match score", "Optimize");

  await page.getByRole("button", { name: "Save this resume" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved to My resumes.")).toBeVisible();

  // The persisted report should surface in the saved-resume detail.
  await page.getByRole("button", { name: "My resumes" }).click();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByText(/Latest optimize report · score \d+\/100/)).toBeVisible();
});

test("cover letter generates from resume + job", async ({ page }) => {
  await page.getByRole("button", { name: "Cover letter", exact: true }).click();
  await page.getByPlaceholder("Paste the resume to base the letter on…").fill(RESUME);
  await page.getByPlaceholder("Paste the job you're applying to…").fill(JOB);
  await page.getByRole("button", { name: "Write cover letter" }).click();
  await expectResult(page, "Cover letter", "Cover letter");
  await expect(page.getByRole("button", { name: "Save this letter" })).toBeVisible();
});
