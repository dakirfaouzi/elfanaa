#!/usr/bin/env tsx
/**
 * `publish-local` — M7 CLI.
 *
 * Materialises a UniversalProduct into a final published bundle under
 * `.platform-data/products/<storeId>/<id>.json`. Source can be either:
 *
 *   1. A completed M6 RunRecord on disk (`--run-id <id>`).
 *      Reads `.platform-data/runs/<runId>.json` via @platform/ingest's
 *      FileStore and uses its `finalProduct` (the M5 assemble output).
 *
 *   2. A hand-crafted UniversalProduct JSON file (`--input <path>`).
 *      Useful for PLATFORM.md M7's manual verification path
 *      ("write a hand-crafted UniversalProduct, publish, ...").
 *
 * Exit codes:
 *   0  → publish succeeded (artefact written)
 *   1  → validation failed (no artefact written; issues printed)
 *   2  → input not found / argument error
 *
 * Usage:
 *
 *   pnpm --filter @platform/publishers publish:local \
 *       --run-id run_abc123
 *
 *   pnpm --filter @platform/publishers publish:local \
 *       --input ./tmp/manual-product.json \
 *       --store fanaa \
 *       --actor ops@fanaa.sa
 *
 * No network egress, no Prisma, no Octokit. Pure file IO under
 * `.platform-data/`. Mirrors the M6 healthcheck CLI pattern.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { FileStore } from "@platform/ingest";
import { fanaaStore } from "@platform/stores";
import type { UniversalProduct } from "@platform/catalog-schema";
import { FanaaPublisher } from "../src/fanaa";
import { FilePublishStore } from "../src/persistence/file-publish-store";

interface Args {
  runId?: string;
  inputPath?: string;
  storeId: string;
  actor: string;
  dataRoot: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    storeId: "fanaa",
    actor: "",
    dataRoot: ".platform-data",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--run-id":
        out.runId = next;
        i++;
        break;
      case "--input":
        out.inputPath = next;
        i++;
        break;
      case "--store":
        out.storeId = next;
        i++;
        break;
      case "--actor":
        out.actor = next ?? "";
        i++;
        break;
      case "--data-root":
        out.dataRoot = next ?? ".platform-data";
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(
    [
      "publish-local — M7 CLI",
      "",
      "  --run-id <id>      Read .platform-data/runs/<id>.json (M6 RunRecord)",
      "  --input <path>     Read a hand-crafted UniversalProduct JSON",
      "  --store <id>       Store to publish to (default: fanaa)",
      "  --actor <email>    Operator email for audit (default: empty)",
      "  --data-root <dir>  Override .platform-data root",
      "",
      "Examples:",
      "  publish-local --run-id run_abc123",
      "  publish-local --input ./fixture.json --store fanaa --actor me@fanaa.sa",
    ].join("\n"),
  );
}

async function loadUniversalProduct(args: Args): Promise<{
  product: UniversalProduct;
  runId: string;
}> {
  if (args.runId) {
    const store = new FileStore(path.join(args.dataRoot, "runs"));
    const record = await store.getRun(args.runId);
    if (!record) {
      throw new Error(`Run "${args.runId}" not found under ${args.dataRoot}/runs/.`);
    }
    if (record.status !== "completed" || !record.finalProduct) {
      throw new Error(
        `Run "${args.runId}" is in status "${record.status}" and has no finalProduct yet. ` +
          "Publish requires a completed pipeline.",
      );
    }
    return { product: record.finalProduct, runId: record.runId };
  }

  if (args.inputPath) {
    const raw = await fs.readFile(args.inputPath, "utf8");
    const parsed = JSON.parse(raw) as UniversalProduct;
    return { product: parsed, runId: parsed.generationRunId ?? "" };
  }

  throw new Error("Provide either --run-id or --input. Try --help.");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.runId && !args.inputPath) {
    printHelp();
    process.exit(2);
  }

  if (args.storeId !== "fanaa") {
    console.error(
      `[publish-local] Only the "fanaa" publisher is wired in M7. Got "${args.storeId}".`,
    );
    process.exit(2);
  }

  let product: UniversalProduct;
  let runId: string;
  try {
    ({ product, runId } = await loadUniversalProduct(args));
  } catch (err) {
    console.error(`[publish-local] ${(err as Error).message}`);
    process.exit(2);
  }

  const publisher = new FanaaPublisher({
    store: new FilePublishStore({ rootDir: args.dataRoot }),
  });

  const result = await publisher.publish({
    universalProduct: product,
    storeConfig: fanaaStore,
    runId,
    actor: args.actor,
  });

  if (result.status === "validation_failed") {
    console.error(
      `[publish-local] Validation failed for run "${runId}" — ${result.issues.length} issue(s):`,
    );
    for (const issue of result.issues) {
      console.error(`  • [${issue.code}] ${issue.path ?? "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "published",
        storeId: result.storeId,
        storeProductId: result.storeProductId,
        artefactLocation: result.artefactLocation,
        publishedAt: result.publishedAt,
        bundleVersion: result.bundle.bundleVersion,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(`[publish-local] fatal:`, err);
  process.exit(2);
});
