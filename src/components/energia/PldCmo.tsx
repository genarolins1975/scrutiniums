"use client";

import { useMemo, type ReactNode } from "react";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { PldEscolha } from "@/components/energia/PldControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, num } from "@/lib/energia/formato";
import {
  COLUNAS_RELACAO,
  COLUNAS_SEMANAS,
  COR_SM,
  CURTO_SM,
  NOME_SM,
  SUBMERCADOS,
  linhasRelacaoAnual,
  linhasSemanais,
  respostaP009,
  rotaPainel,
  vereditoP009,
} from "@/lib/energia/pld";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoCmoPld } from "@/lib/energia/tipos-pld";

/**
 * P009, CMO e formação de preço: submercado (?sm=) e intervalo do gráfico semanal
 * (?de=, ?ate=) ficam na URL; busca, ordem e filtros das tabelas também (prefixos
 * sem e rel). A resposta, as medidas da faixa, o gráfico semanal e a tabela
 * equivalente leem as mesmas linhas (linhasSemanais); a comparação horária mostra o PLD
 * e o CMO do DESSEM na MESMA hora para os quatro submercados, em pequenos múltiplos
 * na mesma escala (nunca dois eixos). Nenhuma diferença é calculada aqui: as da
 * semana de referência vêm prontas da gold, e as horárias por ano também.
 *
 * Ordem da página: resposta e escolha do submercado, faixa de medidas, figura principal
 * (a semana operativa), recorte, tabela, notas do painel (`notas`, logo depois da figura)
 * e as duas comparações complementares, visíveis em Entender, cada uma com a sua pergunta.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
};

const OPCOES_SM = SUBMERCADOS.map((sm) => ({ id: sm, rotulo: CURTO_SM[sm], detalhe: NOME_SM[sm] }));

export type HorarioCmo = { t: string[]; pld: Record<Submercado, (number | null)[]>; cmo: Record<Submercado, (number | null)[]> };

export function PldCmo({
  c,
  horario,
  marcos,
  fichas,
  fonte,
  versao,
  notasEntreLimites,
  notas,
  avisoGrafico,
}: {
  c: Pick<BlocoCmoPld, "semanal" | "semana_referencia" | "relacao_anual">;
  /** Últimas 168 horas (pld_horario_recente.json), só PLD e CMO; null quando o arquivo falta. */
  horario: HorarioCmo | null;
  marcos: { x: string; rotulo: string }[];
  fichas: Record<string, Evidencia>;
  fonte: string;
  versao: string;
  /** Por submercado, a frase que concilia as horas entre os limites daqui com as da página de limites (notaHorasEntreLimites). */
  notasEntreLimites?: Partial<Record<Submercado, string | null>>;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Aviso sobre o recorte do gráfico semanal frente ao CSV, junto do gráfico. */
  avisoGrafico?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Submercado;
  const notaEntreLimites = notasEntreLimites?.[sm] ?? null;
  const linhas = useMemo(() => linhasSemanais(c as BlocoCmoPld, sm), [c, sm]);
  const relacao = useMemo(() => linhasRelacaoAnual(c as BlocoCmoPld, sm), [c, sm]);
  const ref = c.semana_referencia;
  const x = ref?.por_sm.find((p) => p.sm === sm) ?? null;
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const horas = useMemo(
    () =>
      horario
        ? horario.t.map((t, i) => {
            const linha: Record<string, string | number | null> = { t };
            for (const s of SUBMERCADOS) {
              linha[`pld_${s}`] = horario.pld[s][i] ?? null;
              linha[`cmo_${s}`] = horario.cmo[s][i] ?? null;
            }
            return linha;
          })
        : [],
    [horario],
  );
  const situacoes = relacao.map((r) => ({ id: r.id, rotulo: r.ano, piso: r.piso, teto_horario: r.teto_horario, teto_estrutural_no_dia: r.teto_estrutural_no_dia, entre: r.entre }));
  const endereco = `${rotaPainel("p009")}#p009`;

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p009" vivo veredito={vereditoP009(c as BlocoCmoPld, sm)}>
          {respostaP009(c as BlocoCmoPld, sm)}
          {notaEntreLimites ? <span className="mt-2 block">{notaEntreLimites}</span> : null}
        </RespostaCurta>
        <PldEscolha legenda="Submercado" opcoes={OPCOES_SM} valor={sm} onEscolher={(s) => definir({ sm: s })} />
      </div>

      <FaixaMetricas colunas={4} rotulo={`Medidas da semana de referência, ${NOME_SM[sm]}`}>
        <Numero
          variante="faixa"
          rotulo="CMO semanal do DECOMP"
          natureza="ESTIMADO"
          valor={x?.decomp ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={ref ? `semana de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}` : undefined}
          motivoAusencia="Sem semana operativa completa com os três produtos."
          cor={COR_SM[sm]}
          nota="Valor do modelo para a semana inteira, como publicado pelo ONS."
        />
        <Numero
          variante="faixa"
          rotulo="Média do CMO do DESSEM na semana"
          natureza="CALCULADO"
          evidencia={fichas[`dessem_semana_${sm}`] ?? null}
          valor={x?.dessem ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Semana sem as 336 meias horas publicadas."
          cor={COR_SM[sm]}
          endereco={endereco}
        />
        <Numero
          variante="faixa"
          rotulo="Média do PLD na semana"
          natureza="CALCULADO"
          evidencia={fichas[`pld_semana_${sm}`] ?? null}
          valor={x?.pld ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Semana sem as 168 horas publicadas."
          cor={COR_SM[sm]}
          endereco={endereco}
        />
        <Numero
          variante="faixa"
          rotulo="PLD médio menos a média do DESSEM, mesma semana"
          natureza="CALCULADO"
          valor={x?.pld_menos_dessem ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Sem as duas médias da semana."
          nota="Diferença entre produtos diferentes no mesmo intervalo; não mede erro de nenhum deles."
        />
      </FaixaMetricas>

      <div className="space-y-3">
        <GraficoLinhas
          titulo={`CMO semanal do DECOMP, média do DESSEM e média do PLD por semana operativa, ${NOME_SM[sm]}`}
          dados={linhas}
          chaveX="fim"
          formatoX="data"
          series={[
            { id: "decomp", rotulo: "CMO semanal do DECOMP (ONS)", sigla: "DECOMP", cor: "var(--serie-referencia)", tracejada: true },
            { id: "dessem", rotulo: "Média do CMO do DESSEM na semana (ONS)", sigla: "DESSEM", cor: "var(--serie-hidraulica)" },
            { id: "pld", rotulo: "Média do PLD na semana (CCEE)", sigla: "PLD", cor: COR_SM[sm], espessura: 2.5 },
          ]}
          unidade="R$/MWh"
          casas={2}
          zeroNoEixo
          marcos={marcos}
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          legendaInterativa
        />
        <p className="text-xs leading-relaxed text-carvao-muted">
          Cada ponto é uma semana operativa, marcada pela sexta-feira que a encerra (a data que o ONS publica). Semana com meia hora ou hora ausente fica sem média, e a linha
          tem uma lacuna.
        </p>
        {avisoGrafico}
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {ref ? `Semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)} (sábado a sexta)` : "sem semana completa"}; gráfico com {num(linhas.length, 0)} semanas (
            {linhas.length ? `${dataBR(linhas[0].inicio)} a ${dataBR(linhas[linhas.length - 1].fim)}` : "sem semanas"})
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">Submercado {NOME_SM[sm]} (CCEE) e subsistema de mesmo nome (ONS); semana só com as 336 meias horas e as 168 horas</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">
            R$/MWh nominais<span data-nivel="analisar"> (a média semanal do DECOMP aparece como R$/MW no dicionário do ONS)</span>
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={`Tabela equivalente: semanas operativas de ${NOME_SM[sm]}`}
        colunas={COLUNAS_SEMANAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="fim"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-cmo-semanal-${sm}`}
        chaveUrl="sem"
        ordemInicial={{ coluna: "fim", direcao: "desc" }}
        nota="O histórico desde 2021, com os quatro submercados, está no CSV semanal (download no rodapé do painel)."
      />

      {notas}

      <SecaoDoPainel id="mesma-hora" titulo="Como o PLD e o CMO do DESSEM se comparam na mesma hora?" lead="Últimas 168 horas, um painel por submercado, na mesma escala.">
        {horario && horas.length ? (
          <PequenosMultiplos
            titulo="PLD horário e CMO do DESSEM na mesma hora, por submercado"
            dados={horas}
            chaveX="t"
            formatoX="hora"
            unidade="R$/MWh"
            casas={2}
            colunas={2}
            paineis={SUBMERCADOS.map((s) => ({
              id: s,
              titulo: NOME_SM[s],
              series: [
                { id: `pld_${s}`, rotulo: "PLD da hora", sigla: "PLD", cor: COR_SM[s], espessura: 2 },
                { id: `cmo_${s}`, rotulo: "CMO do DESSEM na hora (média das duas meias horas)", sigla: "DESSEM", cor: "var(--serie-hidraulica)", tracejada: true },
              ],
            }))}
          />
        ) : (
          <p className="text-sm text-carvao-muted">
            A janela das últimas 168 horas (pld_horario_recente.json) não está nesta publicação; o histórico horário completo está no CSV horário.
          </p>
        )}
        <p className="text-xs leading-relaxed text-carvao-muted">
          O CMO do DESSEM da hora é a média das meias horas que começam em h:00 e h:30; hora com meia hora ausente fica sem valor. O DESSEM do dia D é calculado em D-1, e o
          arquivo do ONS já traz o dia seguinte: a curva pode terminar depois do PLD.
        </p>
      </SecaoDoPainel>

      <SecaoDoPainel id="relacao-anual" titulo={`Em quantas horas de cada ano o PLD ficou entre os limites: ${NOME_SM[sm]}`}>
        <GraficoBarras
          titulo={`Horas de cada ano pela situação do PLD frente aos limites, ${NOME_SM[sm]}`}
          dados={situacoes}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "piso", rotulo: "no piso", cor: "var(--escala-seq-2)" },
            { id: "entre", rotulo: "entre os limites", cor: "var(--escala-seq-4)" },
            { id: "teto_estrutural_no_dia", rotulo: "em dia com média no teto estrutural", cor: "var(--serie-termica)" },
            { id: "teto_horario", rotulo: "no teto horário", cor: "var(--escala-div-neg-2)" },
          ]}
          unidade="horas"
          casas={0}
          empilhado
        />
        <p className="text-sm leading-relaxed text-carvao-muted">
          No piso e nos tetos, o PLD é o limite do ato, e a diferença para o CMO mede o limite, não a formação do preço. Por isso a tabela separa as horas entre os limites,
          onde as duas séries podem ser comparadas como produtos diferentes no mesmo intervalo.
        </p>
        <TabelaInterativa
          titulo={`Tabela equivalente: PLD menos CMO do DESSEM na mesma hora, por ano, ${NOME_SM[sm]}`}
          colunas={COLUNAS_RELACAO}
          linhas={relacao}
          chaveLinha="id"
          colunaRotulo="ano"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-relacao-cmo-${sm}`}
          chaveUrl="rel"
          nota="Horas sem CMO publicado ficam fora das diferenças; o ano marcado como parcial ainda está em curso."
        />
      </SecaoDoPainel>
    </div>
  );
}
