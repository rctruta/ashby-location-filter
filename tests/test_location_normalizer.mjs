import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyScope,
  normalizeCountry,
  normalizeLocation,
  normalizeMetro,
  parseAshbySlug,
  stripDecorators,
} from "../docs/js/normalizers/location_normalizer.js";
import { handleJsonRpcRequest } from "../mcp/server.js";

test("normalizeCountry unifies synonyms, aliases, and native Intl ISO codes", () => {
  // Recruiter synonyms
  assert.equal(normalizeCountry("USA"), "United States");
  assert.equal(normalizeCountry("us"), "United States");
  assert.equal(normalizeCountry("united states of america"), "United States");
  assert.equal(normalizeCountry("UK"), "United Kingdom");
  assert.equal(normalizeCountry("GB"), "United Kingdom");
  assert.equal(normalizeCountry("korea"), "South Korea");
  assert.equal(normalizeCountry("uae"), "United Arab Emirates");

  // Native Unicode CLDR via Intl.DisplayNames (2-letter ISO codes)
  assert.equal(normalizeCountry("IS"), "Iceland");
  assert.equal(normalizeCountry("UY"), "Uruguay");
  assert.equal(normalizeCountry("NO"), "Norway");
  assert.equal(normalizeCountry("DE"), "Germany");
  assert.equal(normalizeCountry("JP"), "Japan");
  assert.equal(normalizeCountry("CR"), "Costa Rica");
  assert.equal(normalizeCountry("LU"), "Luxembourg");

  // Open-world fallback for unknown country strings
  assert.equal(normalizeCountry("Wakanda"), "Wakanda");
});

test("stripDecorators removes recruiter noise tags and bracketed tokens", () => {
  assert.equal(stripDecorators("New York, NY (HQ)"), "New York, NY");
  assert.equal(stripDecorators("San Francisco [Hybrid]"), "San Francisco");
  assert.equal(stripDecorators("Toronto (Remote)"), "Toronto");
  assert.equal(stripDecorators("London [Office]"), "London");
  assert.equal(stripDecorators("Reykjavík [Office / Onsite]"), "Reykjavík");
  assert.equal(
    stripDecorators("Zürich, Zurich, Switzerland (Headquarters) [Hybrid/Flex]"),
    "Zürich, Zurich, Switzerland"
  );
});

test("classifyScope distinguishes global, country, region, and metro", () => {
  assert.equal(classifyScope("Remote (US or Canada)"), "global");
  assert.equal(classifyScope("APAC"), "global");
  assert.equal(classifyScope("Remote - Canada", "Canada"), "country");
  assert.equal(classifyScope("rEmOtE - - - Iceland (HQ)", "Iceland"), "country");
  assert.equal(classifyScope("Remote (US)", "United States"), "country");
  assert.equal(classifyScope("Anywhere in Norway... [100% Remote]", "Norway"), "country");
  assert.equal(classifyScope("United States", "United States"), "country");
  assert.equal(classifyScope("Remote California", "United States"), "region");
  assert.equal(classifyScope("Remote - - Texas (Americas)", "United States"), "region");
  assert.equal(classifyScope("San Francisco, CA", "United States"), "metro");
  assert.equal(classifyScope("London", "United Kingdom"), "metro");
});

test("normalizeMetro handles recruiter typos while supporting open-world unseen cities", () => {
  // Recruiter typos resolved
  assert.equal(
    normalizeMetro("San Francisco, CA", "San Fransisco", "United States"),
    "San Francisco"
  );
  assert.equal(
    normalizeMetro("New York, NY (HQ)", "New York City", "United States"),
    "New York"
  );
  assert.equal(
    normalizeMetro("Washington, D.C.", "Washington D.C.", "United States"),
    "Washington, DC"
  );

  // Country-wide remote has no metro
  assert.equal(
    normalizeMetro("Remote - Canada", "", "Canada"),
    null
  );

  // Open-world: completely new cities never seen before work seamlessly!
  assert.equal(
    normalizeMetro("Bratislava, Slovakia", "Bratislava", "Slovakia"),
    "Bratislava"
  );
  assert.equal(
    normalizeMetro("Nagoya, Japan (Tech Center)", "Nagoya", "Japan"),
    "Nagoya"
  );
  assert.equal(
    normalizeMetro("Groningen, Netherlands", "Groningen", "Netherlands"),
    "Groningen"
  );
  assert.equal(
    normalizeMetro("Montevideo, Uruguay (Tech Hub)", "Montevideo", "Uruguay"),
    "Montevideo"
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

test("crafty_testing synthetic fixture stress-tests all edge cases cleanly", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.join(__dirname, "../docs/data/crafty_testing.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assert.ok(Array.isArray(fixture.jobs) && fixture.jobs.length > 0);

  const normalizedByJobId = new Map();
  for (const job of fixture.jobs) {
    const addr = job.address?.postalAddress || {};
    const primary = normalizeLocation({
      rawName: job.location,
      locality: addr.addressLocality,
      region: addr.addressRegion,
      country: addr.addressCountry,
    });
    normalizedByJobId.set(job.id, primary);
    assert.ok(["global", "country", "region", "metro", "unspecified"].includes(primary.scope));
  }

  assert.equal(normalizedByJobId.get("crafty-001").canonicalCountry, "Iceland");
  assert.equal(normalizedByJobId.get("crafty-001").scope, "country");
  assert.equal(normalizedByJobId.get("crafty-002").scope, "global");
  assert.equal(normalizedByJobId.get("crafty-003").canonicalCity, "Reykjavík");
  assert.equal(normalizedByJobId.get("crafty-005").canonicalCity, "Zürich");
  assert.equal(normalizedByJobId.get("crafty-006").scope, "region");
});

test("MCP server handles initialize, tools/list, and tools/call over JSON-RPC 2.0", async () => {
  const initResp = await handleJsonRpcRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });
  assert.equal(initResp.result.serverInfo.name, "ashby-location-filter");
  assert.equal(initResp.result.serverInfo.version, "0.2.0");

  const listResp = await handleJsonRpcRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const toolNames = listResp.result.tools.map((t) => t.name);
  assert.deepEqual(toolNames, ["normalize_location", "list_companies", "search_jobs"]);

  const normResp = await handleJsonRpcRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "normalize_location",
      arguments: {
        rawName: "San Fransisco, CA (HQ)",
        locality: "San Fransisco",
        region: "California",
        country: "USA",
      },
    },
  });
  const normData = JSON.parse(normResp.result.content[0].text);
  assert.equal(normData.canonicalCountry, "United States");
  assert.equal(normData.canonicalCity, "San Francisco");
  assert.equal(normData.scope, "metro");

  const companiesResp = await handleJsonRpcRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "list_companies",
      arguments: {},
    },
  });
  const companiesData = JSON.parse(companiesResp.result.content[0].text);
  assert.ok(companiesData.count >= 5);
  assert.ok(!companiesData.companies.some((c) => c.id === "crafty_testing"));

  const searchResp = await handleJsonRpcRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "search_jobs",
      arguments: {
        company: "linear",
        country: "USA",
        limit: 5,
      },
    },
  });
  const searchData = JSON.parse(searchResp.result.content[0].text);
  assert.ok(Array.isArray(searchData.jobs));
  assert.ok(searchData.returned <= 5);
});

test("parseAshbySlug extracts clean company slugs from raw inputs and Ashby URLs", () => {
  assert.equal(parseAshbySlug("notion"), "notion");
  assert.equal(parseAshbySlug("  Deel "), "deel");
  assert.equal(parseAshbySlug("https://jobs.ashbyhq.com/vanta"), "vanta");
  assert.equal(parseAshbySlug("https://jobs.ashbyhq.com/openai/1234-5678"), "openai");
  assert.equal(
    parseAshbySlug("https://api.ashbyhq.com/posting-api/job-board/retool"),
    "retool"
  );
  assert.equal(parseAshbySlug(""), null);
  assert.equal(parseAshbySlug(null), null);
});
