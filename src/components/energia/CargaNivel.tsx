"use client";

import { useMemo, type ReactNode } from "react";
import { CargaEscolha, CargaLista } from "@/components/energia/CargaControles";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_ACUMULADO,
  COLUNAS_ANUAL,
  COLUNAS_COMPARACAO,
  COLUNAS_MENSAL,
  COR_REGIAO,
  CURTO_REGIAO,
  DO_REGIAO,
  JANELAS,
  NOME_REGIAO,
  REGIOES,
  ROTULO_TIPO,
  SUBSISTEMAS,
  TIPOS_COMPARACAO,
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
  textoClasses,
  type SerieColunar,
  type TipoComparacao,
} from "@/lib/energia/carga";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, num, sinal } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { JanelaId, P025, Regime } from "@/lib/energia/tipos-carga";

/**
 * P025, nível e crescimento: região, janela e tipo de comparação ficam na URL
 * (?sm=, ?jan=, ?cmp=), assim como o intervalo do gráfico diário (?de=, ?ate=) e as
 * regiões comparadas mês a mês (?sms=). A resposta, os pontos pareados e a tabela
 * equivalente usam as mesmas linhas (linhasComparacao), e a resposta é refeita pela
 * mesma regra quando o recorte muda. O padrão (SIN, 7 dias, mesmos dias da semana)
 * não é gravado na URL.
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
const OPCOES_TIPO = TIPOS_COMPARACAO.map((t) => ({ id: t, rotulo: t === "equivalente" ? "Mesmos dias da semana" : "Mesmas datas", detalhe: ROTULO_TIPO[t] }));

export function CargaNivel({
  p025,
  serie,
  regimes,
  fonte,
  versao,
  destaques,
}: {
  p025: Pick<P025, "comparacoes" | "mensal" | "anual" | "acumulado_ano">;
  /** Série diária dos últimos três anos (carga.json), já validada no pipeline, em colunas. */
  serie: SerieColunar;
  regimes: (Regime & { observado_nos_dados?: string })[];
  fonte: string;
  versao: string;
  /** Números de destaque com a prova (montados no servidor). */
  destaques?: ReactNode;
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
        : `variação ${sinal(l.variacao_pct, 1)}%; ${dataBR(l.inicio)} a ${dataBR(l.fim)} contra ${dataBR(l.inicio_ant)} a ${dataBR(l.fim_ant)}`,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <CargaEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={sm} onEscolher={(x) => definir({ sm: x })} />
        <CargaLista
          rotulo="Janela"
          opcoes={p.comparacoes.janelas.map((x) => ({ id: x.id, rotulo: `${x.rotulo} (${dataBR(x.inicio)} a ${dataBR(x.fim)})` }))}
          valor={janela}
          onEscolher={(x) => definir({ jan: x })}
        />
        <CargaEscolha legenda="Comparar com" opcoes={OPCOES_TIPO} valor={tipo} onEscolher={(x) => definir({ cmp: x })} />
      </div>

      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p025" aria-live="polite">
        {respostaNivel(p, sm, janela, tipo)}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {j ? `${dataBR(j.inicio)} a ${dataBR(j.fim)}` : "sem janela"}; comparação com as {ROTULO_TIPO[tipo]}
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

      {destaques}

      <GraficoPontos
        titulo={`Carga média ${DO_REGIAO[sm]} em cada janela e na janela de comparação`}
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
        <p className="text-sm text-carvao-muted">
          Composição de calendário de {j.rotulo}: {textoClasses(j.classes)}
          {j.eventos.length ? `; eventos: ${listaTexto(j.eventos.map(([d, nome]) => `${nome} (${dataBR(d)})`))}` : "; nenhum feriado nem ponto facultativo"}.
        </p>
      )}
      <TabelaInterativa
        titulo={`Tabela equivalente: janelas de ${NOME_REGIAO[sm]}, ${ROTULO_TIPO[tipo]}`}
        colunas={COLUNAS_COMPARACAO}
        linhas={paraTabela(linhas.map((l) => ({ ...l, id: l.janela })))}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`carga-comparacoes-${sm}-${tipo}`}
        selecionado={janela}
        onSelecionar={(id) => id && definir({ jan: id as JanelaId })}
        nota="Variação nula: janela incompleta ou em outro regime do ONS. A média nunca é calculada com dia ausente."
      />

      <GraficoLinhas
        titulo={`Carga diária ${DO_REGIAO[sm]} e o mesmo dia da semana 52 semanas antes`}
        dados={diaria}
        chaveX="d"
        series={[
          { id: "atual", rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] },
          { id: "ref364", rotulo: "Mesmo dia da semana, 364 dias antes", sigla: "364 dias antes", cor: "var(--serie-referencia)", tracejada: true },
        ]}
        unidade="MWmed"
        casas={0}
        marcos={marcosDiarios}
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        legendaInterativa
      />

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Mês a mês: variação contra o mesmo mês do ano anterior</h3>
        <Comparador
          rotulo={`Regiões no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sinonimos: [CURTO_REGIAO[r]] }))}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ sms: ids as Regiao[] })}
          dicaBusca="SIN, Sul, Nordeste"
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
            casas={1}
            zeroNoEixo
          />
        )}
        <p className="text-sm text-carvao-muted">
          Os meses comparados podem ter números diferentes de dias úteis (colunas da tabela); a variação mensal não é ajustada por calendário. O mês corrente é parcial e
          compara os mesmos dias do mês.
        </p>
        <TabelaInterativa
          titulo="Tabela equivalente: carga média mensal e variação, últimos 36 meses"
          colunas={COLUNAS_MENSAL}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-mensal-36-meses"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Ano a ano e acumulado do ano</h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p025-acumulado">
          {respostaAcumulado(p.acumulado_ano, sm)}
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
          selecionado={sm}
          onSelecionar={(id) => id && definir({ sm: id as Regiao })}
        />
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
          titulo="Tabela equivalente: carga média anual por região"
          colunas={COLUNAS_ANUAL}
          linhas={anualTabela}
          chaveLinha="id"
          colunaRotulo="ano"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-anual"
          ordemInicial={{ coluna: "ano", direcao: "desc" }}
        />
        <p className="text-xs text-carvao-muted">Médias de {num(anual.length, 0)} anos; a tabela traz as cinco regiões, o gráfico a região escolhida.</p>
      </div>
    </div>
  );
}
