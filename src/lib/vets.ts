import { Client, ID, Permission, Query, Role, TablesDB, type Models } from "appwrite";

export type VetContact = Models.Row & {
  ownerId: string;
  name: string;
  clinic?: string;
  phone: string;
};

type AppwriteConfig = { endpoint: string; projectId: string; databaseId: string };
let servicePromise: Promise<{ tables: TablesDB; databaseId: string }> | undefined;

async function getService() {
  servicePromise ??= fetch("/api/appwrite-config")
    .then(async (response) => {
      if (!response.ok) throw new Error("The vet contacts database is not configured.");
      return response.json() as Promise<AppwriteConfig>;
    })
    .then(({ endpoint, projectId, databaseId }) => {
      if (!endpoint || !projectId || !databaseId) throw new Error("The vet contacts database is not configured.");
      return { tables: new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId)), databaseId };
    });
  return servicePromise;
}

export async function listVetContacts(ownerId: string) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<VetContact>({
    databaseId,
    tableId: "vet_contacts",
    queries: [Query.equal("ownerId", ownerId), Query.orderAsc("name")],
  });
  return result.rows;
}

export async function createVetContact(ownerId: string, contact: Pick<VetContact, "name" | "clinic" | "phone">) {
  const { tables, databaseId } = await getService();
  const role = Role.user(ownerId);
  return tables.createRow<VetContact>({
    databaseId,
    tableId: "vet_contacts",
    rowId: ID.unique(),
    data: {
      ownerId,
      name: contact.name,
      phone: contact.phone,
      ...(contact.clinic && { clinic: contact.clinic }),
    },
    permissions: [Permission.read(role), Permission.update(role), Permission.delete(role)],
  });
}

export async function deleteVetContact(rowId: string) {
  const { tables, databaseId } = await getService();
  await tables.deleteRow({ databaseId, tableId: "vet_contacts", rowId });
}
