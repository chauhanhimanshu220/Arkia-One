import cors from "cors";
import express from "express";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import profitLossRoutes from "./routes/profitLoss.routes.js";
import managementRoutes from "./routes/management.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true, service: "profit-loss-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/profit-loss", profitLossRoutes);
app.use("/api/management", managementRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
