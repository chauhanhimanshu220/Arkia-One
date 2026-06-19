import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const backendTarget = env.VITE_BACKEND_TARGET || "http://localhost:5296";

  return {
    plugins: [
      react(),
      {
        name: "ignore-browser-link-probe",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const requestUrl = (req as { url?: string }).url ?? "";

            if (requestUrl === "/browserLink" || requestUrl.indexOf("/browserLink?") === 0) {
              res.statusCode = 204;
              res.end();
              return;
            }

            next();
          });
        },
      },
    ],
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/swagger": {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
