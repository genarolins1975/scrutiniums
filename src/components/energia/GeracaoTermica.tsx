"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GeracaoAviso, GeracaoEscolha, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Nome } from "@/components/i18n/Nome";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import {
  COMBUSTIVEIS,
  COR_COMBUSTIVEL,
  COR_COMPARACAO,
  COR_MOTIVO,
  JANELAS_TERMICA,
  colunasCombustivelMotivo,
  colunasParcelas,
  colunasTermicaMensal,
  colunasUsinasTermicas,
  combustiveisComSerie,
  curtoCombustivel,
  curtoMotivo,
  glosaMotivo,
  linhasCombustivelMensal,
  linhasCombustivelMotivo,
  linhasMotivosUsinas,
  linhasParcelas,
  linhasTermicaMensal,
  linhasUsinasTermicas,
  maioresUsinasTermicas,
  minusculaPalavras,
  motivoPrincipal,
  mwmed,
  paraTabela,
  respostaTermica,
  rotuloOrigemCombustivel,
  usinasPadraoComparacao,
  usinaTermicaEscolhida,
  vereditoTermica,
  type TermicaCliente,
} from "@/lib/energia/geracao";
import { nomesNo, rotuloGoldNo } from "@/lib/energia/i18n/geracao";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { CategoriaCombustivel } from "@/lib/energia/tipos-geracao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P022, despacho térmico. O recorte fica na URL: usina escolhida (?us=), usinas comparadas
 * (?cmp=, até quatro), combustíveis comparados na série mensal (?cb=, até quatro) e o
 * alcance da série por motivo (?jt=, 24 meses ou desde 2019); busca, ordem e filtros de cada
 * tabela também (prefixos cm, tm, us, pc, mu, cbm). Escolher uma usina na tabela leva a
 * mesma usina à ficha de motivos e parcelas.
 *
 * Combustível e motivo são dimensões separadas: as barras empilham motivos dentro de cada
 * combustível, e a soma dos motivos de cada barra fecha com a geração verificada do
 * combustível, a menos da parcela "não classificada" publicada na tabela. Nada é inferido
 * do preço.
 *
 * Ordem da página: o veredito, a figura principal (combustível por motivo) com a legenda dos motivos e do recorte, a
 * tabela equivalente e as notas do painel (`notas`); depois seções visíveis com pergunta própria (o motivo mês a mês e
 * as usinas) e, em Analisar, o combustível mês a mês. As medidas de abertura (12 meses) ficam na faixa de métricas da página.
 */
const ESQUEMA = {
  us: campo(tiposUrl.texto({ max: 40 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 40 }), { max: LIMITE_COMPARACAO }), [] as string[]),
  cb: campo(tiposUrl.lista(tiposUrl.opcao(COMBUSTIVEIS), { max: LIMITE_COMPARACAO }), [] as CategoriaCombustivel[]),
  jt: campo(tiposUrl.opcao(JANELAS_TERMICA), "24m"),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

export function GeracaoTermica({
  termica,
  fonte,
  versao,
  notas,
  notasUniverso,
  contextoSemana,
}: {
  /** A gold da térmica sem as partes que só a auditoria usa (CVU, universo, identidade), montadas no servidor. */
  termica: TermicaCliente;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Notas de universo e de método que valem para a figura principal (não classificado, combustível, universo que cresce, ponte com a matriz), sob o recorte. */
  notasUniverso?: ReactNode;
  /** A participação térmica dos 7 dias em contexto (seção montada no servidor com a gold de operação), entre a série mensal e as usinas. */
  contextoSemana?: ReactNode;
}) {
  const t = termica;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { mesAno, num } = formatos(idioma);
  const CURTO_COMBUSTIVEL = curtoCombustivel(idioma);
  const CURTO_MOTIVO = curtoMotivo(idioma);
  const GLOSA_MOTIVO = glosaMotivo(idioma);
  const UNIDADE = mwmed(idioma);
  const SIM = tx("sim", "yes");
  const OPCOES_JANELA = [
    { id: "24m" as const, rotulo: tx("24 meses mais recentes", "Latest 24 months") },
    { id: "tudo" as const, rotulo: tx("Desde 2019", "Since 2019") },
  ];
  const u = t.ultimos_12m;
  const cruzado = useMemo(() => linhasCombustivelMotivo(t, idioma), [t, idioma]);
  const cruzadoLinhas = cruzado.linhas;
  const mensalEscolhido = useMemo(() => linhasTermicaMensal(t, v.jt, idioma), [t, v.jt, idioma]);
  const mensal = mensalEscolhido.linhas;
  const ultimoMensal = mensal[mensal.length - 1];
  const usinas = useMemo(() => linhasUsinasTermicas(t, idioma), [t, idioma]);
  const usina = usinaTermicaEscolhida(t, v.us);
  const sel = usina && usinas.some((l) => l.id === usina.id) ? usina.id : null;
  const selecionar = (id: string | null) => definir({ us: id ?? "" });
  const parcelas = usina ? linhasParcelas(usina) : [];

  const conhecidas = new Set(t.usinas_12m.map((x) => x.id));
  const comparadas = (v.cmp as string[]).filter((id) => conhecidas.has(id));
  // sem escolha na tabela nem no comparador, a comparação abre com a maior usina de cada um de três combustíveis
  const padrao = useMemo(() => usinasPadraoComparacao(t.usinas_12m, 3), [t]);
  const comparacaoPadrao = comparadas.length === 0 && !v.us;
  const idsComparados = comparadas.length ? comparadas : comparacaoPadrao ? padrao.map((x) => x.id) : usina ? [usina.id] : [];
  const usinasComparadas = idsComparados.map((id) => t.usinas_12m.find((x) => x.id === id)!).filter(Boolean);
  const maiores = useMemo(() => maioresUsinasTermicas(t.usinas_12m, 10), [t]);
  const motivosUsinas = linhasMotivosUsinas(usinasComparadas, idioma);

  const comSerie = combustiveisComSerie(t);
  const cbs = (v.cb as CategoriaCombustivel[]).filter((c) => comSerie.includes(c));
  const noHistorico: CategoriaCombustivel[] = cbs.length ? cbs : comSerie.slice(0, 3);
  const chaveHistorico = noHistorico.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista é recriada a cada render; a chave textual estabiliza
  const combustivelMensal = useMemo(() => linhasCombustivelMensal(t, noHistorico), [t, chaveHistorico]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;

  const motivosNoGrafico = t.motivos.filter((m) => cruzado.motivos.includes(m.id));
  const periodo12 = tx(`${mesAno(u.inicio)} a ${mesAno(u.fim)}`, `${mesAno(u.inicio)} to ${mesAno(u.fim)}`);
  const nomeUsina = usina ? (usina.nome ?? usina.id) : "";
  const nomesComparadas = usinasComparadas.map((x) => x.nome ?? x.id).join(", ");
  const nomesCombustiveis = noHistorico.map((c) => CURTO_COMBUSTIVEL[c]).join(", ");
  const origens = Object.values(rotuloOrigemCombustivel(idioma)).slice(0, 3).join("; ");
  const cvuComparadas = usinasComparadas
    .map((x) =>
      tx(
        `${x.nome ?? x.id}, ${x.cvu_semana_vigente === null ? "um valor por parcela (tabela de parcelas)" : `${num(x.cvu_semana_vigente, 2)} R$/MWh`}`,
        `${x.nome ?? x.id}, ${x.cvu_semana_vigente === null ? "one value per portion (portions table)" : `${num(x.cvu_semana_vigente, 2)} R$/MWh`}`,
      ),
    )
    .join("; ");
  // em inglês, a mesma lista com cada nome de usina marcado como nome próprio
  const cvuComparadasEn = usinasComparadas.map((x, i) => (
    <Fragment key={x.id}>
      {i > 0 ? "; " : ""}
      <Nome>{x.nome ?? x.id}</Nome>, {x.cvu_semana_vigente === null ? "one value per portion (portions table)" : `${num(x.cvu_semana_vigente, 2)} R$/MWh`}
    </Fragment>
  ));
  const nomesComparadasNo = nomesNo(usinasComparadas.map((x) => x.nome ?? x.id), idioma);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <RespostaCurta id="p022" veredito={vereditoTermica(t, idioma) || respostaTermica(t, idioma)}>
          {respostaTermica(t, idioma)}
        </RespostaCurta>
        <div className="space-y-4">
          <GraficoBarras
            titulo={tx(`Geração térmica por combustível e motivo de despacho, ${periodo12}`, `Thermal generation by fuel and dispatch reason, ${periodo12}`)}
            dados={paraTabela(cruzadoLinhas, idioma)}
            chaveCategoria="id"
            chaveRotulo="combustivel"
            series={cruzado.motivos.map((m) => ({ id: m, rotulo: CURTO_MOTIVO[m], cor: COR_MOTIVO[m] }))}
            unidade="GWh"
            casas={0}
            orientacao="horizontal"
            empilhado
            rotulosValor
          />
          <div data-motivos="rotulos" className="space-y-1">
            <p className="rotulo text-mineral">{tx("O que cada motivo quer dizer, com o rótulo da base publicada", "What each reason means, with the label from the published dataset")}</p>
            <p className="text-xs leading-relaxed text-carvao-muted">
              {tx(
                "Térmica despachada é a que o ONS manda gerar na programação da operação; o motivo é a classificação que o ONS publica para essa geração.",
                "A dispatched thermal plant is one the ONS orders to generate in the operation schedule; the reason is the classification the ONS publishes for that generation.",
              )}
            </p>
            <ul className="grid gap-x-8 gap-y-1.5 text-sm leading-snug text-carvao-muted sm:grid-cols-2">
              {motivosNoGrafico.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[0.4em] inline-block h-2 w-2 shrink-0" style={{ background: COR_MOTIVO[m.id] }} />
                  <span>
                    <span className="text-carvao">{rotuloGoldNo(m.rotulo, idioma, "geracao-motivo-rotulo")}</span>
                    <span className="block text-xs">{GLOSA_MOTIVO[m.id]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <GeracaoRecorte
        periodo={tx(
          `${mesAno(u.inicio)} a ${mesAno(u.fim)} (12 meses completos, ${num(u.horas, 0)} horas); série mensal desde ${mesAno(t.primeiro_mes_na_gold)} e no arquivo desde ${mesAno(t.primeiro_mes)}`,
          `${mesAno(u.inicio)} to ${mesAno(u.fim)} (12 complete months, ${num(u.horas, 0)} hours); monthly series since ${mesAno(t.primeiro_mes_na_gold)}, and in the file since ${mesAno(t.primeiro_mes)}`,
        )}
        universo={tx(
          <>
            Usinas térmicas despachadas pelo ONS<span data-nivel="analisar"> (Tipo I e II-A)</span>, inclusive nucleares; {num(t.usinas_12m_resumo.usinas_com_geracao, 0)} usinas com geração no período
          </>,
          <>
            Thermal plants dispatched by the ONS<span data-nivel="analisar"> (Type I and II-A)</span>, including nuclear; {num(t.usinas_12m_resumo.usinas_com_geracao, 0)} plants with generation in the period
          </>,
        )}
        unidade={tx(
          "MWmed (média do período), GWh (energia) e % da geração térmica verificada; CVU em R$/MWh",
          "MWavg (average for the period), GWh (energy) and % of verified thermal generation; CVU in R$/MWh",
        )}
      />
      {notasUniverso}
      <TabelaInterativa
        titulo={tx("Tabela equivalente: geração por combustível e motivo, 12 meses", "Equivalent table: generation by fuel and reason, 12 months")}
        colunas={colunasCombustivelMotivo(cruzado.motivos, idioma)}
        linhas={paraTabela(cruzadoLinhas, idioma)}
        chaveLinha="id"
        colunaRotulo="combustivel"
        fonte={fonte}
        versao={versao}
        nomeArquivo="geracao-termica-combustivel-motivo"
        chaveUrl="cm"
        nota={tx(
          "Motivo sem geração no período fica fora das colunas (zero em todos os combustíveis). Não classificado é o total verificado menos a soma dos motivos, com sinal, como a fonte publica.",
          "A reason with no generation in the period is left out of the columns (zero in every fuel). Unclassified is the verified total minus the sum of the reasons, with its sign, as the source publishes it.",
        )}
      />

      {notas}

      <SecaoDoPainel id="motivos-mensal" titulo={tx("Por que as térmicas geraram, mês a mês?", "Why did thermal plants generate, month by month?")}>
        <GeracaoEscolha legenda={tx("Período", "Period")} opcoes={OPCOES_JANELA} valor={v.jt} onEscolher={(x) => definir({ jt: x })} />
        <GraficoBarras
          titulo={tx(
            `Geração térmica média do SIN por motivo de despacho, ${mensal[0] ? mesAno(mensal[0].m) : ""} a ${ultimoMensal ? mesAno(ultimoMensal.m) : ""}`,
            `Average SIN thermal generation by dispatch reason, ${mensal[0] ? mesAno(mensal[0].m) : ""} to ${ultimoMensal ? mesAno(ultimoMensal.m) : ""}`,
          )}
          dados={paraTabela(mensal, idioma)}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={mensalEscolhido.motivos.map((m) => ({ id: m, rotulo: CURTO_MOTIVO[m], cor: COR_MOTIVO[m] }))}
          unidade={UNIDADE}
          casas={0}
          empilhado
          altura={320}
        />
        {ultimoMensal && ultimoMensal.parcial === SIM && (
          <GeracaoAviso>
            {tx(
              <>O último mês ({ultimoMensal.mes}) é parcial: a média cobre só as horas já publicadas e não se compara com meses completos.</>,
              <>The latest month ({ultimoMensal.mes}) is partial: the average covers only the hours already published and is not comparable with complete months.</>,
            )}
          </GeracaoAviso>
        )}
        <TabelaInterativa
          titulo={tx("Tabela equivalente: geração térmica média por motivo, mês a mês", "Equivalent table: average thermal generation by reason, month by month")}
          colunas={colunasTermicaMensal(mensalEscolhido.motivos, idioma)}
          linhas={paraTabela(mensal, idioma)}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-termica-motivo-mensal-${v.jt}`}
          chaveUrl="tm"
          nota={tx(
            "Unit commitment só existe a partir de jan/2020 (entrada do DESSEM na programação, segundo o dicionário do ONS); antes disso a coluna fica vazia. Constrained-off térmico é restrição de geração, publicado à parte e fora da soma.",
            `Unit commitment only exists from ${mesAno("2020-01")} (when DESSEM entered the scheduling, according to the ONS data dictionary); before that the column is empty. Thermal constrained-off is a generation restriction, published separately and outside the sum.`,
          )}
        />
      </SecaoDoPainel>

      {contextoSemana}

      <SecaoDoPainel
        id="usinas"
        titulo={tx(
          `Quais usinas mais geraram? As ${num(t.usinas_12m_resumo.publicadas, 0)} com mais geração somam ${num(t.usinas_12m_resumo.cobertura_da_energia_pct, 1)}% da energia térmica`,
          `Which plants generated the most? The ${num(t.usinas_12m_resumo.publicadas, 0)} with the most generation add up to ${num(t.usinas_12m_resumo.cobertura_da_energia_pct, 1)}% of thermal energy`,
        )}
      >
        <GraficoBarras
          titulo={tx(`As ${maiores.length} usinas térmicas com mais geração, ${periodo12}`, `The ${maiores.length} thermal plants with the most generation, ${periodo12}`)}
          dados={maiores.map((x) => ({ id: x.id, rotulo: `${x.nome ?? x.id} (${minusculaPalavras(CURTO_COMBUSTIVEL[x.categoria])})`, gwh: x.mwh === null ? null : x.mwh / 1000 }))}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: "gwh", rotulo: tx("Geração em 12 meses", "Generation in 12 months"), cor: "var(--serie-termica)" }]}
          unidade="GWh"
          casas={0}
          orientacao="horizontal"
          alturaCategoria={44}
          rotulosValor
          rotulosSaoNomes
          selecionado={sel}
          onSelecionar={selecionar}
        />
        <TabelaInterativa
          titulo={tx("Usinas térmicas: geração, motivo principal, combustível e CVU", "Thermal plants: generation, main reason, fuel and CVU")}
          colunas={colunasUsinasTermicas(idioma)}
          linhas={paraTabela(usinas, idioma)}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={versao}
          nomeArquivo="geracao-termica-usinas-12m"
          chaveUrl="us"
          selecionado={sel}
          onSelecionar={selecionar}
          ordemInicial={{ coluna: "gwh", direcao: "desc" }}
          dicaBusca={tx("Nome da usina ou CEG", "Plant name or CEG")}
          nota={tx(
            `A lista completa, mês a mês e com todas as usinas, está no CSV para download, no fim do painel. Combustível pela autoridade publicada (${origens}...); nunca pelo nome.`,
            `The full list, month by month and with every plant, is in the download CSV at the end of the panel. Fuel by the published authority (${origens}...); never by the name.`,
          )}
        />
        {usina && (
          <div className="space-y-3" data-usina={usina.id}>
            <p className="text-sm text-carvao">
              <span className="font-medium">
                <Nome>{nomeUsina}</Nome>
              </span>
              :{" "}
              {tx(
                <>
                  {CURTO_COMBUSTIVEL[usina.categoria].toLowerCase()}, {num(usina.mwmed, 1)} MWmed em média nos 12 meses; motivo com maior parcela: {motivoPrincipal(usina, idioma).toLowerCase()}.{" "}
                  {usina.chaves_na_fonte.length > 1 ? `A fonte publica a usina sob ${usina.chaves_na_fonte.length} chaves (${usina.chaves_na_fonte.join(", ")}), ligadas por um elo do ONS.` : ""}
                  {usina.cvu_semana_vigente === null && usina.parcelas.length > 1 ? " Com várias parcelas, o CVU é o de cada parcela, na tabela abaixo." : ""}
                </>,
                <>
                  {CURTO_COMBUSTIVEL[usina.categoria].toLowerCase()}, an average of {num(usina.mwmed, 1)} MWavg over the 12 months; reason with the largest share: {motivoPrincipal(usina, idioma).toLowerCase()}.{" "}
                  {usina.chaves_na_fonte.length > 1 ? `The source publishes the plant under ${usina.chaves_na_fonte.length} keys (${usina.chaves_na_fonte.join(", ")}), linked by an ONS relationship.` : ""}
                  {usina.cvu_semana_vigente === null && usina.parcelas.length > 1 ? " With several portions, the CVU is that of each portion, in the table below." : ""}
                </>,
              )}
            </p>
            <TabelaInterativa
              titulo={tx(`Parcelas de ${nomeUsina} no ONS: geração e CVU da semana vigente`, `Portions of ${nomeUsina} at the ONS: generation and CVU for the current week`)}
              colunas={colunasParcelas(idioma)}
              linhas={paraTabela(parcelas, idioma)}
              chaveLinha="id"
              colunaRotulo="nome"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`geracao-termica-parcelas-${usina.id}`}
              chaveUrl="pc"
              semLinhas={tx("Nenhuma parcela com geração no período ou CVU na semana.", "No portion with generation in the period or a CVU in the week.")}
              nota={
                usina.parcelas_omitidas
                  ? tx(
                      `${usina.parcelas_omitidas} parcelas sem geração no período nem CVU na semana ficam fora da lista.`,
                      `${usina.parcelas_omitidas} ${usina.parcelas_omitidas === 1 ? "portion" : "portions"} with no generation in the period and no CVU in the week ${usina.parcelas_omitidas === 1 ? "is" : "are"} left out of the list.`,
                    )
                  : undefined
              }
            />
          </div>
        )}
        <Comparador
          rotulo={tx(
            `Usinas para comparar os motivos (até ${LIMITE_COMPARACAO}); sem escolha, a selecionada na tabela`,
            `Plants to compare the reasons (up to ${LIMITE_COMPARACAO}); with no choice, the one selected in the table`,
          )}
          entidades={t.usinas_12m.map((x) => ({ id: x.id, rotulo: x.nome ?? x.id, detalhe: CURTO_COMBUSTIVEL[x.categoria], sinonimos: x.chaves_na_fonte }))}
          selecionadas={comparadas}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca={tx("Angra, Pecém, Santa Cruz", "Angra, Pecém, Santa Cruz")}
          vazio={
            comparacaoPadrao && usinasComparadas.length
              ? tx(
                  <>{`Mostrando ${nomesComparadas}, a maior usina de cada um de ${usinasComparadas.length} combustíveis. Escolha até quatro usinas para comparar.`}</>,
                  <>
                    Showing {nomesComparadasNo}, the largest plant of each of {usinasComparadas.length} fuels. Choose up to four plants to compare.
                  </>,
                )
              : usina
                ? tx(
                    <>{`Mostrando ${nomeUsina}. Escolha até quatro usinas para comparar.`}</>,
                    <>
                      Showing <Nome>{nomeUsina}</Nome>. Choose up to four plants to compare.
                    </>,
                  )
                : tx("Escolha até quatro usinas.", "Choose up to four plants.")
          }
        >
          {() => null}
        </Comparador>
        {usinasComparadas.length > 0 && (
          <>
            <GraficoBarras
              // em inglês, o título não repete os nomes (texto do gráfico não leva marca); eles estão no comparador logo acima e na legenda
              titulo={tx(`Parcela de cada motivo na geração da usina, 12 meses: ${nomesComparadas}`, "Share of each reason in the generation of each compared plant, 12 months")}
              dados={paraTabela(motivosUsinas, idioma)}
              chaveCategoria="id"
              chaveRotulo="motivo"
              series={usinasComparadas.map((x, i) => ({ id: x.id, rotulo: x.nome ?? x.id, cor: usinasComparadas.length > 1 ? COR_COMPARACAO[i % COR_COMPARACAO.length] : COR_COMBUSTIVEL[x.categoria] }))}
              unidade="%"
              casas={1}
              orientacao="horizontal"
              rotulosValor
              seriesSaoNomes
            />
            <p className="text-xs leading-relaxed text-carvao-muted" data-cvu-comparadas="">
              {tx(
                <>
                  CVU da semana vigente: {cvuComparadas}. Custo declarado para a programação, não custo realizado
                  {usinasComparadas.some((x) => x.cvu_semana_vigente === 0) ? "; CVU 0,00 é valor publicado pela fonte, mantido como publicado e nunca tratado como ausência" : ""}.
                </>,
                <>
                  CVU for the current week: {cvuComparadasEn}. Cost declared for scheduling, not realized cost
                  {usinasComparadas.some((x) => x.cvu_semana_vigente === 0) ? `; a CVU of ${num(0, 2)} is a value published by the source, kept as published and never treated as missing` : ""}.
                </>,
              )}
            </p>
            <TabelaInterativa
              titulo={tx("Tabela equivalente: parcela de cada motivo por usina", "Equivalent table: share of each reason by plant")}
              colunas={[{ id: "motivo", rotulo: tx("Motivo", "Reason"), tipo: "texto" }, ...usinasComparadas.map((x) => ({ id: x.id, rotulo: x.nome ?? x.id, tipo: "percentual" as const, casas: 2 }))]}
              linhas={paraTabela(motivosUsinas, idioma)}
              chaveLinha="id"
              colunaRotulo="motivo"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`geracao-termica-motivos-usinas`}
              chaveUrl="mu"
              nota={tx(
                "Motivo que a usina não teve no período aparece como zero: a fonte classifica toda a geração verificada da usina nos motivos publicados.",
                "A reason the plant did not have in the period appears as zero: the source classifies all of the plant's verified generation into the published reasons.",
              )}
            />
          </>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel
        nivel="analisar"
        id="combustiveis-mensal"
        titulo={tx(`Geração térmica por combustível, mês a mês (até ${LIMITE_COMPARACAO} na mesma escala)`, `Thermal generation by fuel, month by month (up to ${LIMITE_COMPARACAO} on the same scale)`)}
      >
        <Comparador
          rotulo={tx(`Combustíveis (até ${LIMITE_COMPARACAO}); sem escolha, os três com mais geração na série`, `Fuels (up to ${LIMITE_COMPARACAO}); with no choice, the three with the most generation in the series`)}
          entidades={comSerie.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c] }))}
          selecionadas={cbs}
          onMudar={(ids) => definir({ cb: ids as CategoriaCombustivel[] })}
          dicaBusca={tx("Gás, carvão, óleo", "Gas, coal, oil")}
          vazio={tx(`Mostrando ${nomesCombustiveis}.`, `Showing ${nomesCombustiveis}.`)}
        >
          {() => null}
        </Comparador>
        <GraficoLinhas
          titulo={tx(`Geração térmica média mensal: ${nomesCombustiveis}`, `Average monthly thermal generation: ${nomesCombustiveis}`)}
          dados={combustivelMensal}
          chaveX="m"
          formatoX="mes"
          series={noHistorico.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], cor: COR_COMBUSTIVEL[c] }))}
          unidade={UNIDADE}
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        />
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: geração térmica média mensal por combustível (${nomesCombustiveis})`, `Equivalent table: average monthly thermal generation by fuel (${nomesCombustiveis})`)}
          colunas={[{ id: "m", rotulo: tx("Mês", "Month"), tipo: "texto" }, ...noHistorico.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], tipo: "numero" as const, unidade: UNIDADE, casas: 1 }))]}
          linhas={paraTabela(combustivelMensal, idioma)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-termica-combustivel-mensal-${noHistorico.join("-")}`}
          chaveUrl="cbm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota={tx(
            "Até 2025 o combustível vem pelo CEG da usina em outros conjuntos do ONS; desde 2026, do campo do próprio conjunto. As térmicas Tipo III sem combustível só aparecem na matriz efetiva.",
            "Up to 2025 the fuel comes from the plant's CEG in other ONS datasets; since 2026, from the dataset's own field. Type III thermal plants without a fuel appear only in the effective mix.",
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
