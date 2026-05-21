#!/usr/bin/env tsx
/**
 * Mock-ingest dispatcher.
 *
 *   pnpm --filter @platform/worker dispatch:mock
 *   pnpm --filter @platform/worker dispatch:mock -- --supplier https://x
 *
 * Builds an IngestJob (with sane defaults or CLI overrides) and:
 *
 *   • Validates it via IngestJobSchema (Zod).
 *   • Enqueues it on the configured FileQueue (default
 *     `.platform-data/queue/`).
 *
 * This is the local-dev replacement for "operator submits an intake
 * form" until the Studio API route lands in M8. Use together with
 * `pnpm --filter @platform/worker run-worker` to exercise the full
 * pipeline against real provider API keys.
 */
import { randomUUID } from "node:crypto";
import { FileQueue, IngestJobSchema, type IngestJob } from "@platform/ingest";

const args = parseArgs(process.argv.slice(2));

async function main(): Promise<number> {
  const queueDir = process.env.PLATFORM_QUEUE_DIR ?? ".platform-data/queue";
  const queue = new FileQueue<IngestJob>(queueDir);

  const job: IngestJob = {
    runId: args.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`,
    storeId: args.storeId ?? "fanaa",
    supplierUrl:
      args.supplier ??
      "https://www.alibaba.com/product-detail/example-serum.html",
    uploadedImages: [
      {
        src:
          args.image ??
          "https://images.unsplash.com/photo-1556228852-80b6e5eeff06",
        alt: "supplier_uploaded_image",
      },
    ],
    priceHint: { amount: Number(args.price ?? 199), currency: "SAR" },
    operatorNotes: args.notes,
    skipResearch: args.skipResearch === "true" || args.skipResearch === "1",
    createdAt: new Date().toISOString(),
  };

  const validated = IngestJobSchema.parse(job);
  const { id } = await queue.enqueue(validated);

  console.log(JSON.stringify({
    event: "dispatched",
    queueId: id,
    runId: validated.runId,
    storeId: validated.storeId,
    queueDir,
  }, null, 2));
  return 0;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("dispatch_failed", err);
    process.exit(1);
  });
