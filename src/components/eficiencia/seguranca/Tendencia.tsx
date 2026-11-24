import { FiguraAnalitica, GraficoLinhas, LeituraGuiada } from "@/components/painel";
import { inicioSequenciaCompleta, serieBR, seriePct, ultimoIndice, ultimoIndiceSimFinal, variacaoPct } from "@/lib/eficiencia/seguranca/dados";
import { inteiro, numero, percentualVariacao } from "@/lib/eficiencia/seguranca/formato";
import type { GoldSeguranca } from "@/lib/eficiencia/seguranca/tipos";
import { fichasSeguranca } from "./fichas";

const COR_POLICIA = "var(--cor-obee)";
const COR_SAUDE = "var(--cor-obee-neutro)";

/**
 * "A violência letal caiu. Quanto disso é registro?": a taxa de homicídio doloso (Sinesp) e a de óbito por agressão (SIM) no Brasil
 * desde o primeiro ano com as 27 UFs no Sinesp e, logo abaixo, a parcela de mortes por causa externa de intenção indeterminada no
 * mesmo período. Dois gráficos de um eixo cada (nunca eixo duplo). O ano preliminar do SIM é tracejado e dito na legenda; todos os
 * valores, anos e variações saem da gold.
 */
export function Tendencia({ g, rota }: { g: GoldSeguranca; rota: string }) {
  const k0 = inicioSequenciaCompleta(g, "homicidio");
  const kH = ultimoIndice(g, "homicidio");
  const kS = ultimoIndiceSimFinal(g);
  const h = serieBR(g, "homicidio"), s = serieBR(g, "agressoes"), ind = seriePct(g, "indeterminadas_pct", "BR");
  const prelim = (k: number) => g.fontes.sim.situacao[String(g.anos[k])] === "preliminar";
  const ks = g.anos.map((_, k) => k).filter((k) => k >= k0);
  const temPrelim = ks.some(prelim);
  const dadosA = ks.map((k) => ({
    ano: String(g.anos[k]),
    policia: h.situacao[k] === "ok" ? h.taxa?.[k] ?? null : null,
    saude: !prelim(k) ? s.taxa?.[k] ?? null : null,
    saudePrelim: prelim(k) || k === kS ? s.taxa?.[k] ?? null : null,
  }));
  const dadosB = ks.map((k) => ({
    ano: String(g.anos[k]),
    final: !prelim(k) ? ind.pct[k] : null,
    prelim: prelim(k) || k === kS ? ind.pct[k] : null,
  }));
  const { sinesp, sim, ibge } = fichasSeguranca(g);
  const a0 = g.anos[k0];
  const vH = variacaoPct(h.taxa?.[k0], h.taxa?.[kH]);
  const vS = variacaoPct(s.taxa?.[k0], s.taxa?.[kS]);
  const kP = ks.filter(prelim).at(-1);
  return (
    <FiguraAnalitica
      id="tendencia"
      idioma="pt"
      pergunta="A violência letal caiu. Quanto disso é registro?"
      subtitulo={`Homicídio doloso (polícia) e óbito por agressão (saúde) · por 100 mil habitantes · Brasil, ${a0} a ${g.anos[kH]}`}
      natureza="CALCULADO"
      proveniencia={sinesp}
      complementares={[{ rotulo: "Sobre o SIM", p: sim }, { rotulo: "Sobre a população", p: ibge }]}
      leitura={
        <LeituraGuiada>
          De {a0}, o primeiro ano com as 27 UFs no Sinesp, a {g.anos[kH]}, a taxa de homicídio doloso registrada pela polícia foi de {numero(h.taxa?.[k0] as number, 1)} para {numero(h.taxa?.[kH] as number, 1)} por 100 mil ({inteiro(h.n[k0] as number)} para {inteiro(h.n[kH] as number)} vítimas{vH !== null ? `, ${percentualVariacao(vH)}` : ""}). No registro de saúde, de {a0} a {g.anos[kS]} (último ano final), o óbito por agressão foi de {numero(s.taxa?.[k0] as number, 1)} para {numero(s.taxa?.[kS] as number, 1)}{vS !== null ? ` (${percentualVariacao(vS)})` : ""}. No mesmo período, a parcela de mortes sem intenção definida foi de {numero(ind.pct[k0] as number, 1)}% para {numero(ind.pct[kS] as number, 1)}%{kP !== undefined ? ` (${numero(ind.pct[kP] as number, 1)}% em ${g.anos[kP]}, preliminar)` : ""}.
        </LeituraGuiada>
      }
      comoInterpretar={`As duas linhas contam a mesma violência por caminhos diferentes: a polícia pela UF do fato e pela classificação penal; a saúde pela UF de residência e pela causa da morte. A série começa em ${a0} porque antes disso alguma UF não enviou o homicídio doloso completo ao Sinesp. Abaixo, na mesma escala de tempo: quando a declaração de óbito não diz se foi agressão, acidente ou suicídio, a morte sai das agressões.`}
      naoConcluir="A queda aparece nos dois registros, mas parte das mortes deixou de ter a intenção identificada na saúde: o painel não estima quanto da queda é reclassificação, nem a atribui a uma política."
      ressalva={temPrelim ? `O último ano do SIM é preliminar (tracejado) e costuma subir quando se torna final.` : undefined}
      tabela={{
        titulo: `Homicídio doloso, óbito por agressão e intenção indeterminada, Brasil, ${a0} a ${g.anos[kH]}`,
        colunas: ["Ano", "Homicídio doloso por 100 mil (Sinesp)", "Vítimas (Sinesp)", "Óbito por agressão por 100 mil (SIM)", "Óbitos (SIM)", "Situação do SIM", "Intenção indeterminada, % das mortes por causas externas"],
        casas: [null, 1, 0, 1, 0, null, 1],
        limite: ks.length,
        linhas: ks.map((k) => [String(g.anos[k]), h.taxa?.[k] ?? null, h.n[k], s.taxa?.[k] ?? null, s.n[k], prelim(k) ? "preliminar" : "final", ind.pct[k]]),
      }}
      depois={<p className="t-meta text-carvao-muted">Cada UF, ano a ano, e a razão entre os dois registros: <a className="underline" href={`${rota}/estados#policia-e-saude`}>Polícia e saúde, por estado</a>.</p>}
    >
      <GraficoLinhas
        semTabela
        titulo={`Homicídio doloso e óbito por agressão por 100 mil habitantes, Brasil, ${a0} a ${g.anos[kH]}`}
        dados={dadosA}
        chaveX="ano"
        formatoX="texto"
        unidade="taxa por 100 mil habitantes"
        casas={1}
        zeroNoEixo
        rotulosDiretos={false}
        altura={300}
        series={[
          { id: "policia", rotulo: "Homicídio doloso, polícia (Sinesp)", sigla: "Polícia", cor: COR_POLICIA, espessura: 2.5 },
          { id: "saude", rotulo: "Óbito por agressão, saúde (SIM)", sigla: "Saúde", cor: COR_SAUDE, espessura: 2.5 },
          ...(temPrelim ? [{ id: "saudePrelim", rotulo: "Óbito por agressão, SIM preliminar", sigla: "Prelim.", cor: COR_SAUDE, tracejada: true, espessura: 2 }] : []),
        ]}
      />
      <div className="mt-8 border-t border-linha pt-6">
        <h3 className="t-h3 text-carvao">Mortes violentas sem intenção definida</h3>
        <p className="mt-1 t-meta text-carvao-muted">% das mortes por causas externas · SIM, Brasil, UF de residência</p>
        <div className="mt-4">
          <GraficoLinhas
            semTabela
            titulo={`Mortes por causa externa de intenção indeterminada, % das mortes por causas externas, Brasil, ${a0} a ${g.anos[ks.at(-1) as number]}`}
            dados={dadosB}
            chaveX="ano"
            formatoX="texto"
            unidade="%"
            casas={1}
            zeroNoEixo
            rotulosDiretos={false}
            altura={200}
            series={[
              { id: "final", rotulo: "Intenção indeterminada, dado final", sigla: "Final", cor: COR_SAUDE, espessura: 2.5 },
              ...(temPrelim ? [{ id: "prelim", rotulo: "Intenção indeterminada, preliminar", sigla: "Prelim.", cor: COR_SAUDE, tracejada: true, espessura: 2 }] : []),
            ]}
          />
        </div>
      </div>
    </FiguraAnalitica>
  );
}
