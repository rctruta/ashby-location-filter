# ashby-location-filter

[![CI](https://github.com/rctruta/ashby-location-filter/actions/workflows/ci.yml/badge.svg)](https://github.com/rctruta/ashby-location-filter/actions/workflows/ci.yml)
[![Snapshots Sync](https://github.com/rctruta/ashby-location-filter/actions/workflows/update_snapshots.yml/badge.svg)](https://github.com/rctruta/ashby-location-filter/actions/workflows/update_snapshots.yml)
[![Version](https://img.shields.io/github/package-json/v/rctruta/ashby-location-filter?label=version&color=blue)](https://github.com/rctruta/ashby-location-filter/blob/main/package.json)
[![MCP Server](https://img.shields.io/badge/MCP-stdio-7c3aed)](https://github.com/rctruta/ashby-location-filter#mcp-server-claude-desktop-cursor-antigravity)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://github.com/rctruta/ashby-location-filter/blob/main/LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://rctruta.github.io/ashby-location-filter/)
[![mcprush](https://img.shields.io/endpoint?url=https%3A%2F%2Fmcprush.com%2Fbadge%2Fashby-location-filter-mcp-2%2Fshields.json)](https://mcprush.com/to/ashby-location-filter-mcp-2?ref=badge)

A multi-company job search and filtering engine tailored for public Ashby job boards. It aggregates job postings from multiple companies into a single cohesive interface, normalizes inconsistent recruiter location entries, tracks daily additions and delistings, and provides real-time multi-faceted filtering.

## What Problems This Solves

1. **Multi-Company Aggregation:** Search across all your target companies (e.g. Cohere, Ramp, Linear, InfluxData) in one place instead of opening dozens of career tabs.
2. **Normalized City & Country Hierarchy:** Recruiter strings like `"Toronto"` (Cohere) and `"Toronto, ON"` (Ramp) are automatically merged into a single bucket (`Toronto (76)`), avoiding fragmented search buckets.
3. **Collision-Proof Location Scoping:** Grouped by country (`optgroup`) and scoped strictly by country code, ensuring `London, ON` (Canada) never merges with `London` (UK).
4. **Multi-Select Company & Workplace:** Compare any subset of companies (e.g., Ramp + Linear) or view all companies with one click. Filter across Remote, Hybrid, and In-office simultaneously.
5. **Diff Tracking:** Highlights new openings added since the last run and marks roles delisted/removed by companies.
6. **Zero-Build Architecture:** Modern ES modules and CSS with no Node.js build step or bundler needed. Runs directly in any modern browser.

---

## Getting Started

### 1. Prerequisites
- Python 3.10+
- [uv](https://github.com/astral-sh/uv) (recommended) or standard Python `pip`
- A modern web browser

### 2. Setup
Clone the repository and install dependencies:

```sh
git clone https://github.com/rctruta/ashby-location-filter.git
cd ashby-location-filter

uv sync
```

> **Important for contributors:** To enable repository quality and security guardrails:
> ```sh
> git config core.hooksPath .githooks
> ```

---

## Workflow & Usage

### 1. Validate, Add, or Remove Companies
You can add or remove any company that uses Ashby for its careers page using the built-in CLI:

```sh
# Test & validate an Ashby job board without changing configuration
python3 -m tools.add_company notion --dry-run

# Automatically validate endpoint, register in config, and fetch snapshot
python3 -m tools.add_company https://jobs.ashbyhq.com/notion --name "Notion"

# Remove a company from publish_snapshot.yaml, delete its snapshot, and update manifest.json
python3 -m tools.add_company influxdata --remove
```

The CLI:
- Extracts the company slug from a name, slug, or full career URL.
- Validates the remote Ashby Posting API.
- Checks `isListed` job counts.
- Appends the company configuration to `tools/publish_snapshot.yaml`.
- Fetches the snapshot to `docs/data/<slug>.json` and rebuilds `docs/data/manifest.json`.

### 2. Update Job Board Snapshots
Refresh snapshots for all configured companies from live feeds:

```sh
python3 -m tools.publish_snapshot --all
```

Or refresh an individual company or parse from a local test file:

```sh
python3 -m tools.publish_snapshot --company ramp
python3 -m tools.publish_snapshot path/to/sample_feed.json
```

### 3. Launch the Web Interface Locally
Start a local web server to view and interact with the application:

```sh
python3 -m http.server 8080 --directory docs
```

Then open `http://localhost:8080` in your browser.

---

## Integrating the Normalizer in Custom Job Boards

If you are building a custom career site with Ashby's Posting API, you can install and import the canonical normalizer directly (zero runtime dependencies, native Unicode CLDR):

```sh
npm install github:rctruta/ashby-location-filter
```

```javascript
import { normalizeLocation, classifyScope } from "ashby-location-filter";

const result = normalizeLocation({
  rawName: "San Fransisco, CA [Hiring Immediately]",
  locality: "San Francisco",
  region: "California",
  country: "USA"
});

console.log(result);
// {
//   canonicalCity: "San Francisco",
//   canonicalRegion: "California",
//   canonicalCountry: "United States",
//   scope: "metro",
//   isRemote: false,
//   displayName: "San Francisco, United States",
//   compoundKey: "p:United States|||San Francisco"
// }
```

---

## MCP Server (Claude Desktop, Cursor, Antigravity)

<!-- mcp-name: io.github.rctruta/ashby-location-filter -->

This repository includes a zero-dependency **Model Context Protocol (MCP)** server (`mcp-name: io.github.rctruta/ashby-location-filter`) that exposes canonical Ashby job search, location normalization, and scope classification tools over `stdio`:

- `normalize_location` — Normalize raw ATS location strings + postal addresses using Unicode CLDR (`Intl.DisplayNames`) and recruiter alias rules.
- `list_companies` — List tracked Ashby job boards available in local snapshots.
- `search_jobs` — Search and filter jobs across tracked companies (or any live Ashby company slug) by canonical country, city, scope (`global`, `country`, `region`, `metro`), workplace type, department, or keyword.

Add to your MCP client configuration (e.g. `claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ashby-location-filter": {
      "command": "npx",
      "args": ["-y", "github:rctruta/ashby-location-filter"]
    }
  }
}
```

---

## Hosting Your Own Job Board Filter

You can easily fork this repository and host your own custom job board tracker for your personal list of target companies:

### Option A: Free Static Hosting (GitHub Pages)
1. **Fork this repository** on GitHub.
2. **Customize your company list:** Edit `tools/publish_snapshot.yaml` to include the companies you want to track, then run `python3 -m tools.publish_snapshot --all`.
3. **Enable GitHub Pages:** Go to your repository **Settings → Pages → Source: Deploy from branch (`main`, folder `/docs`)**.
4. **Daily Updates:** The included GitHub Actions workflow (`.github/workflows/update_snapshots.yml`) will automatically run every day at 06:00 UTC, fetch fresh postings, compute diffs, and commit them back to your repo.

### Option B: Serverless On-Demand Hosting (Vercel)
If you want an on-demand deployment where visitors can query any company dynamically via an API proxy:
1. **Connect your repository to Vercel:** Import your GitHub fork into [Vercel](https://vercel.com).
2. The included [`vercel.json`](vercel.json) and [`api/jobs.py`](api/jobs.py) automatically configure:
   - Serving `docs/` as the fast static frontend.
   - An API proxy at `/api/jobs?company=<slug>` that fetches live Ashby feeds and injects CORS headers.
3. Test locally with the serverless endpoint:
   ```sh
   python3 api/jobs.py
   # In another terminal:
   curl "http://localhost:3000/api/jobs?company=linear"
   ```

---

## Automated Daily Sync (GitHub Actions)
The repository includes a GitHub Actions workflow (`.github/workflows/update_snapshots.yml`):
- **Daily Cron:** Runs automatically at 06:00 UTC every day.
- **Manual Trigger:** Run on demand via **Actions → Update Job Board Snapshots → Run workflow**.
- Automatically commits and pushes updated snapshots back to `main`, keeping live deployments up-to-date with zero manual intervention.

---

## Configuration (`tools/publish_snapshot.yaml`)
Companies and fields are configured declaratively:

```yaml
posting_fields:
  - id
  - title
  - department
  - team
  - location
  - address
  - secondaryLocations
  - workplaceType
  - jobUrl

companies:
  - id: cohere
    name: Cohere
    provider: Ashby
    feed_url: https://api.ashbyhq.com/posting-api/job-board/cohere
    output: docs/data/cohere.json
  - id: ashby
    name: Ashby
    provider: Ashby
    feed_url: https://api.ashbyhq.com/posting-api/job-board/ashby
    output: docs/data/ashby.json

manifest_output: docs/data/manifest.json
```

---

## Repository Guardrails & Integrity
This repository adheres to strict agent and human pair-programming contracts documented in `AGENTS.md`:
- `pre-commit` and `pre-push` hooks enforce clean trees, conventional commits, secret detection, and test suite passage.
- Run gate proof suite: `sh .gates/tests/prove_gates.sh`.
- Run pytest suite: `uv run pytest`.
- Run Node.js normalizer & MCP test suite: `npm test`.

---

## Future Roadmap
- **UI-Based Company Persistence:** Allow users to add, pin, and persist custom Ashby company boards directly from the browser UI alongside daily repository snapshots.
- **Additional ATS Normalizer Adapters:** Extend canonical location normalization and scope classification adapters to Greenhouse and Lever feeds.

---

## License
Dual-licensed under the [Apache License 2.0](LICENSE) (code and tools) and [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE) (documentation and published snapshot data).
