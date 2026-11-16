import { el } from "../dom.js";

export function renderCompanyPicker(container, companies, currentCompanyId, onSelect) {
  if (!companies || companies.length <= 1) {
    container.innerHTML = "";
    return;
  }

  const select = el("select", {
    id: "company-select",
    "aria-label": "Select Job Board",
    onchange: (e) => onSelect(e.target.value),
  });

  for (const c of companies) {
    const opt = el("option", { value: c.id }, `${c.name} (${c.provider})`);
    if (c.id === currentCompanyId) {
      opt.setAttribute("selected", "selected");
    }
    select.append(opt);
  }

  container.replaceChildren(
    el("div", { class: "company-selector" },
      el("label", { for: "company-select" }, "Company"),
      select
    )
  );
}
