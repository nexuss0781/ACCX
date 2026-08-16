const required = ["PARADOX_API_KEY", "PARADOX_PASSPHRASE", "ACCX_VAULT_MASTER_KEY", "ACCX_ADMIN_KEY"] as const;
type RequiredEnvironment = (typeof required)[number];

function getRequired(name: RequiredEnvironment): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export const serverEnv = {
  paradoxGatewayUrl: process.env.PARADOX_GATEWAY_URL ?? "https://paradoxdb.onrender.com/v1",
  paradoxResolverUrl: process.env.PARADOX_RESOLVER_URL ?? "https://paradox-domain.onrender.com/active-domain.json",
  paradoxApiKey: () => getRequired("PARADOX_API_KEY"),
  paradoxPassphrase: () => getRequired("PARADOX_PASSPHRASE"),
  vaultMasterKey: () => getRequired("ACCX_VAULT_MASTER_KEY"),
  adminKey: () => getRequired("ACCX_ADMIN_KEY"),
};
