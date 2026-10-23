"use client";

import type { ReactNode } from "react";
import { FiguraAnalitica, GraficoBarras } from "@/components/painel";
import {
  composicaoDespesa,
  distribuicaoMatriculas,
  ponteMatricula,
  type CapitalPainel,
  type Indice,
  type Ponto,
} from "@/lib/eficiencia/consulta";
import { inteiro, percentual, reaisCompleto, reaisExtenso } from "@/lib/eficiencia/formato";
import { provenienciaDaFicha, type FonteFicha } from "@/lib/eficiencia/proveniencia";
import type { FichaIndicador } from "@/lib/eficiencia/tipos";
import type { ContextoFicha } from "./FichaConteudo";
import { SobreEsteDado } from "./SobreEsteDado";
import { SemValor } from "./estados";

/**
 * Detalhes de uma medida, para uma capital e um período: composição da despesa por subfunção, matrículas por etapa e o
 * caminho do total da DCA ao numerador da razão por matrícula. Cada soma é conferida contra o total que a origina; parcelas
 * que não fecham não são desenhadas.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026) cada detalhe é uma FiguraAnalitica: as barras do kit com a
 * participação de cada parte (escala de zero ao maior valor), a tabela que antes abria em "Ver tabela" como tabela equivalente, a
 * conferência da soma e a ressalva junto do dado, a ficha de origem e o que a composição não permite concluir. Sem composição publicada,
 * o motivo fica no lugar do gráfico.
 */

type Base = { ix: Indice; cap: CapitalPainel; ano: number; ficha: FichaIndicador; ctx: ContextoFicha; fontes: Record<string, FonteFicha> };

/** O motivo de não haver composição, no lugar do gráfico (marcado como gráfico vazio para a figura). */
function SemComposicao({ children }: { children: ReactNode }) {
  return <div data-grafico="sem-composicao">{children}</div>;
}

function Barras({ titulo, linhas }: { titulo: string; linhas: { chave: string; rotulo: string; pct: number }[] }) {
  return <GraficoBarras titulo={titulo} series={[{ id: "pct", nome: "Participação", pontos: linhas.map((l) => ({ x: l.chave, rotulo: l.rotulo, y: l.pct })) }]} eixoY={{ unidade: "%", zero: true, casas: 1 }} orientacao="horizontal" rotulosValor />;
}

export function ComposicaoDespesa({ ix, cap, ano, ficha, ctx, fontes }: Base) {
  const c = composicaoDespesa(ix, cap.cod, ano);
  const nomeCap = `${cap.nome} (${cap.uf})`;
  const pergunta = "Despesa liquidada na função Educação, por subfunção";
  const vazio = c.inconsistente || c.total.valor === null;
  const soma = c.linhas.reduce((a, l) => a + l.valor, 0);
  return (
    <FiguraAnalitica
      id="detalhe"
      idioma="pt"
      pergunta={pergunta}
      subtitulo={`${nomeCap} · % do total da função · exercício ${ano} · valores nominais · ordem da classificação funcional`}
      natureza={ficha.natureza}
      proveniencia={provenienciaDaFicha(ficha, fontes, { inicio: String(ano), fim: String(ano) })}
      tabela={{
        colunas: ["Subfunção", "R$", "% da função"],
        linhas: vazio ? [] : [...c.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), percentual(l.participacao, 2)]), ["Total da função Educação", reaisCompleto(c.total.valor!), "100,00%"]],
        titulo: `Despesa por subfunção, ${nomeCap}, ${ano}`,
        limite: c.linhas.length + 1,
      }}
      ressalva="A classificação por subfunção segue a prática contábil de cada município: despesas comuns a várias etapas podem estar em administração geral, em demais subfunções ou distribuídas nas subfunções de etapa."
      naoConcluir="A composição não mede o custo de cada etapa: ela segue a classificação contábil que cada município adota, e capitais diferentes classificam a mesma despesa de formas diferentes."
      complemento={
        <>
          {!vazio && (
            <p className="t-meta text-carvao">
              <span aria-hidden="true">✓ </span>
              Soma das subfunções: {reaisCompleto(soma)}, igual ao total da função ({reaisCompleto(c.total.valor!)}), com tolerância de R$ 1,00.
            </p>
          )}
          <SobreEsteDado f={ficha} ctx={ctx} />
        </>
      }
    >
      {c.inconsistente ? (
        <SemComposicao>
          <SemValor ponto={{ ...c.total, status: "INCONSISTENTE" }} contexto="A soma das subfunções não reconcilia com o total da função; a composição não é exibida." />
        </SemComposicao>
      ) : c.total.valor === null ? (
        <SemComposicao>
          <SemValor ponto={c.total} />
        </SemComposicao>
      ) : (
        <Barras titulo={`${pergunta}, ${nomeCap}, ${ano}`} linhas={c.linhas.map((l) => ({ chave: l.codigo, rotulo: l.rotulo, pct: l.participacao }))} />
      )}
    </FiguraAnalitica>
  );
}

export function MatriculasPorEtapa({ ix, cap, ano, ficha, ctx, fontes }: Base) {
  const dist = distribuicaoMatriculas(ix, cap.cod, ano);
  const conv = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, ano, "total", null);
  const nomeCap = `${cap.nome} (${cap.uf})`;
  const pergunta = "Matrículas na rede municipal, por etapa";
  const total = dist.total.valor;
  const vazio = total === null || total === 0;
  return (
    <FiguraAnalitica
      id="detalhe"
      idioma="pt"
      pergunta={pergunta}
      subtitulo={`${nomeCap} · matrículas e % do total da rede · Censo Escolar ${ano} · etapas mutuamente exclusivas`}
      natureza={ficha.natureza}
      proveniencia={provenienciaDaFicha(ficha, fontes, { inicio: String(ano), fim: String(ano) })}
      tabela={{
        colunas: ["Etapa", "Rede municipal", "Conveniadas com o município (à parte)"],
        linhas: vazio
          ? []
          : [
              ...dist.linhas.map((l) => [l.rotulo, l.rede !== null ? inteiro(l.rede) : null, l.conveniadas !== null ? inteiro(l.conveniadas) : null]),
              ["Total da educação básica", inteiro(total), conv.valor !== null ? inteiro(conv.valor) : null],
            ],
        titulo: `Matrículas por etapa, ${nomeCap}, ${ano}`,
        limite: dist.linhas.length + 1,
      }}
      comoInterpretar="A educação especial é uma modalidade transversal, já contada nas etapas. Matrículas em escolas privadas conveniadas com o município aparecem só na tabela, em coluna separada, e não entram na soma."
      naoConcluir="Uma matrícula não é uma pessoa: o mesmo estudante pode ter mais de uma. A distribuição por etapa não mede demanda por vaga nem cobertura da população em idade escolar."
      complemento={
        <>
          {!vazio && (
            <p className="t-meta text-carvao">
              <span aria-hidden="true">✓ </span>
              Soma das etapas: {inteiro(dist.linhas.reduce((a, l) => a + (l.rede ?? 0), 0))}, igual ao total da rede ({inteiro(total!)}).
            </p>
          )}
          <SobreEsteDado f={ficha} ctx={ctx} />
        </>
      }
    >
      {vazio ? (
        <SemComposicao>
          <SemValor ponto={dist.total} />
        </SemComposicao>
      ) : (
        <Barras
          titulo={`${pergunta}, ${nomeCap}, ${ano}`}
          linhas={dist.linhas.filter((l) => l.rede !== null).map((l) => ({ chave: l.etapa, rotulo: l.rotulo, pct: (100 * (l.rede ?? 0)) / total! }))}
        />
      )}
    </FiguraAnalitica>
  );
}

export function PonteDaRazao({ ix, cap, ano, razao, ficha, ctx, fontes }: Base & { razao: Ponto }) {
  const ponte = ponteMatricula(ix, cap.cod, ano);
  const nomeCap = `${cap.nome} (${cap.uf})`;
  const pergunta = "Da despesa total à razão por matrícula: o que entra e o que fica fora";
  return (
    <FiguraAnalitica
      id="ponte"
      idioma="pt"
      pergunta={pergunta}
      subtitulo={`${nomeCap} · R$ correntes · exercício ${ano} · Matriz de Saldos Contábeis de dezembro, função 12, e DCA`}
      natureza={ficha.natureza}
      proveniencia={provenienciaDaFicha(ficha, fontes, { inicio: String(ano), fim: String(ano) })}
      tabela={{
        colunas: ["Parcela", "R$", "% do total da DCA"],
        linhas: ponte.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), l.participacao === null ? null : percentual(l.participacao, 2)]),
        titulo: `Ponte da razão por matrícula, ${nomeCap}, ${ano}`,
        limite: Math.max(ponte.linhas.length, 1),
      }}
      comoInterpretar={
        ponte.linhas.length ? (
          <>
            O total declarado na DCA é separado em parcelas mutuamente exclusivas, linha a linha da MSC, pela natureza da despesa. Entram no numerador a aplicação direta (modalidade 90) em geral e, em linha própria, a aplicação direta com
            beneficiário indeterminado; as demais parcelas ficam fora porque não têm matrícula correspondente no denominador. Nenhuma despesa é rateada por etapa e nenhuma matrícula conveniada é somada ao denominador.
          </>
        ) : undefined
      }
      naoConcluir="A razão por matrícula é orçamentária, não o custo do aluno: o numerador inclui a aplicação direta com beneficiário indeterminado e o denominador não inclui as escolas privadas conveniadas."
      complemento={
        <>
          {ponte.linhas.length > 0 && (
            <>
              <p className="t-meta text-carvao">
                <span className="font-semibold">Total declarado na DCA:</span> {reaisExtenso(ponte.total ?? 0)} (100%). Parcelas, em % do total, no gráfico.
              </p>
              <p className="t-meta text-carvao">
                {ponte.reconcilia ? (
                  <>
                    <span aria-hidden="true">✓ </span>A soma das parcelas, com a diferença entre a DCA e a MSC (quando existe), é igual ao total da função na DCA ({reaisCompleto(ponte.total ?? 0)}).
                  </>
                ) : (
                  <>A MSC não reconcilia com a DCA neste exercício: as parcelas aparecem para transparência, mas o numerador por matrícula não é publicado.</>
                )}
              </p>
            </>
          )}
          <SobreEsteDado f={ficha} ctx={ctx} rotulo="Sobre este dado: a ponte" />
        </>
      }
    >
      {!ponte.linhas.length ? (
        <SemComposicao>
          <SemValor ponto={razao} contexto="A Matriz de Saldos Contábeis de dezembro não está disponível para esta capital e este exercício: a ponte não existe." />
        </SemComposicao>
      ) : (
        <Barras
          titulo={`Ponte da razão por matrícula, ${nomeCap}, ${ano}`}
          linhas={ponte.linhas
            .filter((l) => l.componente !== "dca_total")
            .map((l) => ({ chave: l.componente, rotulo: `${l.dentro ? "Dentro do numerador: " : "Fora do numerador: "}${l.rotulo}`, pct: Math.max(0, l.participacao ?? 0) }))}
        />
      )}
    </FiguraAnalitica>
  );
}
