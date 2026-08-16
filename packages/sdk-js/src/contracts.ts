import { z } from "zod";

export const scopeSchema = z.enum(["metadata.read", "secret.rotate", "provider.publish", "job.execute", "audit.read", "identity.manage"]);
export type Scope = z.infer<typeof scopeSchema>;

export const environmentSchema = z.enum(["development", "staging", "production"]);
export type EnvironmentLabel = z.infer<typeof environmentSchema>;

export const secretReferenceSchema = z.string().min(3).max(160).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Reference must use lower-case letters, digits, dots, hyphens, or underscores.");

export const secretMetadataSchema = z.object({
  id: z.string().uuid(), provider: z.string().min(1).max(80), displayName: z.string().min(1).max(160), reference: secretReferenceSchema, environment: environmentSchema,
  status: z.enum(["pending", "active", "revoked"]), activeVersion: z.number().int().nonnegative(), rotationState: z.enum(["stable", "rotation_required", "rotating"]),
  expiresAt: z.string().datetime().nullable(), lastUsedAt: z.string().datetime().nullable(),
});
export type SecretMetadata = z.infer<typeof secretMetadataSchema>;

export const jobSubmissionSchema = z.object({
  action: z.string().min(3).max(100), secretReferences: z.array(secretReferenceSchema).min(1).max(10), requiredScopes: z.array(scopeSchema).min(1).max(10),
  input: z.record(z.string(), z.unknown()).default({}), idempotencyKey: z.string().uuid(),
});
export type JobSubmission = z.infer<typeof jobSubmissionSchema>;

export const sanitizedJobResultSchema = z.object({
  jobId: z.string().uuid(), status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]), message: z.string().max(500), completedAt: z.string().datetime().nullable(),
});
export type SanitizedJobResult = z.infer<typeof sanitizedJobResultSchema>;

export const ZERO_PLAINTEXT_INVARIANT = "Raw secret values must never be serialized to a browser, client SDK response, audit event, log entry, URL, or persistent client storage." as const;
