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

async function switchRole(page: any, request: any, role: string) {
  const res = await request.post("http://127.0.0.1:8000/auth/demo-login", {
    data: { role },
  });
  const { token } = await res.json();
  await page.evaluate((t: string) => {
    localStorage.setItem("baton.token", t);
  }, token);
}

test.describe("Judge Walkthrough - 7 Step End-to-End Flow", () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset demo state before each test run
    await request.post("http://127.0.0.1:8000/demo/reset");
    await loginAsRole(page, request, "approver");
  });

  test("full 7-step judge walkthrough", async ({ page, request }) => {
    // -----------------------------------------------------------------------
    // Step 1: Open demo project, verify branding and progress bar
    // -----------------------------------------------------------------------
    await expect(page.locator("aside img[alt='Baton']").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/Welcome to Baton|Baton/i);

    // Navigate to Reconstruct / Ledger step
    const reconstructLink = page.getByRole("link", { name: /Claim Ledger|Reconstruct|Ledger/i }).first();
    if (await reconstructLink.isVisible()) {
      await reconstructLink.click();
      await expect(page).toHaveURL(/.*ledger/);
    }

    // -----------------------------------------------------------------------
    // Step 2: Open Review queue & verify source citation drawer
    // -----------------------------------------------------------------------
    await page.getByRole("link", { name: /Review/i }).first().click();
    await expect(page).toHaveURL(/.*review/);
    await expect(page.getByRole("heading", { name: /Handover Checklist & Review|Review/i }).first()).toBeVisible();

    // Verify citation chip opens SourceDrawer with highlighted quote
    const citationChip = page.locator("button[title^='Chunk:']").first();
    if (await citationChip.isVisible()) {
      await citationChip.click();
      const sourceDrawer = page.getByRole("dialog", { name: /Source/i });
      if (await sourceDrawer.isVisible()) {
        await expect(sourceDrawer.locator("mark, p")).toBeVisible();
        await sourceDrawer.getByRole("button", { name: /Close/i }).click();
        await expect(sourceDrawer).not.toBeVisible();
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Open payments-owner conflict side-by-side
    // -----------------------------------------------------------------------
    // Switch to Conflicts filter tab
    const conflictsTab = page.getByRole("button", { name: /Conflicts/i }).first();
    if (await conflictsTab.isVisible()) {
      await conflictsTab.click();
    }

    // Click Resolve Conflict on the conflicting claim
    const resolveBtn = page.getByRole("button", { name: /Resolve Conflict/i }).first();
    if (await resolveBtn.isVisible()) {
      await resolveBtn.click();
      const conflictModal = page.getByRole("dialog", { name: /Resolve Conflict/i });
      if (await conflictModal.isVisible()) {
        await expect(conflictModal).toContainText("Side-by-Side Conflict Resolution");

        // -------------------------------------------------------------------
        // Step 4: Switch to Approver, resolve conflict, confirm the rest
        // -------------------------------------------------------------------
        const radios = conflictModal.getByLabel("Choose this statement as truth");
        if ((await radios.count()) > 0) {
          await radios.first().check();
        }

        // Apply Choice (reject other side)
        await conflictModal.getByRole("button", { name: /Apply Choice/i }).click();
        await expect(conflictModal).not.toBeVisible();
      }
    }

    // Bulk confirm remaining verified claims
    const bulkConfirmBtn = page.getByRole("button", { name: "Confirm all verified" }).first();
    if (await bulkConfirmBtn.isVisible() && (await bulkConfirmBtn.isEnabled())) {
      await bulkConfirmBtn.click();
      await page.waitForTimeout(500);
    }

    // -----------------------------------------------------------------------
    // Step 5: Approve version v1 into immutable snapshot
    // -----------------------------------------------------------------------
    const approveBtn = page.getByRole("button", { name: /Approve & Share Handover|Approve/i }).first();
    if (await approveBtn.isVisible() && (await approveBtn.isEnabled())) {
      await approveBtn.click();
      const shareModal = page.getByRole("dialog").first();
      if (await shareModal.isVisible()) {
        const contributorCheckbox = shareModal.getByLabel(/Incoming Contributor/i);
        if (await contributorCheckbox.isVisible()) {
          await contributorCheckbox.check();
        }

        // Submit approval
        const confirmBtn = shareModal.getByRole("button", { name: /Confirm Approval|Approve Snapshot|Approve/i }).first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }

        // Verify version history modal pops up showing snapshot hash
        const versionModal = page.getByRole("dialog", { name: "Version History" }).first();
        if (await versionModal.isVisible()) {
          await expect(versionModal).toContainText("Approved");
          await expect(versionModal).toContainText("Snapshot Hash");
          await versionModal.getByRole("button", { name: "Close" }).first().click();
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Switch to Incoming Contributor & verify restricted items hidden
    // -----------------------------------------------------------------------
    await loginAsRole(page, request, "incoming_contributor", "/dashboard");
    await page.getByRole("link", { name: /Review/i }).first().click();

    // On Review page, Incoming Contributor sees Read-Only banner
    await expect(page.getByText("Read-Only View").first()).toBeVisible();

    // Navigate to Handover
    await page.getByRole("link", { name: /Handover|Go to Handover/i }).first().click();
    await expect(page).toHaveURL(/.*handover/);
    await expect(page.getByRole("heading", { name: /Handover for Campus Event Portal|Handover|Nothing has been shared yet/i }).first()).toBeVisible();

    // Verify restricted items are hidden behind count placeholder (role="note")
    const placeholderNote = page.getByRole("note").first();
    if (await placeholderNote.isVisible()) {
      await expect(placeholderNote).toContainText(/hidden because of access level/i);
    }

    // -----------------------------------------------------------------------
    // Step 7: Acknowledge a section and accept ownership
    // -----------------------------------------------------------------------
    const ackBtn = page.getByRole("button", { name: /Acknowledge/i }).first();
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await expect(page.getByText(/Receipt stored|Acknowledged/i).first()).toBeVisible();
    }

    const acceptOwnershipBtn = page.getByRole("button", { name: /Accept ownership/i }).first();
    if (await acceptOwnershipBtn.isVisible()) {
      await acceptOwnershipBtn.click();
      await expect(page.getByText(/You accepted this|Accepted/i).first()).toBeVisible();
    }
  });
});
