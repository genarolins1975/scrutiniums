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
  type AvisosFec,
  type Indicador,
  type ItemLimites,
} from "@/lib/energia/qualidade";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";

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

const ROTULO_IND: Record<Indicador, { nome: string; unidade: string; titulo: string }> = {
  dec: { nome: "DEC", unidade: "h", titulo: "DEC apurado e limite anual por distribuidora" },
  fec: { nome: "FEC", unidade: "interrupções", titulo: "FEC apurado e limite anual por distribuidora" },
};

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
        <div role="radiogroup" aria-label="Indicador do gráfico" className="flex flex-wrap gap-2">
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
        <div role="radiogroup" aria-label="Grupo de distribuidoras" className="flex flex-wrap gap-2">
          {CLASSES.map((c) => (
            <label
              key={c}
              className={`rotulo inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-4 focus-within:ring-2 focus-within:ring-energia ${v.cls === c ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}
            >
              <input type="radio" name="qualidade-limites-classe" value={c} checked={v.cls === c} onChange={() => definir({ cls: c })} className="h-4 w-4 accent-energia" />
              {c === "concessionaria" ? "Concessionárias" : "Permissionárias"}
            </label>
          ))}
        </div>
      </div>
      {semClasse > 0 && <p className="text-xs text-carvao-muted">{semClasse} distribuidoras sem classificação publicada ficam só na tabela.</p>}
      {sel && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-carvao" data-selecao-distribuidora={sel}>
          <span className="rotulo text-mineral">Distribuidora escolhida</span>
          <strong className="font-medium">{nomeSel}</strong>
          <button type="button" className={BOTAO} onClick={() => selecionar(null)}>
            Limpar seleção
          </button>
          {v.dist.length > 1 && <span className="text-xs text-carvao-muted">Mais {v.dist.length - 1} na comparação.</span>}
        </div>
      )}

      <GraficoPontos
        titulo={`${r.titulo}, ${v.cls === "permissionaria" ? "permissionárias" : "concessionárias"}, ${ano}`}
        itens={itens}
        unidade={r.unidade}
        casas={2}
        rotuloValor={`${r.nome} apurado`}
        rotuloReferencia={`Limite de ${r.nome}`}
        ordemInicial={{ por: "diferenca", direcao: "desc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        corValor="var(--cor-energia)"
        corReferencia="var(--serie-referencia)"
        zeroNoEixo
      />
      {avisosNoGrafico.length > 0 && (
        <div role="note" data-aviso="fec-cobertura-parcial" className="max-w-prose2 space-y-1 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao">
          {avisosNoGrafico.map((a) => (
            <p key={a.cnpj}>* {a.frase}</p>
          ))}
        </div>
      )}

      <section aria-live="polite" aria-label="Histórico da distribuidora escolhida" className="space-y-3 border-t border-linha pt-4">
        {sel ? (
          serie ? (
            <>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="historico-distribuidora">
                {respostaHistoricoDistribuidora(nomeSel, s, ind)}
                {avisoSel && ` ${avisoSel.frase}`}
              </p>
              <GraficoLinhas
                titulo={`${r.nome} anual e limite de ${nomeSel}`}
                dados={dados}
                chaveX="ano"
                formatoX="texto"
                series={[
                  { id: "valor", rotulo: `${r.nome} apurado`, cor: "var(--cor-energia)" },
                  { id: "limite", rotulo: "Limite do ano", cor: "var(--serie-referencia)", tracejada: true },
                ]}
                unidade={r.unidade}
                casas={2}
                zeroNoEixo
                altura={240}
                marcos={[
                  ...(s?.quebras ?? []).map((q) => ({ x: String(q), rotulo: `${q}: perímetro mudou` })),
                  ...(avisoSel ? [{ x: String(avisoSel.ano), rotulo: `${avisoSel.ano}: FEC de cobertura parcial` }] : []),
                ]}
              />
            </>
          ) : erro ? (
            <p role="alert" className="text-sm text-carvao">
              Histórico indisponível ({erro}); a série anual por distribuidora está no CSV da lista de downloads do painel.
            </p>
          ) : (
            <p role="status" className="text-sm text-carvao-muted">
              Carregando o histórico de {nomeSel}…
            </p>
          )
        ) : (
          <p className="text-sm text-carvao-muted">Escolha uma distribuidora no gráfico ou na tabela para ver a distância ao limite ano a ano.</p>
        )}
      </section>

      <QualidadeTabela
        tabela="limites"
        titulo={`Realizado, limite e DGC por distribuidora, ${ano}`}
        linhas={totalLinhas}
        chaveUrl="tlim"
        selecionado={sel}
        onSelecionar={selecionar}
        avisosFec={avisosFec}
      />
    </div>
  );
}
