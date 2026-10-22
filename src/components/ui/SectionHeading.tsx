/**
 * Cabeçalho editorial de seção: rótulo em caixa alta e título serifado. Sem numeração 01, 02, 03 (decisão do dono de 22/10/2026:
 * a ordem é dada pela posição).
 */
export function SectionHeading({
  label,
  title,
  onDark = false,
}: {
  label: string;
  title: string;
  onDark?: boolean;
}) {
  return (
    <div className="mb-10">
      <p className={`mb-3 rotulo ${onDark ? "text-mineral-soft" : "text-mineral"}`}>{label}</p>
      <h2
        className={`font-serif text-3xl leading-snug md:text-4xl ${
          onDark ? "text-marfim" : "text-carvao"
        }`}
      >
        {title}
      </h2>
    </div>
  );
}

export function PageTitle({
  label,
  title,
  description,
}: {
  label?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="border-b border-linha pb-8">
      {label && <p className="rotulo mb-2 text-mineral">{label}</p>}
      <h1 className="font-serif text-3xl leading-snug text-carvao md:text-4xl">{title}</h1>
      {description && <p className="mt-3 max-w-prose2 text-mineral">{description}</p>}
    </header>
  );
}
