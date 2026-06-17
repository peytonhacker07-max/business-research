import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// `base` defaults to "/" for local dev and Vercel; GitHub Pages serves the app
// from a subpath, so the deploy workflow sets VITE_BASE=/business-research/.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
