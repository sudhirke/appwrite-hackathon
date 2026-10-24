import { Account, Client, ID, type Models } from "appwrite";

export type AuthUser = Models.User<Models.Preferences>;

type AppwriteConfig = {
  endpoint: string;
  projectId: string;
};

let accountPromise: Promise<Account> | undefined;

async function getAccount() {
  accountPromise ??= fetch("/api/appwrite-config")
    .then(async (response) => {
      if (!response.ok) throw new Error("Authentication is not configured.");
      return response.json() as Promise<AppwriteConfig>;
    })
    .then(({ endpoint, projectId }) => {
      if (!endpoint || !projectId) throw new Error("Authentication is not configured.");
      return new Account(new Client().setEndpoint(endpoint).setProject(projectId));
    });

  return accountPromise;
}

export async function signIn(email: string, password: string) {
  const account = await getAccount();
  return account.createEmailPasswordSession({ email, password });
}

export async function signUp(name: string, email: string, password: string) {
  const account = await getAccount();
  await account.create({ userId: ID.unique(), email, password, name });
  return account.createEmailPasswordSession({ email, password });
}

export async function getCurrentUser() {
  const account = await getAccount();
  return account.get();
}

export async function signOut() {
  const account = await getAccount();
  return account.deleteSession({ sessionId: "current" });
}
