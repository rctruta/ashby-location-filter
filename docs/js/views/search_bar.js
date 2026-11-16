import { el } from "../dom.js";

export function renderControlsBar(container, state, onSearchChange, onModeChange) {
  const searchInput = el("input", {
    type: "search",
    class: "search-input",
    placeholder: "Search titles, departments, teams, locations...",
    value: state.search || "",
    oninput: (e) => onSearchChange(e.target.value),
  });

  const clearBtn = el("button", {
    type: "button",
    class: "clear-btn",
    "aria-label": "Clear search",
    title: "Clear search",
    onclick: () => {
      searchInput.value = "";
      onSearchChange("");
    },
  }, "✕");

  const searchBox = el("div", { class: "search-box" }, searchInput);
  if (state.search) {
    searchBox.append(clearBtn);
  }

  // View Mode buttons
  const modes = [
    ["location", "By Location"],
    ["department", "By Department"],
    ["combined", "Combined"],
  ];

  const modeButtons = modes.map(([modeKey, label]) => {
    const btn = el("button", {
      type: "button",
      class: `mode-btn ${state.viewMode === modeKey ? "active" : ""}`,
      onclick: () => onModeChange(modeKey),
    }, label);
    return btn;
  });

  const modeToggle = el("div", { class: "mode-toggle", role: "group", "aria-label": "Display Mode" }, ...modeButtons);

  container.replaceChildren(searchBox, modeToggle);
}
