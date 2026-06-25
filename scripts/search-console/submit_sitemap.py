#!/usr/bin/env python3
"""Submit EMPATHEIA's sitemap to Google Search Console via the API.

One-time setup (see scripts/search-console/README.md):
  1. Create an OAuth "Desktop app" client in Google Cloud Console and download
     the JSON as scripts/search-console/client_secret.json
  2. pip install -r scripts/search-console/requirements.txt
  3. python scripts/search-console/submit_sitemap.py

The first run opens a browser for consent and caches a token at
scripts/search-console/token.json so later runs are non-interactive.

Property and sitemap default to the production site but can be overridden:
  SITE_URL=https://empatheia.sinhaankur.com SITEMAP=sitemap.xml python ... submit
"""

import os
import sys

SCOPES = ["https://www.googleapis.com/auth/webmasters"]

HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT_SECRET = os.path.join(HERE, "client_secret.json")
TOKEN_PATH = os.path.join(HERE, "token.json")

SITE_URL = os.environ.get("SITE_URL", "https://empatheia.sinhaankur.com")
SITEMAP = os.environ.get("SITEMAP", "sitemap.xml")


def _fail(msg: str, code: int = 1):
    print(f"\n✗ {msg}\n", file=sys.stderr)
    sys.exit(code)


def get_service():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        _fail(
            "Missing dependencies. Run:\n"
            "  pip install -r scripts/search-console/requirements.txt"
        )

    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CLIENT_SECRET):
                _fail(
                    "client_secret.json not found.\n"
                    "Create an OAuth 'Desktop app' client in Google Cloud Console\n"
                    "and save it as scripts/search-console/client_secret.json\n"
                    "(full steps in scripts/search-console/README.md)."
                )
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())

    return build("searchconsole", "v1", credentials=creds)


def main():
    service = get_service()
    sitemap_url = f"{SITE_URL.rstrip('/')}/{SITEMAP.lstrip('/')}"

    print(f"Property : {SITE_URL}")
    print(f"Sitemap  : {sitemap_url}")

    # Confirm the property is accessible to this account (clear error if not).
    try:
        sites = service.sites().list().execute().get("siteEntry", [])
        owned = {s.get("siteUrl", "").rstrip("/") for s in sites}
        if SITE_URL.rstrip("/") not in owned:
            print(
                "\n⚠ This account doesn't list "
                f"{SITE_URL} as a property.\n"
                "  Make sure you authorized the same Google account that owns the\n"
                "  verified Search Console property, and that it's a URL-prefix\n"
                "  property for exactly this URL.\n"
                f"  Properties visible to this account: {sorted(owned) or 'none'}"
            )
    except Exception as e:  # noqa: BLE001 - surface, don't crash the submit
        print(f"(could not list properties: {e})")

    # Submit the sitemap (idempotent — re-submitting just refreshes it).
    service.sitemaps().submit(siteUrl=SITE_URL, feedpath=sitemap_url).execute()
    print("\n✓ Sitemap submitted.")

    # Read back its status so the result is verifiable.
    try:
        info = service.sitemaps().get(siteUrl=SITE_URL, feedpath=sitemap_url).execute()
        print(f"  lastSubmitted: {info.get('lastSubmitted', 'n/a')}")
        print(f"  isPending    : {info.get('isPending', 'n/a')}")
        contents = info.get("contents", [])
        if contents:
            print(f"  submitted URLs: {contents[0].get('submitted', 'n/a')}")
    except Exception as e:  # noqa: BLE001
        print(f"(submitted, but couldn't read back status: {e})")


if __name__ == "__main__":
    main()
