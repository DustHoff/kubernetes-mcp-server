import { logger } from "../logger.js";

export const k8sAuditEnabled =
  process.env.K8S_AUDIT_LOG === undefined ||
  (process.env.K8S_AUDIT_LOG.toLowerCase() !== "false" && process.env.K8S_AUDIT_LOG !== "0");

export async function k8sAudit<T>(
  operation: string,
  meta: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  if (!k8sAuditEnabled) return fn();

  const startMs = Date.now();
  try {
    const result = await fn();
    logger.info("k8s api", { operation, ...meta, ms: Date.now() - startMs });
    return result;
  } catch (err) {
    logger.error("k8s api error", {
      operation,
      ...meta,
      ms: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
