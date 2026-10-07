"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { PldEscolha } from "@/components/energia/PldControles";
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
} from "@/lib/energia/pld";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoCmoPld } from "@/lib/energia/tipos-pld";

/**
 * P009, CMO e formação de preço: submercado (?sm=) e intervalo do gráfico semanal
 * (?de=, ?ate=) ficam na URL; busca, ordem e filtros das tabelas também (prefixos
 * sem e rel). A resposta, os números de destaque, o gráfico semanal e a tabela
 * equivalente leem as mesmas linhas (linhasSemanais); o painel horário mostra o PLD
 * e o CMO do DESSEM na MESMA hora para os quatro submercados, em pequenos múltiplos
 * na mesma escala (nunca dois eixos). Nenhuma diferença é calculada aqui: as da
 * semana de referência vêm prontas da gold, e as horárias por ano também.
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
}: {
  c: Pick<BlocoCmoPld, "semanal" | "semana_referencia" | "relacao_anual">;
  /** Últimas 168 horas (pld_horario_recente.json), só PLD e CMO; null quando o arquivo falta. */
  horario: HorarioCmo | null;
  marcos: { x: string; rotulo: string }[];
  fichas: Record<string, Evidencia>;
  fonte: string;
  versao: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Submercado;
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
      <PldEscolha legenda="Submercado" opcoes={OPCOES_SM} valor={sm} onEscolher={(s) => definir({ sm: s })} />

      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p009" aria-live="polite">
        {respostaP009(c as BlocoCmoPld, sm)}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
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
          <dd className="mt-0.5">R$/MWh nominais (a média semanal do DECOMP aparece como R$/MW no dicionário do ONS)</dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="CMO semanal do DECOMP"
          natureza="ESTIMADO"
          valor={x?.decomp ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={ref ? `semana de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}` : undefined}
          motivoAusencia="Sem semana operativa completa com os três produtos."
          tamanho="medio"
          cor={COR_SM[sm]}
          nota="Valor do modelo para a semana inteira, como publicado pelo ONS."
        />
        <Numero
          rotulo="Média do CMO do DESSEM na semana"
          natureza="CALCULADO"
          evidencia={fichas[`dessem_semana_${sm}`] ?? null}
          valor={x?.dessem ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Semana sem as 336 meias horas publicadas."
          tamanho="medio"
          cor={COR_SM[sm]}
          endereco={endereco}
        />
        <Numero
          rotulo="Média do PLD na semana"
          natureza="CALCULADO"
          evidencia={fichas[`pld_semana_${sm}`] ?? null}
          valor={x?.pld ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Semana sem as 168 horas publicadas."
          tamanho="medio"
          cor={COR_SM[sm]}
          endereco={endereco}
        />
        <Numero
          rotulo="PLD médio menos a média do DESSEM, mesma semana"
          natureza="CALCULADO"
          valor={x?.pld_menos_dessem ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Sem as duas médias da semana."
          tamanho="medio"
          nota="Diferença entre produtos diferentes no mesmo intervalo; não mede erro de nenhum deles."
        />
      </div>

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

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">PLD e CMO do DESSEM na mesma hora, últimas 168 horas</h3>
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
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Relação na mesma hora, por ano: {NOME_SM[sm]}</h3>
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
      </div>
    </div>
  );
}
