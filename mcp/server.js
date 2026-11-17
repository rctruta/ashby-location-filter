#!/usr/bin/env node
/**
 * @module mcp/server
 * Zero-dependency Model Context Protocol (MCP) server over stdio for
 * canonical Ashby job board search, location normalization, and scope classification.
 *
 * Copyright (c) 2026 Ramona C Truta
 * Licensed under the Apache License, Version 2.0
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  normalizeCountry,
  normalizeLocation,
  normalizeMetro,
} from "../docs/js/normalizers/location_normalizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT_DIR, "docs", "data", "manifest.json");
const DATA_DIR = path.join(ROOT_DIR, "docs", "data");

const DEFAULT_COMPANIES = [
  { id: "ashby", name: "Ashby", provider: "Ashby" },
  { id: "cohere", name: "Cohere", provider: "Ashby" },
];

export const SERVER_INFO = {
  name: "ashby-location-filter",
  version: "0.2.0",
};

export const TOOLS = [
  {
    name: "normalize_location",
    description:
      "Normalize a raw ATS job location string and optional postal address into canonical country (Unicode CLDR), canonical city, region, and geographical scope (global, country, region, metro, unspecified).",
    inputSchema: {
      type: "object",
      properties: {
        rawName: {
          type: "string",
          description: "Raw location string from the job posting (e.g. 'San Fransisco, CA (HQ)' or 'Remote - US')",
        },
        locality: {
          type: "string",
          description: "Optional postalAddress.addressLocality",
        },
        region: {
          type: "string",
          description: "Optional postalAddress.addressRegion",
        },
        country: {
          type: "string",
          description: "Optional postalAddress.addressCountry (name or 2-letter ISO code)",
        },
      },
      required: ["rawName"],
    },
  },
  {
    name: "list_companies",
    description:
      "List tracked Ashby job board companies available in local snapshots.",
    inputSchema: {
      type: "object",
      properties: {
        includeTest: {
          type: "boolean",
          description: "Include synthetic test_only fixtures (default: false)",
        },
      },
    },
  },
  {
    name: "search_jobs",
    description:
      "Search and filter Ashby job postings across tracked companies (or any live Ashby company slug) using canonical location normalization and scope classification.",
    inputSchema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Optional company slug (e.g. 'linear', 'ramp', 'cohere', 'ashby', 'influxdata', or any live Ashby board slug). Omit to search all tracked companies.",
        },
        country: {
          type: "string",
          description:
            "Filter by country name or ISO code (automatically normalized, e.g. 'USA', 'US', 'UK', 'CA', 'DE').",
        },
        city: {
          type: "string",
          description:
            "Filter by canonical city/metro name or alias (e.g. 'NYC' matches 'New York', 'SF' matches 'San Francisco').",
        },
        scope: {
          type: "string",
          enum: ["global", "country", "region", "metro"],
          description:
            "Filter by geographical scope ('global', 'country', 'region', 'metro').",
        },
        workplaceType: {
          type: "string",
          description: "Filter by workplaceType ('Remote', 'Hybrid', 'Onsite').",
        },
        department: {
          type: "string",
          description: "Case-insensitive substring match on department or team.",
        },
        query: {
          type: "string",
          description: "Case-insensitive keyword search on job title, department, or team.",
        },
        limit: {
          type: "number",
          description: "Maximum number of matching jobs to return (default: 50).",
        },
      },
    },
  },
];

function readManifest(includeTest = false) {
  if (!fs.existsSync(MANIFEST_PATH)) return DEFAULT_COMPANIES;
  const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const companies = raw.companies || [];
  return companies.filter((c) => includeTest || !c.test_only);
}

async function loadCompanyJobs(companySlug, trackedCompanies) {
  const cleanSlug = companySlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const tracked = trackedCompanies.find((c) => c.id.toLowerCase() === cleanSlug);
  const localFile = path.join(DATA_DIR, `${cleanSlug}.json`);

  if (fs.existsSync(localFile)) {
    const data = JSON.parse(fs.readFileSync(localFile, "utf8"));
    return {
      company: tracked ? tracked.name : cleanSlug,
      companyId: cleanSlug,
      jobs: (data.jobs || []).filter((j) => j.isListed !== false),
    };
  }

  // Fallback: fetch live from Ashby's public Posting API
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(cleanSlug)}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "ashby-location-filter-mcp/0.2.0" },
  });
  if (!resp.ok) {
    throw new Error(`Ashby API returned HTTP ${resp.status} for company '${cleanSlug}'`);
  }
  const data = await resp.json();
  return {
    company: cleanSlug,
    companyId: cleanSlug,
    jobs: (data.jobs || []).filter((j) => j.isListed !== false),
  };
}

function normalizeJobLocations(job) {
  const addr = job.address?.postalAddress || {};
  const primary = normalizeLocation({
    rawName: job.location,
    locality: addr.addressLocality,
    region: addr.addressRegion,
    country: addr.addressCountry,
  });

  const secondaries = (job.secondaryLocations || []).map((sec) => {
    const secAddr = sec.address?.postalAddress || {};
    return normalizeLocation({
      rawName: sec.location,
      locality: secAddr.addressLocality,
      region: secAddr.addressRegion,
      country: secAddr.addressCountry,
    });
  });

  return [primary, ...secondaries];
}

export async function callTool(name, args = {}) {
  if (name === "normalize_location") {
    return normalizeLocation({
      rawName: args.rawName,
      locality: args.locality,
      region: args.region,
      country: args.country,
    });
  }

  if (name === "list_companies") {
    const companies = readManifest(Boolean(args.includeTest));
    return {
      count: companies.length,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
      })),
    };
  }

  if (name === "search_jobs") {
    const tracked = readManifest(false);
    let boards = [];

    if (args.company) {
      boards = [await loadCompanyJobs(args.company, tracked)];
    } else {
      for (const c of tracked) {
        boards.push(await loadCompanyJobs(c.id, tracked));
      }
    }

    const wantCountry = args.country ? normalizeCountry(args.country) : null;
    const wantCity = args.city
      ? normalizeMetro(args.city, args.city, wantCountry) || args.city.trim()
      : null;
    const wantScope = args.scope ? args.scope.trim().toLowerCase() : null;
    const wantWorkplace = args.workplaceType ? args.workplaceType.trim().toLowerCase() : null;
    const wantDept = args.department ? args.department.trim().toLowerCase() : null;
    const wantQuery = args.query ? args.query.trim().toLowerCase() : null;
    const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 250) : 50;

    const matches = [];
    for (const board of boards) {
      for (const job of board.jobs) {
        const locations = normalizeJobLocations(job);

        if (wantCountry) {
          const hasCountry = locations.some(
            (loc) =>
              loc.canonicalCountry &&
              loc.canonicalCountry.toLowerCase() === wantCountry.toLowerCase()
          );
          if (!hasCountry) continue;
        }

        if (wantCity) {
          const hasCity = locations.some(
            (loc) =>
              loc.canonicalCity &&
              loc.canonicalCity.toLowerCase() === wantCity.toLowerCase()
          );
          if (!hasCity) continue;
        }

        if (wantScope) {
          const hasScope = locations.some((loc) => loc.scope === wantScope);
          if (!hasScope) continue;
        }

        if (wantWorkplace) {
          const wp = (job.workplaceType || "").toLowerCase();
          if (wp !== wantWorkplace) continue;
        }

        if (wantDept) {
          const deptText = `${job.department || ""} ${job.team || ""}`.toLowerCase();
          if (!deptText.includes(wantDept)) continue;
        }

        if (wantQuery) {
          const fullText = `${job.title || ""} ${job.department || ""} ${job.team || ""}`.toLowerCase();
          if (!fullText.includes(wantQuery)) continue;
        }

        matches.push({
          company: board.company,
          id: job.id,
          title: job.title,
          department: job.department || null,
          team: job.team || null,
          workplaceType: job.workplaceType || null,
          locations: locations.map((l) => ({
            displayName: l.displayName,
            canonicalCountry: l.canonicalCountry,
            canonicalRegion: l.canonicalRegion,
            canonicalCity: l.canonicalCity,
            scope: l.scope,
            isRemote: l.isRemote,
          })),
          jobUrl: job.jobUrl || null,
        });
      }
    }

    return {
      totalMatches: matches.length,
      returned: Math.min(matches.length, limit),
      jobs: matches.slice(0, limit),
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function handleJsonRpcRequest(msg) {
  if (!msg || typeof msg !== "object") return null;

  // Notifications have no id and expect no response
  if (msg.id === undefined || msg.id === null) {
    return null;
  }

  const { id, method, params } = msg;

  try {
    if (method === "initialize") {
      const clientVersion = params?.protocolVersion || "2024-11-05";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: clientVersion,
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        },
      };
    }

    if (method === "ping") {
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS,
        },
      };
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const output = await callTool(toolName, toolArgs);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(output, null, 2),
              },
            ],
          },
        };
      } catch (toolErr) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: ${toolErr.message || String(toolErr)}`,
              },
            ],
          },
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: err.message || "Internal error",
      },
    };
  }
}

export function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      const response = await handleJsonRpcRequest(msg);
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    } catch {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        })}\n`
      );
    }
  });
}

// Run stdio server when invoked directly from CLI
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  startStdioServer();
}
