import { Account, Client, ID, type Models } from "appwrite";
import { getAppwriteConfig } from "./appwrite-config";

export type AuthUser = Models.User<Models.Preferences>;

let accountPromise: Promise<Account> | undefined;

async function getAccount() {
  accountPromise ??= getAppwriteConfig().then(({ endpoint, projectId }) => {
      if (!endpoint || !projectId)
        throw new Error("Authentication is not configured.");
      console.info("[Appwrite auth] Initializing browser client.", { endpoint, projectId, host: window.location.host });
      return new Account(
        new Client().setEndpoint(endpoint).setProject(projectId),
      );
    });

  return accountPromise;
}

export async function signIn(email: string, password: string) {
  console.info("[Appwrite auth] Starting sign-in.", { host: window.location.host });
  try {
    const session = await (await getAccount()).createEmailPasswordSession({ email, password });
    console.info("[Appwrite auth] Sign-in succeeded.", { sessionId: session.$id, provider: session.provider });
    return session;
  } catch (error) { logAuthError("sign-in", error); throw error; }
}

export async function signUp(name: string, email: string, password: string) {
  console.info("[Appwrite auth] Starting sign-up.", { host: window.location.host });
  try {
    const account = await getAccount();
    const user = await account.create({ userId: ID.unique(), email, password, name });
    console.info("[Appwrite auth] Account created; creating session.", { userId: user.$id });
    const session = await account.createEmailPasswordSession({ email, password });
    console.info("[Appwrite auth] Sign-up session created.", { sessionId: session.$id });
    return session;
  } catch (error) { logAuthError("sign-up", error); throw error; }
}

export async function getCurrentUser() {
  try { return await (await getAccount()).get(); }
  catch (error) { console.info("[Appwrite auth] Session check did not return a user.", describeError(error)); throw error; }
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) return { value: String(error) };
  const detail = error as Error & { code?: number; type?: string; response?: string };
  return { name: error.name, message: error.message, code: detail.code, type: detail.type, response: detail.response, host: window.location.host };
}

function logAuthError(operation: string, error: unknown) {
  console.error(`[Appwrite auth] ${operation} failed.`, describeError(error));
}

export async function signOut() {
  const account = await getAccount();
  return account.deleteSession({ sessionId: "current" });
}
