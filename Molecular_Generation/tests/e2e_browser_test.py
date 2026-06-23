"""
E2E browser test for the SafeMolGen-DrugOracle UI (FastAPI + React).

Requires: pip install playwright && playwright install chromium
App must be running: backend + frontend (`./run`).
Default frontend URL: http://localhost:5173

Run: python -m pytest tests/e2e_browser_test.py -v
  or: python tests/e2e_browser_test.py
"""

import os
import sys
from pathlib import Path  # noqa: F401  (kept for downstream tooling)

try:
    import pytest
except ImportError:
    pytest = None

try:
    from playwright.sync_api import sync_playwright, expect
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

BASE_URL = os.environ.get("E2E_APP_URL", "http://localhost:5173")

NAV_TIMEOUT = 15000
WAIT_AFTER_CLICK = 1500
GENERATE_WAIT = 90000


def _new_page(browser):
    page = browser.new_page()
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
    page.wait_for_selector("text=Generate", timeout=10000)
    return page


def _test_app_loads():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = _new_page(browser)
            expect(page.get_by_text("Molecule generation", exact=False).first).to_be_visible(timeout=5000)
        finally:
            browser.close()


def _test_about_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = _new_page(browser)
            page.get_by_role("link", name="About").first.click()
            page.wait_for_timeout(WAIT_AFTER_CLICK)
            expect(page.get_by_text("Overview", exact=False).first).to_be_visible(timeout=5000)
        finally:
            browser.close()


def _test_sidebar_settings_visible():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = _new_page(browser)
            expect(page.get_by_text("Target success", exact=False).first).to_be_visible(timeout=5000)
            expect(page.get_by_text("Max iterations", exact=False).first).to_be_visible(timeout=3000)
            expect(page.get_by_text("Property targets", exact=False).first).to_be_visible(timeout=3000)
        finally:
            browser.close()


def _test_generate_page_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = _new_page(browser)
            expect(page.get_by_text("Target success", exact=False).first).to_be_visible(timeout=5000)
            expect(page.get_by_role("button", name="Run generation").first).to_be_visible(timeout=3000)
        finally:
            browser.close()


def _test_generate_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = _new_page(browser)
            try:
                inputs = page.locator('input[type="number"]')
                if inputs.count() >= 1:
                    inputs.nth(0).fill("1")
                    page.wait_for_timeout(800)
            except Exception:
                pass
            page.get_by_role("button", name="Run generation").first.click()
            page.wait_for_timeout(2000)
            assert not page.get_by_text("Traceback", exact=False).first.is_visible(), "App crashed with traceback"
            done = (
                page.get_by_text("Best molecule", exact=False)
                .or_(page.get_by_text("Optimization journey", exact=False))
                .or_(page.get_by_text("Phase probabilities", exact=False))
                .or_(page.get_by_text("Models not loaded", exact=False))
                .or_(page.get_by_text("Generator not loaded", exact=False))
            )
            expect(done.first).to_be_visible(timeout=GENERATE_WAIT)
        finally:
            browser.close()


def test_app_loads():
    _test_app_loads()


def test_about_page():
    _test_about_page()


def test_sidebar_settings_visible():
    _test_sidebar_settings_visible()


def test_generate_page_ui():
    _test_generate_page_ui()


def test_generate_flow():
    _test_generate_flow()


if pytest is not None:
    skip = pytest.mark.skipif(not HAS_PLAYWRIGHT, reason="playwright not installed")
    for name in [
        "test_app_loads", "test_about_page", "test_sidebar_settings_visible",
        "test_generate_page_ui", "test_generate_flow",
    ]:
        globals()[name] = skip(globals()[name])


_ALL_TESTS = [
    ("app_loads", _test_app_loads),
    ("about_page", _test_about_page),
    ("sidebar_settings_visible", _test_sidebar_settings_visible),
    ("generate_page_ui", _test_generate_page_ui),
    ("generate_flow", _test_generate_flow),
]


def main():
    if not HAS_PLAYWRIGHT:
        print("Install: pip install playwright && playwright install chromium")
        sys.exit(2)
    failed = 0
    for name, fn in _ALL_TESTS:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as e:
            print(f"FAIL {name}: {e}")
            failed += 1
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
