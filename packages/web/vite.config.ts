import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const TAILSCALE_SERVE_HOSTS = [".ts.net"];

export default defineConfig({
  plugins: [react()],
  server: { allowedHosts: TAILSCALE_SERVE_HOSTS },
});
