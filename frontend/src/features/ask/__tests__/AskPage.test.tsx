import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/app/api";
import { AskPage } from "../pages/AskPage";

vi.mock("@/app/api", () => ({ api: vi.fn() }));

describe("AskPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a grounded answer with source evidence", async () => {
    vi.mocked(api).mockResolvedValue({ answer: "Based on the approved snapshot, these verified claims match.", approved_version: "v2", matches: [{ claim_id: "c1", statement: "Payments is owned by Aarav.", owner: "Aarav", due_date: null, score: 86, evidence: [{ source_title: "handover.md", chunk_id: "s1-abc", quote: "Payments owner: Aarav" }] }] });
    render(<AskPage />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Who owns payments?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Baton" }));
    expect(await screen.findByText("Payments is owned by Aarav.")).toBeInTheDocument();
    expect(screen.getByText(/Payments owner: Aarav/)).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/ask", { method: "POST", body: { question: "Who owns payments?" } });
  });

  it("shows API errors instead of inventing an answer", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Could not connect"));
    render(<AskPage />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "What is the release risk?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Baton" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not connect"));
    expect(screen.queryByText(/Verified ·/)).not.toBeInTheDocument();
  });
});
