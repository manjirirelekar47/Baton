export interface Segments {
  before: string;
  match: string;
  after: string;
  found: boolean;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split chunk text around the cited quote. Whitespace-normalised, like the backend quote check. */
export function splitAroundQuote(text: string, quote: string): Segments {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { before: text, match: "", after: "", found: false };
  const found = new RegExp(words.map(escapeRegExp).join("\\s+")).exec(text);
  if (!found) return { before: text, match: "", after: "", found: false };
  return {
    before: text.slice(0, found.index),
    match: found[0],
    after: text.slice(found.index + found[0].length),
    found: true,
  };
}
