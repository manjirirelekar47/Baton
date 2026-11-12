import { fireEvent, render, screen } from "@testing-library/react";
import { StateBadge } from "@/shared/ui";
import type { ClaimView } from "../api";
import { ClaimCard } from "../components/ClaimCard";
import { HiddenPlaceholder } from "../components/HiddenPlaceholder";

const ownerClaim: ClaimView = {
  claim_id: "c-002",
  type: "owner",
  section: "ownership",
  statement: "The check-in kiosk module has no recorded owner",
  state: "inferred",
  access_label: "L1",
  owner: null,
  proposed_owner: "Incoming Contributor",
  proposed_for_me: true,
  due_date: null,
  blocked_by: [],
  attested_by: null,
  evidence: [{ chunk_id: "S4-150", quote: "nobody has claimed it yet", source_id: "S4", source_title: "Chat export", event_time: null }],
};

const noop = () => undefined;

describe("HiddenPlaceholder", () => {
  it("shows a bare count and nothing else", () => {
    render(<HiddenPlaceholder count={2} />);
    expect(screen.getByRole("note")).toHaveTextContent("2 items are hidden because of access level");
  });
  it("uses singular wording for one item", () => {
    render(<HiddenPlaceholder count={1} />);
    expect(screen.getByRole("note")).toHaveTextContent("1 item is hidden");
  });
  it("renders nothing when there is nothing hidden", () => {
    const { container } = render(<HiddenPlaceholder count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StateBadge", () => {
  it("always shows a text label, never colour alone", () => {
    render(<StateBadge state="conflicting" />);
    expect(screen.getByText("Conflicting")).toBeInTheDocument();
  });
});

describe("ClaimCard ownership", () => {
  it("shows an unknown owner as Unknown and never invents one", () => {
    render(<ClaimCard claim={ownerClaim} canRespond response={undefined} onRespond={noop} onOpenCitation={noop} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
  it("lets the proposed person accept or decline", () => {
    const onRespond = vi.fn();
    render(<ClaimCard claim={ownerClaim} canRespond onRespond={onRespond} onOpenCitation={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept ownership" }));
    expect(onRespond).toHaveBeenCalledWith("accept");
  });
  it("hides the buttons when the proposal is for someone else", () => {
    render(<ClaimCard claim={{ ...ownerClaim, proposed_for_me: false, proposed_owner: "Meera" }} canRespond onRespond={noop} onOpenCitation={noop} />);
    expect(screen.queryByRole("button", { name: "Accept ownership" })).not.toBeInTheDocument();
    expect(screen.getByText("Meera")).toBeInTheDocument();
  });
  it("opens the cited source", () => {
    const onOpen = vi.fn();
    render(<ClaimCard claim={ownerClaim} canRespond={false} onRespond={noop} onOpenCitation={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Open source S4-150/ }));
    expect(onOpen).toHaveBeenCalledWith(ownerClaim.evidence[0]);
  });
});
