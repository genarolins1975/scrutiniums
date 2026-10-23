import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { AberturaPainel } from "@/components/painel/AberturaPainel";
import { DetalheDoNivel } from "@/components/painel/DetalheDoNivel";
import { FaixaNumeros } from "@/components/painel/FaixaNumeros";
import { NumeroIndicador } from "@/components/painel/NumeroIndicador";
import { ParaLer } from "@/components/painel/ParaLer";
import { tx } from "@/lib/painel/idioma";
import type { PaginaPainelProps } from "@/lib/painel/tipos";

/**
 * Molde único das páginas de painel (Iniciativa 1 do parecer de UX de 23/10/2026), como o EntradaColecao é o das entradas. Sai do
 * servidor, num `<main id="conteudo" data-painel="<rota>">`, com as fatias nesta ordem, cada uma marcada com `data-fatia` para o
 * teste do molde (src/tests/painel-molde.test.ts):
 *
 *  1. `abertura`: AberturaPainel (grupo, H1, lead, recorte, limite, primeira ação; fontes, datas e siglas recolhidas);
 *  2. `numeros`: FaixaNumeros, de 1 a 4 NumeroIndicador;
 *  3. `figuras`: FiguraAnalitica e Recolhido;
 *  4. `tabelas`: TabelaDados e Recolhido, quando a página tem tabela que não é a equivalente de uma figura;
 *  5. `controles`: dentro das fatias acima, sempre imediatamente antes do bloco que afetam (Controles), uma vez por bloco;
 *  6. `notas`: ParaLer, o glossário no ponto de uso;
 *  7. `metodo`: um só `<details>` no fim, com método, fontes, downloads e a faixa de frescor variante método;
 *  8. `fim`: a posição do fim de página (Para ir além e rodapé da coleção), que a Iniciativa 4 funde e o layout desenha.
 *
 * Com `profundidade`, o seletor Entender, Analisar e Auditar vem logo abaixo dos números e vale para o resto da página. Conteúdo que
 * não cabe vai para Recolhido, com o conteúdo inteiro no HTML; nada é apagado.
 */
export function PaginaPainel({
  rota,
  abertura,
  numeros,
  notaNumeros,
  rotuloNumeros,
  figuras,
  tabelas,
  notas,
  metodo,
  frescorMetodo,
  profundidade = false,
  idioma,
  principal = true,
  aviso,
  navegacaoLocal,
}: PaginaPainelProps) {
  const lingua = idioma ?? (tx("pt", "en") as "pt" | "en");
  const corpo = (
    <>
      {figuras && (
        <div data-fatia="figuras" className="space-y-12 pt-6">
          {figuras}
        </div>
      )}
      {tabelas && (
        <div data-fatia="tabelas" className="space-y-10 pt-10">
          {tabelas}
        </div>
      )}
      {notas && (
        <div data-fatia="notas" className="pt-10">
          <ParaLer {...notas} />
        </div>
      )}
      {/* aberto sozinho em Auditar: as regras, as tabelas de conferência e os documentos citados moram aqui */}
      <DetalheDoNivel
        resumo={tx("Método e fontes", "Method and sources", lingua)}
        abreEm={profundidade ? "auditar" : "nunca"}
        className="mt-12 border-t border-linha pt-4"
        classeResumoBase="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao"
        dados={{ "data-fatia": "metodo" }}
      >
        <div className="mt-2 space-y-6 t-meta text-carvao-muted">{metodo}</div>
        {frescorMetodo && <div className="mt-6">{frescorMetodo}</div>}
      </DetalheDoNivel>
      {/* a posição do fim de página: Para ir além e o rodapé da coleção vêm do layout logo depois do <main> */}
      <div data-fatia="fim" aria-hidden="true" />
    </>
  );
  const conteudo = (
    <>
      {aviso}
      <div data-fatia="abertura">
        <AberturaPainel {...abertura} idioma={lingua} />
      </div>
      {numeros && numeros.length > 0 && (
        <div data-fatia="numeros">
          <FaixaNumeros rotulo={rotuloNumeros} nota={notaNumeros} idioma={lingua}>
            {numeros.map((n) => (
              <NumeroIndicador key={n.rotulo} {...n} tamanho={n.tamanho ?? "g"} idioma={lingua} />
            ))}
          </FaixaNumeros>
        </div>
      )}
      {navegacaoLocal}
      {profundidade ? <ModoProfundidade>{corpo}</ModoProfundidade> : corpo}
    </>
  );
  return principal ? (
    <main id="conteudo" tabIndex={-1} className="ed-pagina pb-6" data-painel={rota}>
      {conteudo}
    </main>
  ) : (
    <div className="ed-pagina pb-6" data-painel={rota}>
      {conteudo}
    </div>
  );
}

