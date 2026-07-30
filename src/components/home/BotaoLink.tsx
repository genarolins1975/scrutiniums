import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark";

/**
 * Link de navegação com a mesma aparência do Button institucional
 * (retangular, caixa alta, área de toque mínima de 44px).
 * Existe porque Button renderiza <button> e as CTAs da home são links.
 */
export function BotaoLink({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 font-label uppercase tracking-label text-sm border transition-colors";
  const variants: Record<Variant, string> = {
    primary: "bg-carvao text-marfim border-carvao hover:bg-carvao-soft",
    secondary: "bg-transparent text-carvao border-carvao hover:bg-carvao hover:text-marfim",
    dark: "bg-marfim text-carvao border-marfim hover:bg-papel",
  };
  return (
    <Link href={href} className={`${base} ${variants[variant]}`}>
      {children}
    </Link>
  );
}
