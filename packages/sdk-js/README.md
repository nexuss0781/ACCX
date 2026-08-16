# ACCX SDK

Install with `npm install accx` after publishing this package.

```ts
import { AccxClient } from "accx";

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

`import { AccxBrowserMetadataClient } from "accx/browser"` is intentionally restricted to same-origin, session-authenticated **metadata listing**. It accepts no workload token and has no secret-resolution, clipboard, export, or persistent storage method.
