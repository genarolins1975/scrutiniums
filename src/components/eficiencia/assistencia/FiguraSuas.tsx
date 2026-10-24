"use client";

import { useId, useMemo } from "react";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import type { Proveniencia } from "@/lib/painel/tipos";
import type { Metric, Summary } from "@/lib/eficiencia/assistencia/dados";

const fmt = (v: number | null) => (v === null ? "Não informado" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

/**
 * As respostas da rede do SUAS a uma pergunta do Censo, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os
 * controles (território e medida) logo antes da figura que eles mudam, com o recorte na URL (?ter= e ?med=), e a figura do kit com o
 * gráfico de barras, a tabela equivalente, a fonte e o que não é possível concluir. Os números e as frases são os da antiga
 * DistribuicaoSuas, que saiu quando as seis páginas da Assistência social migraram: percentuais entre respostas observadas, nas perguntas
 * de categoria; nas de contagem, a cobertura das respostas (observadas, não informadas e não aplicáveis) e a soma e a mediana declaradas.
 */
export function FiguraSuas({
  metrics,
  stats,
  ufs,
  proveniencias,
  rota,
  download,
}: {
  metrics: Metric[];
  stats: Record<string, Record<string, Summary>>;
  ufs: string[];
  proveniencias: Record<string, Proveniencia>;
  rota: string;
  download: { href: string; rotulo: string };
}) {
  const id = useId();
  const esquema = useMemo(
    () => ({
      ter: campo(tiposUrl.opcao(["Brasil", ...ufs]), "Brasil"),
      med: campo(tiposUrl.opcao(metrics.map((m) => m.id)), metrics[0].id),
    }),
    [metrics, ufs],
  );
  const [s, definir] = useEstadoUrl(esquema);
  const ficha = metrics.find((m) => m.id === s.med) ?? metrics[0];
  const r = stats[s.ter][ficha.id];
  const categorica = r.categories.length > 0;
  const padrao = s.ter === "Brasil" && ficha.id === metrics[0].id;
  const cobertura = `${fmt(r.observed)} respostas observadas de ${fmt(r.total)} unidades: ${fmt(r.missing)} não informadas e ${fmt(r.notApplicable)} não aplicáveis.`;
  const titulo = `${ficha.name} · ${s.ter} · ${ficha.period}`;
  // categoria: percentuais entre respostas observadas (escala comum de 0 a 100); contagem: a cobertura das respostas, em unidades
  const series = categorica
    ? [{ id: "pct", nome: "% das respostas observadas", pontos: r.categories.map((c) => ({ x: c.label, y: c.percent })) }]
    : [
        {
          id: "unidades",
          nome: "Unidades",
          pontos: [
            { x: "observadas", rotulo: "Respostas observadas", y: r.observed },
            { x: "nao-informadas", rotulo: "Não informadas", y: r.missing },
            { x: "nao-aplicaveis", rotulo: "Não aplicáveis", y: r.notApplicable },
          ],
        },
      ];
  const tabela = categorica
    ? { colunas: ["Resposta", "Unidades", "% observado"], linhas: r.categories.map((c) => [c.label, c.count, c.percent]), casas: [null, 0, 1], titulo: `${ficha.name} · ${ficha.period} · ${s.ter}` }
    : {
        colunas: ["Situação da resposta", "Unidades"],
        linhas: [
          ["Respostas observadas", r.observed],
          ["Não informadas", r.missing],
          ["Não aplicáveis", r.notApplicable],
        ],
        casas: [null, 0],
        titulo: `${ficha.name} · ${ficha.period} · ${s.ter}`,
      };
  const rotuloSelect = "mt-2 block min-h-[44px] max-w-full border border-carvao-muted bg-superficie px-3 text-sm text-carvao";
  return (
    <>
      <Controles rotulo="Recorte das respostas da rede" resumo={`Mostrando ${s.ter}, ${ficha.kind} · ${ficha.name}, ${ficha.period}.`} limpar={padrao ? undefined : { href: rota }}>
        <label className="text-sm text-carvao" htmlFor={`${id}-uf`}>
          Território
          <select id={`${id}-uf`} value={s.ter} onChange={(e) => definir({ ter: e.target.value })} className={rotuloSelect}>
            <option>Brasil</option>
            {ufs.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-sm text-carvao" htmlFor={`${id}-metric`}>
          Medida e tipo de unidade
          <select id={`${id}-metric`} value={ficha.id} onChange={(e) => definir({ med: e.target.value })} className={`${rotuloSelect} w-full`}>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.kind} · {m.name}
              </option>
            ))}
          </select>
        </label>
      </Controles>
      <FiguraAnalitica
        id="respostas-da-rede"
        pergunta="Como a rede respondeu a cada pergunta do Censo SUAS?"
        subtitulo={`${ficha.kind} · ${ficha.name} · ${categorica ? "% das respostas observadas" : "unidades respondentes"} · ${s.ter} · ${ficha.period}`}
        natureza="CALCULADO"
        proveniencia={proveniencias[ficha.id]}
        download={download}
        idioma="pt"
        leitura={<LeituraGuiada>{cobertura}</LeituraGuiada>}
        tabela={tabela}
        comoInterpretar={
          categorica
            ? "Escala comum de 0 a 100%. Não é escore de serviço. Inclui unidades regionais ou estaduais quando presentes; a seleção é pela UF da rede."
            : "Contagem declarada por unidade: o gráfico mostra quantas unidades responderam; a soma e a mediana estão logo abaixo. Inclui unidades regionais ou estaduais quando presentes; a seleção é pela UF da rede."
        }
        naoConcluir={ficha.limitations}
        complemento={
          <>
            {!categorica && (
              <dl className="grid gap-5 border-y border-linha py-5 sm:grid-cols-2">
                {ficha.unit !== "dias" && (
                  <div>
                    <dt className="t-meta text-carvao-muted">Soma das contagens observadas nas unidades</dt>
                    <dd className="numero-p mt-1 text-carvao">{fmt(r.sum)}</dd>
                    <dd className="t-meta mt-1 text-carvao-muted">Pode haver pessoas ou vínculos em mais de uma unidade. Não é cobertura populacional.</dd>
                  </div>
                )}
                <div>
                  <dt className="t-meta text-carvao-muted">Mediana entre respostas observadas</dt>
                  <dd className="numero-p mt-1 text-carvao">
                    {fmt(r.median)} {ficha.unit === "dias" ? "dias" : ""}
                  </dd>
                  <dd className="t-meta mt-1 text-carvao-muted">Referência descritiva do recorte, sem interpretação de meta.</dd>
                </div>
              </dl>
            )}
            {r.observed === 0 && (
              <p className="t-meta text-carvao" role="status">
                Não há respostas observadas para esta medida neste recorte.
              </p>
            )}
          </>
        }
      >
        <GraficoBarras
          titulo={titulo}
          series={series}
          eixoY={{ unidade: categorica ? "%" : "unidades", zero: true, casas: categorica ? 1 : 0 }}
          orientacao="horizontal"
          rotulosValor
          // a frase "Escala comum de 0 a 100%" vale como na distribuição de antes: a referência no total leva o eixo a 100 em toda medida
          referencias={categorica ? [{ valor: 100, rotulo: "Total das respostas observadas" }] : undefined}
        />
      </FiguraAnalitica>
    </>
  );
}
