import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { buildDashboardSummary } from "./domain/dashboard.js";
import { createRepository } from "./data/repository.js";
import type { Repository } from "./data/repository.js";

export function createApp(repository: Repository = createRepository()): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/api/health", async () => {
    return { status: "ok" };
  });

  app.get("/api/assets", async () => {
    return repository.listAssets();
  });

  app.get("/api/technicians", async () => {
    return repository.listTechnicians();
  });

  app.get("/api/dashboard/summary", async () => {
    return buildDashboardSummary(repository.listWorkOrders());
  });

  return app;
}
