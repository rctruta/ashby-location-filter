import { DEFAULT_SNAPSHOT, MANIFEST_URL } from "./constants.js";
import { el } from "./dom.js";
import { readJob } from "./models.js";
import { renderCompanyPicker } from "./views/company_picker.js";
import { renderFacetSidebar } from "./views/facet_sidebar.js";
import { renderResults } from "./views/results_view.js";
import { renderControlsBar } from "./views/search_bar.js";
import { renderSourceHeader } from "./views/source_header.js";

// Global reactive application state
const state = {
  companies: [],
  currentCompanyId: "cohere",
  currentSnapshotUrl: DEFAULT_SNAPSHOT,
  viewMode: "combined", // "location" | "department" | "combined"
  search: "",
  loc: { kind: "all" },
  dept: { kind: "all" },
  workplaces: new Set(),
  status: "all",
};

let allJobs = [];
let sourceMeta = null;

// Read query params from URL
function initFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("company")) state.currentCompanyId = params.get("company");
  if (params.get("view")) state.viewMode = params.get("view");
  if (params.get("q")) state.search = params.get("q");
  if (params.get("country")) {
    state.loc = { kind: "country", country: params.get("country") };
  } else if (params.get("place")) {
    state.loc = {
      kind: "place",
      country: params.get("p_country") || null,
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
    params.get("workplaces").split(",").filter(Boolean).forEach(w => state.workplaces.add(w));
  }
  if (params.get("status")) state.status = params.get("status");
}

// Update URL without reloading page
function syncToURL() {
  const params = new URLSearchParams();
  if (state.currentCompanyId && state.currentCompanyId !== "cohere") {
    params.set("company", state.currentCompanyId);
  }
  if (state.viewMode !== "combined") params.set("view", state.viewMode);
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

  const pickerContainer = document.getElementById("company-picker-slot");
  if (pickerContainer) {
    renderCompanyPicker(pickerContainer, state.companies, state.currentCompanyId, onSelectCompany);
  }

  const controlsContainer = document.getElementById("controls-slot");
  if (controlsContainer) {
    renderControlsBar(controlsContainer, state, onSearchChange, onModeChange);
  }

  const sidebarContainer = document.getElementById("sidebar-slot");
  if (sidebarContainer) {
    renderFacetSidebar(sidebarContainer, allJobs, state, {
      onSelectLoc,
      onSelectDept,
      onToggleWorkplace,
      onSelectStatus,
    });
  }

  const resultsContainer = document.getElementById("results-slot");
  if (resultsContainer) {
    renderResults(resultsContainer, allJobs, state);
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

function onModeChange(mode) {
  state.viewMode = mode;
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

async function onSelectCompany(companyId) {
  const match = state.companies.find(c => c.id === companyId);
  if (!match) return;
  state.currentCompanyId = companyId;
  state.currentSnapshotUrl = match.snapshot;
  state.loc = { kind: "all" };
  state.dept = { kind: "all" };
  state.workplaces.clear();
  state.status = "all";
  await loadSnapshot(state.currentSnapshotUrl);
  render();
}

async function loadSnapshot(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = await response.json();

  sourceMeta = data.source;
  const diffInfo = data.diff || null;

  // Active listed jobs
  const listed = (data.jobs || []).filter(j => j.isListed === true || j.isListed === undefined);
  const activeJobs = listed.map(j => readJob(j, diffInfo));

  // If there are removed jobs recorded in diff, include them so they can be viewed
  const removedJobs = ((diffInfo && diffInfo.removed_jobs) || []).map(j =>
    readJob(j, { is_removed: true })
  );

  allJobs = [...activeJobs, ...removedJobs];
}

async function main() {
  initFromURL();

  // Load manifest if available
  try {
    const manifestResp = await fetch(MANIFEST_URL);
    if (manifestResp.ok) {
      const manifest = await manifestResp.json();
      state.companies = manifest.companies || [];
      const current = state.companies.find(c => c.id === state.currentCompanyId);
      if (current) {
        state.currentSnapshotUrl = current.snapshot;
      } else if (state.companies.length > 0) {
        state.currentCompanyId = state.companies[0].id;
        state.currentSnapshotUrl = state.companies[0].snapshot;
      }
    }
  } catch (e) {
    console.warn("Could not load manifest; falling back to default snapshot.", e);
  }

  await loadSnapshot(state.currentSnapshotUrl);
  render();
}

main().catch(error => {
  const errBox = el("div", { class: "error" }, `Could not load job postings.\n${error.message || error}`);
  document.body.prepend(errBox);
  console.error("Initialization failed:", error);
});
