import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Read PORT from .env like the API server does; Vite only exposes VITE_* by default.
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = `http://localhost:${env.PORT || 3001}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": apiUrl,
        "/health": apiUrl,
      },
    },
  };
});
