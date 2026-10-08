import { CabecalhoObee } from "@/components/eficiencia/CabecalhoObee";

/** Casca do painel: cabeçalho com a navegação e o conteúdo da visão. Cada visão é uma rota estática. */
export default function LayoutPainelEducacao({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabecalhoObee />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-12">
        {children}
      </main>
    </>
  );
}
