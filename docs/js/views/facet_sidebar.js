import { WORKPLACES, STATUS_OPTIONS } from "../constants.js";
import { el } from "../dom.js";
import {
  countForDepartment,
  countForLocation,
  hitsLocation,
  passesSearch,
  passesStatus,
  passesWorkplace,
} from "../filter.js";
import { addressNote, isCountryWide } from "../models.js";

function sameLoc(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && a.country === b.country && a.name === b.name;
}

function sameDept(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && a.name === b.name && a.department === b.department;
}

function row(label, sub, count, isPressed, onClick) {
  return el(
    "button",
    {
      class: "row",
      "aria-pressed": String(isPressed),
      onclick: onClick,
    },
    el("span", { class: "name" }, label, sub ? el("span", { class: "sub" }, sub) : null),
    el("span", { class: "count" }, String(count))
  );
}

export function renderLocationsPanel(container, jobs, state, onSelectLoc) {
  const panel = el("div", { class: "panel" }, el("h2", {}, "Filter by Location"));
  const box = el("div", { id: "locations-list" });

  box.append(
    row(
      "All locations",
      null,
      countForLocation(jobs, state, { kind: "all" }),
      state.loc.kind === "all",
      () => onSelectLoc({ kind: "all" })
    )
  );

  const tree = new Map();
  for (const job of jobs) {
    for (const l of job.locs) {
      if (!tree.has(l.country)) tree.set(l.country, new Map());
      tree.get(l.country).set(l.name, l);
    }
  }

  const countries = [...tree.keys()]
    .filter(c => c !== null)
    .map(c => [c, countForLocation(jobs, state, { kind: "country", country: c })])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const places = country =>
    [...tree.get(country).values()]
      .map(l => [l, countForLocation(jobs, state, { kind: "place", country, name: l.name })])
      .sort(
        (a, b) =>
          isCountryWide(b[0]) - isCountryWide(a[0]) ||
          b[1] - a[1] ||
          a[0].name.localeCompare(b[0].name)
      );

  for (const [country, count] of countries) {
    const isSelected = state.loc.country === country;
    box.append(
      row(
        country,
        "any location in this country",
        count,
        sameLoc(state.loc, { kind: "country", country }),
        () => onSelectLoc({ kind: "country", country })
      )
    );

    if (isSelected) {
      const kids = el("div", { class: "children" });
      for (const [l, n] of places(country)) {
        kids.append(
          row(
            l.name,
            addressNote(l),
            n,
            sameLoc(state.loc, { kind: "place", country, name: l.name }),
            () => onSelectLoc({ kind: "place", country, name: l.name })
          )
        );
      }
      kids.append(
        el(
          "p",
          { class: "note" },
          `A posting can list several locations, so these rows do not add up to ${count}.`
        )
      );
      box.append(kids);
    }
  }

  if (tree.has(null)) {
    box.append(
      el(
        "p",
        { class: "group-label" },
        "Named locations with no address country in the feed"
      )
    );
    for (const [l, n] of places(null)) {
      box.append(
        row(
          l.name,
          addressNote(l),
          n,
          sameLoc(state.loc, { kind: "place", country: null, name: l.name }),
          () => onSelectLoc({ kind: "place", country: null, name: l.name })
        )
      );
    }
  }

  panel.append(box);
  container.append(panel);
}

export function renderDepartmentsPanel(container, jobs, state, onSelectDept) {
  const panel = el("div", { class: "panel" }, el("h2", {}, "Filter by Department"));
  const box = el("div", { id: "departments-list" });

  box.append(
    row(
      "All departments",
      null,
      countForDepartment(jobs, state, { kind: "all" }),
      state.dept.kind === "all",
      () => onSelectDept({ kind: "all" })
    )
  );

  const deptMap = new Map();
  for (const job of jobs) {
    const dept = job.department || "General";
    if (!deptMap.has(dept)) deptMap.set(dept, new Set());
    if (job.team) {
      deptMap.get(dept).add(job.team);
    }
  }

  const deptList = [...deptMap.keys()]
    .map(d => [d, countForDepartment(jobs, state, { kind: "department", name: d })])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  for (const [deptName, count] of deptList) {
    const isDeptSelected = state.dept.department === deptName || state.dept.name === deptName;
    box.append(
      row(
        deptName,
        null,
        count,
        sameDept(state.dept, { kind: "department", name: deptName }),
        () => onSelectDept({ kind: "department", name: deptName })
      )
    );

    const teams = [...deptMap.get(deptName)].sort();
    if (isDeptSelected && teams.length > 0) {
      const kids = el("div", { class: "children" });
      for (const team of teams) {
        const teamCount = countForDepartment(jobs, state, {
          kind: "team",
          department: deptName,
          name: team,
        });
        kids.append(
          row(
            team,
            "team",
            teamCount,
            sameDept(state.dept, { kind: "team", department: deptName, name: team }),
            () => onSelectDept({ kind: "team", department: deptName, name: team })
          )
        );
      }
      box.append(kids);
    }
  }

  panel.append(box);
  container.append(panel);
}

export function renderWorkplacesPanel(container, jobs, state, onToggleWorkplace) {
  const panel = el(
    "div",
    { class: "panel" },
    el("h2", {}, "Work arrangement"),
    el("div", { id: "workplaces-list" }),
    el("p", { class: "note" }, "The feed records this once per posting, not per location.")
  );

  const box = panel.querySelector("#workplaces-list");
  const inScope = jobs.filter(j => {
    if (!passesSearch(j, state.search)) return false;
    if (!passesStatus(j, state.status)) return false;
    if (state.dept.kind !== "all") {
      const deptCheck =
        state.dept.kind === "department"
          ? j.department === state.dept.name
          : j.department === state.dept.department && j.team === state.dept.name;
      if (!deptCheck) return false;
    }
    return state.loc.kind === "all" || hitsLocation(j, state.loc).length > 0;
  });

  box.replaceChildren(
    ...WORKPLACES.map(([value, label]) =>
      row(
        label,
        null,
        inScope.filter(j => j.workplace === value).length,
        state.workplaces.has(value),
        () => onToggleWorkplace(value)
      )
    )
  );

  container.append(panel);
}

export function renderStatusPanel(container, jobs, state, onSelectStatus) {
  const hasDiffs = jobs.some(j => j.status === "new" || j.status === "removed");
  if (!hasDiffs) return;

  const panel = el("div", { class: "panel" }, el("h2", {}, "Posting Status (Diffs)"), el("div", { id: "status-list" }));

  const box = panel.querySelector("#status-list");
  const inScope = jobs.filter(j => {
    if (!passesSearch(j, state.search)) return false;
    if (!passesWorkplace(j, state.workplaces)) return false;
    return true;
  });

  box.replaceChildren(
    ...STATUS_OPTIONS.map(([value, label]) => {
      const count =
        value === "all"
          ? inScope.length
          : inScope.filter(j => j.status === value).length;
      return row(label, null, count, state.status === value, () => onSelectStatus(value));
    })
  );

  container.append(panel);
}

export function renderFacetSidebar(container, jobs, state, callbacks) {
  container.innerHTML = "";

  // Dedicated clean focus per viewMode
  if (state.viewMode === "department") {
    renderDepartmentsPanel(container, jobs, state, callbacks.onSelectDept);
  } else {
    // "location"
    renderLocationsPanel(container, jobs, state, callbacks.onSelectLoc);
  }

  renderWorkplacesPanel(container, jobs, state, callbacks.onToggleWorkplace);
  renderStatusPanel(container, jobs, state, callbacks.onSelectStatus);
}
