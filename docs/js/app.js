import { DEFAULT_COMPANY, MANIFEST_URL } from "./constants.js";
import { el } from "./dom.js";
import { normalizeCountryName, readJob } from "./models.js";
import { parseAshbySlug } from "./normalizers/location_normalizer.js";
import { renderActivePills, renderFilterBar } from "./views/filter_bar.js";
import { renderResults } from "./views/results_view.js";
import { renderSourceHeader } from "./views/source_header.js";

const LIVE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes in sessionStorage

// Global reactive application state
const state = {
  companies: [],
  selectedCompanies: new Set(["all"]), // "all" or Set of specific company IDs
  customSlugs: new Set(), // On-demand live Ashby company slugs
  customLoading: false,
  customError: null,
  groupMode: "department", // "company" | "department" | "location" | "flat"
  search: "",
  loc: { kind: "all" },
  dept: { kind: "all" },
  workplaces: new Set(),
  status: "all",
  testMode: false, // Only include synthetic/test_only companies when ?test=1 is set
};

let allJobs = [];
let sourceMeta = null;

function initFromURL() {
  const params = new URLSearchParams(window.location.search);
  const testParam = params.get("test");
  if (testParam === "1" || testParam === "true") {
    state.testMode = true;
  }
  if (params.get("custom")) {
    params
      .get("custom")
      .split(",")
      .map((s) => parseAshbySlug(s))
      .filter(Boolean)
      .forEach((s) => state.customSlugs.add(s));
  }
  if (params.get("companies")) {
    const list = params.get("companies").split(",").filter(Boolean);
    state.selectedCompanies = list.length > 0 ? new Set(list) : new Set(["all"]);
  } else if (params.get("company")) {
    const c = params.get("company");
    state.selectedCompanies = c && c !== "all" ? new Set([c]) : new Set(["all"]);
  }
  if (params.get("group")) state.groupMode = params.get("group");
  if (params.get("q")) state.search = params.get("q");

  if (params.get("country")) {
    state.loc = { kind: "country", country: normalizeCountryName(params.get("country")) };
  } else if (params.get("place")) {
    state.loc = {
      kind: "place",
      country: normalizeCountryName(params.get("p_country")),
      name: params.get("place"),
    };
  }

  if (params.get("dept")) {
    state.dept = { kind: "department", name: params.get("dept") };
  } else if (params.get("team")) {
    state.dept = {
      kind: "team",
      department: params.get("t_dept") || "General",
      name: params.get("team"),
    };
  }

  if (params.get("workplaces")) {
    params
      .get("workplaces")
      .split(",")
      .filter(Boolean)
      .forEach((w) => state.workplaces.add(w));
  }
  if (params.get("status")) state.status = params.get("status");
}

function syncToURL() {
  const params = new URLSearchParams();
  if (state.testMode) {
    params.set("test", "1");
  }
  if (state.customSlugs && state.customSlugs.size > 0) {
    params.set("custom", [...state.customSlugs].join(","));
  }
  if (state.selectedCompanies && !state.selectedCompanies.has("all") && state.selectedCompanies.size > 0) {
    params.set("companies", [...state.selectedCompanies].join(","));
  }
  if (state.groupMode !== "department") params.set("group", state.groupMode);
  if (state.search) params.set("q", state.search);

  if (state.loc.kind === "country") {
    params.set("country", state.loc.country);
  } else if (state.loc.kind === "place") {
    params.set("place", state.loc.name);
    if (state.loc.country) params.set("p_country", state.loc.country);
  }

  if (state.dept.kind === "department") {
    params.set("dept", state.dept.name);
  } else if (state.dept.kind === "team") {
    params.set("team", state.dept.name);
    params.set("t_dept", state.dept.department);
  }

  if (state.workplaces.size > 0) {
    params.set("workplaces", [...state.workplaces].join(","));
  }
  if (state.status !== "all") params.set("status", state.status);

  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, "", newUrl);
}

function render() {
  syncToURL();

  const filterBarContainer = document.getElementById("filter-bar-slot");
  if (filterBarContainer) {
    renderFilterBar(filterBarContainer, allJobs, state, {
      onSearchChange,
      onToggleCompany,
      onToggleAllCompanies,
      onAddCustomCompany,
      onSelectLoc,
      onSelectDept,
      onToggleWorkplace,
      onSelectStatus,
      onGroupChange,
      onResetAll,
    });
  }

  const pillsContainer = document.getElementById("active-pills-slot");
  if (pillsContainer) {
    renderActivePills(pillsContainer, state, {
      onSearchChange,
      onToggleCompany,
      onToggleAllCompanies,
      onSelectLoc,
      onSelectDept,
      onToggleWorkplace,
      onSelectStatus,
      onResetAll,
    });
  }

  const resultsContainer = document.getElementById("results-slot");
  if (resultsContainer) {
    renderResults(resultsContainer, allJobs, state, { onSelectLoc });
  }

  const sourceContainer = document.getElementById("source-slot");
  if (sourceContainer && sourceMeta) {
    renderSourceHeader(sourceContainer, sourceMeta);
  }
}

function onSearchChange(val) {
  state.search = val;
  render();
}

function onGroupChange(mode) {
  state.groupMode = mode;
  render();
}

function onToggleCompany(companyId, isChecked) {
  state.selectedCompanies.delete("all");
  if (isChecked) {
    state.selectedCompanies.add(companyId);
  } else {
    state.selectedCompanies.delete(companyId);
  }
  if (state.selectedCompanies.size === state.companies.length) {
    state.selectedCompanies.clear();
    state.selectedCompanies.add("all");
  }
  render();
}

function onToggleAllCompanies(isChecked) {
  state.selectedCompanies.clear();
  if (isChecked) {
    state.selectedCompanies.add("all");
  }
  render();
}

function onSelectLoc(loc) {
  state.loc = loc;
  render();
}

function onSelectDept(dept) {
  state.dept = dept;
  render();
}

function onToggleWorkplace(val) {
  if (state.workplaces.has(val)) {
    state.workplaces.delete(val);
  } else {
    state.workplaces.add(val);
  }
  render();
}

function onSelectStatus(status) {
  state.status = status;
  render();
}

function onResetAll() {
  state.search = "";
  state.selectedCompanies = new Set(["all"]);
  state.loc = { kind: "all" };
  state.dept = { kind: "all" };
  state.workplaces.clear();
  state.status = "all";
  state.groupMode = "department";
  render();
}

async function loadData() {
  const results = await Promise.all(
    state.companies.map(async (c) => {
      try {
        const resp = await fetch(`${c.snapshot}?_=${Date.now()}`);
        if (!resp.ok) return { company: c, data: { jobs: [] } };
        const data = await resp.json();
        return { company: c, data };
      } catch (e) {
        console.warn(`Failed to load snapshot for ${c.name}:`, e);
        return { company: c, data: { jobs: [] } };
      }
    })
  );

  let combined = [];
  for (const { company, data } of results) {
    const diffInfo = data.diff || null;
    const companyInfo = { id: company.id, name: company.name };
    const listed = (data.jobs || []).filter(
      (j) => j.isListed === true || j.isListed === undefined
    );
    const active = listed.map((j) => readJob(j, diffInfo, companyInfo));
    const removed = ((diffInfo && diffInfo.removed_jobs) || []).map((j) =>
      readJob(j, { is_removed: true }, companyInfo)
    );
    combined.push(...active, ...removed);
  }

  allJobs = combined;

  sourceMeta = {
    isMultiCompany: true,
    companyCount: state.companies.length,
    boardNames: state.companies.map((c) => c.name).join(", "),
    downloaded: new Date().toISOString(),
  };
}

function formatSlugName(slug) {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchLiveAshbyBoard(slug) {
  const cacheKey = `ashby_live_board_${slug}`;
  try {
    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.ts && Date.now() - cached.ts < LIVE_CACHE_TTL_MS && cached.data) {
        return cached.data;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  const resp = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
  if (!resp.ok) {
    throw new Error(resp.status === 404 ? `No public Ashby board found for '${slug}'` : `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (!data || !Array.isArray(data.jobs)) {
    throw new Error(`Invalid Ashby feed for '${slug}'`);
  }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore storage quota errors
  }
  return data;
}

async function onAddCustomCompany(rawInput, selectExclusively = true) {
  const slug = parseAshbySlug(rawInput);
  if (!slug) {
    state.customError = "Enter a valid Ashby company slug or URL";
    render();
    return false;
  }

  const existing = state.companies.find((c) => c.id.toLowerCase() === slug);
  if (existing) {
    state.customError = null;
    if (selectExclusively) {
      state.selectedCompanies = new Set([existing.id]);
    } else if (!state.selectedCompanies.has("all")) {
      state.selectedCompanies.add(existing.id);
    }
    render();
    return true;
  }

  state.customLoading = true;
  state.customError = null;
  render();

  try {
    const data = await fetchLiveAshbyBoard(slug);
    const listed = (data.jobs || []).filter(
      (j) => j.isListed === true || j.isListed === undefined
    );
    const displayName = formatSlugName(slug);
    const companyEntry = {
      id: slug,
      name: `${displayName} (Live)`,
      provider: "Ashby Live",
      isCustom: true,
    };

    state.companies.push(companyEntry);
    state.customSlugs.add(slug);

    const companyInfo = { id: companyEntry.id, name: displayName };
    const newJobs = listed.map((j) => readJob(j, null, companyInfo));
    allJobs.push(...newJobs);

    if (selectExclusively) {
      state.selectedCompanies = new Set([slug]);
    }

    sourceMeta = {
      isMultiCompany: true,
      companyCount: state.companies.length,
      boardNames: state.companies.map((c) => c.name).join(", "),
      downloaded: new Date().toISOString(),
    };
    state.customLoading = false;
    state.customError = null;
    render();
    return true;
  } catch (err) {
    state.customLoading = false;
    state.customError = err.message || `Could not load '${slug}'`;
    render();
    return false;
  }
}

async function main() {
  initFromURL();

  try {
    const manifestResp = await fetch(`${MANIFEST_URL}?_=${Date.now()}`);
    if (!manifestResp.ok) throw new Error(`HTTP ${manifestResp.status}`);
    const manifest = await manifestResp.json();
    const rawCompanies = manifest.companies || [];
    state.companies = rawCompanies.filter(
      (c) => !c.test_only || state.testMode || state.selectedCompanies.has(c.id)
    );
  } catch (e) {
    console.error("Could not load manifest:", e);
  }

  await loadData();

  // If URL requested any company not in manifest, treat it as a live custom slug
  const knownIds = new Set(state.companies.map((c) => c.id.toLowerCase()));
  for (const sel of state.selectedCompanies) {
    if (sel !== "all" && !knownIds.has(sel.toLowerCase())) {
      state.customSlugs.add(sel.toLowerCase());
    }
  }

  if (state.customSlugs.size > 0) {
    for (const slug of [...state.customSlugs]) {
      await onAddCustomCompany(slug, false);
    }
  }

  render();
}

main().catch((error) => {
  const errBox = el(
    "div",
    { class: "error" },
    `Could not load job postings.\n${error.message || error}`
  );
  document.body.prepend(errBox);
  console.error("Initialization failed:", error);
});
