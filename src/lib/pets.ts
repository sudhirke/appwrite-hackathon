import { Client, ID, Permission, Query, Role, TablesDB, type Models } from "appwrite";

type PublicFlags = { showName: boolean };

type PetFields = {
  ownerId: string;
  name: string;
  breed?: string;
  color?: string;
  birthDate?: string;
  microchipId?: string;
  photoUrl?: string;
  status: "safe" | "missing";
  lastKnownLocation?: [number, number];
  lastSeenAt?: string;
  publicFlags?: string;
};

export type Pet = Models.Row & PetFields;

export type NewPet = {
  name: string;
  breed?: string;
  color?: string;
  birthDate?: string;
  microchipId?: string;
  photoUrl?: string;
  status: Pet["status"];
  lastKnownLocation?: [number, number];
  lastSeenAt?: string;
  publicFlags?: PublicFlags;
};

type AppwriteConfig = { endpoint: string; projectId: string; databaseId: string };

let servicePromise: Promise<{ tables: TablesDB; databaseId: string }> | undefined;

async function getService() {
  servicePromise ??= fetch("/api/appwrite-config")
    .then(async (response) => {
      if (!response.ok) throw new Error("The pet database is not configured.");
      return response.json() as Promise<AppwriteConfig>;
    })
    .then(({ endpoint, projectId, databaseId }) => {
      if (!endpoint || !projectId || !databaseId) throw new Error("The pet database is not configured.");
      return { tables: new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId)), databaseId };
    });
  return servicePromise;
}

export async function listPets(ownerId: string) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<Pet>({
    databaseId,
    tableId: "pets",
    queries: [Query.equal("ownerId", ownerId), Query.orderDesc("$createdAt")],
  });
  return result.rows;
}

export async function createPet(ownerId: string, pet: NewPet) {
  const { tables, databaseId } = await getService();
  const role = Role.user(ownerId);
  const data: PetFields = {
    ownerId,
    name: pet.name,
    status: pet.status,
    ...(pet.breed && { breed: pet.breed }),
    ...(pet.color && { color: pet.color }),
    ...(pet.birthDate && { birthDate: pet.birthDate }),
    ...(pet.microchipId && { microchipId: pet.microchipId }),
    ...(pet.photoUrl && { photoUrl: pet.photoUrl }),
    ...(pet.lastKnownLocation && { lastKnownLocation: pet.lastKnownLocation }),
    ...(pet.lastSeenAt && { lastSeenAt: pet.lastSeenAt }),
    ...(pet.publicFlags && { publicFlags: JSON.stringify(pet.publicFlags) }),
  };

  return tables.createRow<Pet>({
    databaseId,
    tableId: "pets",
    rowId: ID.unique(),
    data,
    permissions: [Permission.read(role), Permission.update(role), Permission.delete(role)],
  });
}

export async function deletePet(rowId: string) {
  const { tables, databaseId } = await getService();
  await tables.deleteRow({ databaseId, tableId: "pets", rowId });
}
