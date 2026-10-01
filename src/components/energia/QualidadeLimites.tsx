"use client";

import { useEffect, useMemo, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos, type ParEntidade } from "@/components/energia/GraficoPontos";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { CAMPO_CLASSE, CAMPO_DIST, CAMPO_IND, CLASSES, INDICADORES, carregarUmaVez, destacar, respostaHistoricoDistribuidora, type Indicador } from "@/lib/energia/qualidade";
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

const ROTULO_IND: Record<Indicador, { nome: string; unidade: string; titulo: string }> = {
  dec: { nome: "DEC", unidade: "h", titulo: "DEC apurado e limite anual por distribuidora" },
  fec: { nome: "FEC", unidade: "interrupções", titulo: "FEC apurado e limite anual por distribuidora" },
};

export function QualidadeLimites({
  ano,
  itensDec,
  itensFec,
  classes,
  totalLinhas,
  urlSerie,
}: {
  ano: number;
  itensDec: ParEntidade[];
  itensFec: ParEntidade[];
  /** Classificação (Concessionária ou Permissionária) de cada CNPJ. */
  classes: Record<string, string | null>;
  /** Linhas da tabela com DGC (todas as distribuidoras do ano). */
  totalLinhas: number;
  urlSerie: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const sel = v.dist[0] ?? null;
  const ind = v.ind;
  const r = ROTULO_IND[ind];
  const rotuloClasse = v.cls === "permissionaria" ? "Permissionária" : "Concessionária";
  // distribuidora escolhida em outro painel aparece mesmo se for da outra classe
  const itens = (ind === "dec" ? itensDec : itensFec).filter((i) => classes[i.id] === rotuloClasse || i.id === sel);
  const semClasse = itensDec.filter((i) => classes[i.id] !== "Concessionária" && classes[i.id] !== "Permissionária").length;
  const nomes = useMemo(() => new Map(itensDec.map((i) => [i.id, i.rotulo])), [itensDec]);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div role="radiogroup" aria-label="Indicador do gráfico" className="flex flex-wrap gap-2">
          {INDICADORES.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={ind === i}
              onClick={() => definir({ ind: i })}
              className={`rotulo min-h-[44px] border px-4 ${ind === i ? "border-energia bg-energia text-superficie" : "border-linha bg-superficie text-carvao hover:border-energia"}`}
            >
              {ROTULO_IND[i].nome}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Grupo de distribuidoras" className="flex flex-wrap gap-2">
          {CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={v.cls === c}
              onClick={() => definir({ cls: c })}
              className={`rotulo min-h-[44px] border px-4 ${v.cls === c ? "border-energia bg-energia text-superficie" : "border-linha bg-superficie text-carvao hover:border-energia"}`}
            >
              {c === "concessionaria" ? "Concessionárias" : "Permissionárias"}
            </button>
          ))}
        </div>
      </div>
      {semClasse > 0 && <p className="text-xs text-carvao-muted">{semClasse} distribuidoras sem classificação publicada ficam só na tabela.</p>}

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

      <section aria-live="polite" aria-label="Histórico da distribuidora escolhida" className="space-y-3 border-t border-linha pt-4">
        {sel ? (
          serie ? (
            <>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="historico-distribuidora">
                {respostaHistoricoDistribuidora(nomeSel, s, ind)}
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
                marcos={(s?.quebras ?? []).map((q) => ({ x: String(q), rotulo: `${q}: perímetro mudou` }))}
              />
            </>
          ) : erro ? (
            <p role="alert" className="text-sm text-carvao">
              Histórico indisponível ({erro}); a série está em qualidade_distribuidoras_anual.csv.
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
      />
    </div>
  );
}
