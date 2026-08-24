const required = ["DATABASE_URL", "ACCX_VAULT_MASTER_KEY", "ACCX_ADMIN_KEY", "ACCX_WORKER_KEY"] as const;
type RequiredEnvironment = (typeof required)[number];

function getRequired(name: RequiredEnvironment): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const serverEnv = {
  databaseUrl: () => getRequired("DATABASE_URL"),
  vaultMasterKey: () => getRequired("ACCX_VAULT_MASTER_KEY"),
  adminKey: () => getRequired("ACCX_ADMIN_KEY"),
  workerKey: () => getRequired("ACCX_WORKER_KEY"),
  nexussAuth: () => {
    const authUrl = optional("NEXUSS_AUTH_URL");
    const projectId = optional("NEXUSS_AUTH_PROJECT_ID");
    const redirectUri = optional("NEXUSS_AUTH_REDIRECT_URI");
    if (!authUrl || !projectId || !redirectUri) return null;
    let parsedAuthUrl: URL;
    let parsedRedirectUri: URL;
    try {
      parsedAuthUrl = new URL(authUrl);
      parsedRedirectUri = new URL(redirectUri);
    } catch {
      throw new Error("NEXUSS_AUTH_CONFIGURATION_INVALID");
    }
    if (!["http:", "https:"].includes(parsedAuthUrl.protocol) || !["http:", "https:"].includes(parsedRedirectUri.protocol)) throw new Error("NEXUSS_AUTH_CONFIGURATION_INVALID");
    if (process.env.NODE_ENV === "production" && (parsedAuthUrl.protocol !== "https:" || parsedRedirectUri.protocol !== "https:")) throw new Error("NEXUSS_AUTH_CONFIGURATION_INVALID");
    return { authUrl: parsedAuthUrl.toString().replace(/\/$/, ""), projectId, redirectUri: parsedRedirectUri.toString() };
  },
};
