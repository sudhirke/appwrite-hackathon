import { serve } from "bun";
import { Client, Query, TablesDB } from "node-appwrite";
import index from "./index.html";

function getAdminTables() {
  const endpoint = process.env.REACT_APP_APPWRITE_ENDPOINT;
  const projectId = process.env.REACT_APP_APPWRITE_PROJECT_ID;
  const databaseId = process.env.REACT_APP_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !databaseId || !apiKey) return null;
  return { tables: new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)), databaseId };
}

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    "/api/appwrite-config": {
      GET() {
        const endpoint = process.env.REACT_APP_APPWRITE_ENDPOINT;
        const projectId = process.env.REACT_APP_APPWRITE_PROJECT_ID;
        const databaseId = process.env.REACT_APP_APPWRITE_DATABASE_ID;

        if (!endpoint || !projectId || !databaseId) {
          return Response.json({ error: "Appwrite is not configured." }, { status: 503 });
        }

        return Response.json({ endpoint, projectId, databaseId });
      },
    },

    "/api/public/pets/:token": {
      async GET(req) {
        const service = getAdminTables();
        if (!service) return Response.json({ error: "Appwrite is not configured." }, { status: 503 });
        const tags = await service.tables.listRows({
          databaseId: service.databaseId,
          tableId: "qr_tags",
          queries: [Query.equal("qrToken", req.params.token), Query.equal("isActive", true), Query.limit(1), Query.select(["*", "petId.*", "petId.vetContactId.*"])],
        });
        const tag = tags.rows[0] as Record<string, any> | undefined;
        const pet = tag?.petId as Record<string, any> | undefined;
        if (!pet) return Response.json({ error: "Tag not found." }, { status: 404 });
        let flags: { showName?: boolean } = {};
        try { flags = pet.publicFlags ? JSON.parse(pet.publicFlags) : {}; } catch { flags = {}; }
        let photoUrls: string[] = [];
        try { photoUrls = pet.photoUrls ? JSON.parse(pet.photoUrls) : []; } catch { photoUrls = []; }
        if (!photoUrls.length && pet.photoUrl) photoUrls = [pet.photoUrl];
        const vet = pet.vetContactId as Record<string, any> | undefined;
        return Response.json({
          ...(flags.showName !== false && { name: pet.name }),
          breed: pet.breed,
          color: pet.color,
          photoUrls: photoUrls.slice(0, 3),
          status: pet.status,
          ...(pet.status === "missing" && { lastSeenAt: pet.lastSeenAt, lastKnownLocation: pet.lastKnownLocation }),
          ...(vet && { vet: { name: vet.name, clinic: vet.clinic, phone: vet.phone } }),
        });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
