# Search Console — programmatic sitemap submission

Submits `empatheia.sinhaankur.com`'s sitemap to Google Search Console via the
API, so it can be re-run any time (e.g. after adding pages) instead of clicking
through the dashboard.

> Note: the dashboard equivalent is ~30 seconds (Sitemaps → `sitemap.xml` →
> Submit). This API path is worth it only for repeated/scripted use. The
> one-time OAuth setup below takes ~10–15 min.

## One-time setup

### 1. Create an OAuth client (Google Cloud Console — manual)
1. Go to https://console.cloud.google.com/ and create or pick a project.
2. **APIs & Services → Library** → search **"Google Search Console API"** →
   **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name (e.g. "EMPATHEIA sitemap"), your email for support/dev contact →
     Save and continue through the steps.
   - **Test users** → add the Google account that owns the Search Console
     property. (In testing mode only test users can authorize — that's fine.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app** → Create.
   - **Download JSON**, and save it here as:
     `scripts/search-console/client_secret.json`

### 2. Install dependencies
Deps live in an isolated virtualenv (already created at
`scripts/search-console/.venv` — re-create with
`python3 -m venv scripts/search-console/.venv` if missing):
```
scripts/search-console/.venv/bin/pip install -r scripts/search-console/requirements.txt
```

## Run
```
scripts/search-console/.venv/bin/python scripts/search-console/submit_sitemap.py
```
- First run opens a browser to authorize (use the property-owning account).
  A token is cached at `token.json`; later runs are non-interactive.
- Override target if needed:
  ```
  SITE_URL=https://empatheia.sinhaankur.com SITEMAP=sitemap.xml \
    python scripts/search-console/submit_sitemap.py
  ```

## Security
`client_secret.json` and `token.json` are git-ignored and must never be
committed. They live only on your machine.
