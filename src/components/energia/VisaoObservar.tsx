"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { VisaoFaixaEstados, VisaoLegendaEstados } from "@/components/energia/VisaoFaixaEstados";
import { VisaoRegraDetalhe } from "@/components/energia/VisaoRegras";
import { carregaJson } from "@/lib/energia/carregaJson";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import type { EstadoRegra, RegraObservar, SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import { FILTROS_P007, URL_GOLD_VISAO, filtraRegras, rotulosFiltroP007, type FiltroP007, type TrechoEstado } from "@/lib/energia/visao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Lista do "O que observar" (P007) com filtro e comparação: o conteúdo de cada regra vem
 * pronto do servidor (VisaoRegras); aqui só se escolhe o que mostrar. Filtro (todas, em
 * alerta ou observação, sobre o sistema, sobre os dados), regra aberta e regras comparadas
 * ficam na URL (p007.filtro, p007.regra, p007.cmp), com voltar e avançar. A comparação põe
 * as linhas de estado de até quatro regras sobre o mesmo eixo de datas.
 *
 * O detalhe de cada regra (condição, limiares, histórico, registro das publicações) não
 * viaja no HTML nem nas props: é lido da gold publicada quando a regra é aberta (seção
 * 5.1 do contrato), pelas mesmas peças de servidor (VisaoRegraDetalhe).
 */

export type ItemObservar = {
  id: string;
  titulo: string;
  tipo: "regra" | "dados" | "evento";
  assunto: "sistema" | "dados";
  estado: EstadoRegra;
  rotuloEstado: string;
  referencia: string;
  href: string;
  resumo: ReactNode;
  /** Detalhe pronto (opcional); sem ele, o detalhe é lido da gold ao abrir a regra. */
  detalhe?: ReactNode;
};

export type LinhaComparavel = { id: string; rotulo: string; trechos: TrechoEstado[]; texto: string };

/** O filtro sem recorte, como a URL o grava. */
const TODAS: FiltroP007 = "todas"; // i18n: dado

const ESQUEMA = {
  filtro: campo(tiposUrl.opcao(FILTROS_P007), TODAS, { param: "p007.filtro" }),

  regra: campo(tiposUrl.texto({ max: 40 }), "", { param: "p007.regra" }),
};

const GLIFO: Record<EstadoRegra, string> = { ativo: "◉", em_retorno: "◉", em_observacao: "◎", normal: "○", sem_dado: "–", evento: "◇" };

/** Estados cujas regras aparecem abertas: o que pede atenção e o calendário. Normal e sem dado ficam recolhidos num grupo. */
const ESTADOS_ABERTOS: ReadonlySet<EstadoRegra> = new Set<EstadoRegra>(["ativo", "em_retorno", "em_observacao", "evento"]);

export function VisaoObservar({
  itens,
  comparaveis,
  padraoComparacao,
  dominio,
}: {
  itens: ItemObservar[];
  comparaveis: LinhaComparavel[];
  padraoComparacao: string[];
  dominio: { inicio: string; fim: string } | null;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const nome = useId();
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR } = formatos(idioma);
  const ROTULO_FILTRO_P007 = rotulosFiltroP007(idioma);
  const visiveis = filtraRegras(itens, v.filtro);
  // as regras que pedem atenção (alerta, observação) e os eventos do calendário ficam abertas; as normais e sem dado ficam num grupo recolhido
  const abertasNaLista = visiveis.filter((o) => ESTADOS_ABERTOS.has(o.estado));
  const quietas = visiveis.filter((o) => !ESTADOS_ABERTOS.has(o.estado));
  const [grupoAberto, setGrupoAberto] = useState<boolean>(false);
  // um link para uma regra do grupo recolhido (?p007.regra=...) abre o grupo e a regra
  const regraNoGrupo = !!v.regra && quietas.some((o) => o.id === v.regra);
  useEffect(() => {
    if (regraNoGrupo) setGrupoAberto(true);
  }, [regraNoGrupo]);
  const porId = new Map(comparaveis.map((c) => [c.id, c]));
  // regras abertas e a gold lida sob demanda para os detalhes
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(v.regra ? [v.regra] : []));
  const [gold, setGold] = useState<SinteseVisaoGold | null>(null);
  const [erroGold, setErroGold] = useState<string | null>(null);
  const precisaGold = itens.some((o) => !o.detalhe && abertas.has(o.id));
  useEffect(() => {
    if (!precisaGold || gold) return;
    let vivo = true;
    carregaJson<SinteseVisaoGold>(URL_GOLD_VISAO)
      .then((j) => {
        if (vivo) setGold(j);
      })
      .catch((x: unknown) => {
        if (vivo) setErroGold(x instanceof Error ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [precisaGold, gold]);
  const regraDaGold = (id: string): RegraObservar | undefined => gold?.observar.find((o) => o.id === id);

  const item = (o: ItemObservar) => {
    const destaque = o.estado === "ativo" || o.estado === "em_retorno";
    return (
      <li key={o.id} id={`regra-${o.id}`} className="scroll-mt-28 py-4">
        <div className="grid gap-2 md:grid-cols-[10rem_1fr]">
          <p className={`rotulo flex items-start gap-2 ${destaque ? "text-carvao" : "text-mineral"}`}>
            <span aria-hidden="true">{GLIFO[o.estado]}</span>
            <span>
              {o.rotuloEstado}
              <span className="block font-sans text-xs normal-case tracking-normal text-mineral">
                {o.assunto === "dados" ? tx("sobre os dados", "about the data") : o.tipo === "evento" ? tx("calendário", "calendar") : tx("sobre o sistema", "about the system")} · {dataBR(o.referencia)}
              </span>
            </span>
          </p>
          <div className="min-w-0">
            <h3 className={`font-medium ${destaque ? "text-carvao" : "text-carvao-muted"}`}>
              {o.titulo}
              <span data-nivel="analisar" className="ml-2 font-mono text-xs font-normal text-mineral">
                {tx("código", "code")} {o.id}
              </span>
            </h3>
            <div className="mt-1">{o.resumo}</div>
            <details
              className="mt-2"
              open={v.regra === o.id || undefined}
              onToggle={(e) => {
                const aberto = (e.currentTarget as HTMLDetailsElement).open;
                if (aberto) setAbertas((s) => (s.has(o.id) ? s : new Set(s).add(o.id)));
                if (aberto && v.regra !== o.id) definir({ regra: o.id });
                if (!aberto && v.regra === o.id) definir({ regra: "" });
              }}
            >
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4">
                {tx("Regra, limiares e histórico", "Rule, thresholds and history")}
              </summary>
              <div className="mt-2">
                {o.detalhe ??
                  (abertas.has(o.id) ? (
                    (() => {
                      const r = regraDaGold(o.id);
                      if (r) return <VisaoRegraDetalhe o={r} idioma={idioma} />;
                      return (
                        <p role="status" aria-live="polite" className={`text-sm ${erroGold ? "text-aviso" : "text-carvao-muted"}`}>
                          {erroGold
                            ? tx(`O detalhe da regra não pôde ser lido da base publicada: ${erroGold}`, `The rule detail could not be read from the published base: ${erroGold}`)
                            : gold
                              ? tx("Regra ausente da base publicada.", "Rule missing from the published base.")
                              : tx("Lendo o detalhe da regra na base publicada…", "Reading the rule detail from the published base…")}
                        </p>
                      );
                    })()
                  ) : null)}
              </div>
            </details>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <fieldset className="min-w-0">
        <legend className="rotulo text-mineral">{tx("Mostrar", "Show")}</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FILTROS_P007.map((f) => {
            const ativo = f === v.filtro;
            const n = filtraRegras(itens, f).length;
            return (
              <label
                key={f}
                className={`inline-flex min-h-[44px] cursor-pointer items-center border px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-energia ${
                  ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
                }`}
              >
                <input type="radio" name={nome} value={f} checked={ativo} onChange={() => definir({ filtro: f })} className="sr-only" />
                {ROTULO_FILTRO_P007[f]} ({n})
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-xs text-carvao-muted" aria-live="polite">
        {tx(
          <>
            {visiveis.length} de {itens.length} itens{v.filtro !== "todas" ? ` (${ROTULO_FILTRO_P007[v.filtro].toLowerCase()})` : ""}.
          </>,
          <>
            {visiveis.length} of {itens.length} items{v.filtro !== "todas" ? ` (${ROTULO_FILTRO_P007[v.filtro].toLowerCase()})` : ""}.
          </>,
        )}

        {v.filtro !== TODAS && (
          <button type="button" onClick={() => definir({ filtro: TODAS })} className="ml-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Remover filtro", "Remove filter")}
          </button>
        )}
      </p>

      {visiveis.length === 0 ? (
        <p className="text-sm text-carvao-muted">{tx("Nenhuma regra neste recorte nesta publicação.", "No rule in this selection in this publication.")}</p>
      ) : (
        <div className="space-y-4">
          {abertasNaLista.length > 0 && <ul className="divide-y divide-linha border-y border-linha">{abertasNaLista.map(item)}</ul>}
          {abertasNaLista.length === 0 && v.filtro !== TODAS && (
            <p className="text-sm text-carvao-muted">{tx("Nenhuma regra em alerta, em observação ou de calendário neste recorte.", "No rule in alert, under observation or on the calendar in this selection.")}</p>
          )}
          {quietas.length > 0 && (
            <details open={grupoAberto} onToggle={(e) => setGrupoAberto((e.currentTarget as HTMLDetailsElement).open)} data-regras-normais="">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4">
                {tx(
                  <>{quietas.length === 1 ? "1 regra em estado normal ou sem dado" : `${quietas.length} regras em estado normal ou sem dado`}: ver a lista e o histórico</>,
                  <>{quietas.length === 1 ? "1 rule in normal state or with no data" : `${quietas.length} rules in normal state or with no data`}: see the list and the history</>,
                )}
              </summary>
              <ul className="mt-2 divide-y divide-linha border-y border-linha">{quietas.map(item)}</ul>
            </details>
          )}
        </div>
      )}

      {dominio && comparaveis.length > 0 && (
        <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-4">
          <h3 className="font-serif text-lg text-carvao">{tx("Quando cada regra esteve em alerta nos últimos 365 dias", "When each rule was in alert in the last 365 days")}</h3>
          <VisaoLegendaEstados idioma={idioma} />
          <Comparador
            rotulo={tx("Regras para comparar (até 4)", "Rules to compare (up to 4)")}
            entidades={comparaveis.map((c) => ({ id: c.id, rotulo: c.rotulo }))}
            padrao={padraoComparacao}
            chaveUrl="p007.cmp"
            dicaBusca={tx("Armazenamento, carga, piso", "Storage, load, floor")}
            vazio={tx(
              "Nenhuma regra escolhida. Escolha até quatro para ver as linhas de estado sobre o mesmo eixo de datas.",
              "No rule chosen. Choose up to four to see the state lines on the same date axis.",
            )}
            renderizarItem={(e) => {
              const c = porId.get(e.id);
              if (!c) return null;
              return (
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-carvao">{c.rotulo}</p>
                  <VisaoFaixaEstados trechos={c.trechos} inicio={dominio.inicio} fim={dominio.fim} rotulo={`${c.rotulo}: ${c.texto}`} />
                  <p className="flex justify-between text-xs text-mineral" aria-hidden="true">
                    <span>{dataBR(dominio.inicio)}</span>
                    <span>{dataBR(dominio.fim)}</span>
                  </p>
                  <p className="text-xs text-carvao-muted">{c.texto}</p>
                </div>
              );
            }}
          />
          <p className="text-xs text-carvao-muted">
            {tx(
              <>
                Mesmo eixo de datas para todas as regras escolhidas, de {dataBR(dominio.inicio)} a {dataBR(dominio.fim)}; cada regra começa no seu primeiro dia publicado.
              </>,
              <>
                Same date axis for all the rules chosen, from {dataBR(dominio.inicio)} to {dataBR(dominio.fim)}; each rule starts on its first published day.
              </>,
            )}
          </p>
        </div>
      )}
    </div>
  );
}
