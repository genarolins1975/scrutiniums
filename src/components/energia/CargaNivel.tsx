"use client";

import { useMemo, type ReactNode } from "react";
import { CargaBase, CargaEscolha, CargaLista } from "@/components/energia/CargaControles";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  BASE_CURTA,
  COLUNAS_ACUMULADO,
  COLUNAS_ANUAL,
  COLUNAS_COMPARACAO,
  COLUNAS_MENSAL,
  COR_REGIAO,
  CURTO_REGIAO,
  DO_REGIAO,
  EXPLICACAO_BASE,
  JANELAS,
  NOME_REGIAO,
  REGIOES,
  ROTULO_TIPO,
  SUBSISTEMAS,
  TIPOS_COMPARACAO,
  linhaDaJanela,
  linhasAcumulado,
  linhasAnual,
  linhasComparacao,
  linhasMensal,
  listaTexto,
  marcosRegimes,
  paraTabela,
  respostaAcumulado,
  respostaNivel,
  serieComReferencia,
  textoCalendarioJanela,
  textoEventosJanela,
  textoJanelasIguais,
  textoMesCorrente,
  textoOutraBase,
  vereditoNivel,
  type SerieColunar,
  type TipoComparacao,
} from "@/lib/energia/carga";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR, num, sinal } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { JanelaId, P025, Regime } from "@/lib/energia/tipos-carga";

/**
 * P025, nível e crescimento: região, janela e base da comparação ficam na URL
 * (?sm=, ?jan=, ?cmp=), assim como o intervalo do gráfico diário (?de=, ?ate=) e as
 * regiões comparadas mês a mês (?sms=); busca, filtros, ordem e página de cada
 * tabela também (prefixos jan.t, mes.t, acum e ano.t). A faixa de métricas da abertura
 * (CargaMetricas), a resposta, os pontos pareados, a série diária, o calendário, a tabela
 * equivalente e a exportação leem as mesmas linhas (linhasComparacao) e as mesmas três
 * escolhas: trocar a base de "mesmos dias da semana" para "mesmas datas" muda todos eles
 * ao mesmo tempo. O padrão (SIN, 7 dias, mesmos dias da semana) não é gravado na URL.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(REGIOES), "SIN"),
  jan: campo(tiposUrl.opcao(JANELAS), "7d"),
  cmp: campo(tiposUrl.opcao(TIPOS_COMPARACAO), "equivalente"),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(REGIOES), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS]),
};

const OPCOES_REGIAO = REGIOES.map((sm) => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : NOME_REGIAO[sm], detalhe: NOME_REGIAO[sm] }));
const OPCOES_BASE = TIPOS_COMPARACAO.map((t) => ({
  id: t,
  rotulo: t === "equivalente" ? "Mesmos dias da semana" : "Mesmas datas",
  resumo: t === "equivalente" ? "52 semanas antes (364 dias)" : "mesma data do ano anterior",
  explicacao: EXPLICACAO_BASE[t],
}));

/**
 * Faixa de métricas da abertura: a carga média da janela escolhida, a média da janela de comparação e a variação, com a base da
 * comparação à mão. Lê da URL a mesma região, janela e base que o painel (por isso é cliente) e as linhas de linhasComparacao, as
 * mesmas do gráfico e da tabela: nenhum número é calculado aqui. A frase sob a faixa diz o que a outra base daria para a mesma
 * janela, para a página nunca abrir com duas taxas sem dizer que as bases são diferentes.
 */
export function CargaMetricas({
  comparacoes,
  evidencias,
}: {
  comparacoes: P025["comparacoes"];
  /** Fichas "Comprove este número" da variação do SIN em 7 dias, uma por base (a ficha só existe para esse recorte). */
  evidencias: { equivalente: Evidencia | null; mesmasDatas: Evidencia | null };
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Regiao;
  const tipo = v.cmp as TipoComparacao;
  const janela = v.jan as JanelaId;
  const j = comparacoes.janelas.find((x) => x.id === janela) ?? comparacoes.janelas[0];
  const l = linhaDaJanela({ comparacoes }, sm, j?.id ?? janela, tipo);
  const ficha = sm === "SIN" && j?.id === "7d" ? (tipo === "equivalente" ? evidencias.equivalente : evidencias.mesmasDatas) : null;
  const nomeJanela = j ? j.rotulo : "janela";
  const periodoAtual = l ? `${dataBR(l.inicio)} a ${dataBR(l.fim)}` : undefined;
  const periodoComparacao = l?.inicio_ant && l.fim_ant ? `${dataBR(l.inicio_ant)} a ${dataBR(l.fim_ant)}` : undefined;
  const semComparacao = "Sem comparação: falta dia aceito pela validação física numa das janelas, e a média não é calculada com dia ausente.";

  return (
    <FaixaMetricas colunas={4} rotulo="Carga média, janela de comparação e variação" nota={j ? textoOutraBase({ comparacoes }, sm, j.id, tipo) : undefined}>
      <Numero
        variante="faixa"
        rotulo={`Carga média ${DO_REGIAO[sm]}, ${nomeJanela}`}
        natureza="CALCULADO"
        valor={l?.media ?? null}
        formato="num"
        casas={0}
        unidade="MWmed"
        periodo={periodoAtual}
        cor={COR_REGIAO[sm]}
        motivoAusencia={semComparacao}
      />
      <Numero
        variante="faixa"
        rotulo={tipo === "equivalente" ? "Mesmos dias da semana, 52 semanas antes" : "Mesmas datas do ano anterior"}
        natureza="CALCULADO"
        valor={l?.media_ant ?? null}
        formato="num"
        casas={0}
        unidade="MWmed"
        periodo={periodoComparacao}
        cor="var(--serie-referencia)"
        motivoAusencia={semComparacao}
      />
      <Numero
        variante="faixa"
        rotulo="Variação da carga média sobre a janela de comparação"
        natureza="CALCULADO"
        valor={l?.variacao_pct ?? null}
        formato="variacao_pct"
        casas={2}
        periodo={BASE_CURTA[tipo]}
        evidencia={ficha}
        endereco={ficha ? (tipo === "equivalente" ? "/setor-eletrico/carga#p025" : "/setor-eletrico/carga#a07") : undefined}
        motivoAusencia={
          l?.media === null || l === null
            ? semComparacao
            : "A comparação está em outro regime metodológico do ONS, e por isso a diferença não é publicada como variação."
        }
      />
      <CargaBase legenda="Comparar com" opcoes={OPCOES_BASE} valor={tipo} onEscolher={(x) => definir({ cmp: x })} />
    </FaixaMetricas>
  );
}

export function CargaNivel({
  p025,
  serie,
  regimes,
  fonte,
  versao,
  notas,
  aposPrincipal,
  historia,
}: {
  p025: Pick<P025, "comparacoes" | "mensal" | "anual" | "acumulado_ano">;
  /** Série diária dos últimos três anos (carga.json), já validada no pipeline, em colunas. */
  serie: SerieColunar;
  regimes: (Regime & { observado_nos_dados?: string })[];
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Conteúdo depois da figura principal e das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
  /** Seção da série longa, com as mudanças de regime marcadas (montada no servidor), antes da comparação mês a mês. */
  historia?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const p = p025;
  const sm = v.sm as Regiao;
  const tipo = v.cmp as TipoComparacao;
  const janela = v.jan as JanelaId;
  const j = p.comparacoes.janelas.find((x) => x.id === janela) ?? p.comparacoes.janelas[0];
  const linhas = useMemo(() => linhasComparacao(p, sm, tipo), [p, sm, tipo]);
  const itens = linhas.map((l) => ({
    id: l.janela,
    rotulo: l.rotulo,
    valor: l.media,
    referencia: l.media_ant,
    detalhe:
      l.variacao_pct === null
        ? l.media === null
          ? "sem comparação: falta dia numa das janelas"
          : "sem variação: janelas em regimes diferentes do ONS"
        : `variação ${sinal(l.variacao_pct, 2)}%; ${dataBR(l.inicio)} a ${dataBR(l.fim)} contra ${dataBR(l.inicio_ant)} a ${dataBR(l.fim_ant)}`,
  }));
  const diaria = useMemo(() => serieComReferencia(serie, sm), [serie, sm]);
  const inicioSerie = serie.d[0] ?? "";
  const fimSerie = serie.d[serie.d.length - 1] ?? "";
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const marcosDiarios = [
    ...marcosRegimes(regimes, inicioSerie, fimSerie),
    ...(j && j.inicio >= inicioSerie ? [{ x: j.inicio, rotulo: `início da janela de ${j.rotulo}` }] : []),
  ];
  const mensal = useMemo(() => linhasMensal(p), [p]);
  const anual = useMemo(() => linhasAnual(p), [p]);
  // as mesmas linhas planas no gráfico de barras e na tabela equivalente
  const anualTabela = useMemo(() => paraTabela(anual), [anual]);
  const anosMisturados = anual.filter((a) => a.regimes.includes(" e ")).map((a) => a.ano);
  const escolhidas = (v.sms as Regiao[]).length ? (v.sms as Regiao[]) : [];
  const janelasIguais = textoJanelasIguais(p.comparacoes.janelas);
  const refChave = tipo === "equivalente" ? "ref364" : "refDatas";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p025" vivo veredito={vereditoNivel(p, sm, janela, tipo)}>
          {respostaNivel(p, sm, janela, tipo)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={sm} onEscolher={(x) => definir({ sm: x })} />
          <CargaLista
            rotulo="Janela"
            opcoes={p.comparacoes.janelas.map((x) => ({ id: x.id, rotulo: `${x.rotulo} (${dataBR(x.inicio)} a ${dataBR(x.fim)})` }))}
            valor={janela}
            onEscolher={(x) => definir({ jan: x })}
          />
        </div>
      </div>

      <GraficoPontos
        titulo={`Carga média ${DO_REGIAO[sm]} em cada janela e na janela de comparação (${BASE_CURTA[tipo]})`}
        itens={itens}
        unidade="MWmed"
        casas={0}
        rotuloValor="Média da janela"
        rotuloReferencia={tipo === "equivalente" ? "Mesmos dias da semana, 52 semanas antes" : "Mesmas datas do ano anterior"}
        corValor={COR_REGIAO[sm]}
        corReferencia="var(--serie-referencia)"
        selecionado={janela}
        onSelecionar={(id) => id && definir({ jan: id as JanelaId })}
      />
      {j && (
        <div data-calendario-janelas="" className="max-w-prose2 space-y-1 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
          <p className="rotulo text-mineral">Calendário das duas janelas</p>
          <p>
            {textoCalendarioJanela(j, tipo)} {textoEventosJanela(j, tipo)}
          </p>
          {janelasIguais && <p>{janelasIguais}</p>}
        </div>
      )}

      <GraficoLinhas
        titulo={`Carga diária ${DO_REGIAO[sm]} e ${tipo === "equivalente" ? "o mesmo dia da semana 52 semanas antes" : "a mesma data do ano anterior"}`}
        dados={diaria}
        chaveX="d"
        series={[
          { id: "atual", rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] },
          tipo === "equivalente"
            ? { id: refChave, rotulo: "Mesmo dia da semana, 364 dias antes", sigla: "364 dias antes", cor: "var(--serie-referencia)", tracejada: true }
            : { id: refChave, rotulo: "Mesma data do ano anterior", sigla: "ano anterior", cor: "var(--serie-referencia)", tracejada: true },
        ]}
        unidade="MWmed"
        casas={0}
        marcos={marcosDiarios}
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        legendaInterativa
      />

      <dl className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3" data-recorte-painel="">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {j ? `${dataBR(j.inicio)} a ${dataBR(j.fim)}` : "sem janela"}; comparação: {ROTULO_TIPO[tipo]}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {sm === "SIN" ? "SIN, soma dos quatro subsistemas no dia" : `Subsistema ${NOME_REGIAO[sm]}`}; dias aceitos pela validação física
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">MWmed (média diária de potência); variação em %</dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={`Tabela equivalente: janelas de ${NOME_REGIAO[sm]}, ${ROTULO_TIPO[tipo]}`}
        colunas={COLUNAS_COMPARACAO}
        linhas={paraTabela(linhas.map((l) => ({ ...l, id: l.janela })))}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`carga-comparacoes-${sm}-${tipo}`}
        chaveUrl="jan.t"
        selecionado={janela}
        onSelecionar={(id) => id && definir({ jan: id as JanelaId })}
        nota="Variação nula: janela incompleta ou em outro regime do ONS. A média nunca é calculada com dia ausente."
      />

      {notas}

      {aposPrincipal}

      {historia}

      <SecaoDoPainel
        id="mensal"
        titulo="Como cada mês se compara com o mesmo mês do ano anterior?"
        lead="Mês contra mês, sem ajuste de calendário: os meses comparados podem ter números diferentes de dias úteis, que estão na tabela."
      >
        <Comparador
          rotulo={`Regiões no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sinonimos: [CURTO_REGIAO[r]] }))}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ sms: ids as Regiao[] })}
          dicaBusca="Buscar, por exemplo SIN, Sul, Nordeste"
          vazio="Nenhuma região escolhida. Escolha até quatro para ver a variação mensal na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <GraficoLinhas
            titulo="Variação da carga média mensal contra o mesmo mês do ano anterior"
            dados={mensal}
            chaveX="m"
            formatoX="mes"
            series={escolhidas.map((r) => ({ id: `var_${r}`, rotulo: NOME_REGIAO[r], sigla: CURTO_REGIAO[r], cor: COR_REGIAO[r] }))}
            unidade="%"
            casas={2}
            zeroNoEixo
          />
        )}
        <p className="text-sm text-carvao-muted">
          A variação mensal não é ajustada por calendário. {textoMesCorrente(p.mensal, p.comparacoes.janelas)}
        </p>
        <TabelaInterativa
          titulo={`Tabela equivalente: carga média mensal e variação, últimos ${num(mensal.length, 0)} meses`}
          colunas={COLUNAS_MENSAL}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-mensal"
          chaveUrl="mes.t"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="anual"
        titulo="E no ano, a carga média muda?"
        lead="Média de cada ano e acumulado do ano até o último dia publicado, contra o mesmo período 52 semanas antes (mesmos dias da semana)."
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p025-acumulado">
          {respostaAcumulado(p.acumulado_ano, sm)}
        </p>
        <GraficoBarras
          titulo={`Carga média anual ${DO_REGIAO[sm]}`}
          dados={anualTabela}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: sm, rotulo: NOME_REGIAO[sm], cor: COR_REGIAO[sm] }]}
          unidade="MWmed"
          casas={0}
        />
        <p className="text-sm text-carvao-muted">
          Ano com menos dias que o calendário aparece com a contagem no rótulo. A variação anual só existe entre anos completos no mesmo regime do ONS
          {anosMisturados.length ? `; ${listaTexto(anosMisturados)} misturam regimes e não entram em variação` : ""}. Níveis de regimes diferentes não medem crescimento.
        </p>
        <TabelaInterativa
          titulo="Acumulado do ano por região"
          colunas={COLUNAS_ACUMULADO}
          linhas={paraTabela(linhasAcumulado(p.acumulado_ano))}
          chaveLinha="id"
          colunaRotulo="regiao"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-acumulado-ano"
          chaveUrl="acum"
          selecionado={sm}
          onSelecionar={(id) => id && definir({ sm: id as Regiao })}
        />
        <TabelaInterativa
          titulo="Tabela equivalente: carga média anual por região"
          colunas={COLUNAS_ANUAL}
          linhas={anualTabela}
          chaveLinha="id"
          colunaRotulo="ano"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-anual"
          chaveUrl="ano.t"
          ordemInicial={{ coluna: "ano", direcao: "desc" }}
        />
        <p className="text-xs text-carvao-muted">Médias de {num(anual.length, 0)} anos; a tabela traz as cinco regiões, o gráfico a região escolhida.</p>
      </SecaoDoPainel>
    </div>
  );
}
