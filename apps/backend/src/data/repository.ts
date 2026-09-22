import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Asset, Priority, Technician, WorkOrder, WorkOrderState } from "@equipment-hub/contract";

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(currentDir, "../../../../data");

function loadJson<T>(fileName: string): T {
  const raw = readFileSync(join(dataDir, fileName), "utf-8");
  return JSON.parse(raw) as T;
}

export interface WorkOrderFilters {
  state?: WorkOrderState;
  priority?: Priority;
}

export interface Repository {
  listAssets(): Asset[];
  listTechnicians(): Technician[];
  listWorkOrders(filters?: WorkOrderFilters): WorkOrder[];
  getWorkOrder(id: string): WorkOrder | undefined;
  saveWorkOrder(updated: WorkOrder): void;
  assetExists(id: string): boolean;
  technicianExists(id: string): boolean;
  references(): string[];
}

export function createRepository(): Repository {
  const assets = loadJson<Asset[]>("assets.json");
  const technicians = loadJson<Technician[]>("technicians.json");
  const workOrders = loadJson<WorkOrder[]>("work-orders.json");

  return {
    listAssets() {
      return assets.map((asset) => ({ ...asset }));
    },

    listTechnicians() {
      return technicians.map((technician) => ({ ...technician }));
    },

    listWorkOrders(filters) {
      return workOrders
        .filter((workOrder) => !filters?.state || workOrder.state === filters.state)
        .filter((workOrder) => !filters?.priority || workOrder.priority === filters.priority)
        .map((workOrder) => ({ ...workOrder }));
    },

    getWorkOrder(id) {
      const found = workOrders.find((workOrder) => workOrder.id === id);
      return found ? { ...found } : undefined;
    },

    saveWorkOrder(updated) {
      const index = workOrders.findIndex((workOrder) => workOrder.id === updated.id);

      if (index === -1) {
        workOrders.push({ ...updated });
        return;
      }

      workOrders[index] = { ...updated };
    },

    assetExists(id) {
      return assets.some((asset) => asset.id === id);
    },

    technicianExists(id) {
      return technicians.some((technician) => technician.id === id);
    },

    references() {
      return workOrders.map((workOrder) => workOrder.reference);
    },
  };
}
