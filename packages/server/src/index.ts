// T015: Express server entry point

import { config as loadEnv } from "dotenv";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from repo root (src/ -> packages/server/ -> packages/ -> repo root)
const envPath = path.resolve(__dirname, "../../..", ".env");
const envResult = loadEnv({ path: envPath });
if (envResult.error) {
  console.warn(`Warning: could not load ${envPath}: ${envResult.error.message}`);
}

import { appRouter } from "./router.js";
import { createContext } from "./trpc.js";
import { loadConfig, getConfigFilePath } from "./services/config.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = express();

// tRPC middleware
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// Serve static client build in production only
if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*path", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Ensure config file exists before accepting requests
loadConfig().then(() => {
  app.listen(PORT, () => {
    if (process.env.NODE_ENV === "production") {
      console.log(`Server running on http://localhost:${PORT}`);
    } else {
      console.log(`Config: ${getConfigFilePath()}`);
      console.log(`API server running on http://localhost:${PORT}/trpc`);
      console.log(`Open http://localhost:5173 in your browser`);
    }
  });
});
