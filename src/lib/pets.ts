import { Client, ID, Permission, Query, Role, Storage, TablesDB, type Models } from "appwrite";
import type { VetContact } from "./vets";
import { getAppwriteConfig } from "./appwrite-config";

type PublicFlags = { showName: boolean };

type PetFields = {
  ownerId: string;
  name: string;
  breed?: string;
  color?: string;
  birthDate?: string;
  microchipId?: string;
  photoUrl?: string;
  photoUrls?: string;
  status: "safe" | "missing";
  lastKnownLocation?: [number, number];
  lastSeenAt?: string;
  publicFlags?: string;
  vetContactId?: VetContact | string | null;
};

export type Pet = Models.Row & PetFields;

export type NewPet = {
  name: string;
  breed?: string;
  color?: string;
  birthDate?: string;
  microchipId?: string;
  photoUrl?: string;
  photoUrls?: string[];
  status: Pet["status"];
  lastKnownLocation?: [number, number];
  lastSeenAt?: string;
  publicFlags?: PublicFlags;
};

let servicePromise: Promise<{ tables: TablesDB; storage: Storage; databaseId: string }> | undefined;
const PET_PHOTOS_BUCKET_ID = "pet-photos";

async function getService() {
  servicePromise ??= getAppwriteConfig().then(({ endpoint, projectId, databaseId }) => {
      if (!endpoint || !projectId || !databaseId) throw new Error("The pet database is not configured.");
      const client = new Client().setEndpoint(endpoint).setProject(projectId);
      return { tables: new TablesDB(client), storage: new Storage(client), databaseId };
    });
  return servicePromise;
}

export async function listPets(ownerId: string) {
  const { tables, databaseId } = await getService();
  const result = await tables.listRows<Pet>({
    databaseId,
    tableId: "pets",
    queries: [Query.equal("ownerId", ownerId), Query.orderDesc("$createdAt"), Query.select(["*", "vetContactId.*"])],
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
    ...(pet.photoUrls?.length && { photoUrls: JSON.stringify(pet.photoUrls) }),
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

export async function updatePetVetContact(rowId: string, vetContactId: string | null) {
  const { tables, databaseId } = await getService();
  return tables.updateRow<Pet>({
    databaseId,
    tableId: "pets",
    rowId,
    data: { vetContactId },
  });
}

export async function updatePet(rowId: string, pet: NewPet) {
  const { tables, databaseId } = await getService();
  return tables.updateRow<Pet>({
    databaseId,
    tableId: "pets",
    rowId,
    data: {
      name: pet.name,
      breed: pet.breed || null,
      color: pet.color || null,
      birthDate: pet.birthDate || null,
      microchipId: pet.microchipId || null,
      photoUrl: pet.photoUrl || null,
      photoUrls: pet.photoUrls?.length ? JSON.stringify(pet.photoUrls) : null,
      status: pet.status,
      lastKnownLocation: pet.lastKnownLocation || null,
      lastSeenAt: pet.lastSeenAt || null,
      ...(pet.publicFlags && { publicFlags: JSON.stringify(pet.publicFlags) }),
    } as unknown as Partial<Pet>,
  });
}

export async function uploadPetPhoto(ownerId: string, file: File) {
  const { storage } = await getService();
  const uploaded = await storage.createFile({
    bucketId: PET_PHOTOS_BUCKET_ID,
    fileId: ID.unique(),
    file,
    permissions: [Permission.read(Role.user(ownerId)), Permission.update(Role.user(ownerId)), Permission.delete(Role.user(ownerId))],
  });
  return storage.getFileView({ bucketId: PET_PHOTOS_BUCKET_ID, fileId: uploaded.$id }).toString();
}
