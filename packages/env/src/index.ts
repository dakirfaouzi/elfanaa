/**
 * @platform/env — barrel.
 *
 * Public surface: Zod schemas + per-context loaders. No I/O — these
 * are pure functions over a raw env map.
 */
export {
  PersistenceEnvSchema,
  PersistenceMode,
  R2EnvSchema,
  StorageDriver,
  StudioEnvSchema,
  validateEnv,
  validateEnvOrThrow,
  type EnvValidationFailure,
  type EnvValidationResult,
  type PersistenceEnv,
  type R2Env,
  type StudioEnv,
} from "./schemas";

export {
  loadPersistenceEnv,
  loadPersistenceEnvOrThrow,
  loadR2Env,
  loadR2EnvOrThrow,
  loadStudioEnv,
  loadStudioEnvOrThrow,
  resolvePersistenceConfig,
  resolveR2Config,
  type ResolvedPersistenceConfig,
  type ResolvedR2Config,
} from "./contexts";
