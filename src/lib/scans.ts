import { Channel, Client, Query, Realtime, TablesDB, type Models, type RealtimeSubscription } from "appwrite";
import type { Pet } from "./pets";
import type { QRTag } from "./tags";
import { getAppwriteConfig } from "./appwrite-config";

export type TagScan = Models.Row & {
  ownerId?: string;
  location?: [number, number] | null;
  consentGiven: boolean;
  scannedAt: string;
  petStatusAtScan?: Pet["status"];
  tagId?: QRTag | string | null;
  petId?: Pet | string | null;
};

let servicePromise: Promise<{ tables: TablesDB; databaseId: string }> | undefined;

async function getService() {
  servicePromise ??= getAppwriteConfig().then(({ endpoint, projectId, databaseId }) => ({
    tables: new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId)),
    databaseId,
  }));
  return servicePromise;
}

export async function listTagScans(tagId: string) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<TagScan>({
    databaseId,
    tableId: "scans",
    queries: [Query.equal("tagId", tagId), Query.orderDesc("scannedAt"), Query.limit(50)],
  });
  return result.rows;
}

export async function listPetScans(petId: string, cursorAfter?: string) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<TagScan>({
    databaseId,
    tableId: "scans",
    queries: [
      Query.equal("petId", petId),
      Query.orderDesc("scannedAt"),
      Query.limit(50),
      Query.select(["*", "tagId.*"]),
      ...(cursorAfter ? [Query.cursorAfter(cursorAfter)] : []),
    ],
  });
  return { rows: result.rows, total: result.total };
}

export async function listRecentScans(limit = 50) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<TagScan>({
    databaseId,
    tableId: "scans",
    queries: [Query.orderDesc("scannedAt"), Query.limit(limit), Query.select(["*", "tagId.*", "petId.*"])],
  });
  return result.rows;
}

export async function subscribeToScans(
  onScan: (scan: TagScan) => void,
  onConnectionChange?: (state: "connected" | "disconnected" | "error") => void,
) {
  const { databaseId } = await getService();
  const { endpoint, projectId } = await getAppwriteConfig();
  const realtime = new Realtime(new Client().setEndpoint(endpoint).setProject(projectId));
  realtime.onOpen(() => onConnectionChange?.("connected"));
  realtime.onClose(() => onConnectionChange?.("disconnected"));
  realtime.onError(() => onConnectionChange?.("error"));
  let subscription: RealtimeSubscription | undefined;
  subscription = await realtime.subscribe<TagScan>(
    Channel.tablesdb(databaseId).table("scans").row().create(),
    ({ payload }) => onScan(payload),
  );
  return async () => {
    await subscription?.unsubscribe();
    await realtime.disconnect();
  };
}
