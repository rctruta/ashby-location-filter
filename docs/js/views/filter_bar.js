import { getCompanyHue, GROUP_MODES, WORKPLACES } from "../constants.js";
import { el } from "../dom.js";
import {
  countForCompany,
  countForDepartment,
  countForLocation,
  countForWorkplace,
} from "../filter.js";
import { isCountryWide, normalizeCountryName } from "../models.js";

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
          callbacks.onSelectLoc({ kind: "country", country: normalizeCountryName(val.slice(2)) });
        } else if (val.startsWith("p:")) {
          const [country, name] = val.slice(2).split("|||");
          callbacks.onSelectLoc({ kind: "place", country: normalizeCountryName(country) || null, name });
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
    const isAll = state.selectedCompanies && state.selectedCompanies.has("all");
    let buttonLabel = "Companies: All ▾";
    if (isAll) {
      buttonLabel = "Companies: All ▾";
    } else if (!state.selectedCompanies || state.selectedCompanies.size === 0) {
      buttonLabel = "Companies (0) ▾";
    } else if (state.selectedCompanies.size === 1) {
      const singleId = [...state.selectedCompanies][0];
      const comp = state.companies.find((c) => c.id === singleId);
      buttonLabel = `Company: ${comp ? comp.name : singleId} ▾`;
    } else {
      buttonLabel = `Companies (${state.selectedCompanies.size}) ▾`;
    }
    companyToggleBtn.textContent = buttonLabel;

    const totalAllCount = countForCompany(jobs, state, "all");

    // All Companies row (honest toggle)
    const allCheckbox = el("input", {
      type: "checkbox",
      checked: isAll ? "checked" : null,
      onchange: (e) => {
        callbacks.onToggleAllCompanies(e.target.checked);
      },
    });

    const allRow = el("label", { class: "company-checkbox-row all-row" },
      allCheckbox,
      el("span", { class: "cb-label" }, "All Companies"),
      el("span", { class: "cb-count" }, String(totalAllCount))
    );

    const divider = el("div", { class: "popover-divider" });

    // Individual company rows - standard clickable checkboxes with dynamic color indicator
    const companyRows = state.companies.map((c) => {
      const count = countForCompany(jobs, state, c.id);
      const isChecked = !isAll && state.selectedCompanies && state.selectedCompanies.has(c.id);
      const hue = getCompanyHue(c.id);

      const cb = el("input", {
        type: "checkbox",
        checked: isChecked ? "checked" : null,
        onchange: (e) => {
          callbacks.onToggleCompany(c.id, e.target.checked);
        },
      });

      return el("label", { class: "company-checkbox-row" },
        cb,
        el("span", { class: "company-dot", style: `--badge-hue: ${hue};` }),
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
        // Only include genuine city names (not country-wide or identical to country)
        if (l.city && l.city !== countryKey && !isCountryWide(l)) {
          locTree.get(countryKey).add(l.city);
        }
      }
    }

    const locOptions = [
      el("option", { value: "all" }, `All Locations (${countForLocation(jobs, state, { kind: "all" })})`)
    ];

    const sortedCountries = [...locTree.keys()].filter(Boolean).sort();
    for (const country of sortedCountries) {
      const cCount = countForLocation(jobs, state, { kind: "country", country });
      const isSelectedCountry = state.loc.kind === "country" && state.loc.country === country;

      // Skip empty countries unless currently selected
      if (cCount === 0 && !isSelectedCountry) continue;

      const rawCities = [...locTree.get(country)].sort();
      const activeCities = rawCities.map(city => {
        const cityCount = countForLocation(jobs, state, { kind: "place", country, name: city });
        const isSelectedCity = state.loc.kind === "place" && state.loc.name === city && state.loc.country === country;
        return { city, count: cityCount, selected: isSelectedCity };
      }).filter(c => c.count > 0 || c.selected);

      // If the country has NO specific cities, or only 1 city matching 100% of the listings:
      if (activeCities.length === 0) {
        const opt = el("option", { value: `c:${country}` }, `${country} (${cCount})`);
        if (isSelectedCountry) opt.setAttribute("selected", "selected");
        locOptions.push(opt);
      } else if (activeCities.length === 1 && activeCities[0].count === cCount) {
        const cityObj = activeCities[0];
        const city = cityObj.city;
        let label;
        if (city.toLowerCase() === country.toLowerCase() || city.toLowerCase().startsWith("remote") || city.toLowerCase().includes(country.toLowerCase())) {
          label = `${country} (${cCount})`;
        } else {
          label = `${country} – ${city} (${cCount})`;
        }
        const opt = el("option", { value: `c:${country}` }, label);
        if (isSelectedCountry || cityObj.selected) opt.setAttribute("selected", "selected");
        locOptions.push(opt);
      } else {
        // Has sub-cities: show optgroup with "All <Country>" + cities
        const group = el("optgroup", { label: `${country} (${cCount})` });
        const countryOpt = el("option", { value: `c:${country}` }, `All ${country} (${cCount})`);
        if (isSelectedCountry) countryOpt.setAttribute("selected", "selected");
        group.append(countryOpt);

        for (const { city, count, selected } of activeCities) {
          const cityOpt = el("option", { value: `p:${country}|||${city}` }, `${city} (${count})`);
          if (selected) cityOpt.setAttribute("selected", "selected");
          group.append(cityOpt);
        }
        locOptions.push(group);
      }
    }

    if (locTree.has(null)) {
      const otherPlaces = [...locTree.get(null)].sort();
      const activePlaces = otherPlaces.map(place => {
        const pCount = countForLocation(jobs, state, { kind: "place", country: null, name: place });
        const isSelected = state.loc.kind === "place" && state.loc.country === null && state.loc.name === place;
        return { place, count: pCount, selected: isSelected };
      }).filter(p => p.count > 0 || p.selected);

      if (activePlaces.length > 0) {
        const otherGroup = el("optgroup", { label: "Other / Unspecified" });
        for (const { place, count } of activePlaces) {
          otherGroup.append(el("option", { value: `p:|||${place}` }, `${place} (${count})`));
        }
        locOptions.push(otherGroup);
      }
    }

    locationSelect.replaceChildren(...locOptions);

    const normStateCountry = state.loc.country ? normalizeCountryName(state.loc.country) : null;
    if (state.loc.kind === "country") {
      locationSelect.value = `c:${normStateCountry}`;
    } else if (state.loc.kind === "place") {
      locationSelect.value = `p:${normStateCountry || ""}|||${state.loc.name}`;
      if (!locationSelect.value && normStateCountry) {
        locationSelect.value = `c:${normStateCountry}`;
      }
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
      if (j.team && j.team !== dept) deptTree.get(dept).add(j.team);
    }

    const deptOptions = [
      el("option", { value: "all" }, `All Departments (${countForDepartment(jobs, state, { kind: "all" })})`)
    ];

    const sortedDepts = [...deptTree.keys()].sort();
    for (const dept of sortedDepts) {
      const dCount = countForDepartment(jobs, state, { kind: "department", name: dept });
      const isSelectedDept = state.dept.kind === "department" && state.dept.name === dept;

      // Skip 0-count departments unless currently selected
      if (dCount === 0 && !isSelectedDept) continue;

      const rawTeams = [...deptTree.get(dept)].sort();
      const activeTeams = rawTeams.map(team => {
        const tCount = countForDepartment(jobs, state, { kind: "team", department: dept, name: team });
        const isSelectedTeam = state.dept.kind === "team" && state.dept.name === team && state.dept.department === dept;
        return { team, count: tCount, selected: isSelectedTeam };
      }).filter(t => t.count > 0 || t.selected);

      // If the department has NO sub-teams:
      if (activeTeams.length === 0) {
        const opt = el("option", { value: `d:${dept}` }, `${dept} (${dCount})`);
        if (isSelectedDept) opt.setAttribute("selected", "selected");
        deptOptions.push(opt);
      } else if (activeTeams.length === 1 && activeTeams[0].count === dCount) {
        // Only 1 sub-team and it covers 100% of the department's listings: single clean option
        const teamObj = activeTeams[0];
        const team = teamObj.team;
        let label;
        if (team.toLowerCase() === dept.toLowerCase()) {
          label = `${dept} (${dCount})`;
        } else if (team.toLowerCase().startsWith(dept.toLowerCase()) || team.toLowerCase().includes(dept.toLowerCase())) {
          label = `${team} (${dCount})`;
        } else {
          label = `${dept} – ${team} (${dCount})`;
        }
        const opt = el("option", { value: `d:${dept}` }, label);
        if (isSelectedDept || teamObj.selected) opt.setAttribute("selected", "selected");
        deptOptions.push(opt);
      } else {
        // Has sub-teams: show optgroup with "All <Dept>" + sub-teams
        const group = el("optgroup", { label: `${dept} (${dCount})` });
        const deptOpt = el("option", { value: `d:${dept}` }, `All ${dept} (${dCount})`);
        if (isSelectedDept) deptOpt.setAttribute("selected", "selected");
        group.append(deptOpt);

        for (const { team, count, selected } of activeTeams) {
          const teamOpt = el("option", { value: `t:${dept}|||${team}` }, `${team} (${count})`);
          if (selected) teamOpt.setAttribute("selected", "selected");
          group.append(teamOpt);
        }
        deptOptions.push(group);
      }
    }

    departmentSelect.replaceChildren(...deptOptions);

    if (state.dept.kind === "department") {
      departmentSelect.value = `d:${state.dept.name}`;
    } else if (state.dept.kind === "team") {
      departmentSelect.value = `t:${state.dept.department}|||${state.dept.name}`;
      if (!departmentSelect.value && state.dept.department) {
        departmentSelect.value = `d:${state.dept.department}`;
      }
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

  // Reset Button is always enabled and visible
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
