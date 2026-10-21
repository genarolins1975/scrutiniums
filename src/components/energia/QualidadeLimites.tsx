"use client";

import { useEffect, useMemo, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos, type ParEntidade } from "@/components/energia/GraficoPontos";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CAMPO_CLASSE,
  CAMPO_DIST,
  CAMPO_IND,
  CLASSES,
  INDICADORES,
  carregarUmaVez,
  destacar,
  paresLimites,
  respostaHistoricoDistribuidora,
  respostaRecorteLimites,
  type AvisosFec,
  type Indicador,
  type ItemLimites,
} from "@/lib/energia/qualidade";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";
import type { Idioma } from "@/lib/idioma";
import { porIdioma } from "@/lib/energia/idioma";
import { Nome } from "@/components/i18n/Nome";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { marcarNomes } from "@/lib/energia/i18n/qualidade-perdas";

/**
 * P052: realizado × limite por distribuidora (pontos pareados: círculo é o apurado,
 * losango é o limite do mesmo ano, com a diferença escrita), o histórico da
 * distribuidora escolhida e a tabela equivalente com DGC calculado ao lado do publicado.
 *
 * Estado na URL: `?ind=` (DEC ou FEC), `?cls=` (concessionárias ou permissionárias, cada
 * grupo com cerca de metade das distribuidoras: porte e regulação parecidos dentro do
 * grupo, e o gráfico fica legível no celular) e `?dist=` (a primeira é a escolhida).
 * Escolher um ponto, uma linha da tabela ou uma distribuidora nos pequenos múltiplos dá
 * no mesmo; o voltar desfaz. O histórico (2015 em diante) vem do arquivo de séries por
 * distribuidora, buscado só quando há uma escolhida; a tabela com DGC abre sob demanda.
 */

const ESQUEMA = { ind: CAMPO_IND, cls: CAMPO_CLASSE, dist: CAMPO_DIST };

const BOTAO =
  "inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

function rotulosInd(idioma: Idioma): Record<Indicador, { nome: string; unidade: string; titulo: string }> {
  return {
    dec: { nome: "DEC", unidade: "h", titulo: porIdioma(idioma, { pt: "DEC apurado e limite anual por distribuidora", en: "Assessed DEC and annual limit by distribution utility" }) },
    fec: {
      nome: "FEC",
      unidade: porIdioma(idioma, { pt: "interrupções", en: "interruptions" }),
      titulo: porIdioma(idioma, { pt: "FEC apurado e limite anual por distribuidora", en: "Assessed FEC and annual limit by distribution utility" }),
    },
  };
}

export function QualidadeLimites({
  ano,
  itens: todos,
  totalLinhas,
  urlSerie,
  avisosFec = {},
}: {
  ano: number;
  /** Uma linha por distribuidora, com DEC, FEC, os dois limites, a classe e as notas (itensLimites). */
  itens: ItemLimites[];
  /** Linhas da tabela com DGC (todas as distribuidoras do ano). */
  totalLinhas: number;
  urlSerie: string;
  /** Distribuidoras cujo FEC do ano é de cobertura parcial: marca no gráfico de FEC, nota sob ele e marco no histórico. */
  avisosFec?: AvisosFec;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const ROTULO_IND = rotulosInd(idioma);
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const sel = v.dist[0] ?? null;
  const ind = v.ind;
  const r = ROTULO_IND[ind];
  const classeEscolhida = v.cls === "permissionaria" ? "p" : "c";
  // distribuidora escolhida em outro painel aparece mesmo se for da outra classe
  const itens: ParEntidade[] = useMemo(() => paresLimites(todos.filter((i) => i.classe === classeEscolhida || i.id === sel), ind, avisosFec), [todos, classeEscolhida, sel, ind, avisosFec]);
  const semClasse = todos.filter((i) => i.classe === "s").length;
  const nomes = useMemo(() => new Map(todos.map((i) => [i.id, i.rotulo])), [todos]);

  useEffect(() => {
    if (!sel || serie) return;
    let vivo = true;
    carregarUmaVez(urlSerie, (resp) => resp.json() as Promise<QualidadeSeriesDistribuidorasGold>).then(
      (s) => vivo && setSerie(s),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [sel, serie, urlSerie]);

  const selecionar = (id: string | null) => definir({ dist: id ? destacar(v.dist, id) : v.dist.slice(1) });
  const s = sel && serie ? serie.distribuidoras[sel] : undefined;
  const dados = useMemo(
    () =>
      s
        ? s.anos.map((a, i) => ({ ano: String(a), valor: s[ind][i], limite: s[ind === "dec" ? "dec_limite" : "fec_limite"][i] }))
        : [],
    [s, ind],
  );
  const nomeSel = sel ? (nomes.get(sel) ?? `CNPJ ${sel}`) : "";
  // FEC de cobertura parcial: as distribuidoras do gráfico que têm a marca (nota sob o gráfico) e a da escolhida (histórico)
  const avisosNoGrafico = ind === "fec" ? itens.map((i) => avisosFec[i.id]).filter((a) => !!a) : [];
  const avisoSel = ind === "fec" && sel ? avisosFec[sel] : undefined;

  return (
    <div className="space-y-5">
      {/* rádios nativos: setas, Tab e leitor de tela funcionam sem código próprio */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div role="radiogroup" aria-label={tx("Indicador do gráfico", "Chart indicator")} className="flex flex-wrap gap-2">
          {INDICADORES.map((i) => (
            <label
              key={i}
              className={`rotulo inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-4 focus-within:ring-2 focus-within:ring-energia ${ind === i ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}
            >
              <input type="radio" name="qualidade-limites-indicador" value={i} checked={ind === i} onChange={() => definir({ ind: i })} className="h-4 w-4 accent-energia" />
              {ROTULO_IND[i].nome}
            </label>
          ))}
        </div>
        <div role="radiogroup" aria-label={tx("Grupo de distribuidoras", "Group of distribution utilities")} className="flex flex-wrap gap-2">
          {CLASSES.map((c) => (
            <label
              key={c}
              className={`rotulo inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-4 focus-within:ring-2 focus-within:ring-energia ${v.cls === c ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}
            >
              <input type="radio" name="qualidade-limites-classe" value={c} checked={v.cls === c} onChange={() => definir({ cls: c })} className="h-4 w-4 accent-energia" />
              {c === "concessionaria" ? tx("Concessionárias", "Concession holders") : tx("Permissionárias", "Permit holders")}
            </label>
          ))}
        </div>
      </div>
      {semClasse > 0 && (
        <p className="text-sm text-carvao-muted">
          {tx(
            <>{semClasse} distribuidoras sem classificação publicada ficam só na tabela.</>,
            <>{semClasse} distribution utilities with no published classification appear only in the table.</>,
          )}
        </p>
      )}
      {sel && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-carvao" data-selecao-distribuidora={sel}>
          <span className="rotulo text-mineral">{tx("Distribuidora escolhida", "Selected distribution utility")}</span>
          <strong className="font-medium">
            <Nome>{nomeSel}</Nome>
          </strong>
          <button type="button" className={BOTAO} onClick={() => selecionar(null)}>
            {tx("Limpar seleção", "Clear selection")}
          </button>
          {v.dist.length > 1 && <span className="text-sm text-carvao-muted">{tx(<>Mais {v.dist.length - 1} na comparação.</>, <>{v.dist.length - 1} more in the comparison.</>)}</span>}
        </div>
      )}

      {/* a frase acompanha o indicador e o grupo escolhidos acima: trocar para FEC ou para permissionárias muda o que ela diz. Fica depois dos controles
          (por isso não leva data-resposta, que o CSS da página passa para a frente do bloco): o que muda de altura não empurra o controle que a pessoa acabou de usar */}
      <p aria-live="polite" data-frase-recorte="limites" className="max-w-prose2 text-base leading-relaxed text-carvao">
        {marcarNomes(
          respostaRecorteLimites(todos, ind, classeEscolhida, ano, avisosFec, idioma),
          todos.map((i) => i.rotulo),
          idioma,
        )}
      </p>
      {avisosNoGrafico.length > 0 && (
        <p data-legenda="asterisco-fec" className="text-sm leading-snug text-carvao">
          <span aria-hidden="true" className="mr-1 font-medium">
            *
          </span>
          {tx(
            "FEC de cobertura parcial: em algum mês do ano, o valor não cobre todas as unidades consumidoras da distribuidora. A explicação de cada uma está abaixo do gráfico.",
            "FEC with partial coverage: in some month of the year, the value does not cover all consumer units of the distribution utility. The explanation for each one is below the chart.",
          )}
        </p>
      )}

      <GraficoPontos
        titulo={tx(
          `${r.titulo}, ${v.cls === "permissionaria" ? "permissionárias" : "concessionárias"}, ${ano}`,
          `${r.titulo}, ${v.cls === "permissionaria" ? "permit holders" : "concession holders"}, ${ano}`,
        )}
        itens={itens}
        rotulosSaoNomes
        unidade={r.unidade}
        casas={2}
        rotuloValor={tx(`${r.nome} apurado`, `Assessed ${r.nome}`)}
        rotuloReferencia={tx(`Limite de ${r.nome}`, `${r.nome} limit`)}
        ordemInicial={{ por: "diferenca", direcao: "desc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        corValor="var(--cor-energia)" // i18n: dado
        corReferencia="var(--serie-referencia)"
        zeroNoEixo
      />
      {avisosNoGrafico.length > 0 && (
        <div role="note" data-aviso="fec-cobertura-parcial" className="max-w-prose2 space-y-1 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao">
          {avisosNoGrafico.map((a) => (
            <p key={a.cnpj}>* {marcarNomes(a.frase, [a.rotulo], idioma)}</p>
          ))}
        </div>
      )}

      <section aria-live="polite" aria-label={tx("Histórico da distribuidora escolhida", "History of the selected distribution utility")} className="space-y-3 border-t border-linha pt-4">
        {sel ? (
          serie ? (
            <>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="historico-distribuidora">
                {marcarNomes(respostaHistoricoDistribuidora(nomeSel, s, ind, idioma), [nomeSel], idioma)}
                {avisoSel && " "}
                {avisoSel && marcarNomes(avisoSel.frase, [avisoSel.rotulo], idioma)}
              </p>
              <GraficoLinhas
                titulo={tx(`${r.nome} anual e limite de ${nomeSel}`, `Annual ${r.nome} and limit of ${nomeSel}`)}
                dados={dados}
                chaveX="ano" // i18n: dado
                formatoX="texto"
                series={[
                  { id: "valor", rotulo: tx(`${r.nome} apurado`, `Assessed ${r.nome}`), cor: "var(--cor-energia)" }, // i18n: dado
                  { id: "limite", rotulo: tx("Limite do ano", "Limit of the year"), cor: "var(--serie-referencia)", tracejada: true },
                ]}
                unidade={r.unidade}
                casas={2}
                zeroNoEixo
                altura={240}
                marcos={[
                  ...(s?.quebras ?? []).map((q) => ({ x: String(q), rotulo: tx(`${q}: perímetro mudou`, `${q}: perimeter changed`) })),
                  ...(avisoSel ? [{ x: String(avisoSel.ano), rotulo: tx(`${avisoSel.ano}: FEC de cobertura parcial`, `${avisoSel.ano}: FEC with partial coverage`) }] : []),
                ]}
              />
            </>
          ) : erro ? (
            <p role="alert" className="text-sm text-carvao">
              {tx(
                <>Histórico indisponível ({erro}); a série anual por distribuidora está no CSV da lista de downloads do painel.</>,
                <>History unavailable ({erro}); the annual series by distribution utility is in the CSV in the panel&apos;s download list.</>,
              )}
            </p>
          ) : (
            <p role="status" className="text-sm text-carvao-muted">
              {tx(<>Carregando o histórico de {nomeSel}…</>, <>Loading the history of {nomeSel}…</>)}
            </p>
          )
        ) : (
          <p className="text-sm text-carvao-muted">
            {tx(
              "Escolha uma distribuidora no gráfico ou na tabela para ver a distância ao limite ano a ano.",
              "Choose a distribution utility in the chart or in the table to see the distance to the limit year by year.",
            )}
          </p>
        )}
      </section>

      <QualidadeTabela
        tabela="limites"
        titulo={tx(`Realizado, limite e DGC por distribuidora, ${ano}`, `Actual, limit and DGC by distribution utility, ${ano}`)}
        linhas={totalLinhas}
        chaveUrl="tlim"
        selecionado={sel}
        onSelecionar={selecionar}
        avisosFec={avisosFec}
      />
    </div>
  );
}
