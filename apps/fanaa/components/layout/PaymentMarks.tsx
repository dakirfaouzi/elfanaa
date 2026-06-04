import { Banknote } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Accepted-payment marks for the footer trust block.
 *
 * Deliberately monochrome and asset-free: we render simplified wordmarks /
 * glyphs in the brand ink rather than the official multicolour brand logos.
 * This (a) avoids shipping third-party trademark assets, and (b) keeps the
 * row coherent with the warm-cream editorial palette instead of dropping five
 * clashing primary-colour rectangles into the footer.
 */

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-7 min-w-[44px] items-center justify-center gap-1 rounded-md border border-line bg-bg px-2 text-ink/70"
    >
      {children}
    </span>
  );
}

export function PaymentMarks({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Tile label="mada">
        <span className="text-[11px] font-bold lowercase tracking-tight">mada</span>
      </Tile>

      <Tile label="Visa">
        <span className="text-[11px] font-bold italic tracking-wide">VISA</span>
      </Tile>

      <Tile label="Mastercard">
        <svg viewBox="0 0 36 24" className="h-3.5 w-auto" aria-hidden fill="currentColor">
          <circle cx="15" cy="12" r="7" />
          <circle cx="21" cy="12" r="7" fillOpacity="0.45" />
        </svg>
      </Tile>

      <Tile label="Apple Pay">
        <svg viewBox="0 0 24 24" className="h-3.5 w-auto" aria-hidden fill="currentColor">
          <path d="M17.05 12.04c-.03-2.6 2.12-3.84 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-1.72-.92-2.83-.9-1.46.02-2.8.85-3.55 2.16-1.51 2.62-.39 6.5 1.08 8.63.72 1.04 1.57 2.2 2.69 2.16 1.08-.04 1.49-.7 2.79-.7 1.3 0 1.67.7 2.81.68 1.16-.02 1.9-1.06 2.61-2.1.82-1.2 1.16-2.36 1.18-2.42-.03-.01-2.26-.87-2.28-3.46zM14.9 4.62c.6-.72 1-1.73.89-2.74-.86.04-1.9.57-2.51 1.29-.55.64-1.03 1.66-.9 2.64.96.07 1.93-.49 2.52-1.19z" />
        </svg>
        <span className="text-[11px] font-semibold">Pay</span>
      </Tile>

      <Tile label="Cash on delivery">
        <Banknote className="size-3.5" strokeWidth={1.6} />
      </Tile>
    </div>
  );
}
