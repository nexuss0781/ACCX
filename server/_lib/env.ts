const required = ["DATABASE_URL", "ACCX_VAULT_MASTER_KEY", "ACCX_ADMIN_KEY", "ACCX_WORKER_KEY"] as const;
type RequiredEnvironment = (typeof required)[number];

function getRequired(name: RequiredEnvironment): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export const serverEnv = {
  databaseUrl: () => getRequired("DATABASE_URL"),
  vaultMasterKey: () => getRequired("ACCX_VAULT_MASTER_KEY"),
  adminKey: () => getRequired("ACCX_ADMIN_KEY"),
  workerKey: () => getRequired("ACCX_WORKER_KEY"),
};
