# ashby-location-filter

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

# Fast setup with uv (recommended):
uv sync

# Or standard pip:
python3 -m venv .venv
source .venv/bin/activate
pip install .
```

> **Important for contributors:** To enable repository quality and security guardrails:
> ```sh
> git config core.hooksPath .githooks
> ```

---

## Workflow & Usage

### 1. Validate & Add New Companies
You can add any company that uses Ashby for its careers page using the built-in CLI:

```sh
# Test & validate an Ashby job board without changing configuration
python3 tools/add_company.py notion --dry-run

# Automatically validate endpoint, register in config, and fetch snapshot
python3 tools/add_company.py https://jobs.ashbyhq.com/notion --name "Notion"
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
python3 tools/publish_snapshot.py --all
```

Or refresh an individual company or parse from a local test file:

```sh
python3 tools/publish_snapshot.py --company ramp
python3 tools/publish_snapshot.py path/to/sample_feed.json
```

### 3. Launch the Web Interface Locally
Start a local web server to view and interact with the application:

```sh
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000` in your browser.

---

## Hosting Your Own Job Board Filter

You can easily fork this repository and host your own custom job board tracker for your personal list of target companies:

### Option A: Free Static Hosting (GitHub Pages)
1. **Fork this repository** on GitHub.
2. **Customize your company list:** Edit `tools/publish_snapshot.yaml` to include the companies you want to track, then run `python3 tools/publish_snapshot.py --all`.
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
  - id: ramp
    name: Ramp
    provider: Ashby
    feed_url: https://api.ashbyhq.com/posting-api/job-board/ramp
    output: docs/data/ramp.json

manifest_output: docs/data/manifest.json
```

---

## Repository Guardrails & Integrity
This repository adheres to strict agent and human pair-programming contracts documented in `AGENTS.md`:
- `pre-commit` and `pre-push` hooks enforce clean trees, conventional commits, secret detection, and test suite passage.
- Run gate proof suite: `sh .gates/tests/prove_gates.sh`.
- Run pytest suite: `uv run pytest`.

---

## License
Dual-licensed under the [Apache License 2.0](LICENSE) (code and tools) and [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE) (documentation and published snapshot data).
