"""Tests for canonical location normalizer module."""
import pathlib
import subprocess


ROOT = pathlib.Path(__file__).resolve().parent.parent


def test_node_location_normalizer_suite():
    """Runs the JavaScript unit test suite for location_normalizer.js."""
    test_file = ROOT / "tests" / "test_location_normalizer.mjs"
    assert test_file.exists(), f"Missing {test_file}"

    res = subprocess.run(
        ["node", "--test", str(test_file)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert res.returncode == 0, f"Location normalizer tests failed:\n{res.stdout}\n{res.stderr}"
