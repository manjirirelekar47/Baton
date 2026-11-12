import { splitAroundQuote } from "../highlight";

describe("splitAroundQuote", () => {
  it("finds the quote and splits the text around it", () => {
    const out = splitAroundQuote("Rohan took payments over from Aarav", "took payments over");
    expect(out).toEqual({ before: "Rohan ", match: "took payments over", after: " from Aarav", found: true });
  });
  it("ignores whitespace differences", () => {
    expect(splitAroundQuote("took\n payments   over", "took payments over").found).toBe(true);
  });
  it("reports a missing quote instead of inventing a match", () => {
    expect(splitAroundQuote("nothing here", "took payments over").found).toBe(false);
    expect(splitAroundQuote("anything", "   ").found).toBe(false);
  });
  it("treats regex characters literally", () => {
    expect(splitAroundQuote("cost (approx.) 5+5", "(approx.) 5+5").found).toBe(true);
  });
});
