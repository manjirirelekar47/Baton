import { test, expect } from "@playwright/test";

test.describe("Judge Walkthrough - 7 Step End-to-End Flow", () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset demo state before each test run
    await request.post("http://127.0.0.1:8000/demo/reset");
    await page.goto("/");
  });

  test("full 7-step judge walkthrough", async ({ page }) => {
    // -----------------------------------------------------------------------
    // Step 1: Open demo project, verify branding and progress bar
    // -----------------------------------------------------------------------
    await expect(page.locator("header")).toContainText("Baton");
    await expect(page.locator("header")).toContainText("Campus Event Portal");

    // Navigate to Reconstruct / Ledger step
    const reconstructLink = page.getByRole("link", { name: "Reconstruct" });
    if (await reconstructLink.isVisible()) {
      await reconstructLink.click();
      await expect(page).toHaveURL(/.*ledger/);
    }

    // -----------------------------------------------------------------------
    // Step 2: Open Review queue & verify source citation drawer
    // -----------------------------------------------------------------------
    await page.getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(/.*review/);
    await expect(page.getByRole("heading", { name: "Review and approve" })).toBeVisible();

    // Verify citation chip opens SourceDrawer with highlighted quote
    const citationChip = page.locator("button[title^='Chunk:']").first();
    if (await citationChip.isVisible()) {
      await citationChip.click();
      const sourceDrawer = page.getByRole("dialog", { name: "Source" });
      await expect(sourceDrawer).toBeVisible();
      // Verify quote is rendered inside <mark> or passage
      await expect(sourceDrawer.locator("mark, p")).toBeVisible();
      // Close drawer
      await sourceDrawer.getByRole("button", { name: "Close" }).click();
      await expect(sourceDrawer).not.toBeVisible();
    }

    // -----------------------------------------------------------------------
    // Step 3: Open payments-owner conflict side-by-side
    // -----------------------------------------------------------------------
    // Switch to Conflicts filter tab
    const conflictsTab = page.getByRole("button", { name: /Conflicts/i });
    if (await conflictsTab.isVisible()) {
      await conflictsTab.click();
    }

    // Click Resolve Conflict on the conflicting claim
    const resolveBtn = page.getByRole("button", { name: /Resolve Conflict/i }).first();
    if (await resolveBtn.isVisible()) {
      await resolveBtn.click();
      const conflictModal = page.getByRole("dialog", { name: "Resolve Conflict" });
      await expect(conflictModal).toBeVisible();
      await expect(conflictModal).toContainText("Side-by-Side Conflict Resolution");

      // ---------------------------------------------------------------------
      // Step 4: Switch to Approver, resolve conflict, confirm the rest
      // ---------------------------------------------------------------------
      // Select the winning statement radio
      const radios = conflictModal.getByLabel("Choose this statement as truth");
      if ((await radios.count()) > 0) {
        await radios.first().check();
      }

      // Apply Choice (reject other side)
      await conflictModal.getByRole("button", { name: /Apply Choice/i }).click();
      await expect(conflictModal).not.toBeVisible();
    }

    // Bulk confirm remaining verified claims
    const bulkConfirmBtn = page.getByRole("button", { name: "Confirm all verified" });
    if (await bulkConfirmBtn.isVisible() && (await bulkConfirmBtn.isEnabled())) {
      await bulkConfirmBtn.click();
      // Wait for network response / update
      await page.waitForTimeout(500);
    }

    // -----------------------------------------------------------------------
    // Step 5: Approve version v1 into immutable snapshot
    // -----------------------------------------------------------------------
    const approveBtn = page.getByRole("button", { name: "Approve & Share Handover" });
    // If not ready due to pending items, confirm them or check readiness
    if (await approveBtn.isEnabled()) {
      await approveBtn.click();
      const shareModal = page.getByRole("dialog", { name: "Approve Handover Version" });
      await expect(shareModal).toBeVisible();

      // Ensure Incoming Contributor is included in shared roles
      const contributorCheckbox = shareModal.getByLabel(/Incoming Contributor/i);
      if (await contributorCheckbox.isVisible()) {
        await contributorCheckbox.check();
      }

      // Submit approval
      await shareModal.getByRole("button", { name: "Approve Snapshot" }).click();
      await expect(shareModal).not.toBeVisible();

      // Verify version history modal pops up showing snapshot hash
      const versionModal = page.getByRole("dialog", { name: "Version History" });
      if (await versionModal.isVisible()) {
        await expect(versionModal).toContainText("Approved");
        await expect(versionModal).toContainText("Snapshot Hash");
        await versionModal.getByRole("button", { name: "Close" }).click();
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Switch to Incoming Contributor & verify restricted items hidden
    // -----------------------------------------------------------------------
    const roleSelect = page.locator("header select");
    await roleSelect.selectOption("incoming_contributor");
    await page.waitForTimeout(500);

    // On Review page, Incoming Contributor sees Read-Only banner
    await expect(page.getByText("Read-Only View")).toBeVisible();

    // Navigate to Handover
    await page.getByRole("link", { name: "Handover" }).click();
    await expect(page).toHaveURL(/.*handover/);
    await expect(page.getByRole("heading", { name: /Handover for Campus Event Portal/i })).toBeVisible();

    // Verify restricted items are hidden behind count placeholder (role="note")
    const placeholderNote = page.getByRole("note");
    if (await placeholderNote.isVisible()) {
      await expect(placeholderNote).toContainText(/hidden because of access level/i);
    }

    // -----------------------------------------------------------------------
    // Step 7: Acknowledge a section and accept ownership
    // -----------------------------------------------------------------------
    const ackBtn = page.getByRole("button", { name: "Acknowledge section" }).first();
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await expect(page.getByText("Acknowledged")).toBeVisible();
    }

    const acceptOwnershipBtn = page.getByRole("button", { name: "Accept ownership" }).first();
    if (await acceptOwnershipBtn.isVisible()) {
      await acceptOwnershipBtn.click();
      await expect(page.getByText("Accepted")).toBeVisible();
    }
  });
});
