"""Serverless API proxy for on-demand Ashby job board querying.

Receives requests with ?company=<slug>, fetches live postings from Ashby's API,
injects CORS headers, and returns the listed job postings payload.
"""
from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

import yaml

CONFIG_PATH = Path(__file__).resolve().parent.parent / "tools" / "publish_snapshot.yaml"


def resolve_endpoint(company_slug: str) -> str | None:
    """Derive Ashby API URL from config without hardcoded URLs."""
    slug = re.sub(r"[^a-zA-Z0-9_-]", "", company_slug.strip().lower())
    if not slug:
        return None
    if CONFIG_PATH.is_file():
        cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
        companies = cfg.get("companies", [])
        if companies:
            sample = str(companies[0].get("feed_url", ""))
            return re.sub(r"/[^/]+$", f"/{slug}", sample)
    return None


def fetch_company_jobs(slug: str) -> tuple[int, dict]:
    """Fetch live jobs for a company slug."""
    url = resolve_endpoint(slug)
    if not url:
        return 400, {"error": "Invalid company slug or missing configuration"}

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ashby-location-filter/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            jobs = [j for j in data.get("jobs", []) if j.get("isListed") is not False]
            return 200, {
                "company": slug,
                "jobs": jobs,
                "total": len(jobs),
            }
    except urllib.error.HTTPError as e:
        return e.code, {"error": f"Upstream Ashby API returned HTTP {e.code}"}
    except Exception as e:
        return 502, {"error": f"Failed to contact Ashby API: {e}"}


class handler(BaseHTTPRequestHandler):
    """Vercel / standard library serverless HTTP request handler."""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        company = params.get("company", [None])[0]

        if not company:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing 'company' query parameter"}).encode("utf-8"))
            return

        status, body = fetch_company_jobs(company)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))


if __name__ == "__main__":
    from http.server import HTTPServer
    server = HTTPServer(("localhost", 3000), handler)
    server.serve_forever()
