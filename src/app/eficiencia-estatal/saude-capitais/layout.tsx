import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { CabecalhoSaude } from "@/components/eficiencia/saude/CabecalhoSaude";
import { LiberaRecorte } from "@/components/eficiencia/LiberaRecorte";
import { SCRIPT_RECORTE_SAUDE } from "@/lib/eficiencia/saude/rotas";

/** Casca do módulo Saúde nas capitais: cabeçalho com a navegação e o conteúdo da visão. Cada visão é uma rota estática. */
export default function LayoutSaudeCapitais({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CabecalhoSaude />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_RECORTE_SAUDE }} />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">
        {children}<EscoresServicos capitulo="health"/>
        <LiberaRecorte />
        <noscript>
          <p className="mt-8 border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
            Sem JavaScript, o módulo mostra o recorte padrão e não o do link. Ative o JavaScript para ver o recorte pedido.
          </p>
        </noscript>
      </main>
    </>
  );
}
