import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dark";

/**
 * Botão retangular institucional. Variações semânticas:
 * primary (carvão), secondary (contorno), ghost (texto), dark (para seções escuras).
 */
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean }
>(function Button({ variant = "primary", full = false, className = "", children, ...props }, ref) {
  const base =
    "inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 font-label uppercase tracking-label text-sm border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary: "bg-carvao text-marfim border-carvao hover:bg-carvao-soft",
    secondary: "bg-transparent text-carvao border-carvao hover:bg-carvao hover:text-marfim",
    ghost: "bg-transparent text-carvao border-transparent underline underline-offset-4 hover:text-bronze",
    dark: "bg-marfim text-carvao border-marfim hover:bg-papel",
  };
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
