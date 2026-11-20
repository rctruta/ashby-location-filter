// Every posting counted under a country must be reachable from one of that
// country's dropdown rows: a city, or the country-wide row.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { countForLocation, locationTree, passesLocation } from "../docs/js/filter.js";
import { readJob } from "../docs/js/models.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "../docs/data");

function loadJobs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(DATA, "manifest.json"), "utf8"));
  const jobs = [];
  for (const company of manifest.companies) {
    const snapshot = JSON.parse(fs.readFileSync(path.join(DATA, "..", company.snapshot), "utf8"));
    for (const job of snapshot.jobs) jobs.push(readJob(job, null, company));
  }
  return jobs;
}

const NO_FILTERS = {
  search: "",
  selectedCompanies: new Set(["all"]),
  loc: { kind: "all" },
  dept: { kind: "all" },
  workplaces: new Set(),
  status: "all",
};

function remoteCanadaOnly() {
  return readJob({
    id: "remote-canada-only",
    title: "Example",
    location: "Remote - Canada",
    address: { postalAddress: { addressCountry: "Canada", addressLocality: "", addressRegion: "" } },
    secondaryLocations: [],
  });
}

test("a posting whose only location is country-wide matches the country-wide row and no city", () => {
  const job = remoteCanadaOnly();
  assert.equal(passesLocation(job, { kind: "country", country: "Canada" }), true);
  assert.equal(passesLocation(job, { kind: "wide", country: "Canada" }), true);
  const tree = locationTree([job]);
  assert.equal(tree.get("Canada").cities.size, 0);
  assert.equal(tree.get("Canada").hasWide, true);
});

test("a posting with only a city does not match the country-wide row", () => {
  const job = readJob({
    id: "toronto-only",
    title: "Example",
    location: "Toronto",
    address: { postalAddress: { addressCountry: "Canada", addressLocality: "Toronto", addressRegion: "Ontario" } },
    secondaryLocations: [],
  });
  assert.equal(passesLocation(job, { kind: "wide", country: "Canada" }), false);
  assert.equal(passesLocation(job, { kind: "place", country: "Canada", name: "Toronto" }), true);
});

test("every posting in a country is reachable from one of that country's rows", () => {
  const jobs = loadJobs();
  const tree = locationTree(jobs);
  for (const [country, { cities, hasWide }] of tree) {
    if (country === null) continue;
    const inCountry = jobs.filter((j) => passesLocation(j, { kind: "country", country }));
    const unreachable = inCountry.filter(
      (j) =>
        !(hasWide && passesLocation(j, { kind: "wide", country })) &&
        ![...cities].some((name) => passesLocation(j, { kind: "place", country, name }))
    );
    assert.deepEqual(unreachable.map((j) => j.title), [], `${country}: postings in no row`);
  }
});

test("the published data has country-wide Canadian postings with no Canadian city", () => {
  const jobs = loadJobs();
  const wide = countForLocation(jobs, NO_FILTERS, { kind: "wide", country: "Canada" });
  const all = countForLocation(jobs, NO_FILTERS, { kind: "country", country: "Canada" });
  assert.ok(wide > 0 && wide <= all, `wide=${wide} all=${all}`);
});
