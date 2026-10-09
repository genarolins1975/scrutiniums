import { CabecalhoObee } from "@/components/eficiencia/CabecalhoObee";
import { LiberaRecorte, SCRIPT_RECORTE } from "@/components/eficiencia/LiberaRecorte";

/** Casca do painel: cabeçalho com a navegação e o conteúdo da visão. Cada visão é uma rota estática. */
export default function LayoutPainelEducacao({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabecalhoObee />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_RECORTE }} />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-12">
        {children}
        <LiberaRecorte />
        <noscript>
          <p className="mt-8 border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
            Sem JavaScript, o painel mostra o recorte padrão e não o do link. Ative o JavaScript para ver o recorte pedido.
          </p>
        </noscript>
      </main>
    </>
  );
}
