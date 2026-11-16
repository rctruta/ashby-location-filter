import { STATUS_OPTIONS, WORKPLACES } from "../constants.js";
import { el } from "../dom.js";
import {
  countForCompany,
  countForDepartment,
  countForLocation,
  countForStatus,
  countForWorkplace,
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

export function renderCompanyFacet(container, jobs, state, onSelectCompany) {
  if (!state.companies || state.companies.length <= 1) return;

  const panel = el("div", { class: "panel" }, el("h2", {}, "Company"));
  const box = el("div", { id: "companies-list" });

  box.append(
    row(
      "All Companies",
      `${state.companies.length} boards combined`,
      countForCompany(jobs, state, "all"),
      state.companyId === "all",
      () => onSelectCompany("all")
    )
  );

  for (const c of state.companies) {
    box.append(
      row(
        c.name,
        null,
        countForCompany(jobs, state, c.id),
        state.companyId === c.id,
        () => onSelectCompany(c.id)
      )
    );
  }

  panel.append(box);
  container.append(panel);
}

export function renderLocationsPanel(container, jobs, state, onSelectLoc) {
  const panel = el("div", { class: "panel" }, el("h2", {}, "Location"));
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
    .filter(([, count]) => count > 0 || state.loc.country !== null)
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
    const nullPlaces = places(null).filter(([, n]) => n > 0 || state.loc.name !== null);
    if (nullPlaces.length > 0) {
      box.append(
        el("p", { class: "group-label" }, "Locations with no address country")
      );
      for (const [l, n] of nullPlaces) {
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
  }

  panel.append(box);
  container.append(panel);
}

export function renderDepartmentsPanel(container, jobs, state, onSelectDept) {
  const panel = el("div", { class: "panel" }, el("h2", {}, "Department"));
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
    .filter(([, count]) => count > 0 || state.dept.name === null)
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
  const panel = el("div", { class: "panel" },
    el("h2", {}, "Work arrangement"),
    el("div", { id: "workplaces-list" })
  );

  const box = panel.querySelector("#workplaces-list");

  box.replaceChildren(
    ...WORKPLACES.map(([value, label]) =>
      row(
        label,
        null,
        countForWorkplace(jobs, state, value),
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

  const panel = el("div", { class: "panel" },
    el("h2", {}, "Posting Status"),
    el("div", { id: "status-list" })
  );

  const box = panel.querySelector("#status-list");

  box.replaceChildren(
    ...STATUS_OPTIONS.map(([value, label]) => {
      const count = countForStatus(jobs, state, value);
      return row(label, null, count, state.status === value, () => onSelectStatus(value));
    })
  );

  container.append(panel);
}

export function renderFacetSidebar(container, jobs, state, callbacks) {
  container.innerHTML = "";

  // 1. Company Facet (visible when multiple companies exist)
  renderCompanyFacet(container, jobs, state, callbacks.onSelectCompany);

  // 2. Location Facet (always visible, always synchronized)
  renderLocationsPanel(container, jobs, state, callbacks.onSelectLoc);

  // 3. Department Facet (always visible, always synchronized)
  renderDepartmentsPanel(container, jobs, state, callbacks.onSelectDept);

  // 4. Workplace Facet (always visible, dynamically calculated)
  renderWorkplacesPanel(container, jobs, state, callbacks.onToggleWorkplace);

  // 5. Diff Status Facet (visible if diff data exists)
  renderStatusPanel(container, jobs, state, callbacks.onSelectStatus);
}
