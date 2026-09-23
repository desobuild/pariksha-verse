import { z } from "zod";

/**
 * Validation Foundation using Zod.
 * Future domain schemas (exam, syllabus, planner, practice) will be located here.
 */

export const idSchema = z.string().min(1, "Identifier is required");

export const timestampSchema = z.coerce.date();

export const healthCheckStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["healthy", "degraded", "down"]),
  checkedAt: timestampSchema,
});

export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;

export { z };
