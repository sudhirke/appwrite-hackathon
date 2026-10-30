import { Client, Query, TablesDB, type Models } from "appwrite";
import { getAppwriteConfig } from "./appwrite-config";

export type TagScan = Models.Row & {
  location?: [number, number] | null;
  consentGiven: boolean;
  scannedAt: string;
  tagId?: string;
  petId?: string;
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
