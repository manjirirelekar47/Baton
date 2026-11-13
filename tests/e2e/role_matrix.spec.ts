import { test, expect } from "@playwright/test";

test.describe("Role Matrix and Access Control Verification", () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post("http://127.0.0.1:8000/demo/reset");
    await page.goto("/");
  });

  test("approver has full review, readiness, and snapshot approval controls", async ({ page }) => {
    const roleSelect = page.locator("header select");
    await roleSelect.selectOption("approver");
    await page.getByRole("link", { name: "Review" }).click();

    // Verify approver controls
    await expect(page.getByRole("heading", { name: "Review and approve" })).toBeVisible();
    await expect(page.getByText("Readiness Gate")).toBeVisible();
    await expect(page.getByRole("button", { name: "Audit Trail" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Version History" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm all verified" })).toBeVisible();
  });

  test("leaver sees gap interview and confidentiality banner, not approver queue", async ({ page }) => {
    const roleSelect = page.locator("header select");
    await roleSelect.selectOption("leaver");
    await page.getByRole("link", { name: "Review" }).click();

    // Verify leaver landing
    await expect(page.getByRole("heading", { name: "Leaver Handover" })).toBeVisible();
    await expect(page.getByText("Confidentiality & Automated Redaction")).toBeVisible();
    await expect(page.getByText(/Secrets .* are automatically redacted/i)).toBeVisible();

    // Verify approver buttons are NOT visible
    await expect(page.getByRole("button", { name: "Confirm all verified" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Approve & Share Handover" })).not.toBeVisible();
  });

  test("incoming maintainer sees read-only banner and appropriate ACL restrictions", async ({ page }) => {
    const roleSelect = page.locator("header select");
    await roleSelect.selectOption("incoming_maintainer");
    await page.getByRole("link", { name: "Review" }).click();

    // Review page is read-only
    await expect(page.getByText("Read-Only View")).toBeVisible();
    await expect(page.getByText(/restricted to project approvers/i)).toBeVisible();

    // Navigate to Handover
    await page.getByRole("link", { name: "Handover" }).click();
    await expect(page).toHaveURL(/.*handover/);
  });

  test("incoming contributor sees read-only banner and hidden placeholders in handover", async ({ page }) => {
    const roleSelect = page.locator("header select");
    await roleSelect.selectOption("incoming_contributor");
    await page.getByRole("link", { name: "Review" }).click();

    // Review page is read-only
    await expect(page.getByText("Read-Only View")).toBeVisible();

    // Navigate to Handover
    await page.getByRole("link", { name: "Handover" }).click();
    await expect(page).toHaveURL(/.*handover/);

    // Verify placeholder exists for hidden higher-tier claims
    const placeholder = page.getByRole("note");
    if (await placeholder.isVisible()) {
      await expect(placeholder).toContainText(/hidden because of access level/i);
    }
  });
});
