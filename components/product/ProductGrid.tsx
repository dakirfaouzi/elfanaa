import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/cn";

type ProductGridProps = {
  products: Product[];
  className?: string;
};

export function ProductGrid({ products, className }: ProductGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-4",
        className
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
