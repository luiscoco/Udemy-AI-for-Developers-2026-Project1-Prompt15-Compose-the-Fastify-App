import { describe, expect, it } from "vitest";
import type { Asset, Technician, WorkOrder } from "@equipment-hub/contract";
import { createApp } from "./app.js";
import type { Repository } from "./data/repository.js";

function makeFakeRepository(overrides: Partial<Repository> = {}): Repository {
  const assets: Asset[] = [];
  const technicians: Technician[] = [];
  const workOrders: WorkOrder[] = [];

  return {
    listAssets: () => assets,
    listTechnicians: () => technicians,
    listWorkOrders: () => workOrders,
    getWorkOrder: () => undefined,
    saveWorkOrder: () => {},
    assetExists: () => false,
    technicianExists: () => false,
    references: () => [],
    ...overrides,
  };
}

describe("createApp", () => {
  it("responds to GET /api/health without opening a network socket", async () => {
    const app = createApp(makeFakeRepository());

    // app.inject() dispatches the request through Fastify's router in-process;
    // no port is bound and no socket is opened, so no server.listen() call is needed.
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns assets from the injected repository", async () => {
    const asset: Asset = {
      id: "asset-1",
      tag: "CNV-001",
      name: "Conveyor Belt",
      location: "Plant A",
    };

    const app = createApp(makeFakeRepository({ listAssets: () => [asset] }));

    const response = await app.inject({ method: "GET", url: "/api/assets" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([asset]);
  });

  it("returns technicians from the injected repository", async () => {
    const technician: Technician = { id: "tech-1", name: "Alex", specialty: "electrical" };

    const app = createApp(makeFakeRepository({ listTechnicians: () => [technician] }));

    const response = await app.inject({ method: "GET", url: "/api/technicians" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([technician]);
  });

  it("builds the dashboard summary from the injected repository's work orders", async () => {
    const workOrder: WorkOrder = {
      id: "wo-1",
      reference: "WO-2026-0001",
      assetId: "asset-1",
      title: "Fix belt",
      description: "Belt is misaligned",
      priority: "critical",
      state: "reported",
      technicianId: null,
      reportedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const app = createApp(makeFakeRepository({ listWorkOrders: () => [workOrder] }));

    const response = await app.inject({ method: "GET", url: "/api/dashboard/summary" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ totalOpen: 1, criticalOpen: 1, unassigned: 1 });
  });
});
