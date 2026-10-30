import { Client, Query, TablesDB, type Models } from "appwrite";
import type { Pet } from "./pets";
import type { QRTag } from "./tags";
import { getAppwriteConfig } from "./appwrite-config";

export type TagScan = Models.Row & {
  location?: [number, number] | null;
  consentGiven: boolean;
  scannedAt: string;
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
