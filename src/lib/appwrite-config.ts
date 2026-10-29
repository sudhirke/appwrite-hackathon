export type AppwriteConfig = { endpoint: string; projectId: string; databaseId: string };

const embeddedConfig: Partial<AppwriteConfig> = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || "",
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID || "",
};

let configPromise: Promise<AppwriteConfig> | undefined;
const complete = (config: Partial<AppwriteConfig>): config is AppwriteConfig => Boolean(config.endpoint && config.projectId && config.databaseId);

export function getAppwriteConfig() {
  configPromise ??= loadConfig();
  return configPromise;
}

async function loadConfig(): Promise<AppwriteConfig> {
  if (complete(embeddedConfig)) {
    console.info("[Appwrite config] Using build-time configuration.", { ...embeddedConfig, host: window.location.host });
    return embeddedConfig;
  }
  console.warn("[Appwrite config] Build-time variables are incomplete; trying the local API fallback.", { hasEndpoint: Boolean(embeddedConfig.endpoint), hasProjectId: Boolean(embeddedConfig.projectId), hasDatabaseId: Boolean(embeddedConfig.databaseId), host: window.location.host });
  const response = await fetch("/api/appwrite-config", { headers: { Accept: "application/json" } });
  const contentType = response.headers.get("content-type") || "unknown";
  const body = await response.text();
  if (!response.ok || !contentType.includes("application/json")) {
    console.error("[Appwrite config] Invalid configuration response.", { url: response.url, status: response.status, statusText: response.statusText, contentType, bodyPreview: body.slice(0, 160), host: window.location.host });
    throw new Error("Appwrite configuration is unavailable. Set REACT_APP_APPWRITE_ENDPOINT, REACT_APP_APPWRITE_PROJECT_ID, and REACT_APP_APPWRITE_DATABASE_ID in the Appwrite Site build variables, then redeploy.");
  }
  try {
    const config = JSON.parse(body) as Partial<AppwriteConfig>;
    if (!complete(config)) throw new Error("Required values are missing.");
    console.info("[Appwrite config] Using local API configuration.", config);
    return config;
  } catch (error) {
    console.error("[Appwrite config] Invalid configuration JSON.", { error, contentType, bodyPreview: body.slice(0, 160) });
    throw new Error("The Appwrite configuration response is invalid. Check the browser console for details.");
  }
}
