import { DEFAULT_COMPANY, MANIFEST_URL } from "./constants.js";
import { el } from "./dom.js";
import { readJob } from "./models.js";
import { renderActivePills, renderFilterBar } from "./views/filter_bar.js";
import { renderResults } from "./views/results_view.js";
import { renderSourceHeader } from "./views/source_header.js";

// Global reactive application state
const state = {
  companies: [],
  selectedCompanies: new Set(["all"]), // "all" or Set of specific company IDs
  groupMode: "department", // "company" | "department" | "location" | "flat"
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

async function main() {
  initFromURL();

  try {
    const manifestResp = await fetch(MANIFEST_URL);
    if (!manifestResp.ok) throw new Error(`HTTP ${manifestResp.status}`);
    const manifest = await manifestResp.json();
    state.companies = manifest.companies || [];
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
