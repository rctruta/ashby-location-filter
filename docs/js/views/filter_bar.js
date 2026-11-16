import { GROUP_MODES, WORKPLACES } from "../constants.js";
import { el } from "../dom.js";
import {
  countForCompany,
  countForDepartment,
  countForLocation,
  countForWorkplace,
} from "../filter.js";

/**
 * Modern top filter bar with dropdowns and active filter pills.
 */
export function renderFilterBar(container, jobs, state, callbacks) {
  let searchInput = container.querySelector(".search-input");
  let clearSearchBtn = container.querySelector(".clear-search-btn");

  if (!searchInput) {
    searchInput = el("input", {
      type: "search",
      class: "search-input",
      placeholder: "Search titles, skills, locations, departments...",
      value: state.search || "",
      oninput: (e) => callbacks.onSearchChange(e.target.value),
    });

    clearSearchBtn = el(
      "button",
      {
        type: "button",
        class: "clear-search-btn",
        "aria-label": "Clear search",
        title: "Clear search",
        style: state.search ? "" : "display: none;",
        onclick: () => {
          searchInput.value = "";
          searchInput.focus();
          callbacks.onSearchChange("");
        },
      },
      "✕"
    );

    const searchBox = el("div", { class: "search-box" }, searchInput, clearSearchBtn);

    // Filter controls row
    const controlsRow = el("div", { class: "filters-row" });

    // 1. Company Select
    const companySelect = el("select", {
      class: "filter-select",
      id: "company-filter",
      "aria-label": "Filter by company",
      onchange: (e) => callbacks.onSelectCompany(e.target.value),
    });

    // 2. Location Select (Grouped by Country)
    const locationSelect = el("select", {
      class: "filter-select",
      id: "location-filter",
      "aria-label": "Filter by location",
      onchange: (e) => {
        const val = e.target.value;
        if (!val || val === "all") {
          callbacks.onSelectLoc({ kind: "all" });
        } else if (val.startsWith("c:")) {
          callbacks.onSelectLoc({ kind: "country", country: val.slice(2) });
        } else if (val.startsWith("p:")) {
          const [country, name] = val.slice(2).split("|||");
          callbacks.onSelectLoc({ kind: "place", country: country || null, name });
        }
      },
    });

    // 3. Department Select (Grouped by Department)
    const departmentSelect = el("select", {
      class: "filter-select",
      id: "department-filter",
      "aria-label": "Filter by department",
      onchange: (e) => {
        const val = e.target.value;
        if (!val || val === "all") {
          callbacks.onSelectDept({ kind: "all" });
        } else if (val.startsWith("d:")) {
          callbacks.onSelectDept({ kind: "department", name: val.slice(2) });
        } else if (val.startsWith("t:")) {
          const [dept, team] = val.slice(2).split("|||");
          callbacks.onSelectDept({ kind: "team", department: dept, name: team });
        }
      },
    });

    // 4. Workplace Multi-Toggle Dropdown Popover
    const workplaceDropdown = el("div", { class: "workplace-dropdown-wrapper" },
      el("button", {
        type: "button",
        class: "workplace-toggle-btn",
        onclick: (e) => {
          e.stopPropagation();
          const pop = container.querySelector(".workplace-popover");
          if (pop) pop.classList.toggle("open");
        },
      }, "Workplace ▾"),
      el("div", { class: "workplace-popover" })
    );

    // 5. Group Mode Select
    const groupSelect = el("select", {
      class: "filter-select group-select",
      id: "group-mode",
      "aria-label": "Group results by",
      onchange: (e) => callbacks.onGroupChange(e.target.value),
    });
    for (const [key, label] of GROUP_MODES) {
      groupSelect.append(el("option", { value: key }, label));
    }

    // 6. Reset All Button
    const resetBtn = el("button", {
      type: "button",
      class: "reset-all-btn",
      onclick: () => callbacks.onResetAll(),
    }, "Reset Filters");

    controlsRow.append(
      el("div", { class: "filter-item" }, el("label", {}, "Company:"), companySelect),
      el("div", { class: "filter-item" }, el("label", {}, "Location:"), locationSelect),
      el("div", { class: "filter-item" }, el("label", {}, "Department:"), departmentSelect),
      el("div", { class: "filter-item" }, el("label", {}, "Workplace:"), workplaceDropdown),
      el("div", { class: "filter-item" }, el("label", {}, "Display:"), groupSelect),
      resetBtn
    );

    container.replaceChildren(searchBox, controlsRow);

    // Close workplace popover on outside click
    document.addEventListener("click", () => {
      const pop = container.querySelector(".workplace-popover");
      if (pop) pop.classList.remove("open");
    });
  } else {
    if (document.activeElement !== searchInput) {
      searchInput.value = state.search || "";
    }
    clearSearchBtn.style.display = state.search ? "" : "none";
  }

  // Populate Company Select Options
  const companySelect = container.querySelector("#company-filter");
  if (companySelect) {
    const totalAllCount = countForCompany(jobs, state, "all");
    const options = [
      el("option", { value: "all" }, `All Companies (${totalAllCount})`)
    ];
    for (const c of state.companies) {
      const count = countForCompany(jobs, state, c.id);
      const opt = el("option", { value: c.id }, `${c.name} (${count})`);
      if (state.companyId === c.id) opt.setAttribute("selected", "selected");
      options.push(opt);
    }
    companySelect.replaceChildren(...options);
    companySelect.value = state.companyId || "all";
  }

  // Populate Location Select Options (Hierarchical Countries & Cities)
  const locationSelect = container.querySelector("#location-filter");
  if (locationSelect) {
    const locTree = new Map();
    for (const j of jobs) {
      for (const l of j.locs) {
        if (!locTree.has(l.country)) locTree.set(l.country, new Set());
        if (l.name && l.name !== l.country) locTree.get(l.country).add(l.name);
      }
    }

    const locOptions = [
      el("option", { value: "all" }, `All Locations (${countForLocation(jobs, state, { kind: "all" })})`)
    ];

    const sortedCountries = [...locTree.keys()].filter(Boolean).sort();
    for (const country of sortedCountries) {
      const cCount = countForLocation(jobs, state, { kind: "country", country });
      const group = el("optgroup", { label: `${country} (${cCount})` });

      // Country-wide option
      const countryOpt = el("option", { value: `c:${country}` }, `All ${country} (${cCount})`);
      group.append(countryOpt);

      const cities = [...locTree.get(country)].sort();
      for (const city of cities) {
        const cityCount = countForLocation(jobs, state, { kind: "place", country, name: city });
        if (cityCount > 0 || (state.loc.kind === "place" && state.loc.name === city)) {
          group.append(el("option", { value: `p:${country}|||${city}` }, `${city} (${cityCount})`));
        }
      }
      locOptions.push(group);
    }

    if (locTree.has(null)) {
      const otherPlaces = [...locTree.get(null)].sort();
      const otherGroup = el("optgroup", { label: "Other / Unspecified" });
      for (const place of otherPlaces) {
        const pCount = countForLocation(jobs, state, { kind: "place", country: null, name: place });
        otherGroup.append(el("option", { value: `p:|||${place}` }, `${place} (${pCount})`));
      }
      locOptions.push(otherGroup);
    }

    locationSelect.replaceChildren(...locOptions);

    if (state.loc.kind === "country") {
      locationSelect.value = `c:${state.loc.country}`;
    } else if (state.loc.kind === "place") {
      locationSelect.value = `p:${state.loc.country || ""}|||${state.loc.name}`;
    } else {
      locationSelect.value = "all";
    }
  }

  // Populate Department Select Options
  const departmentSelect = container.querySelector("#department-filter");
  if (departmentSelect) {
    const deptTree = new Map();
    for (const j of jobs) {
      const dept = j.department || "General";
      if (!deptTree.has(dept)) deptTree.set(dept, new Set());
      if (j.team) deptTree.get(dept).add(j.team);
    }

    const deptOptions = [
      el("option", { value: "all" }, `All Departments (${countForDepartment(jobs, state, { kind: "all" })})`)
    ];

    const sortedDepts = [...deptTree.keys()].sort();
    for (const dept of sortedDepts) {
      const dCount = countForDepartment(jobs, state, { kind: "department", name: dept });
      const group = el("optgroup", { label: `${dept} (${dCount})` });

      group.append(el("option", { value: `d:${dept}` }, `All ${dept} (${dCount})`));

      const teams = [...deptTree.get(dept)].sort();
      for (const team of teams) {
        const tCount = countForDepartment(jobs, state, { kind: "team", department: dept, name: team });
        if (tCount > 0 || (state.dept.kind === "team" && state.dept.name === team)) {
          group.append(el("option", { value: `t:${dept}|||${team}` }, `${team} (${tCount})`));
        }
      }
      deptOptions.push(group);
    }

    departmentSelect.replaceChildren(...deptOptions);

    if (state.dept.kind === "department") {
      departmentSelect.value = `d:${state.dept.name}`;
    } else if (state.dept.kind === "team") {
      departmentSelect.value = `t:${state.dept.department}|||${state.dept.name}`;
    } else {
      departmentSelect.value = "all";
    }
  }

  // Populate Workplace Popover Checkboxes (Multi-select)
  const workplacePopover = container.querySelector(".workplace-popover");
  const workplaceToggleBtn = container.querySelector(".workplace-toggle-btn");
  if (workplacePopover && workplaceToggleBtn) {
    const selectedCount = state.workplaces.size;
    workplaceToggleBtn.textContent = selectedCount === 0
      ? "Workplace ▾"
      : `Workplace (${selectedCount}) ▾`;

    const items = WORKPLACES.map(([value, label]) => {
      const count = countForWorkplace(jobs, state, value);
      const isChecked = state.workplaces.has(value);
      const cb = el("input", {
        type: "checkbox",
        checked: isChecked ? "checked" : null,
        onchange: (e) => {
          e.stopPropagation();
          callbacks.onToggleWorkplace(value);
        },
      });
      return el("label", { class: "workplace-checkbox-row", onclick: (e) => e.stopPropagation() },
        cb,
        el("span", { class: "cb-label" }, label),
        el("span", { class: "cb-count" }, String(count))
      );
    });

    workplacePopover.replaceChildren(...items);
  }

  // Sync Group Select value
  const groupSelect = container.querySelector("#group-mode");
  if (groupSelect) {
    groupSelect.value = state.groupMode || "department";
  }

  // Toggle Reset Button Visibility
  const resetBtn = container.querySelector(".reset-all-btn");
  if (resetBtn) {
    const hasActiveFilters =
      (state.companyId && state.companyId !== "all") ||
      (state.loc && state.loc.kind !== "all") ||
      (state.dept && state.dept.kind !== "all") ||
      state.workplaces.size > 0 ||
      (state.status && state.status !== "all") ||
      Boolean(state.search);

    resetBtn.style.display = hasActiveFilters ? "inline-flex" : "none";
  }
}

/**
 * Renders active filter tag pills with 1-click removal.
 */
export function renderActivePills(container, state, callbacks) {
  const pills = [];

  // Search keyword pill
  if (state.search) {
    pills.push(
      createPill(`Search: “${state.search}”`, () => callbacks.onSearchChange(""))
    );
  }

  // Company pill
  if (state.companyId && state.companyId !== "all") {
    const c = state.companies.find((comp) => comp.id === state.companyId);
    pills.push(
      createPill(`Company: ${c ? c.name : state.companyId}`, () => callbacks.onSelectCompany("all"))
    );
  }

  // Location pill
  if (state.loc && state.loc.kind !== "all") {
    const label = state.loc.kind === "country"
      ? `Country: ${state.loc.country}`
      : `City: ${state.loc.name}`;
    pills.push(
      createPill(label, () => callbacks.onSelectLoc({ kind: "all" }))
    );
  }

  // Department pill
  if (state.dept && state.dept.kind !== "all") {
    const label = state.dept.kind === "department"
      ? `Dept: ${state.dept.name}`
      : `Team: ${state.dept.name}`;
    pills.push(
      createPill(label, () => callbacks.onSelectDept({ kind: "all" }))
    );
  }

  // Workplace pills
  for (const wp of state.workplaces) {
    const wpLabel = WORKPLACES.find(([v]) => v === wp);
    pills.push(
      createPill(`Workplace: ${wpLabel ? wpLabel[1] : wp}`, () => callbacks.onToggleWorkplace(wp))
    );
  }

  // Status pill
  if (state.status && state.status !== "all") {
    pills.push(
      createPill(`Status: ${state.status}`, () => callbacks.onSelectStatus("all"))
    );
  }

  if (pills.length === 0) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  container.replaceChildren(
    el("span", { class: "pills-label" }, "Active filters:"),
    ...pills,
    el("button", {
      type: "button",
      class: "clear-all-pills-btn",
      onclick: () => callbacks.onResetAll(),
    }, "Clear all")
  );
}

function createPill(text, onRemove) {
  return el(
    "span",
    { class: "filter-pill" },
    text,
    el("button", {
      type: "button",
      class: "pill-remove",
      "aria-label": `Remove ${text}`,
      onclick: onRemove,
    }, "✕")
  );
}
