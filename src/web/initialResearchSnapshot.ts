export interface InitialResearchSnapshot {
  path: string;
  title: string;
  paragraphs: string[];
  rows: string[];
}

// Capture only text from the anonymous, escaped build snapshot before Vue clears #app.
// Never persist member API payloads or reinterpret this snapshot as current data.
export function readInitialResearchSnapshot(document: Document, path: string): InitialResearchSnapshot | null {
  const section = document.querySelector("#app .seo-live-data");
  const title = section?.querySelector("h2")?.textContent?.trim();
  if (!section || !title) return null;
  return {
    path, title,
    paragraphs: Array.from(section.querySelectorAll("p"), (element) => element.textContent?.trim() ?? ""),
    rows: Array.from(section.querySelectorAll("li"), (element) => element.textContent?.trim() ?? "").slice(0, 3)
  };
}

export const initialResearchSnapshot = typeof document === "undefined" ? null
  : readInitialResearchSnapshot(document, window.location.pathname);
