import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const TAILSCALE_SERVE_HOSTS = [".ts.net"];

const DEV_API = "http://localhost:1337";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: TAILSCALE_SERVE_HOSTS,
    proxy: { "/events": DEV_API, "/mcp": DEV_API },
  },
});
