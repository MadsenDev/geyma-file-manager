// Self-hosted fonts (bundled by Vite, served locally). The app previously pulled
// these from Google Fonts with a render-blocking <link> in index.html — a network
// round trip on every launch that blanked the window until it resolved (and hung
// offline). Weights must match what the UI actually uses; @fontsource ships each
// weight as its own import with `font-display: swap`.
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/hanken-grotesk/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/500.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
