import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

import pkg from "./package.json"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      process.env.VITE_APP_VERSION ?? pkg.version
    ),
    "import.meta.env.VITE_APP_BUILD_TIME": JSON.stringify(
      process.env.VITE_APP_BUILD_TIME ?? ""
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const contentType = proxyRes.headers["content-type"] ?? ""
            if (
              contentType.includes("ndjson") ||
              contentType.includes("text/event-stream")
            ) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform"
              proxyRes.headers["x-accel-buffering"] = "no"
            }
          })
        },
      },
    },
  },
})
