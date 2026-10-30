// Bundles the hero into one script and one stylesheet that the page inlines.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  outfile: "dist/deal-hero.js",
  metafile: true,
  logLevel: "info",
});
await build({ entryPoints: ["src/hero.css"], bundle: true, minify: true, outfile: "dist/deal-hero.css", logLevel: "info" });
