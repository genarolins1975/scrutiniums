"use client";

import { useEffect, useMemo, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos, type ParEntidade } from "@/components/energia/GraficoPontos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CAMPO_DIST,
  CAMPO_IND,
  COLUNAS_LIMITES,
  INDICADORES,
  carregarUmaVez,
  destacar,
  respostaHistoricoDistribuidora,
  type Indicador,
} from "@/lib/energia/qualidade";
import type { LinhaTabela } from "@/lib/energia/tabela";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";

/**
 * P052: realizado × limite por distribuidora (pontos pareados: círculo é o apurado,
 * losango é o limite do mesmo ano, com a diferença escrita), o histórico da
 * distribuidora escolhida e a tabela equivalente com DGC calculado ao lado do publicado.
 *
 * Estado na URL: `?ind=` (DEC ou FEC) e `?dist=` (a primeira é a escolhida). Escolher
 * um ponto, uma linha da tabela ou uma distribuidora nos pequenos múltiplos dá no mesmo;
 * o voltar desfaz. O histórico (2015 em diante) vem do arquivo de séries por
 * distribuidora, buscado só quando há uma escolhida.
 */

const ESQUEMA = { ind: CAMPO_IND, dist: CAMPO_DIST };

const ROTULO_IND: Record<Indicador, { nome: string; unidade: string; titulo: string }> = {
  dec: { nome: "DEC", unidade: "h", titulo: "DEC apurado e limite anual por distribuidora" },
  fec: { nome: "FEC", unidade: "interrupções", titulo: "FEC apurado e limite anual por distribuidora" },
};

export function QualidadeLimites({
  ano,
  itensDec,
  itensFec,
  linhas,
  urlSerie,
  fonte,
  versao,
}: {
  ano: number;
  itensDec: ParEntidade[];
  itensFec: ParEntidade[];
  linhas: LinhaTabela[];
  urlSerie: string;
  fonte: string;
  versao: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const sel = v.dist[0] ?? null;
  const ind = v.ind;
  const r = ROTULO_IND[ind];
  const itens = ind === "dec" ? itensDec : itensFec;
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

      <GraficoPontos
        titulo={`${r.titulo}, ${ano}`}
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

      <TabelaInterativa
        titulo={`Realizado, limite e DGC por distribuidora, ${ano}`}
        colunas={COLUNAS_LIMITES}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="sigla"
        fonte={fonte}
        versao={versao}
        nomeArquivo="qualidade-limites-distribuidoras"
        chaveUrl="tlim"
        ordemInicial={{ coluna: ind === "dec" ? "razao_dec" : "razao_fec", direcao: "desc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        dicaBusca="Sigla ou CNPJ"
        nota="DGC (desempenho global de continuidade) = média simples de DEC ÷ limite e FEC ÷ limite, como no ranking da ANEEL; o publicado tem duas casas."
      />
    </div>
  );
}
