import { getCompanyHue, WORKPLACES } from "../constants.js";
import { el } from "../dom.js";
import { filterJobs, hitsLocation, locationTest } from "../filter.js";
import { addressNote, cityRegion, isCountryWide } from "../models.js";

function describeQuery(shownCount, state, sampleJob) {
  const parts = [];

  if (state.companyId && state.companyId !== "all") {
    const comp = state.companies.find((c) => c.id === state.companyId);
    parts.push(`at ${comp ? comp.name : state.companyId}`);
  } else {
    parts.push("across all companies");
  }

  if (state.loc.kind === "country") {
    parts.push(`in ${state.loc.country}`);
  } else if (state.loc.kind === "wide") {
    parts.push(`anywhere in ${state.loc.country}`);
  } else if (state.loc.kind === "place") {
    parts.push(`in ${state.loc.name}`);
  }

  if (state.dept.kind === "department") {
    parts.push(`in ${state.dept.name}`);
  } else if (state.dept.kind === "team") {
    parts.push(`in ${state.dept.department} (${state.dept.name} team)`);
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
  if (state.loc.kind === "country") {
    detail = `Matches any location whose address country is ${state.loc.country}: cities, regions, and country-wide postings alike. A posting that lists several cities is counted under each of them, so the city counts can add up to more than this total.`;
  } else if (state.loc.kind === "wide") {
    detail = `Postings that list ${state.loc.country} itself as a location, with no specific city. Many of them also list cities.`;
  } else if (state.loc.kind === "place" && sampleJob) {
    const sampleLoc = sampleJob.locs.find(locationTest(state.loc));
    if (sampleLoc) {
      detail = isCountryWide(sampleLoc)
        ? `Country-wide location` +
          (cityRegion(sampleLoc) ? `, feed address says ${cityRegion(sampleLoc)}.` : `.`)
        : `Matches named location (${addressNote(sampleLoc) || "specific office"}).`;
    }
  } else {
    detail = "Showing live and tracked postings synchronized across all active filters.";
  }

  return [big, detail];
}

function renderJobCard(job, state, labels, handlers) {
  const filteredLoc = state.loc.kind !== "all";
  const matchedLocs = new Set(filteredLoc ? hitsLocation(job, state.loc) : []);

  const headerLeft = [];
  if (job.company) {
    const hue = getCompanyHue(job.company.id);
    headerLeft.push(
      el(
        "span",
        {
          class: "company-badge",
          style: `--badge-hue: ${hue};`,
        },
        job.company.name
      )
    );
  }

  headerLeft.push(
    el(
      "a",
      {
        href: job.url,
        class: "title",
        target: "_blank",
        rel: "noopener",
      },
      job.title
    )
  );

  const badges = [];
  if (job.status === "new") {
    badges.push(el("span", { class: "badge badge-new" }, "New"));
  } else if (job.status === "removed") {
    badges.push(el("span", { class: "badge badge-removed" }, "Delisted"));
  }

  const header = el(
    "div",
    { class: "job-header" },
    el("div", { class: "job-title-row" }, ...headerLeft),
    el("div", { class: "job-badges-row" }, ...badges)
  );

  const metaParts = [];
  if (job.department) {
    metaParts.push(el("span", { class: "meta-dept" }, job.department));
  }
  if (job.team) {
    metaParts.push(el("span", { class: "meta-team" }, job.team));
  }
  if (job.workplace && labels.get(job.workplace)) {
    metaParts.push(
      el("span", { class: "meta-workplace" }, labels.get(job.workplace))
    );
  }

  const metaLine = el(
    "div",
    { class: "meta" },
    ...metaParts.flatMap((node, idx) => (idx > 0 ? [" · ", node] : [node]))
  );

  const chips = el(
    "div",
    { class: "chips" },
    ...job.locs.map(l => {
      const isHit = matchedLocs.has(l);
      return el(
        "button",
        {
          type: "button",
          class: isHit ? "chip hit" : "chip",
          title: isHit
            ? `Active location filter: ${l.name}. Click to clear.`
            : `Filter jobs by ${l.name} (${[l.locality, l.region, l.country].filter(Boolean).join(", ") || "no address"})`,
          onClick: handlers && handlers.onSelectLoc
            ? (e) => {
                e.preventDefault();
                if (isHit) {
                  handlers.onSelectLoc({ kind: "all" });
                } else {
                  handlers.onSelectLoc(
                    isCountryWide(l) && l.country
                      ? { kind: "wide", country: l.country }
                      : { kind: "place", country: l.country, name: l.name }
                  );
                }
              }
            : undefined,
        },
        l.name,
        l.role === "primary" ? el("span", { class: "role" }, " · primary") : null
      );
    })
  );

  return el("div", { class: "job" }, header, metaLine, chips);
}

export function renderResults(container, jobs, state, handlers) {
  const shown = filterJobs(jobs, state);
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
        el(
          "p",
          { style: "font-size: 16px; font-weight: 600;" },
          "No matching job postings found."
        ),
        el("p", {}, "Try clearing your search query or loosening your location, department, or company filters.")
      )
    );
    return;
  }

  const labels = new Map(WORKPLACES);
  const elements = [queryBanner];

  // Grouping logic based on state.groupMode
  if (state.groupMode === "company") {
    const groups = new Map();
    for (const job of shown) {
      const compName = job.company ? job.company.name : "Other";
      if (!groups.has(compName)) groups.set(compName, []);
      groups.get(compName).push(job);
    }
    const sortedCompNames = [...groups.keys()].sort();
    for (const compName of sortedCompNames) {
      const compJobs = groups.get(compName).sort((a, b) => a.title.localeCompare(b.title));
      elements.push(
        el("h3", { class: "group-header" }, `${compName} (${compJobs.length})`),
        ...compJobs.map(job => renderJobCard(job, state, labels, handlers))
      );
    }
  } else if (state.groupMode === "department") {
    const groups = new Map();
    for (const job of shown) {
      const deptName = job.department || "General";
      if (!groups.has(deptName)) groups.set(deptName, []);
      groups.get(deptName).push(job);
    }
    const sortedDeptNames = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length || a.localeCompare(b));
    for (const deptName of sortedDeptNames) {
      const deptJobs = groups.get(deptName).sort((a, b) => a.title.localeCompare(b.title));
      elements.push(
        el("h3", { class: "group-header" }, `${deptName} (${deptJobs.length})`),
        ...deptJobs.map(job => renderJobCard(job, state, labels, handlers))
      );
    }
  } else if (state.groupMode === "location") {
    const groups = new Map();
    for (const job of shown) {
      const country = (job.locs[0] && job.locs[0].country) || "Unspecified Country";
      if (!groups.has(country)) groups.set(country, []);
      groups.get(country).push(job);
    }
    const sortedCountries = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length || a.localeCompare(b));
    for (const country of sortedCountries) {
      const locJobs = groups.get(country).sort((a, b) => a.title.localeCompare(b.title));
      elements.push(
        el("h3", { class: "group-header" }, `${country} (${locJobs.length})`),
        ...locJobs.map(job => renderJobCard(job, state, labels, handlers))
      );
    }
  } else {
    // Flat List
    const sortedJobs = [...shown].sort((a, b) => a.title.localeCompare(b.title));
    elements.push(...sortedJobs.map(job => renderJobCard(job, state, labels, handlers)));
  }

  container.replaceChildren(...elements);
}
