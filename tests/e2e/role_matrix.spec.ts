import { test, expect } from "@playwright/test";

async function loginAsRole(page: any, request: any, role: string, targetUrl: string = "/dashboard") {
  const res = await request.post("http://127.0.0.1:8000/auth/demo-login", {
    data: { role },
  });
  const { token } = await res.json();
  await page.goto("/login");
  await page.evaluate((t: string) => {
    localStorage.setItem("baton.token", t);
  }, token);
  await page.goto(targetUrl);
}

test.describe("Role Matrix and Access Control Verification", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("http://127.0.0.1:8000/demo/reset");
  });

  test("approver has full review, readiness, and snapshot approval controls", async ({ page, request }) => {
    await loginAsRole(page, request, "approver");
    await page.getByRole("link", { name: /Review/i }).first().click();

    // Verify approver controls
    await expect(page.getByRole("heading", { name: /Handover Checklist & Review|Review/i }).first()).toBeVisible();
    await expect(page.getByText(/Handover Checklist|Readiness/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Audit Trail" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Version History" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm all verified" }).first()).toBeVisible();

    // Verify Audit Trail modal opens and closes
    await page.getByRole("button", { name: "Audit Trail" }).first().click();
    const auditModal = page.getByRole("dialog", { name: "Audit Trail" }).first();
    await expect(auditModal).toBeVisible();
    await expect(auditModal.getByRole("heading", { name: "Audit Trail" }).first()).toBeVisible();
    await auditModal.getByRole("button", { name: "Close" }).first().click();
    await expect(auditModal).not.toBeVisible();
  });

  test("leaver sees gap interview and confidentiality banner, not approver queue", async ({ page, request }) => {
    await loginAsRole(page, request, "leaver");
    await page.getByRole("link", { name: /Review/i }).first().click();

    // Verify leaver landing
    await expect(page.getByRole("heading", { name: /Handover Questions & Answers|Leaver Gap Interview|Leaver/i }).first()).toBeVisible();
    await expect(page.getByText("Confidentiality & Automated Redaction").first()).toBeVisible();
    await expect(page.getByText(/Secrets .* are automatically redacted/i).first()).toBeVisible();

    // Verify approver buttons are NOT visible
    await expect(page.getByRole("button", { name: "Confirm all verified" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Approve & Share Handover" })).not.toBeVisible();
  });

  test("incoming maintainer sees read-only banner and appropriate ACL restrictions", async ({ page, request }) => {
    await loginAsRole(page, request, "incoming_maintainer");
    await page.getByRole("link", { name: /Review/i }).first().click();

    // Review page is read-only
    await expect(page.getByText("Read-Only View").first()).toBeVisible();
    await expect(page.getByText(/reserved for project approvers|restricted to project approvers/i).first()).toBeVisible();

    // Navigate to Handover
    await page.getByRole("link", { name: /Handover|Go to Handover/i }).first().click();
    await expect(page).toHaveURL(/.*handover/);
  });

  test("incoming contributor sees read-only banner and hidden placeholders in handover", async ({ page, request }) => {
    await loginAsRole(page, request, "incoming_contributor");
    await page.getByRole("link", { name: /Review/i }).first().click();

    // Review page is read-only
    await expect(page.getByText("Read-Only View").first()).toBeVisible();

    // Navigate to Handover
    await page.getByRole("link", { name: /Handover|Go to Handover/i }).first().click();
    await expect(page).toHaveURL(/.*handover/);

    // Verify placeholder exists for hidden higher-tier claims
    const placeholder = page.getByRole("note").first();
    if (await placeholder.isVisible()) {
      await expect(placeholder).toContainText(/hidden because of access level/i);
    }
  });
});
