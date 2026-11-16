import { el } from "../dom.js";

export function renderSourceHeader(container, source) {
  if (!source) return;

  const day = source.downloaded
    ? new Date(source.downloaded).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "recently";

  if (source.isMultiCompany) {
    container.replaceChildren(
      `Data: Aggregated snapshot of ${source.companyCount || 3} public `,
      el("span", { style: "font-weight: 600;" }, "Ashby"),
      ` job board feeds (${source.boardNames || "Cohere, Ramp, Linear"}), downloaded ${day}. ` +
        `An independent prototype, not affiliated with any of the named companies or Ashby.`
    );
    return;
  }

  container.replaceChildren(
    `Data: a snapshot of the public ${source.provider || "Ashby"} `,
    el("a", { href: source.feed_url, rel: "noopener", target: "_blank" }, "job board feed"),
    ` for ${source.board}, downloaded ${day}. An independent prototype, ` +
      `not affiliated with ${source.board} or ${source.provider || "Ashby"}.`
  );
}
