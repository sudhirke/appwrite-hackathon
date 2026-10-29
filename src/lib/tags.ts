import { Client, ID, Permission, Query, Role, TablesDB, type Models } from "appwrite";
import type { Pet } from "./pets";
import { getAppwriteConfig } from "./appwrite-config";

export const TAG_COLORS = ["forest", "orange", "blue", "rose", "black"] as const;
export type TagColor = typeof TAG_COLORS[number];

export type QRTag = Models.Row & {
  ownerId: string;
  label: string;
  color: TagColor;
  qrToken: string;
  isActive: boolean;
  issuedAt: string;
  location?: [number, number] | null;
  petId?: Pet | string | null;
};

let servicePromise: Promise<{ tables: TablesDB; databaseId: string }> | undefined;

async function getService() {
  servicePromise ??= getAppwriteConfig().then(({ endpoint, projectId, databaseId }) => {
      if (!endpoint || !projectId || !databaseId) throw new Error("The QR tag database is not configured.");
      return { tables: new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId)), databaseId };
    });
  return servicePromise;
}

export async function listTags(ownerId: string) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<QRTag>({
    databaseId,
    tableId: "qr_tags",
    queries: [Query.equal("ownerId", ownerId), Query.orderDesc("$createdAt"), Query.select(["*", "petId.*"])],
  });
  return result.rows;
}

export async function createTag(ownerId: string, label: string, color: TagColor) {
  const { tables, databaseId } = await getService();
  const role = Role.user(ownerId);
  return tables.createRow<QRTag>({
    databaseId,
    tableId: "qr_tags",
    rowId: ID.unique(),
    data: {
      ownerId,
      label,
      color,
      qrToken: crypto.randomUUID().replaceAll("-", ""),
      isActive: true,
      issuedAt: new Date().toISOString(),
    },
    permissions: [Permission.read(role), Permission.update(role), Permission.delete(role)],
  });
}

export async function assignTag(rowId: string, petId: string | null) {
  const { tables, databaseId } = await getService();
  return tables.updateRow<QRTag>({ databaseId, tableId: "qr_tags", rowId, data: { petId } });
}

export async function setTagActive(rowId: string, isActive: boolean) {
  const { tables, databaseId } = await getService();
  return tables.updateRow<QRTag>({ databaseId, tableId: "qr_tags", rowId, data: { isActive } });
}

export async function updateTagLocation(rowId: string, latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude must be between -90 and 90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Longitude must be between -180 and 180.");
  const { tables, databaseId } = await getService();
  return tables.updateRow<QRTag>({ databaseId, tableId: "qr_tags", rowId, data: { location: [longitude, latitude] } });
}

export async function deleteTag(rowId: string) {
  const { tables, databaseId } = await getService();
  await tables.deleteRow({ databaseId, tableId: "qr_tags", rowId });
}
