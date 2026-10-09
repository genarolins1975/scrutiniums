"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RedeEscolha } from "@/components/energia/RedeControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR, num, plural } from "@/lib/energia/formato";
import {
  COLUNAS_MAIORES_DESVIOS,
  COLUNAS_PROGRAMA_REPETIDO,
  COLUNAS_PROGRAMADO_DIARIO,
  COR_PAR,
  LIMIAR_NULO_MWMED,
  PARES_PROGRAMADO,
  avisoMesIncompleto,
  colunasProgramadoMensal,
  curtoPar,
  colunasDistribuicao,
  ehFronteira,
  linhasDistribuicao,
  linhasMaioresDesvios,
  linhasMateriaisMensal,
  linhasProgramaRepetido,
  linhasProgramadoDiario,
  linhasProgramadoMensal,
  medidasProgramado,
  nomePar,
  paraTabela,
  respostaProgramado,
  semCaminhosInternos,
  sentidoPositivo,
  textoProgramaRepetido,
  vereditoProgramado,
  type BaseDesvio,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { ParProgramado, ProgramadoRede } from "@/lib/energia/tipos-rede";

/**
 * P031, programado e verificado. O recorte fica na URL: fronteira ou país (?par=),
 * base da distribuição (?base=com|sem, com ou sem os dias rotulados por programa
 * repetido) e pares comparados mês a mês (?pares=, até quatro); busca, ordem, filtros
 * e página de cada tabela também (prefixos dist, d30.p, md, mm, mp.t, rep). Escolher um
 * par na faixa ou na tabela muda a resposta, a ficha de prova, a série diária e a mensal
 * juntas. Desvio é diferença entre medida e programa, nunca chamado de falha.
 */
const BASES = ["com", "sem"] as const;
const ESQUEMA = {
  par: campo(tiposUrl.opcao(PARES_PROGRAMADO), "N_NE"),
  base: campo(tiposUrl.opcao(BASES), "com"),
  pares: campo(tiposUrl.lista(tiposUrl.opcao(PARES_PROGRAMADO), { max: LIMITE_COMPARACAO }), ["N_NE", "N_SE", "NE_SE", "S_SE"] as ParProgramado[]),
};

const OPCOES_PAR = PARES_PROGRAMADO.map((p) => ({ id: p, rotulo: curtoPar(p), detalhe: nomePar(p) }));
const OPCOES_BASE = [
  { id: "com" as const, rotulo: "Todos os dias", detalhe: "Distribuição com todos os dias comparados" },
  { id: "sem" as const, rotulo: "Sem dias rotulados", detalhe: "Distribuição sem os dias de programa repetido" },
];

/**
 * Faixa de métricas da abertura: o desvio absoluto médio e a mediana, as horas com desvio material e as horas no sentido oposto ao
 * programa, para a fronteira ou o país e a base escolhidos. Lê da URL o mesmo par e a mesma base que o painel (por isso é cliente) e as
 * linhas da distribuição (medidasProgramado), as mesmas da resposta, da faixa de desvios e da tabela: nenhum número é calculado aqui.
 * Desvio é a diferença entre o verificado e o programado, nunca chamado de falha.
 */
export function RedeProgramadoMetricas({
  programado,
  evidencias,
}: {
  programado: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "inicio" | "fim">;
  /** Fichas de prova do desvio absoluto médio por par (chave desvio_medio.<par>); a ficha prova a base com todos os dias. */
  evidencias: Record<string, Evidencia>;
}) {
  const [v] = useEstadoUrl(ESQUEMA);
  const par = v.par as ParProgramado;
  const base = v.base as BaseDesvio;
  const m = medidasProgramado(programado, par, base);
  const ficha = base === "com" ? (evidencias[`desvio_medio.${par}`] ?? null) : null;
  const periodo = m ? `${dataBR(m.inicio)} a ${dataBR(m.fim)}` : `${dataBR(programado.inicio)} a ${dataBR(programado.fim)}`;
  const semHoras = "Sem horas com programado e verificado comparáveis nesta publicação.";
  const deHoras = m ? `De ${num(m.horas, 0)} horas comparadas.` : undefined;
  return (
    <FaixaMetricas
      colunas={4}
      rotulo="Desvio do fluxo verificado em relação ao programado"
      nota={`Desvio é a diferença entre o verificado e o programado na mesma hora; a fonte não informa o motivo.${base === "sem" ? " Base sem os dias rotulados por programa repetido: a ficha de prova cobre só a base com todos os dias." : ""}`}
    >
      <Numero
        variante="faixa"
        rotulo={`Desvio absoluto médio por hora, ${m?.nome ?? nomePar(par)}`}
        natureza="CALCULADO"
        valor={ficha ? undefined : (m?.desvio_abs_medio_mwmed ?? null)}
        evidencia={ficha}
        // mesmas casas do valor exibido na ficha de prova (a gold publica o desvio médio inteiro)
        casas={0}
        unidade="MWmed"
        periodo={periodo}
        cor={COR_PAR[par]}
        nota={m ? `${deHoras}${m.dias_excluidos ? ` Sem ${plural(m.dias_excluidos, "dia rotulado", "dias rotulados")}.` : ""}` : undefined}
        motivoAusencia={semHoras}
        endereco="/setor-eletrico/rede/programado#p031"
      />
      <Numero
        variante="faixa"
        rotulo="Mediana do desvio absoluto por hora"
        natureza="CALCULADO"
        valor={m?.p50_abs_mwmed ?? null}
        formato="num"
        casas={1}
        unidade="MWmed"
        periodo={periodo}
        cor="var(--serie-referencia)"
        nota="Metade das horas teve desvio absoluto menor ou igual a este valor."
        motivoAusencia={semHoras}
      />
      <Numero
        variante="faixa"
        rotulo={`Horas com desvio de ${num(programado.limiar_material_mwmed, 0)} MWmed ou mais`}
        natureza="CALCULADO"
        valor={m?.horas_materiais ?? null}
        formato="num"
        casas={0}
        unidade="horas"
        periodo={periodo}
        cor="var(--serie-5)"
        nota={deHoras}
        motivoAusencia={semHoras}
      />
      <Numero
        variante="faixa"
        rotulo="Horas com o fluxo no sentido oposto ao programado"
        natureza="CALCULADO"
        valor={m?.horas_inversao ?? null}
        formato="num"
        casas={0}
        unidade="horas"
        periodo={periodo}
        cor="var(--serie-3)"
        nota={m ? `Verificado e programado com sinais contrários, os dois acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed. ${deHoras}` : undefined}
        motivoAusencia={semHoras}
      />
    </FaixaMetricas>
  );
}

export function RedeProgramado({
  programado,
  evidencias,
  fonte,
  versao,
  regraMaterialidade,
  notas,
  aposPrincipal,
}: {
  /** Regra de materialidade publicada na gold (limiar, sensibilidade e o que o desvio não é). */
  regraMaterialidade: string;
  programado: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "limiares_sensibilidade_mwmed" | "programa_repetido" | "diario" | "mensal" | "maiores_desvios" | "maiores_desvios_fora_dos_dias_rotulados" | "inicio" | "fim" | "justificativa_limiar">;
  /** Fichas de prova do desvio absoluto médio por par (chave desvio_medio.<par>). */
  evidencias: Record<string, Evidencia>;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
}) {
  const p = programado;
  const justificativaLimiar = p.justificativa_limiar;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const par = v.par as ParProgramado;
  const base = v.base as BaseDesvio;
  const escolhidos = v.pares as ParProgramado[];
  const dist = useMemo(() => linhasDistribuicao(p, base), [p, base]);
  const diario = useMemo(() => linhasProgramadoDiario(p, par), [p, par]);
  const mensal = useMemo(() => linhasProgramadoMensal(p, par), [p, par]);
  const materiais = useMemo(() => linhasMateriaisMensal(p, escolhidos), [p, escolhidos]);
  const maiores = useMemo(() => linhasMaioresDesvios(base === "sem" ? p.maiores_desvios_fora_dos_dias_rotulados : p.maiores_desvios), [p, base]);
  const repetido = useMemo(() => linhasProgramaRepetido(p), [p]);
  const selecionar = (id: string | null) => id && (PARES_PROGRAMADO as readonly string[]).includes(id) && definir({ par: id as ParProgramado });
  // aviso só quando as horas comparadas do último mês ficam abaixo das do calendário
  const avisoUltimoMes = avisoMesIncompleto(p.mensal.meses.at(-1), p.mensal.por_par[par]?.horas.at(-1));

  return (
    <div className="space-y-6">
      <div className="grid gap-y-4">
        <RespostaCurta id="p031" vivo veredito={vereditoProgramado(p, par, base)}>
          {respostaProgramado(p, par, base)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <RedeEscolha legenda="Fronteira ou país" opcoes={OPCOES_PAR} valor={par} onEscolher={(x) => definir({ par: x })} />
          <RedeEscolha legenda="Base" opcoes={OPCOES_BASE} valor={base} onEscolher={(x) => definir({ base: x })} />
        </div>
      </div>

      <GraficoBarras
        titulo={`Faixa dos desvios absolutos por hora, ${base === "sem" ? "sem os dias rotulados" : "todos os dias"}`}
        dados={paraTabela(dist)}
        chaveCategoria="id"
        chaveRotulo="par"
        series={[
          { id: "p50_abs_mwmed", rotulo: "Mediana", cor: "var(--escala-seq-2)" },
          { id: "p90_abs_mwmed", rotulo: "Percentil 90", cor: "var(--escala-seq-3)" },
          { id: "p99_abs_mwmed", rotulo: "Percentil 99", cor: "var(--escala-seq-4)" },
          { id: "max_abs_mwmed", rotulo: "Maior", cor: "var(--escala-seq-5)" },
        ]}
        unidade="MWmed"
        casas={0}
        orientacao="horizontal"
        referencias={[{ valor: p.limiar_material_mwmed, rotulo: "limiar material" }]}
        selecionado={par}
        onSelecionar={selecionar}
      />
      <TabelaInterativa
        titulo={`Tabela equivalente: distribuição dos desvios por fronteira e país, ${base === "sem" ? "sem os dias rotulados" : "todos os dias"}`}
        colunas={colunasDistribuicao(p)}
        linhas={paraTabela(dist)}
        chaveLinha="id"
        colunaRotulo="par"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`rede-desvios-distribuicao-${base}`}
        chaveUrl="dist"
        selecionado={par}
        onSelecionar={selecionar}
        nota={`Viés positivo: o verificado ficou, em média, mais no sentido positivo do par do que o programa. Sentido oposto: programa e verificado com sinais contrários, os dois acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed.`}
      />

      <div className="max-w-prose2 space-y-2 text-sm leading-relaxed text-carvao-muted">
        <p>{semCaminhosInternos(regraMaterialidade)}</p>
        {justificativaLimiar && <p>{justificativaLimiar}</p>}
      </div>

      <GraficoLinhas
        titulo={`Saldo programado e verificado por dia, ${nomePar(par)}`}
        dados={diario}
        chaveX="d"
        formatoX="data"
        series={[
          { id: "verificado_mwh", rotulo: "Verificado", cor: COR_PAR[par] },
          { id: "programado_mwh", rotulo: "Programado", cor: "var(--serie-referencia)", tracejada: true },
        ]}
        unidade="MWh"
        casas={0}
        zeroNoEixo
        legendaInterativa
      />
      <TabelaInterativa
        titulo={`Tabela equivalente: ${nomePar(par)} por dia`}
        colunas={COLUNAS_PROGRAMADO_DIARIO}
        linhas={paraTabela(diario)}
        chaveLinha="id"
        colunaRotulo="d"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`rede-programado-diario-${par}`}
        chaveUrl="d30.p"
        ordemInicial={{ coluna: "d", direcao: "desc" }}
        nota="Saldos do dia somados com sinal; a soma dos desvios absolutos usa o módulo de cada hora e por isso pode ser maior que a diferença entre os saldos."
      />

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {dataBR(p.inicio)} a {dataBR(p.fim)}, hora a hora (a fonte não publica programado antes de {dataBR(p.inicio)}); série diária dos últimos {p.diario.dias.length} dias
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {nomePar(par)}
            {ehFronteira(par) ? `; positivo ${sentidoPositivo(par)}` : "; positivo é exportação do Brasil"}
            {base === "sem" ? "; sem os dias rotulados por programa repetido" : "; todos os dias comparados"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">MWmed por hora (desvio = verificado − programado); MWh nas somas diárias e mensais</dd>
        </div>
      </dl>

      {notas}

      {aposPrincipal}

      <SecaoDoPainel
        id="maiores-desvios"
        titulo={`Quais foram as horas de maior desvio${base === "sem" ? ", fora dos dias rotulados" : ""}?`}
        lead={`São as ${maiores.length} horas em que o fluxo medido mais se afastou do programado, cada uma com o programado, o verificado e o desvio.`}
      >
        <TabelaInterativa
          titulo={`Os ${maiores.length} maiores desvios absolutos${base === "sem" ? " fora dos dias rotulados" : ""}`}
          colunas={COLUNAS_MAIORES_DESVIOS}
          linhas={paraTabela(maiores)}
          chaveLinha="id"
          colunaRotulo="hora"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-maiores-desvios-${base}`}
          chaveUrl="md"
          nota="Cada linha diz se a hora é de dia rotulado por programa repetido; nos países a regra não rotula dias (não se aplica). Troque a base para ver a lista sem esses dias."
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="mes-a-mes"
        titulo="Em quantas horas por mês o desvio foi material?"
        lead={`Horas com desvio de ${num(p.limiar_material_mwmed, 0)} MWmed ou mais, por mês, para até quatro fronteiras ou países na mesma escala.`}
      >
        <Comparador
          rotulo={`Pares no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={PARES_PROGRAMADO.map((x) => ({ id: x, rotulo: nomePar(x), sinonimos: [curtoPar(x)] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ pares: ids as ParProgramado[] })}
          dicaBusca="Buscar, por exemplo Norte, Sul, Argentina"
          vazio="Nenhum par escolhido. Escolha até quatro para ver as horas materiais na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && (
          <>
            <GraficoLinhas
              titulo={`Horas com desvio de ${num(p.limiar_material_mwmed, 0)} MWmed ou mais, por mês`}
              dados={materiais}
              chaveX="m"
              formatoX="mes"
              series={escolhidos.map((x) => ({ id: x, rotulo: nomePar(x), sigla: curtoPar(x), cor: COR_PAR[x] }))}
              unidade="horas"
              casas={0}
              zeroNoEixo
            />
            <TabelaInterativa
              titulo="Tabela equivalente: horas materiais por mês"
              colunas={[{ id: "m", rotulo: "Mês", tipo: "data" as const }, ...escolhidos.map((x) => ({ id: x, rotulo: nomePar(x), tipo: "numero" as const, unidade: "horas", casas: 0 }))]}
              linhas={paraTabela(materiais)}
              chaveLinha="id"
              colunaRotulo="m"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-horas-materiais-${escolhidos.join("-")}`}
              chaveUrl="mm"
              ordemInicial={{ coluna: "m", direcao: "desc" }}
            />
          </>
        )}
        {avisoUltimoMes && <p className="text-sm text-carvao-muted">{avisoUltimoMes}</p>}
        <TabelaInterativa
          titulo={`Tabela por mês: ${nomePar(par)}`}
          colunas={colunasProgramadoMensal(par)}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-programado-mensal-${par}`}
          chaveUrl="mp.t"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="programa-repetido" nivel="analisar" titulo="Programa repetido: dias rotulados">
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p031-repetido" data-resposta-depois="">
          {textoProgramaRepetido(p)}
        </p>
        <p className="text-sm text-carvao-muted">{p.programa_repetido.regra}</p>
        <TabelaInterativa
          titulo="Dias rotulados, por fronteira"
          colunas={COLUNAS_PROGRAMA_REPETIDO}
          linhas={paraTabela(repetido)}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte={fonte}
          versao={versao}
          nomeArquivo="rede-programa-repetido"
          chaveUrl="rep"
          semLinhas="Nenhum dia rotulado por programa repetido."
        />
      </SecaoDoPainel>
    </div>
  );
}
