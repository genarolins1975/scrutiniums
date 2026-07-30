/**
 * Cabeçalho editorial de seção: número serifado em bronze,
 * rótulo em caixa alta e título serifado.
 */
export function SectionHeading({
  number,
  label,
  title,
  onDark = false,
}: {
  number?: string;
  label: string;
  title: string;
  onDark?: boolean;
}) {
  return (
    <div className="mb-10">
      <div className="mb-3 flex items-baseline gap-4">
        {number && (
          <span className="font-serif text-xl text-bronze" aria-hidden="true">
            {number}
          </span>
        )}
        <span className={`rotulo ${onDark ? "text-mineral-soft" : "text-mineral"}`}>{label}</span>
      </div>
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
