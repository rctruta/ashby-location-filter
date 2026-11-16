import { WORKPLACES } from "../constants.js";
import { el } from "../dom.js";
import { filterJobs, hitsLocation, locationTest } from "../filter.js";
import { addressNote, cityRegion, isCountryWide } from "../models.js";

function describeQuery(shownCount, state, sampleJob) {
  const parts = [];

  if (state.currentCompanyId === "all") {
    parts.push("all tracked companies");
  }

  if (state.viewMode === "department") {
    if (state.dept.kind === "all") {
      parts.push("all departments");
    } else if (state.dept.kind === "department") {
      parts.push(`in ${state.dept.name}`);
    } else if (state.dept.kind === "team") {
      parts.push(`in ${state.dept.department} (${state.dept.name} team)`);
    }
  } else {
    // "location" mode
    if (state.loc.kind === "all") {
      parts.push("all locations");
    } else if (state.loc.kind === "country") {
      parts.push(`locations in ${state.loc.country}`);
    } else {
      parts.push(`location named “${state.loc.name}”`);
    }
  }

  if (state.workplaces.size > 0) {
    const labels = WORKPLACES.filter(([v]) => state.workplaces.has(v)).map(([, l]) => l);
    parts.push(`marked ${labels.join(" or ")}`);
  }

  if (state.search) {
    parts.push(`matching “${state.search}”`);
  }

  if (state.status && state.status !== "all") {
    parts.push(`status: ${state.status}`);
  }

  const big = `${shownCount} posting${shownCount === 1 ? "" : "s"} ${parts.join(" · ")}`;

  let detail = "";
  if (state.viewMode === "department") {
    detail = state.dept.kind === "all"
      ? "Showing postings grouped by functional department."
      : `Filtered by ${state.dept.name}. Postings in other departments are hidden.`;
  } else {
    if (state.loc.kind === "country") {
      detail = `Matches any primary or secondary location whose address country is ${state.loc.country}: cities, regions, and country-wide postings alike.`;
    } else if (state.loc.kind === "place" && sampleJob) {
      const sampleLoc = sampleJob.locs.find(locationTest(state.loc));
      if (sampleLoc) {
        detail = isCountryWide(sampleLoc)
          ? `Country-wide location` +
            (cityRegion(sampleLoc) ? `, feed address says ${cityRegion(sampleLoc)}.` : `.`)
          : `Matches named location (${addressNote(sampleLoc) || "specific office"}).`;
      }
    } else {
      detail = "Showing live postings grouped by geographic address country.";
    }
  }

  return [big, detail];
}

export function renderResults(container, jobs, state) {
  const shown = filterJobs(jobs, state).sort((a, b) => a.title.localeCompare(b.title));
  const [big, detail] = describeQuery(shown.length, state, shown[0]);

  const queryBanner = el(
    "div",
    { class: "query", id: "query-banner" },
    el("p", { class: "big" }, big),
    el("p", {}, detail)
  );

  if (shown.length === 0) {
    container.replaceChildren(
      queryBanner,
      el(
        "div",
        { class: "empty-state" },
        el("p", { style: "font-size: 16px; font-weight: 600;" }, "No matching job postings found."),
        el("p", {}, "Try clearing your search query or loosening your filters.")
      )
    );
    return;
  }

  const labels = new Map(WORKPLACES);
  const filteredLoc = state.loc.kind !== "all";

  const cards = shown.map(job => {
    const matchedLocs = new Set(filteredLoc ? hitsLocation(job, state.loc) : []);

    const badges = [];
    if (job.company) {
      badges.push(el("span", { class: "badge badge-company" }, job.company.name));
    }
    if (job.status === "new") {
      badges.push(el("span", { class: "badge badge-new" }, "New"));
    } else if (job.status === "removed") {
      badges.push(el("span", { class: "badge badge-removed" }, "Delisted"));
    }

    const titleLink = el(
      "a",
      {
        href: job.url,
        class: "title",
        target: "_blank",
        rel: "noopener",
      },
      job.title
    );

    const header = el("div", { class: "job-header" }, titleLink, ...badges);

    const metaParts = [];
    if (job.department) {
      metaParts.push(el("span", { class: "meta-dept" }, job.department));
    }
    if (job.team) {
      metaParts.push(el("span", {}, job.team));
    }
    if (job.workplace && labels.get(job.workplace)) {
      metaParts.push(el("span", {}, labels.get(job.workplace)));
    }

    const metaLine = el(
      "div",
      { class: "meta" },
      ...metaParts.flatMap((node, idx) => (idx > 0 ? [" · ", node] : [node]))
    );

    const chips = el(
      "div",
      { class: "chips" },
      ...job.locs.map(l =>
        el(
          "span",
          {
            class: matchedLocs.has(l) ? "chip hit" : "chip",
            title:
              [l.locality, l.region, l.country].filter(Boolean).join(", ") ||
              "no address in the feed",
          },
          l.name,
          l.role === "primary" ? el("span", { class: "role" }, " · primary") : null
        )
      )
    );

    return el("div", { class: "job" }, header, metaLine, chips);
  });

  container.replaceChildren(queryBanner, ...cards);
}
