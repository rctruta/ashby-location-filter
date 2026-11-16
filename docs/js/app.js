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
  currentCompanyId: "all", // Defaults to all companies combined for rich search experience
  currentSnapshotUrl: DEFAULT_SNAPSHOT,
  viewMode: "location", // "location" | "department"
  search: "",
  loc: { kind: "all" },
  dept: { kind: "all" },
  workplaces: new Set(),
  status: "all",
};

let allJobs = [];
let sourceMeta = null;

function initFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("company")) state.currentCompanyId = params.get("company");
  if (params.get("view") === "department") state.viewMode = "department";
  else state.viewMode = "location";

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
  if (state.currentCompanyId && state.currentCompanyId !== "all") {
    params.set("company", state.currentCompanyId);
  }
  if (state.viewMode !== "location") params.set("view", state.viewMode);
  if (state.search) params.set("q", state.search);

  if (state.viewMode === "location") {
    if (state.loc.kind === "country") {
      params.set("country", state.loc.country);
    } else if (state.loc.kind === "place") {
      params.set("place", state.loc.name);
      if (state.loc.country) params.set("p_country", state.loc.country);
    }
  } else if (state.viewMode === "department") {
    if (state.dept.kind === "department") {
      params.set("dept", state.dept.name);
    } else if (state.dept.kind === "team") {
      params.set("team", state.dept.name);
      params.set("t_dept", state.dept.department);
    }
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
  // Re-render sidebar and results instantly without touching the input focus
  render();
}

function onModeChange(mode) {
  if (state.viewMode === mode) return;
  state.viewMode = mode;
  // Reset opposing facet to keep view clean and intuitive
  if (mode === "department") {
    state.loc = { kind: "all" };
  } else {
    state.dept = { kind: "all" };
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

async function onSelectCompany(companyId) {
  state.currentCompanyId = companyId;
  state.loc = { kind: "all" };
  state.dept = { kind: "all" };
  state.workplaces.clear();
  state.status = "all";
  await loadData();
  render();
}

async function loadData() {
  if (state.currentCompanyId === "all") {
    // Load all companies in parallel
    const results = await Promise.all(
      state.companies.map(async (c) => {
        try {
          const resp = await fetch(c.snapshot);
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
      const listed = (data.jobs || []).filter(
        (j) => j.isListed === true || j.isListed === undefined
      );
      const active = listed.map((j) => readJob(j, diffInfo, { id: company.id, name: company.name }));
      const removed = ((diffInfo && diffInfo.removed_jobs) || []).map((j) =>
        readJob(j, { is_removed: true }, { id: company.id, name: company.name })
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
  } else {
    // Load single selected company
    const match = state.companies.find((c) => c.id === state.currentCompanyId);
    const snapshotUrl = match ? match.snapshot : state.currentSnapshotUrl;
    const response = await fetch(snapshotUrl);
    if (!response.ok) throw new Error(`${snapshotUrl}: HTTP ${response.status}`);
    const data = await response.json();

    sourceMeta = data.source;
    const diffInfo = data.diff || null;

    const companyInfo = match ? { id: match.id, name: match.name } : null;
    const listed = (data.jobs || []).filter((j) => j.isListed === true || j.isListed === undefined);
    const activeJobs = listed.map((j) => readJob(j, diffInfo, companyInfo));
    const removedJobs = ((diffInfo && diffInfo.removed_jobs) || []).map((j) =>
      readJob(j, { is_removed: true }, companyInfo)
    );

    allJobs = [...activeJobs, ...removedJobs];
  }
}

async function main() {
  initFromURL();

  // Load manifest
  try {
    const manifestResp = await fetch(MANIFEST_URL);
    if (manifestResp.ok) {
      const manifest = await manifestResp.json();
      state.companies = manifest.companies || [];
      if (!state.currentCompanyId && state.companies.length > 0) {
        state.currentCompanyId = "all";
      }
    }
  } catch (e) {
    console.warn("Could not load manifest; falling back to default snapshot.", e);
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
