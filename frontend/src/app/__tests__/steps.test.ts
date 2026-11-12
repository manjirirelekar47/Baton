import { activeStep } from "../steps";

describe("activeStep", () => {
  it("maps routes to the five steps", () => {
    expect(activeStep("/sources", "")).toBe(1);
    expect(activeStep("/ledger", "")).toBe(2);
    expect(activeStep("/ledger", "?view=verify")).toBe(3);
    expect(activeStep("/review", "")).toBe(4);
    expect(activeStep("/handover", "")).toBe(5);
    expect(activeStep("/nowhere", "")).toBe(0);
  });
});
