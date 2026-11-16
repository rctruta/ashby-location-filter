import { el } from "../dom.js";

/**
 * Sets up the search bar and mode toggle buttons.
 * Preserves the input element across state updates to prevent cursor jumps and focus loss.
 */
export function renderControlsBar(container, state, onSearchChange, onModeChange) {
  let searchInput = container.querySelector(".search-input");
  let clearBtn = container.querySelector(".clear-btn");
  let modeToggle = container.querySelector(".mode-toggle");

  if (!searchInput) {
    searchInput = el("input", {
      type: "search",
      class: "search-input",
      placeholder: "Search titles, departments, teams, locations...",
      value: state.search || "",
      oninput: (e) => onSearchChange(e.target.value),
    });

    clearBtn = el(
      "button",
      {
        type: "button",
        class: "clear-btn",
        "aria-label": "Clear search",
        title: "Clear search",
        style: state.search ? "" : "display: none;",
        onclick: () => {
          searchInput.value = "";
          searchInput.focus();
          onSearchChange("");
        },
      },
      "✕"
    );

    const searchBox = el("div", { class: "search-box" }, searchInput, clearBtn);

    // Two clear, intuitive view modes: By Location or By Department
    const modes = [
      ["location", "By Location"],
      ["department", "By Department"],
    ];

    const modeButtons = modes.map(([modeKey, label]) => {
      return el(
        "button",
        {
          type: "button",
          "data-mode": modeKey,
          class: `mode-btn ${state.viewMode === modeKey ? "active" : ""}`,
          onclick: () => onModeChange(modeKey),
        },
        label
      );
    });

    modeToggle = el(
      "div",
      { class: "mode-toggle", role: "group", "aria-label": "Display Mode" },
      ...modeButtons
    );

    container.replaceChildren(searchBox, modeToggle);
  } else {
    // Only update value if the input is not currently focused by user
    if (document.activeElement !== searchInput) {
      searchInput.value = state.search || "";
    }
    clearBtn.style.display = state.search ? "" : "none";

    modeToggle.querySelectorAll(".mode-btn").forEach((btn) => {
      const modeKey = btn.getAttribute("data-mode");
      btn.classList.toggle("active", state.viewMode === modeKey);
    });
  }
}
