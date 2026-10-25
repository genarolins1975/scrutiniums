import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import { LiberaRecorte, SCRIPT_RECORTE } from "@/components/eficiencia/LiberaRecorte";
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/educacao-municipal-capitais") };

/** Casca do painel: cabeçalho com a navegação e o conteúdo da visão. Cada visão é uma rota estática. */
export default function LayoutPainelEducacao({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/educacao-municipal-capitais" navegacao="educacao" /></header>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_RECORTE }} />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-12 [&>[data-painel]]:px-0">
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
