/**
 * Monograma S da Scrutiniums: duas formas entrelaçadas,
 * carvão em cima, bronze embaixo, conforme a referência visual.
 */
export function LogoMark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  const top = onDark ? "var(--cor-marfim)" : "var(--cor-carvao)";
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 40 50"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M28 0 L10 0 C4 4 2 8 2 14 C2 20 6 24 13 26 L21 28 L21 14 C21 8 23 3 28 0 Z" fill={top} />
      <path d="M12 50 L30 50 C36 46 38 42 38 36 C38 30 34 26 27 24 L19 22 L19 36 C19 42 17 47 12 50 Z" fill="var(--cor-bronze)" />
    </svg>
  );
}

export function LogoWordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={22} onDark={onDark} />
      <span
        className={`font-serif text-lg tracking-wide2 uppercase ${onDark ? "text-marfim" : "text-carvao"}`}
      >
        Scrutiniums
      </span>
    </span>
  );
}
