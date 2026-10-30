import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];
const appwriteConfig = {
  endpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || process.env.APPWRITE_SITE_API_ENDPOINT || "",
  projectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || process.env.APPWRITE_SITE_PROJECT_ID || "",
  databaseId: process.env.REACT_APP_APPWRITE_DATABASE_ID || "",
};

console.log("Appwrite build configuration:", {
  hasEndpoint: Boolean(appwriteConfig.endpoint),
  hasProjectId: Boolean(appwriteConfig.projectId),
  hasDatabaseId: Boolean(appwriteConfig.databaseId),
});

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  publicPath: "/",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __APPWRITE_CONFIG__: JSON.stringify(appwriteConfig),
  },
});

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
