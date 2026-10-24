import { SeloProntidao } from "@/components/observatorios/SeloProntidao";
import { DetalheDoNivel } from "@/components/painel/DetalheDoNivel";
import { tx } from "@/lib/painel/idioma";
import type { AberturaProps, AcentoPainel } from "@/lib/painel/tipos";

/** Filete de 3 px na cor do acento da coleção (decisão do dono de 22/10/2026: os filetes ficam). */
const FILETE: Record<AcentoPainel, string> = {
  energia: "bg-energia",
  obee: "bg-obee",
  gas: "bg-gas",
  conect: "bg-conect",
  bronze: "bg-bronze",
  destaque: "bg-destaque",
};

/**
 * Abertura de toda página de painel (fatia `abertura` do PaginaPainel), generalizada da forma editorial do CabecalhoModulo do Setor
 * Elétrico: filete e grupo da navegação, H1 (até 60 caracteres), lead (até 220), a primeira ação do leitor quando a página tem uma,
 * a linha de recorte ("período · universo · unidade · Fonte: ...") e a frase do limite ("Não permite concluir: ..."). Nada mais
 * antes dos números. Fontes por extenso, datas de cada parte e siglas ficam num único bloco recolhido, no HTML do servidor, aberto
 * em Auditar.
 *
 * O recorte e o limite são obrigatórios no tipo; a prontidão só entra pelo SeloProntidao, nunca escrita no rótulo.
 */
export function AberturaPainel({
  grupo,
  titulo,
  lead,
  recorte,
  limite,
  acao,
  fontesDatasSiglas,
  prontidao,
  acento = "destaque",
  idioma,
}: AberturaProps & { idioma?: "pt" | "en" }) {
  const l = idioma ?? (tx("pt", "en") as "pt" | "en");
  const partes = [recorte.periodo, recorte.universo, recorte.unidade].filter(Boolean);
  return (
    <header className="cab-modulo" data-abertura="painel">
      <p className="rotulo flex flex-wrap items-center gap-x-3 gap-y-1 text-mineral" data-grupo={grupo ? "" : undefined}>
        <span aria-hidden="true" className={`h-[3px] w-8 shrink-0 ${FILETE[acento]}`} />
        {grupo && <span>{grupo}</span>}
        {prontidao && <SeloProntidao valor={prontidao} idioma={l} />}
      </p>
      <h1 className="t-h1 mt-3 max-w-4xl text-carvao">{titulo}</h1>
      <p className="t-lead mt-3 max-w-3xl text-carvao-muted">{lead}</p>
      {acao && (
        <div className="mb-4 mt-5" data-acao="">
          {acao}
        </div>
      )}
      <div className="ed-meta t-meta mt-2 items-center text-carvao-muted" data-recorte="">
        <span>{partes.join(" · ")}</span>
        <span>
          {tx("Fonte: ", "Source: ", l)}
          {recorte.fonte}
        </span>
        {fontesDatasSiglas && (
          <DetalheDoNivel resumo={tx("Fontes, datas e siglas", "Sources, dates and acronyms", l)} abreEm="auditar" className="[&[open]]:basis-full" dados={{ "data-sobre-pagina": "true" }}>
            <div className="t-meta max-w-prose2 space-y-3 pb-2 pt-1 text-carvao-muted">{fontesDatasSiglas}</div>
          </DetalheDoNivel>
        )}
      </div>
      {/* o mesmo filete do "não permite concluir" de cada figura (FiguraAnalitica), em todos os domínios */}
      <p className="t-corpo mt-3 max-w-3xl border-l border-carvao pl-4 text-carvao" data-limite="">
        <span className="font-medium">{tx("Não permite concluir:", "What it does not allow you to conclude:", l)}</span> {limite}
      </p>
    </header>
  );
}
