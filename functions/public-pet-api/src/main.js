import { Client, ID, Permission, Query, Role, TablesDB } from "node-appwrite";

const TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

function json(res, data, status = 200) {
  return res.json(data, status, { "cache-control": "no-store" });
}

function getTables(req) {
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const apiKey = req.headers["x-appwrite-key"];
  if (!databaseId || !endpoint || !projectId || !apiKey) throw new Error("Function configuration is incomplete.");

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { tables: new TablesDB(client), databaseId };
}

async function findTag(tables, databaseId, token, selection) {
  const result = await tables.listRows({
    databaseId,
    tableId: "qr_tags",
    queries: [Query.equal("qrToken", token), Query.equal("isActive", true), Query.limit(1), Query.select(selection)],
  });
  return result.rows[0];
}

async function getPublicProfile(req, res, token) {
  const { tables, databaseId } = getTables(req);
  const tag = await findTag(tables, databaseId, token, ["*", "petId.*", "petId.vetContactId.*"]);
  const pet = tag?.petId;
  if (!pet) return json(res, { error: "This tag is not active or has not been assigned." }, 404);

  let flags = {};
  try { flags = pet.publicFlags ? JSON.parse(pet.publicFlags) : {}; } catch { flags = {}; }
  let photoUrls = [];
  try { photoUrls = pet.photoUrls ? JSON.parse(pet.photoUrls) : []; } catch { photoUrls = []; }
  if (!Array.isArray(photoUrls)) photoUrls = [];
  if (!photoUrls.length && pet.photoUrl) photoUrls = [pet.photoUrl];
  const vet = pet.vetContactId;

  return json(res, {
    ...(flags.showName !== false && { name: pet.name }),
    breed: pet.breed,
    color: pet.color,
    photoUrls: photoUrls.filter((url) => typeof url === "string").slice(0, 3),
    status: pet.status,
    ...(pet.status === "missing" && { lastSeenAt: pet.lastSeenAt, lastKnownLocation: pet.lastKnownLocation }),
    ...(vet && { vet: { name: vet.name, clinic: vet.clinic, phone: vet.phone } }),
  });
}

async function recordScan(req, res, token) {
  const { tables, databaseId } = getTables(req);
  const tag = await findTag(tables, databaseId, token, ["$id", "ownerId", "petId.$id"]);
  const petId = typeof tag?.petId === "string" ? tag.petId : tag?.petId?.$id;
  if (!tag || !petId) return json(res, { error: "This tag is not active or has not been assigned." }, 404);

  const body = req.bodyJson && typeof req.bodyJson === "object" ? req.bodyJson : {};
  const consentGiven = body.consentGiven === true;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const hasLocation = consentGiven && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  if (consentGiven && !hasLocation) return json(res, { error: "Valid coordinates are required when location consent is granted." }, 400);

  const scan = await tables.createRow({
    databaseId,
    tableId: "scans",
    rowId: ID.unique(),
    data: {
      consentGiven,
      scannedAt: new Date().toISOString(),
      tagId: tag.$id,
      petId,
      ...(hasLocation && { location: [longitude, latitude] }),
    },
    permissions: [Permission.read(Role.user(tag.ownerId))],
  });
  return json(res, { scanId: scan.$id, locationRecorded: hasLocation }, 201);
}

export default async ({ req, res, log, error }) => {
  try {
    const pathname = (req.path || new URL(req.url, "https://function.local").pathname).replace(/\/+$/, "");
    const match = pathname.match(/^\/pets\/([^/]+)(\/scans)?$/);
    if (!match) return json(res, { error: "Route not found." }, 404);
    const token = decodeURIComponent(match[1]);
    if (!TOKEN_PATTERN.test(token)) return json(res, { error: "Invalid QR token." }, 400);

    if (req.method === "GET" && !match[2]) return await getPublicProfile(req, res, token);
    if (req.method === "POST" && match[2]) return await recordScan(req, res, token);
    return json(res, { error: "Method not allowed." }, 405);
  } catch (reason) {
    error(`Public pet API failed: ${reason instanceof Error ? reason.message : String(reason)}`);
    log("The public pet API returned an internal error.");
    return json(res, { error: "The public pet service is temporarily unavailable." }, 500);
  }
};
