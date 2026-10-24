import {
  AppwriteException,
  Client,
  Permission,
  RelationMutate,
  RelationshipType,
  Role,
  TablesDB,
  TablesDBIndexType,
} from "node-appwrite";

const endpoint = process.env.REACT_APP_APPWRITE_ENDPOINT;
const projectId = process.env.REACT_APP_APPWRITE_PROJECT_ID;
const databaseId = process.env.REACT_APP_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error("Missing Appwrite endpoint, project ID, database ID, or API key in .env");
}

const tables = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey),
);

const userTablePermissions = [Permission.create(Role.users())];

const definitions = [
  {
    id: "subscriptions",
    name: "Subscriptions",
    columns: [
      { key: "userId", type: "varchar", size: 36, required: true },
      { key: "tier", type: "enum", elements: ["free", "basic", "premium"], required: true },
      { key: "status", type: "varchar", size: 32, required: true },
      { key: "stripeSubscriptionId", type: "varchar", size: 255, required: false },
      { key: "currentPeriodEnd", type: "datetime", required: false },
    ],
    indexes: [
      { key: "user_unique", type: "unique", attributes: ["userId"] },
      { key: "status_idx", type: "key", attributes: ["status"] },
    ],
  },
  {
    id: "pets",
    name: "Pets",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 128, required: true },
      { key: "breed", type: "varchar", size: 128, required: false },
      { key: "color", type: "varchar", size: 64, required: false },
      { key: "birthDate", type: "datetime", required: false },
      { key: "microchipId", type: "varchar", size: 128, required: false },
      { key: "photoUrl", type: "url", required: false },
      { key: "status", type: "enum", elements: ["safe", "missing"], required: true },
      { key: "lastKnownLocation", type: "point", required: false },
      { key: "lastSeenAt", type: "datetime", required: false },
      { key: "publicFlags", type: "text", required: false },
    ],
    indexes: [
      { key: "owner_idx", type: "key", attributes: ["ownerId"] },
      { key: "owner_status_idx", type: "key", attributes: ["ownerId", "status"] },
      { key: "microchip_unique", type: "unique", attributes: ["microchipId"] },
    ],
  },
  {
    id: "vet_contacts",
    name: "Vet Contacts",
    columns: [
      { key: "ownerId", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 128, required: true },
      { key: "clinic", type: "varchar", size: 255, required: false },
      { key: "phone", type: "varchar", size: 32, required: true },
    ],
    indexes: [{ key: "owner_idx", type: "key", attributes: ["ownerId"] }],
  },
  {
    id: "qr_tags",
    name: "QR Tags",
    columns: [
      { key: "qrToken", type: "varchar", size: 255, required: true },
      { key: "qrAssetUrl", type: "url", required: false },
      { key: "isActive", type: "boolean", required: true },
      { key: "issuedAt", type: "datetime", required: true },
    ],
    indexes: [{ key: "token_unique", type: "unique", attributes: ["qrToken"] }],
  },
  {
    id: "vaccinations",
    name: "Vaccinations",
    columns: [
      { key: "name", type: "varchar", size: 128, required: true },
      { key: "administeredOn", type: "datetime", required: true },
      { key: "expiresAt", type: "datetime", required: false },
    ],
    indexes: [{ key: "expiry_idx", type: "key", attributes: ["expiresAt"] }],
  },
  {
    id: "medications",
    name: "Medications",
    columns: [
      { key: "name", type: "varchar", size: 128, required: true },
      { key: "dosage", type: "varchar", size: 128, required: true },
      { key: "schedule", type: "varchar", size: 255, required: true },
    ],
    indexes: [],
  },
  {
    id: "alerts",
    name: "Alerts",
    columns: [
      { key: "originLocation", type: "point", required: true },
      { key: "radiusKm", type: "integer", required: true, min: 1, max: 500 },
      { key: "status", type: "enum", elements: ["active", "resolved"], required: true },
      { key: "createdAt", type: "datetime", required: true },
      { key: "resolvedAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "status_created_idx", type: "key", attributes: ["status", "createdAt"], orders: ["ASC", "DESC"] },
      { key: "origin_spatial", type: "spatial", attributes: ["originLocation"] },
    ],
  },
  {
    id: "scans",
    name: "Scans",
    columns: [
      { key: "location", type: "point", required: false },
      { key: "consentGiven", type: "boolean", required: true },
      { key: "ipHash", type: "varchar", size: 128, required: false },
      { key: "scannedAt", type: "datetime", required: true },
    ],
    indexes: [
      { key: "scanned_at_idx", type: "key", attributes: ["scannedAt"], orders: ["DESC"] },
    ],
  },
  {
    id: "alert_notifications",
    name: "Alert Notifications",
    columns: [
      { key: "userId", type: "varchar", size: 36, required: true },
      { key: "channel", type: "enum", elements: ["push", "sms", "email"], required: true },
      { key: "deliveryStatus", type: "varchar", size: 32, required: true },
      { key: "sentAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "user_idx", type: "key", attributes: ["userId"] },
      { key: "delivery_idx", type: "key", attributes: ["deliveryStatus"] },
    ],
  },
] as const;

const relationships = [
  { tableId: "pets", relatedTableId: "vet_contacts", key: "vetContactId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.SetNull },
  { tableId: "qr_tags", relatedTableId: "pets", key: "petId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.Cascade },
  { tableId: "vaccinations", relatedTableId: "pets", key: "petId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.Cascade },
  { tableId: "medications", relatedTableId: "pets", key: "petId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.Cascade },
  { tableId: "alerts", relatedTableId: "pets", key: "petId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.Cascade },
  { tableId: "scans", relatedTableId: "pets", key: "petId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.Cascade },
  { tableId: "scans", relatedTableId: "qr_tags", key: "tagId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.SetNull },
  { tableId: "scans", relatedTableId: "alerts", key: "alertId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.SetNull },
  { tableId: "alert_notifications", relatedTableId: "alerts", key: "alertId", type: RelationshipType.ManyToOne, onDelete: RelationMutate.Cascade },
] as const;

async function exists(tableId: string) {
  try {
    await tables.getTable({ databaseId: databaseId!, tableId });
    return true;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return false;
    throw error;
  }
}

for (const definition of definitions) {
  if (await exists(definition.id)) {
    console.log(`skip table ${definition.id}`);
    continue;
  }

  await tables.createTable({
    databaseId,
    tableId: definition.id,
    name: definition.name,
    permissions: userTablePermissions,
    rowSecurity: true,
    columns: [...definition.columns],
    indexes: definition.indexes.map((index) => ({
      ...index,
      type: index.type as TablesDBIndexType,
    })),
  });
  console.log(`created table ${definition.id}`);
}

for (const relationship of relationships) {
  const columns = await tables.listColumns({ databaseId, tableId: relationship.tableId });
  if (columns.columns.some((column) => column.key === relationship.key)) {
    console.log(`skip relationship ${relationship.tableId}.${relationship.key}`);
    continue;
  }

  await tables.createRelationshipColumn({
    databaseId,
    tableId: relationship.tableId,
    relatedTableId: relationship.relatedTableId,
    key: relationship.key,
    type: relationship.type,
    twoWay: false,
    onDelete: relationship.onDelete,
  });
  console.log(`created relationship ${relationship.tableId}.${relationship.key}`);
}

console.log(`Appwrite schema is ready in database ${databaseId}.`);
