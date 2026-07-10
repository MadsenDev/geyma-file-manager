# Geyma website

The GitHub Pages landing page: a single self-contained static page (`index.html`), no build
step, no dependencies. Screenshots in `assets/` are copies of `docs/screenshots/` — re-copy
them when the originals change.

Deployed by `.github/workflows/deploy-pages.yml` on every push to `main` that touches
`website/` (requires Pages to be set to "GitHub Actions" in the repo settings). Served at
<https://madsendev.github.io/geyma-file-manager/>. If a custom domain (e.g. `geyma.dev`) is
added later, configure it in the repo's Pages settings and update the `og:url` / `og:image`
absolute URLs in `index.html`.
