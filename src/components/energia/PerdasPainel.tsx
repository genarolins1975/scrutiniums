import type { ReactNode } from "react";
import { PerdasLinkConsulta } from "@/components/energia/PerdasLinkConsulta";
import { PerdasLinkPainel } from "@/components/energia/PerdasLinkPainel";
import { carimbo, dataBR, mesAno } from "@/lib/energia/formato";
import { anosSerieNacional } from "@/lib/energia/perdas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";

/**
 * Peças comuns às páginas do módulo Perdas (componentes de servidor): navegação entre os
 * quatro painéis, resposta curta, linha de período, universo e unidade, e o rodapé com a
 * próxima pergunta, os downloads e o link compartilhável (anatomia da seção 7.2).
 *
 * Por que quatro páginas e não uma: cada painel leva mapa ou gráfico, tabela equivalente
 * e dados para a interação; numa página só, o HTML passaria de 900 KB (medido no teste
 * src/tests/energia-perdas.test.ts), acima da meta de 600 KB do contrato (seção 5.1). A
 * distribuidora escolhida segue de uma página para outra pelo parâmetro ?d=.
 */

export const PAGINAS_PERDAS = [
  { id: "mapa", href: "/setor-eletrico/perdas", rotulo: "Mapa e comparação", painel: "P055" },
  { id: "composicao", href: "/setor-eletrico/perdas/composicao", rotulo: "Técnicas e não técnicas", painel: "P056" },
  { id: "regulatorio", href: "/setor-eletrico/perdas/regulatorio", rotulo: "Realizado e regulatório", painel: "P057" },
  { id: "custo", href: "/setor-eletrico/perdas/custo-e-contexto", rotulo: "Custo e contexto", painel: "P058" },
] as const;

export type IdPaginaPerdas = (typeof PAGINAS_PERDAS)[number]["id"];

export const LINK_PERDAS = "rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export function PerdasNavegacao({ atual }: { atual: IdPaginaPerdas }) {
  return (
    <nav aria-label="Painéis do módulo de perdas" className="border-y border-linha bg-superficie">
      <ul className="flex flex-wrap gap-x-1 gap-y-0 px-2">
        {PAGINAS_PERDAS.map((p) => {
          const ativo = p.id === atual;
          return (
            <li key={p.id}>
              <PerdasLinkConsulta
                href={p.href}
                atual={ativo}
                className={`flex min-h-[44px] items-center gap-1.5 px-3 text-sm ${ativo ? "bg-energia-fundo text-carvao shadow-[inset_0_-3px_0_var(--cor-energia)]" : "text-carvao-muted hover:text-carvao"}`}
              >
                {p.rotulo}
              </PerdasLinkConsulta>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Linha de referência do cabeçalho, a mesma nas quatro páginas: anos completos da série do
 * SAMP, o ano aberto (só quando a fonte já publicou algum mês dele), a data em que a
 * vigência tarifária foi conferida e o ano do Censo, todos lidos da gold. Sem ano aberto,
 * a frase não fica com um "e  até" solto.
 */
export function ReferenciaPerdas({ g }: { g: PerdasGold }) {
  const r = g.referencia;
  const anos = anosSerieNacional(g.nacional);
  const serie = anos ? (anos.inicio === anos.fim ? `ano completo de ${anos.fim}` : `anos completos de ${anos.inicio} a ${anos.fim}`) : `anos completos até ${r.ano}`;
  const aberto = r.ano_parcial !== null && r.ultima_competencia_parcial ? ` e ${r.ano_parcial} até ${mesAno(r.ultima_competencia_parcial)}` : "";
  const censo = g.proveniencia.contexto.periodo_referencia.inicio.slice(0, 4);
  return (
    <>
      ANEEL, SAMP Balanço: {serie}
      {aberto}; componentes tarifárias com vigência conferida em {dataBR(r.tarifa_consultada_em)}; Censo {censo} do IBGE. Processado em {carimbo(g.gerado_em)}.
    </>
  );
}

export function Resposta({ children, prova }: { children: ReactNode; prova?: ReactNode }) {
  return (
    <div className="mb-5 border-l-2 border-energia pl-4">
      <p className="text-base leading-relaxed text-carvao">{children}</p>
      {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
    </div>
  );
}

export function Recorte({ periodo, universo, unidade }: { periodo: string; universo: string; unidade: string }) {
  return (
    <p className="mb-4 text-xs leading-relaxed text-mineral">
      Período: {periodo}. Universo: {universo}. Unidade: {unidade}.
    </p>
  );
}

/** Rodapé dos painéis: próxima pergunta (levando a distribuidora escolhida), downloads e link do painel. */
export function RodapePainel({ ancora, proxima, downloads = [] }: { ancora: string; proxima: { pergunta: string; href: string }; downloads?: { rotulo: string; url: string }[] }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-linha pt-3">
      <p className="text-sm text-carvao">
        <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
        <PerdasLinkConsulta href={proxima.href} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
          {proxima.pergunta}
        </PerdasLinkConsulta>
      </p>
      <div className="flex flex-wrap items-center gap-x-5">
        {downloads.map((d) => (
          <a key={d.url} href={d.url} download className={LINK_PERDAS}>
            {d.rotulo}
          </a>
        ))}
        <PerdasLinkPainel ancora={ancora} />
      </div>
    </div>
  );
}
