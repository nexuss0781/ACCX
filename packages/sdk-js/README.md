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
