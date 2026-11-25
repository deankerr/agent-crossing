import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const THREE_AND_REACT_BUNDLE_KILOBYTES = 1500;
const TAILSCALE_SERVE_HOSTS = [".ts.net"];

export default defineConfig({
  build: { chunkSizeWarningLimit: THREE_AND_REACT_BUNDLE_KILOBYTES },
  plugins: [react()],
  preview: { host: true, port: 5180 },
  server: { allowedHosts: TAILSCALE_SERVE_HOSTS, host: true, port: 5180 },
});
