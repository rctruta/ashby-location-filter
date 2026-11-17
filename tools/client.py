"""Fetch feed data from remote URL or local file."""
import json
import urllib.request
from pathlib import Path
from typing import Any


def fetch_feed(url_or_path: str | Path) -> dict[str, Any]:
    """Fetch JSON from a URL or load from a local file path."""
    source_str = str(url_or_path)
    if source_str.startswith("http://") or source_str.startswith("https://"):
        req = urllib.request.Request(
            source_str,
            headers={"User-Agent": "ashby-location-filter/1.0"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    path = Path(source_str)
    return json.loads(path.read_text(encoding="utf-8"))
