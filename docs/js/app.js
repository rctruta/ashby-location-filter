import { DEFAULT_COMPANY, MANIFEST_URL } from "./constants.js";
import { el } from "./dom.js";
import { normalizeCountryName, readJob } from "./models.js";
import { extractAshbyCandidates } from "./normalizers/location_normalizer.js";
import { renderActivePills, renderFilterBar } from "./views/filter_bar.js";
import { renderResults } from "./views/results_view.js";
import { renderSourceHeader } from "./views/source_header.js";

const STORAGE_KEY_PREFS = "ashby_filter_user_companies_v1";
const LIVE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache for live job payloads

// Global reactive application state
const state = {
  companies: [],
  manifestCompanies: [],
  selectedCompanies: new Set(["all"]), // "all" or Set of specific company IDs
  hasCustomPrefs: false,
  customLoading: false,
  customError: null,
  customSuccess: null,
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

function readUserPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (!raw) return { added: [], hidden: [] };
    const parsed = JSON.parse(raw);
    return {
      added: Array.isArray(parsed.added) ? parsed.added : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return { added: [], hidden: [] };
  }
}

function writeUserPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
  state.hasCustomPrefs = prefs.added.length > 0 || prefs.hidden.length > 0;
}

function formatSlugName(slug) {
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchLiveBoardBySlug(slug, useCache = true) {
  const cacheKey = `ashby_filter_live_cache_${slug}`;
  if (useCache) {
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.ts && Date.now() - cached.ts < LIVE_CACHE_TTL_MS && cached.data) {
          return cached.data;
        }
      }
    } catch {
      // Ignore cache read errors
    }
  }

  const resp = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`
  );
  if (!resp.ok) {
    return null;
  }
  const data = await resp.json();
  if (!data || !Array.isArray(data.jobs)) {
    return null;
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore storage quota errors
  }
  return data;
}

async function resolveAndValidateAshbyBoard(rawInput) {
  const candidates = extractAshbyCandidates(rawInput);
  if (candidates.length === 0) {
    throw new Error("Enter a company name, website URL, or Ashby board URL.");
  }

  for (const slug of candidates) {
    const data = await fetchLiveBoardBySlug(slug, false);
    if (data) {
      return { slug, data };
    }
  }

  throw new Error(
    `No public Ashby job board found for "${rawInput.trim()}". Only companies with a public Ashby endpoint can be added.`
  );
}

function initFromURL() {
  const params = new URLSearchParams(window.location.search);
  const testParam = params.get("test");
  if (testParam === "1" || testParam === "true") {
    state.testMode = true;
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
  } else if (params.get("anywhere")) {
    state.loc = { kind: "wide", country: normalizeCountryName(params.get("anywhere")) };
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
  if (state.selectedCompanies && !state.selectedCompanies.has("all") && state.selectedCompanies.size > 0) {
    params.set("companies", [...state.selectedCompanies].join(","));
  }
  if (state.groupMode !== "department") params.set("group", state.groupMode);
  if (state.search) params.set("q", state.search);

  if (state.loc.kind === "country") {
    params.set("country", state.loc.country);
  } else if (state.loc.kind === "wide") {
    params.set("anywhere", state.loc.country);
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
      onAddCompany,
      onRemoveCompany,
      onRestoreDefaultCompanies,
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

function updateSourceMeta() {
  sourceMeta = {
    isMultiCompany: true,
    companyCount: state.companies.length,
    boardNames: state.companies.map((c) => c.name).join(", "),
    downloaded: new Date().toISOString(),
  };
}

async function onAddCompany(rawInput) {
  state.customLoading = true;
  state.customError = null;
  state.customSuccess = null;
  render();

  try {
    const { slug, data } = await resolveAndValidateAshbyBoard(rawInput);

    const existing = state.companies.find((c) => c.id.toLowerCase() === slug);
    if (existing) {
      state.customLoading = false;
      state.customError = `"${existing.name}" is already in your list.`;
      render();
      return false;
    }

    const manifestMatch = state.manifestCompanies.find((c) => c.id.toLowerCase() === slug);
    const prefs = readUserPrefs();

    let companyEntry;
    if (manifestMatch) {
      prefs.hidden = prefs.hidden.filter((id) => id.toLowerCase() !== slug);
      companyEntry = manifestMatch;
    } else {
      const displayName = formatSlugName(slug);
      companyEntry = {
        id: slug,
        name: displayName,
        provider: "Ashby (Live)",
        isCustom: true,
      };
      if (!prefs.added.some((c) => c.id.toLowerCase() === slug)) {
        prefs.added.push({ id: slug, name: displayName });
      }
    }
    writeUserPrefs(prefs);

    state.companies.push(companyEntry);
    const listed = (data.jobs || []).filter(
      (j) => j.isListed === true || j.isListed === undefined
    );
    const companyInfo = { id: companyEntry.id, name: companyEntry.name };
    const newJobs = listed.map((j) => readJob(j, null, companyInfo));
    allJobs.push(...newJobs);

    // If user wasn't viewing All Companies, select the newly added company so they see it immediately
    if (!state.selectedCompanies.has("all")) {
      state.selectedCompanies.add(companyEntry.id);
    }

    updateSourceMeta();
    state.customLoading = false;
    state.customError = null;
    state.customSuccess = `Added ${companyEntry.name} (${listed.length} listed jobs)`;
    render();
    return true;
  } catch (err) {
    state.customLoading = false;
    state.customSuccess = null;
    state.customError = err.message || "Could not validate Ashby endpoint.";
    render();
    return false;
  }
}

function onRemoveCompany(companyId) {
  const idLow = companyId.toLowerCase();
  const prefs = readUserPrefs();
  const isManifest = state.manifestCompanies.some((c) => c.id.toLowerCase() === idLow);

  if (isManifest) {
    if (!prefs.hidden.includes(idLow)) prefs.hidden.push(idLow);
  } else {
    prefs.added = prefs.added.filter((c) => c.id.toLowerCase() !== idLow);
    try {
      localStorage.removeItem(`ashby_filter_live_cache_${idLow}`);
    } catch {
      // Ignore storage errors
    }
  }
  writeUserPrefs(prefs);

  state.companies = state.companies.filter((c) => c.id.toLowerCase() !== idLow);
  allJobs = allJobs.filter((j) => !j.company || j.company.id.toLowerCase() !== idLow);
  state.selectedCompanies.delete(companyId);
  if (state.selectedCompanies.size === 0 && state.companies.length > 0) {
    state.selectedCompanies.add("all");
  }

  state.customError = null;
  state.customSuccess = null;
  updateSourceMeta();
  render();
}

async function onRestoreDefaultCompanies() {
  writeUserPrefs({ added: [], hidden: [] });
  state.companies = state.manifestCompanies.filter(
    (c) => !c.test_only || state.testMode
  );
  state.selectedCompanies = new Set(["all"]);
  state.customError = null;
  state.customSuccess = "Restored default companies.";
  await loadData();
  render();
}

async function loadData() {
  const results = await Promise.all(
    state.companies.map(async (c) => {
      try {
        if (c.isCustom || !c.snapshot) {
          const data = await fetchLiveBoardBySlug(c.id, true);
          return { company: c, data: data || { jobs: [] } };
        }
        const resp = await fetch(`${c.snapshot}?_=${Date.now()}`);
        if (!resp.ok) return { company: c, data: { jobs: [] } };
        const data = await resp.json();
        return { company: c, data };
      } catch (e) {
        console.warn(`Failed to load board for ${c.name}:`, e);
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
  updateSourceMeta();
}

async function main() {
  initFromURL();

  try {
    const manifestResp = await fetch(`${MANIFEST_URL}?_=${Date.now()}`);
    if (!manifestResp.ok) throw new Error(`HTTP ${manifestResp.status}`);
    const manifest = await manifestResp.json();
    state.manifestCompanies = manifest.companies || [];

    const prefs = readUserPrefs();
    state.hasCustomPrefs = prefs.added.length > 0 || prefs.hidden.length > 0;
    const hiddenSet = new Set(prefs.hidden.map((s) => s.toLowerCase()));

    const baseCompanies = state.manifestCompanies.filter(
      (c) =>
        (!c.test_only || state.testMode || state.selectedCompanies.has(c.id)) &&
        !hiddenSet.has(c.id.toLowerCase())
    );

    const knownIds = new Set(baseCompanies.map((c) => c.id.toLowerCase()));
    const savedCustom = prefs.added
      .filter((c) => c && c.id && !knownIds.has(c.id.toLowerCase()))
      .map((c) => ({
        id: c.id.toLowerCase(),
        name: c.name || formatSlugName(c.id),
        provider: "Ashby (Live)",
        isCustom: true,
      }));

    state.companies = [...baseCompanies, ...savedCustom];
  } catch (e) {
    console.error("Could not load manifest:", e);
  }

  await loadData();
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
