import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyScope,
  normalizeCountry,
  normalizeLocation,
  normalizeMetro,
  stripDecorators,
} from "../docs/js/normalizers/location_normalizer.js";

test("normalizeCountry unifies synonyms and codes", () => {
  assert.equal(normalizeCountry("USA"), "United States");
  assert.equal(normalizeCountry("us"), "United States");
  assert.equal(normalizeCountry("united states of america"), "United States");
  assert.equal(normalizeCountry("UK"), "United Kingdom");
  assert.equal(normalizeCountry("GB"), "United Kingdom");
  assert.equal(normalizeCountry("de"), "Germany");
  assert.equal(normalizeCountry("ca"), "Canada");
  assert.equal(normalizeCountry("korea"), "South Korea");
  assert.equal(normalizeCountry("uae"), "United Arab Emirates");
});

test("stripDecorators removes recruiter tags", () => {
  assert.equal(stripDecorators("New York, NY (HQ)"), "New York, NY");
  assert.equal(stripDecorators("San Francisco [Hybrid]"), "San Francisco");
  assert.equal(stripDecorators("Toronto (Remote)"), "Toronto");
  assert.equal(stripDecorators("London [Office]"), "London");
});

test("classifyScope distinguishes global, country, region, and metro", () => {
  assert.equal(classifyScope("Remote (US or Canada)"), "global");
  assert.equal(classifyScope("APAC"), "global");
  assert.equal(classifyScope("Remote - Canada", "Canada"), "country");
  assert.equal(classifyScope("Remote (US)", "United States"), "country");
  assert.equal(classifyScope("United States", "United States"), "country");
  assert.equal(classifyScope("Remote California", "United States"), "region");
  assert.equal(classifyScope("San Francisco, CA", "United States"), "metro");
  assert.equal(classifyScope("London", "United Kingdom"), "metro");
});

test("normalizeMetro cleans recruiter typos and variations", () => {
  // Ramp typo
  assert.equal(
    normalizeMetro("San Francisco, CA", "San Fransisco", "United States"),
    "San Francisco"
  );
  // New York City vs New York
  assert.equal(
    normalizeMetro("New York, NY (HQ)", "New York City", "United States"),
    "New York"
  );
  // Washington DC
  assert.equal(
    normalizeMetro("Washington, D.C.", "Washington D.C.", "United States"),
    "Washington, DC"
  );
  // Country-wide remote has no metro
  assert.equal(
    normalizeMetro("Remote - Canada", "", "Canada"),
    null
  );
});

test("normalizeLocation produces complete canonical location object", () => {
  const sf = normalizeLocation({
    rawName: "San Francisco, CA",
    locality: "San Fransisco",
    region: "California",
    country: "USA",
  });
  assert.equal(sf.canonicalCountry, "United States");
  assert.equal(sf.canonicalCity, "San Francisco");
  assert.equal(sf.scope, "metro");
  assert.equal(sf.compoundKey, "p:United States|||San Francisco");

  const canadaRemote = normalizeLocation({
    rawName: "Remote - Canada",
    locality: "",
    region: "",
    country: "Canada",
  });
  assert.equal(canadaRemote.canonicalCountry, "Canada");
  assert.equal(canadaRemote.canonicalCity, null);
  assert.equal(canadaRemote.scope, "country");
  assert.equal(canadaRemote.isRemote, true);
  assert.equal(canadaRemote.compoundKey, "c:Canada");

  const multiRegion = normalizeLocation({
    rawName: "Remote (US or Canada)",
    locality: "",
    region: "",
    country: "",
  });
  assert.equal(multiRegion.scope, "global");
  assert.equal(multiRegion.canonicalCity, null);
  assert.equal(multiRegion.isRemote, true);
});
