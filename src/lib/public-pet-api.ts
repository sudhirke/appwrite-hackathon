import { Client, ExecutionMethod, Functions } from "appwrite";
import { getAppwriteConfig } from "./appwrite-config";

export type PublicPetData = {
  name?: string;
  breed?: string;
  color?: string;
  photoUrls: string[];
  status: "safe" | "missing";
  lastSeenAt?: string;
  lastKnownLocation?: [number, number];
  vet?: { name: string; clinic?: string; phone: string };
};

type ScanPayload = { consentGiven: boolean; latitude?: number; longitude?: number };

let servicePromise: Promise<{ functions: Functions; functionId: string }> | undefined;

async function getService() {
  servicePromise ??= getAppwriteConfig().then(({ endpoint, projectId, publicPetFunctionId }) => ({
    functions: new Functions(new Client().setEndpoint(endpoint).setProject(projectId)),
    functionId: publicPetFunctionId,
  }));
  return servicePromise;
}

async function execute<T>(path: string, method: ExecutionMethod, body?: unknown): Promise<T> {
  const { functions, functionId } = await getService();
  const execution = await functions.createExecution({
    functionId,
    async: false,
    xpath: path,
    method,
    ...(body !== undefined && { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
  let payload: { error?: string } & Partial<T> = {};
  try { payload = JSON.parse(execution.responseBody || "{}") as { error?: string } & Partial<T>; }
  catch { throw new Error("The public pet service returned an invalid response."); }
  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
    throw new Error(payload.error || "The public pet service is unavailable.");
  }
  return payload as T;
}

export function getPublicPet(token: string) {
  return execute<PublicPetData>(`/pets/${encodeURIComponent(token)}`, ExecutionMethod.GET);
}

export function reportPublicPetScan(token: string, payload: ScanPayload) {
  return execute<{ scanId: string; locationRecorded: boolean }>(`/pets/${encodeURIComponent(token)}/scans`, ExecutionMethod.POST, payload);
}
