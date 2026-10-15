import { en } from "@/i18n/en";

/** O aviso permanece fora da região portuguesa, inclusive para leitores de tela. */
export function PortuguesApenas({ children, regiao }: Readonly<{ children: React.ReactNode; regiao?: string }>) {
  return (
    <>
      <p data-i18n-aviso lang="en" className="border-b border-linha bg-marfim px-6 py-3 text-sm text-carvao">
        {en["traducao.portugues_apenas"].texto}
      </p>
      <div data-i18n-estado="portugues_marcado" data-i18n-regiao={regiao} lang="pt-BR">{children}</div>
    </>
  );
}
