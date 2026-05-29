"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/hooks/useCart";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";
import type { Product } from "@/lib/types";

type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  variantId?: string;
  size?: "md" | "lg";
  fullWidth?: boolean;
  /** If true, opens the cart drawer immediately after adding. */
  openOnAdd?: boolean;
};

export function AddToCartButton({
  product,
  quantity = 1,
  variantId,
  size = "lg",
  fullWidth = true,
  openOnAdd = true,
}: AddToCartButtonProps) {
  const add = useCart((s) => s.add);
  const openCart = useUI((s) => s.openCart);
  const { t } = useLocale();
  const [added, setAdded] = useState(false);

  const onClick = () => {
    // Phase 2.5: forward the variantId AND the full product so
    // AI-generated rows added through this button (used by /sugarbear
    // and any future bespoke landing page) flow through the cart
    // exactly like snapshot products. The 3-arg shape passes options
    // so both `variantId` and `product` ride along without breaking
    // the legacy string-variantId callers (handled by `useCart.add`).
    add(product.id, quantity, { variantId, product });
    setAdded(true);
    if (openOnAdd) setTimeout(openCart, 220);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Button
      onClick={onClick}
      size={size}
      fullWidth={fullWidth}
      iconStart={added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
    >
      {added ? t.common.added : t.common.addToCart}
    </Button>
  );
}
