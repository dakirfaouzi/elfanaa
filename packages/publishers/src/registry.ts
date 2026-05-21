import type { StoreConfig } from "@platform/stores";
import type { Publisher } from "./contracts";
import { FanaaPublisher, type FanaaPublisherOptions } from "./fanaa";
import { PublisherError } from "./contracts";

/**
 * Publisher registry — `storeConfig.publisher` → Publisher instance.
 *
 * # M7 surface
 *
 *   • `fanaa`        → FanaaPublisher (canonical reference)
 *   • `shopify`      → throws PublisherError("not_implemented_M7") for
 *                       symmetry; M11/M12 wires the real one.
 *   • `tiktok_shop`  → throws PublisherError("not_implemented_M7")
 *
 * # Why a registry and not a factory call site?
 *
 * The Studio (M8) needs to render store-switcher UI without knowing
 * which publishers are wired. `listPublisherIds()` returns the live
 * set so the UI can grey-out the unsupported stores rather than
 * crashing the dashboard.
 *
 * # Dependency injection
 *
 * Tests / CLIs can construct publishers directly with
 * `new FanaaPublisher({ store: tempFileStore })`. The registry is
 * only used by the orchestrator and the default CLI path.
 */
export interface PublisherRegistryOptions {
  /** Options passed to every FanaaPublisher created via the registry. */
  fanaa?: FanaaPublisherOptions;
}

export class PublisherRegistry {
  private readonly fanaaOpts?: FanaaPublisherOptions;
  private readonly cache = new Map<string, Publisher>();

  constructor(opts: PublisherRegistryOptions = {}) {
    this.fanaaOpts = opts.fanaa;
  }

  /**
   * Resolve a publisher for the given StoreConfig. Cached per
   * `storeConfig.publisher` id so a long-running worker keeps one
   * publisher instance per publisher kind (matches the future
   * Octokit-client pattern: connection reuse).
   */
  resolveForStore(storeConfig: StoreConfig): Publisher {
    return this.resolveById(storeConfig.publisher);
  }

  resolveById(publisherId: string): Publisher {
    const cached = this.cache.get(publisherId);
    if (cached) return cached;

    let publisher: Publisher;
    switch (publisherId) {
      case "fanaa":
        publisher = new FanaaPublisher(this.fanaaOpts);
        break;
      case "shopify":
      case "tiktok_shop":
      case "meta_catalog":
        throw new PublisherError(
          "store_config_mismatch",
          `Publisher "${publisherId}" is not implemented in M7 (deferred to M11/M12 per PLATFORM.md §22).`,
        );
      default:
        throw new PublisherError(
          "store_config_mismatch",
          `Unknown publisher "${publisherId}". Registered: ${this.listPublisherIds().join(", ") || "fanaa"}.`,
        );
    }

    this.cache.set(publisherId, publisher);
    return publisher;
  }

  listPublisherIds(): string[] {
    return ["fanaa"];
  }
}
