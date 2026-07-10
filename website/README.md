# Geyma website

The GitHub Pages landing page: a single self-contained static page (`index.html`), no build
step, no dependencies. Screenshots in `assets/` are copies of `docs/screenshots/` — re-copy
them when the originals change.

Deployed by `.github/workflows/deploy-pages.yml` on every push to `main` that touches
`website/` (Pages is set to "GitHub Actions" in the repo settings). Served at
<https://geyma.vardir.no/> — a custom domain configured in the repo's Pages settings, with a
CNAME record at the DNS host pointing `geyma.vardir.no` to `madsendev.github.io` (the
github.io URL redirects there). If the domain ever changes, update it in the Pages settings
and in the `og:url` / `og:image` absolute URLs in `index.html`.
