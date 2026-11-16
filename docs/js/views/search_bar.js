import { GROUP_MODES } from "../constants.js";
import { el } from "../dom.js";

/**
 * Sets up the search bar and group mode toggle buttons.
 * Preserves the input element across state updates to prevent cursor jumps and focus loss.
 */
export function renderControlsBar(container, state, onSearchChange, onGroupChange) {
  let searchInput = container.querySelector(".search-input");
  let clearBtn = container.querySelector(".clear-btn");
  let modeToggle = container.querySelector(".mode-toggle");

  if (!searchInput) {
    searchInput = el("input", {
      type: "search",
      class: "search-input",
      placeholder: "Search titles, companies, departments, teams, locations...",
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

    const modeButtons = GROUP_MODES.map(([modeKey, label]) => {
      return el(
        "button",
        {
          type: "button",
          "data-mode": modeKey,
          class: `mode-btn ${state.groupMode === modeKey ? "active" : ""}`,
          onclick: () => onGroupChange(modeKey),
        },
        label
      );
    });

    modeToggle = el(
      "div",
      { class: "mode-toggle", role: "group", "aria-label": "Group results by" },
      ...modeButtons
    );

    container.replaceChildren(searchBox, modeToggle);
  } else {
    if (document.activeElement !== searchInput) {
      searchInput.value = state.search || "";
    }
    clearBtn.style.display = state.search ? "" : "none";

    modeToggle.querySelectorAll(".mode-btn").forEach((btn) => {
      const modeKey = btn.getAttribute("data-mode");
      btn.classList.toggle("active", state.groupMode === modeKey);
    });
  }
}
