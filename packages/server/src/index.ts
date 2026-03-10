// T015: Express server entry point

import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import { fileURLToPath } from "url";
import { appRouter } from "./router.js";
import { createContext } from "./trpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

app.listen(PORT, () => {
  if (process.env.NODE_ENV === "production") {
    console.log(`Server running on http://localhost:${PORT}`);
  } else {
    console.log(`API server running on http://localhost:${PORT}/trpc`);
    console.log(`Open http://localhost:5173 in your browser`);
  }
});
