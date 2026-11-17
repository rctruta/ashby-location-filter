// ==UserScript==
// @name         Ashby Canonical Location Filter Overlay
// @namespace    https://github.com/rctruta/ashby-location-filter
// @version      0.2.0
// @description  Adds a 1-click button on any jobs.ashbyhq.com/<company> board to open and filter its live jobs with canonical Unicode CLDR location normalization.
// @author       Ramona C Truta
// @license      Apache-2.0
// @match        https://jobs.ashbyhq.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (pathParts.length === 0) return;

  const slug = pathParts[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  if (!slug) return;

  const targetUrl = `https://rctruta.github.io/ashby-location-filter/?custom=${encodeURIComponent(
    slug
  )}&companies=${encodeURIComponent(slug)}`;

  const btn = document.createElement("a");
  btn.href = targetUrl;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.textContent = `Filter '${slug}' by Canonical Location ↗`;
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "999999",
    background: "#2563eb",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: "9999px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: "13px",
    fontWeight: "600",
    textDecoration: "none",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
    transition: "transform 0.15s ease, background 0.15s ease",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#1d4ed8";
    btn.style.transform = "translateY(-1px)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#2563eb";
    btn.style.transform = "translateY(0)";
  });

  document.body.appendChild(btn);
})();
