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

    // 1. Company Multi-Select Dropdown Popover
    const companyDropdown = el("div", { class: "company-dropdown-wrapper" },
      el("button", {
        type: "button",
        class: "company-toggle-btn",
        onclick: (e) => {
          e.stopPropagation();
          const pop = container.querySelector(".company-popover");
          if (pop) pop.classList.toggle("open");
          const wpPop = container.querySelector(".workplace-popover");
          if (wpPop) wpPop.classList.remove("open");
        },
      }, "Companies: All ▾"),
      el("div", { class: "company-popover" })
    );

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
      el("div", { class: "filter-item" }, el("label", {}, "Company:"), companyDropdown),
      el("div", { class: "filter-item" }, el("label", {}, "Location:"), locationSelect),
      el("div", { class: "filter-item" }, el("label", {}, "Department:"), departmentSelect),
      el("div", { class: "filter-item" }, el("label", {}, "Workplace:"), workplaceDropdown),
      el("div", { class: "filter-item" }, el("label", {}, "Display:"), groupSelect),
      resetBtn
    );

    container.replaceChildren(searchBox, controlsRow);

    // Close popovers on outside click
    document.addEventListener("click", () => {
      const cPop = container.querySelector(".company-popover");
      if (cPop) cPop.classList.remove("open");
      const wpPop = container.querySelector(".workplace-popover");
      if (wpPop) wpPop.classList.remove("open");
    });
  } else {
    if (document.activeElement !== searchInput) {
      searchInput.value = state.search || "";
    }
    clearSearchBtn.style.display = state.search ? "" : "none";
  }

  // Populate Company Popover Checkboxes (Multi-select)
  const companyPopover = container.querySelector(".company-popover");
  const companyToggleBtn = container.querySelector(".company-toggle-btn");
  if (companyPopover && companyToggleBtn) {
    const isAll = !state.selectedCompanies || state.selectedCompanies.has("all") || state.selectedCompanies.size === 0;
    const selectedCount = isAll ? 0 : state.selectedCompanies.size;
    companyToggleBtn.textContent = isAll
      ? "Companies: All ▾"
      : `Companies (${selectedCount}) ▾`;

    const totalAllCount = countForCompany(jobs, state, "all");

    // All Companies row
    const allCheckbox = el("input", {
      type: "checkbox",
      checked: isAll ? "checked" : null,
      onchange: (e) => {
        e.stopPropagation();
        callbacks.onToggleAllCompanies(e.target.checked);
      },
    });

    const allRow = el("label", {
      class: "company-checkbox-row all-row",
      onclick: (e) => e.stopPropagation(),
    },
      allCheckbox,
      el("span", { class: "cb-label" }, "All Companies"),
      el("span", { class: "cb-count" }, String(totalAllCount))
    );

    const divider = el("div", { class: "popover-divider" });

    // Individual company rows (disabled when All Companies is checked)
    const companyRows = state.companies.map((c) => {
      const count = countForCompany(jobs, state, c.id);
      const isChecked = !isAll && state.selectedCompanies.has(c.id);

      const cb = el("input", {
        type: "checkbox",
        checked: isChecked ? "checked" : null,
        disabled: isAll ? "disabled" : null,
        onchange: (e) => {
          e.stopPropagation();
          callbacks.onToggleCompany(c.id, e.target.checked);
        },
      });

      return el("label", {
        class: `company-checkbox-row ${isAll ? "disabled" : ""}`,
        title: isAll ? `Select ${c.name}` : "",
        onclick: (e) => {
          e.stopPropagation();
          if (isAll) {
            callbacks.onToggleCompany(c.id, true);
          }
        },
      },
        cb,
        el("span", { class: "cb-label" }, c.name),
        el("span", { class: "cb-count" }, String(count))
      );
    });

    companyPopover.replaceChildren(allRow, divider, ...companyRows);
  }

  // Populate Location Select Options (Hierarchical Countries & Cities)
  const locationSelect = container.querySelector("#location-filter");
  if (locationSelect) {
    const locTree = new Map();
    for (const j of jobs) {
      for (const l of j.locs) {
        const countryKey = l.country || null;
        if (!locTree.has(countryKey)) locTree.set(countryKey, new Set());
        const cityName = l.city || l.name;
        if (cityName && cityName !== countryKey) {
          locTree.get(countryKey).add(cityName);
        }
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
    const hasActiveCompanies = state.selectedCompanies && !state.selectedCompanies.has("all") && state.selectedCompanies.size > 0;
    const hasActiveFilters =
      hasActiveCompanies ||
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

  // Company pills
  if (state.selectedCompanies && !state.selectedCompanies.has("all") && state.selectedCompanies.size > 0) {
    for (const cid of state.selectedCompanies) {
      const c = state.companies.find((comp) => comp.id === cid);
      const name = c ? c.name : cid;
      pills.push(
        createPill(`Company: ${name}`, () => callbacks.onToggleCompany(cid, false))
      );
    }
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
