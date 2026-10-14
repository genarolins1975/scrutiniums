import { en } from "@/i18n/en";

/** O aviso permanece fora da região portuguesa, inclusive para leitores de tela. */
export function PortuguesApenas({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <p data-i18n-aviso lang="en" className="border-b border-linha bg-marfim px-6 py-3 text-sm text-carvao">
        {en["traducao.portugues_apenas"].texto}
      </p>
      <div data-i18n-estado="portugues_marcado" lang="pt-BR">{children}</div>
    </>
  );
}
