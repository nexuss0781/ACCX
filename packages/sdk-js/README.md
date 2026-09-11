# ACCX SDK

Install with `npm install @nexuss0781/accx` after publishing this package.

```ts
import { AccxClient } from "@nexuss0781/accx";

const accx = new AccxClient({
  baseUrl: process.env.ACCX_BASE_URL!,
  workloadToken: process.env.ACCX_WORKLOAD_TOKEN!,
});

const result = await accx.submitAction({
  action: "provider.publish",
  secretReferences: [process.env.SOCIAL_TWITTER_REF!],
  requiredScopes: ["job.execute", "provider.publish"],
  input: { contentId: "post-123" },
  idempotencyKey: crypto.randomUUID(),
});
```

The SDK never downloads a credential. ACCX uses the reference inside its trusted backend path and returns a sanitized job result.

## Metadata and retry behavior

`AccxClient` retries only transient transport responses, uses bounded request timeouts, and exposes `AccxError` with a status and retryability flag. It can refresh **metadata only** for a stable reference:

```ts
const metadata = await accx.getSecretMetadata(process.env.SOCIAL_TWITTER_REF!);
// metadata.status, metadata.activeVersion, metadata.rotationState, metadata.healthStatus
```

The metadata cache is bounded and can be cleared with `clearMetadataCache()` after a deployment or rotation notification. Use `redactAccxValue()` when attaching non-credential ACCX context to application logs.

## Browser entry point

`import { AccxBrowserMetadataClient } from "@nexuss0781/accx/browser"` is intentionally restricted to same-origin, session-authenticated **metadata listing**. It accepts no workload token and has no secret-resolution, clipboard, export, or persistent storage method.

## Environment variables with `EnvLoader`

Store the ACCX reference in your `.env` value and expand it at boot with a personal access token over the PAT channel:

```
GEMINI_KEY=accx://acme/production:GEMINI_KEY
DB_HOST=accx://acme/production:DB_HOST
LOCAL_DEV_FLAG=off
```

```ts
import { EnvLoader } from "@nexuss0781/accx";

const loader = new EnvLoader({
  baseUrl: process.env.ACCX_BASE_URL!,
  personalToken: process.env.ACCX_PERSONAL_TOKEN!, // accx_pat_...
});

const env = await loader.load({
  local: process.env,            // explicit local values win
  accx: await readFile(".env", "utf8"),
});
```

`accx://<project>/<environment>:<KEY>` is resolved server-side only for the token's own workspace; `development`, `staging`, and `production` are the only environments. Batched resolution, bounded retries, and freshness headers are handled automatically, and keys missing on the server raise `AccxError` with status `404`.
