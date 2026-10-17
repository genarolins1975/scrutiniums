import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ContaComposicao } from "@/components/energia/ContaComposicao";
import { ContaFaixa } from "@/components/energia/ContaFaixa";
import { ContaHistorico } from "@/components/energia/ContaHistorico";
import { ContaLinkFiltros } from "@/components/energia/ContaLinkPainel";
import { ContaSerieReal } from "@/components/energia/ContaSerieReal";
import { ContaSimulador } from "@/components/energia/ContaSimulador";
import { ContaTabelaSobDemanda } from "@/components/energia/ContaTabelaSobDemanda";
import { ContaTarifas } from "@/components/energia/ContaTarifas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  comProcedimentoExterno,
  compactarLinhasTabela,
  compactarComposicao,
  compactarDistribuidorasSim,
  compactarEntidades,
  compactarFora,
  compactarInfo,
  compactarVigentes,
  compararMesmoConjunto,
  coberturaDoRanking,
  foraDoRanking,
  linhasEvolucao,
  mudancaComposicaoEm,
  mudancaTarifa,
  respostaBandeira,
  respostaCde,
  respostaComposicao,
  respostaReajustes,
  respostaSubsidios,
  minuscula,
  nomeLigacao,
  resumoSerieReal,
  rotuloDistribuidora,
  textoSerieReal,
  textoTresValoresTipicos,
  vereditoBandeira,
  vereditoComposicao,
  vereditoReajustes,
  vereditoSubsidios,
} from "@/lib/energia/conta";
import { carimbo, dataBR, mesAno, num, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { bandeiraNoIdioma, dadoNo, dadoTexto, motivoSemVigenteEn } from "@/lib/energia/i18n/conta-inclusao";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { infoDasDistribuidoras, lerHistoricoB1 } from "./dados";
import { Auditoria, Datas, fonteTarifas, Navegacao, ROTA_REAJUSTES, Recorte, Seguir, downloadsDoPainel } from "./partes";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/conta-de-luz", {
    title: tx("Conta de luz: tarifas, composição, simulador e reajustes", "Electricity bill: tariffs, composition, simulator and adjustments"),
    description: tx(
      "Tarifa B1 residencial de aplicação de cada distribuidora (ANEEL), custo de perfis de consumo comparáveis, composição da tarifa, simulador sem tributos, variação contra o IPCA, bandeiras, subsídios tarifários e orçamento da CDE.",
      "Applied residential B1 tariff of each distribution utility (ANEEL), cost of comparable consumption profiles, tariff composition, simulator without taxes, change against the IPCA, tariff flags, tariff subsidies and the Energy Development Account (CDE) budget.",
    ),
    alternates: { canonical: "/setor-eletrico/conta-de-luz" },
  }, anterior);
}

/* As colunas são montadas na hora do render (o idioma vem da página), nunca no topo do módulo. */
function colunasSemVigente(): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
    { id: "inicio", rotulo: tx("Início da última vigência", "Start of the last validity period"), tipo: "data" },
    { id: "fim", rotulo: tx("Fim da última vigência", "End of the last validity period"), tipo: "data" },
    {
      id: "ato",
      rotulo: tx("Ato", "Act"),
      tipo: "texto",
      literal: { classe: "ato-retificacao-sem-numero", origem: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica" },
    },
    { id: "dias", rotulo: tx("Dias sem tarifa", "Days without a tariff"), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "situacao", rotulo: tx("Situação", "Status"), tipo: "texto", categorica: true },
    { id: "motivo", rotulo: tx("Motivo", "Reason"), tipo: "texto" },
  ];
}

function colunasAtipicas(): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto" },
    { id: "codigo", rotulo: tx("Componente", "Component"), tipo: "texto", categorica: true },
    { id: "valor", rotulo: tx("Valor", "Value"), tipo: "numero", unidade: "R$/MWh", casas: 2 }, // i18n: dado
    { id: "pct", rotulo: tx("Da tarifa", "Of the tariff"), tipo: "percentual", casas: 1 },
    {
      id: "mediana",
      rotulo: tx("Mediana do módulo", "Median of the absolute value"),
      tipo: "numero",
      unidade: "R$/MWh",
      casas: 2,
    },
    { id: "grupo_codigo", rotulo: tx("Grupo pelo código", "Group by code"), tipo: "texto" },
    { id: "grupo_usado", rotulo: tx("Grupo usado", "Group used"), tipo: "texto" },
    { id: "criterios", rotulo: tx("Critério", "Criterion"), tipo: "texto" },
  ];
}

function colunasCasos(): ColunaTabela[] {
  return [
    { id: "classe", rotulo: tx("Classe", "Class"), tipo: "texto", categorica: true },
    { id: "kwh", rotulo: tx("Consumo", "Consumption"), tipo: "numero", unidade: "kWh", casas: 0 },
    { id: "ligacao", rotulo: tx("Ligação", "Connection"), tipo: "texto", categorica: true },
    { id: "bandeira", rotulo: tx("Bandeira", "Tariff flag"), tipo: "texto", categorica: true },
    {
      id: "total", // i18n: dado
      rotulo: tx("Estimativa", "Estimate"),
      tipo: "numero",
      unidade: tx("R$/mês", "R$/month"),
      casas: 2,
    },
    {
      id: "parcela_bandeira",
      rotulo: tx("Parcela da bandeira", "Tariff flag portion"),
      tipo: "numero",
      unidade: tx("R$/mês", "R$/month"),
      casas: 2,
    },
  ];
}

export default function ContaDeLuzPage() {
  const g = lerGold<ContaGold>("conta.json");
  const idioma = idiomaEnergia();
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="conta-de-luz" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo={tx("Conta de luz indisponível nesta publicação", "Electricity bill unavailable in this publication")}
            motivo={
              g?.motivo ??
              tx(
                "A gold do módulo Conta de luz (public/energia/gold/conta.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
                "The Electricity bill module gold (public/energia/gold/conta.json) was not generated or did not pass validation; the last valid publication is kept when there is one.",
              )
            }
          />
        </main>
      </>
    );
  }

  const t = g.tarifas;
  const comp = g.composicao;
  const sim = g.simulador;
  const reaj = g.reajustes;
  const band = g.bandeiras;
  const sub = g.subsidios;
  const cde = g.financiamento_cde;
  const ref = g.data_referencia;
  const evolucao = linhasEvolucao(t.evolucao);
  // a mediana do ranking contra a do dia 1º só vale no mesmo conjunto de distribuidoras: a comparação sai da linha do tempo de cada uma
  const historico = lerHistoricoB1();
  const comparacao = historico
    ? compararMesmoConjunto({ vigentes: t.vigentes, semVigente: t.sem_vigente, historico: historico.distribuidoras, evolucao, dataReferencia: g.data_referencia })
    : null;
  // a regra de completude do ranking: as distribuidoras que ficaram fora (com o motivo e a última tarifa) e a cobertura em distribuidoras e em UCs
  const foraRank = foraDoRanking(t.sem_vigente, historico?.distribuidoras ?? null);
  const infoDasTodas = infoDasDistribuidoras([...t.vigentes.map((v) => v.cnpj), ...t.sem_vigente.map((x) => x.cnpj)]);
  const info = compactarInfo(infoDasTodas);
  const cobertura = coberturaDoRanking({ vigentes: t.vigentes, fora: foraRank, info: infoDasTodas });
  // o que vai aos componentes de cliente viaja em tuplas, e a mesma lista de distribuidoras (a mesma referência) serve à faixa, ao painel de tarifas e à composição
  const vigentesCompactos = compactarVigentes(t.vigentes);
  const tresValores = textoTresValoresTipicos(comp, t.resumo);
  const serieReal = resumoSerieReal(evolucao, reaj.comparacao_inflacao?.ultimo_ipca ?? null);
  const ultimoIpca = reaj.comparacao_inflacao?.ultimo_ipca ?? null;
  const janela12 = reaj.comparacao_inflacao?.janelas.find((j) => j.meses === 12) ?? null;
  const fora = t.resumo.fora_vigencia_recente + t.resumo.fora_sem_tarifa_ha_mais_de_90_dias;
  const semCustoDisponibilidade = Math.min(...g.perfis_kwh) >= sim.regras.custo_disponibilidade_kwh.trifasico;
  const faixaN = serieReal ? (serieReal.nMin === serieReal.nMax ? `${serieReal.nMin}` : tx(`${serieReal.nMin} a ${serieReal.nMax}`, `${serieReal.nMin} to ${serieReal.nMax}`)) : "";

  const entidades = compactarEntidades(t.vigentes, t.sem_vigente);

  const COLUNAS_SEM_VIGENTE = colunasSemVigente();
  const COLUNAS_ATIPICAS = colunasAtipicas();
  const COLUNAS_CASOS = colunasCasos();
  const linhasSemVigente = t.sem_vigente.map((s) => ({
    id: s.cnpj,
    sigla: rotuloDistribuidora(s.sigla, s.cnpj),
    cnpj: s.cnpj,
    inicio: s.ultima_vigencia.inicio,
    fim: s.ultima_vigencia.fim,
    ato: s.ultima_vigencia.ato,
    dias: s.dias_sem_tarifa,
    situacao: s.incorporada_por
      ? tx("incorporada", "merged")
      : s.dias_sem_tarifa <= 90
        ? tx("vigência encerrada há até 90 dias", "validity ended up to 90 days ago")
        : tx("sem tarifa há mais de 90 dias", "no tariff for more than 90 days"),
    // o motivo vem da gold em três formas fixas: a página inglesa o reescreve; forma desconhecida segue como a fonte escreveu
    motivo: tx(s.motivo, motivoSemVigenteEn(s.motivo) ?? s.motivo),
  }));

  const rotuloGrupo = new Map(comp.grupos.map((x) => [x.id, dadoTexto(x.rotulo, idioma)]));
  const linhasAtipicas = comp.componentes_atipicas.map((a) => ({
    id: `${a.cnpj}|${a.codigo}`,
    sigla: rotuloDistribuidora(a.sigla, a.cnpj),
    codigo: a.codigo,
    valor: a.valor,
    pct: a.pct_tarifa,
    mediana: a.mediana_modulo_rs_mwh,
    grupo_codigo: rotuloGrupo.get(a.grupo_pelo_codigo) ?? a.grupo_pelo_codigo,
    grupo_usado: rotuloGrupo.get(a.grupo_usado) ?? a.grupo_usado,
    criterios: a.criterios.map((c) => dadoTexto(c, idioma)).join("; "),
  }));

  const rotuloClasse = new Map(sim.classes.map((c) => [c.id, dadoTexto(c.rotulo, idioma)]));
  const linhasCasos = sim.casos_referencia.casos.map(([classe, kwh, ligacao, bandeira, total, parcela], i) => ({
    id: String(i),
    classe: rotuloClasse.get(classe) ?? classe,
    kwh,
    // em português a tabela mostra o código da ligação como a gold o publica; em inglês, o nome
    ligacao: tx(ligacao, nomeLigacao(ligacao, "en")),
    bandeira: bandeira === null ? bandeira : bandeiraNoIdioma(bandeira, idioma),
    total,
    parcela_bandeira: parcela,
  }));

  // notas do painel de tarifas: ficam logo depois das figuras (o painel é composto e as passa ao corpo)
  const oQueMudouTarifa = mudancaTarifa(ref, t.resumo, evolucao, comparacao);
  const comoInterpretarTarifa = tx(
    <>
      Cada barra é uma distribuidora (subgrupo B1, residencial, modalidade convencional, tarifa de aplicação). O custo do perfil é kWh × (TE + TUSD) ÷ 1000;{" "}
      {semCustoDisponibilidade ? "nenhum perfil fica abaixo do maior " : "há perfil abaixo do maior "}
      <Termo slug="custo-de-disponibilidade">custo de disponibilidade</Termo> ({sim.regras.custo_disponibilidade_kwh.trifasico} kWh, ligação trifásica)
      {semCustoDisponibilidade
        ? ", então o mínimo não muda a comparação."
        : ": nesse perfil, o mínimo da ligação pode valer mais que o consumo, e o custo publicado não o considera."}{" "}
      A faixa clara da primeira figura vai do 1º ao 3º quartil. A base econômica, na tabela, é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo. No modo
      Analisar, o histórico mostra até quatro distribuidoras sobre a mediana nacional.
    </>,
    <>
      Each bar is a distribution utility (subgroup B1, residential, conventional modality, applied tariff). The profile cost is kWh × (TE + TUSD) ÷ 1000;{" "}
      {semCustoDisponibilidade ? "no profile is below the largest " : "there is a profile below the largest "}
      <Termo slug="custo-de-disponibilidade">availability cost</Termo> ({sim.regras.custo_disponibilidade_kwh.trifasico} kWh, three-phase connection)
      {semCustoDisponibilidade
        ? ", so the minimum does not change the comparison."
        : ": in that profile, the connection minimum may be worth more than the consumption, and the published cost does not consider it."}{" "}
      The light band in the first figure runs from the 1st to the 3rd quartile. The economic base, in the table, is the tariff used in the tariff calculation, without the financial components of
      the process. In Analyze mode, the history shows up to four distribution utilities over the national median.
    </>,
  );
  const naoConcluirTarifa = tx(
    <>
      Não é a conta final: faltam ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. Não é a tarifa média de fornecimento. A mediana não é ponderada por consumidores e não representa o
      consumidor médio do país; os perfis de {g.perfis_kwh.join(", ")} kWh são referências do observatório, não consumo médio. A diferença de tarifa entre distribuidoras não mede a eficiência de nenhuma delas.
    </>,
    <>
      It is not the final bill: ICMS, PIS/Pasep, Cofins, public lighting and the tariff flag are missing. It is not the average supply tariff. The median is not weighted by consumers and does
      not represent the country&apos;s average consumer; the profiles of {g.perfis_kwh.join(", ")} kWh are the observatory&apos;s references, not average consumption. The tariff difference between
      distribution utilities does not measure the efficiency of any of them.
    </>,
  );
  const oQueMudouComposicao = (
    <>
      {mudancaComposicaoEm(comp, ref)}
      <span data-nivel="analisar">
        {" "}
        {tx("Leitura completa do valor negativo:", "Full reading of the negative value:")} {dadoNo(comp.creditos.leitura, "conta-creditos-leitura", idioma)}.
      </span>
    </>
  );
  const comoInterpretarComposicao = tx(
    <>
      As partes positivas de cada barra passam do total, e os itens negativos (créditos e devoluções) trazem de volta: a soma de tudo é TE + TUSD. Os grupos seguem a classificação do
      observatório pelo código da componente; a parcela das componentes <Termo slug="cde">CDE</Termo> está dentro dos encargos e aparece à parte só para leitura. Na tabela de
      decomposição, a média fecha com o total e a mediana é lida grupo a grupo.
    </>,
    <>
      The positive parts of each bar go past the total, and the negative items (credits and refunds) bring it back: the sum of everything is TE + TUSD. The groups follow the
      observatory&apos;s classification by component code; the portion of the <Termo slug="cde">CDE</Termo> components is within sector charges and appears separately only for reading. In
      the breakdown table, the average matches the total and the median is read group by group.
    </>,
  );
  const naoConcluirComposicao = tx(
    <>
      Não se conclui margem ou lucro da distribuidora: o grupo distribuição é a remuneração regulada do fio, não resultado contábil. Não se conclui o valor em reais do crédito tarifário
      por distribuidora (o conjunto dá R$/MWh da tarifa B1, não o mercado a que se aplica). Tributos e iluminação pública não estão na tarifa homologada.
    </>,
    <>
      No conclusion can be drawn about the distribution utility&apos;s margin or profit: the distribution group is the regulated remuneration of the wire, not an accounting result. No
      conclusion can be drawn about the value in reais of the tariff credit per distribution utility (the dataset gives R$/MWh of the B1 tariff, not the market it applies to). Taxes and public
      lighting are not in the ratified tariff.
    </>,
  );
  const bandeiraDoMes = sim.bandeira_vigente?.bandeira
    ? `${minuscula(bandeiraNoIdioma(sim.bandeira_vigente.bandeira, idioma))} (${mesAno(`${sim.bandeira_vigente.mes}-01`)})`
    : tx("não publicada", "not published");
  const oQueMudouSimulador = tx(
    <>
      Desde {dataBR(sim.regras.desconto_social_desde)}, o Desconto Social isenta das quotas da CDE o consumo de até {sim.regras.desconto_social_limite_kwh} kWh no mês; a Tarifa Social dá
      desconto integral até {sim.regras.tarifa_social_limite_kwh} kWh. Bandeira do mês publicado:{" "}
      {bandeiraDoMes}.
    </>,
    <>
      Since {dataBR(sim.regras.desconto_social_desde)}, the <Nome>Desconto Social</Nome> (social discount) exempts consumption of up to {sim.regras.desconto_social_limite_kwh} kWh a month from
      CDE quotas; the <Nome>Tarifa Social</Nome> (social electricity tariff) gives a full discount up to {sim.regras.tarifa_social_limite_kwh} kWh. Tariff flag of the published month:{" "}
      {bandeiraDoMes}.
    </>,
  );
  const comoInterpretarSimulador = tx(
    <>
      A memória de cálculo mostra cada parcela: kWh, preço por kWh e valor. O gráfico mostra a estimativa para todo consumo de zero ao limite do eixo; a linha muda de inclinação onde muda a
      regra. Cada regra traz o seu estado: conferida no texto oficial, ou parcial quando parte dela é leitura declarada.
    </>,
    <>
      The calculation breakdown shows each item: kWh, price per kWh and amount. The chart shows the estimate for every consumption from zero to the axis limit; the line changes slope where the
      rule changes. Each rule carries its status: checked against the official text, or partial when part of it is a declared reading.
    </>,
  );
  const naoConcluirSimulador = tx(
    <>
      Não é a fatura: faltam ICMS, PIS/Pasep, Cofins, iluminação pública, multas, parcelamentos e serviços. A aplicação do Desconto Social por parcela, o mínimo da Tarifa Social acima de{" "}
      {sim.regras.tarifa_social_limite_kwh} kWh e a bandeira na Tarifa Social são leituras do observatório, não conferidas no texto da REN nº 1.000/2021. Bandeira não vale em sistemas
      isolados.
    </>,
    <>
      It is not the bill: ICMS, PIS/Pasep, Cofins, public lighting, fines, installments and services are missing. The band-by-band application of the Desconto Social, the Tarifa Social minimum
      above {sim.regras.tarifa_social_limite_kwh} kWh and the tariff flag in the Tarifa Social are the observatory&apos;s readings, not checked against the text of REN 1,000/2021. The tariff
      flag does not apply in isolated systems.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="conta-de-luz" />
      <MarcaVisita secao="energia:conta-de-luz" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <Navegacao atual="tarifas" />
        <CabecalhoModulo
          siglas={["TE", "TUSD", "ANEEL", "IPCA", "CDE", "PLD", "REN"]}
          titulo={tx("Quanto custa o mesmo consumo?", "How much does the same consumption cost?")}
          lead={tx(
            "O mesmo consumo em quilowatt-hora (kWh) custa diferente conforme a distribuidora: cada área tem a sua tarifa de energia (TE) e de uso da rede (TUSD). Tributos, iluminação pública e bandeira ficam de fora.",
            "The same consumption in kilowatt-hours (kWh) costs a different amount depending on the distribution utility: each area has its own energy tariff (TE) and grid use tariff (TUSD). Taxes, public lighting and the tariff flag are left out.",
          )}
          limite={tx(
            <>
              Não é a fatura: faltam ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. O menor e o maior custo são das {t.resumo.n} distribuidoras com tarifa no arquivo de {dataBR(ref)} (de{" "}
              {cobertura.universo}), e a mediana não pesa por consumidores.
            </>,
            <>
              It is not the bill: ICMS, PIS/Pasep, Cofins, public lighting and the tariff flag are missing. The lowest and highest cost are those of the {t.resumo.n} distribution utilities with a
              tariff in the file of {dataBR(ref)} (out of {cobertura.universo}), and the median is not weighted by consumers.
            </>,
          )}
          recorte={tx(
            `${dataBR(ref)} · ${t.resumo.n} distribuidoras · B1 residencial convencional · R$/mês e R$/kWh`,
            `${dataBR(ref)} · ${t.resumo.n} distribution utilities · conventional residential B1 · R$/month and R$/kWh`,
          )}
          fonte={tx("ANEEL, tarifas de aplicação das distribuidoras", "ANEEL, applied tariffs of the distribution utilities")}
          referencia={tx(
            <>
              Tarifas de aplicação da ANEEL vigentes em {dataBR(ref)} (arquivo gerado pela fonte em {dataBR(g.gerado_pela_fonte_em)}); bandeira de{" "}
              {band.vigente ? mesAno(`${band.vigente.mes}-01`) : "mês não publicado"}; IPCA até {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "mês não publicado"}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL applied tariffs in force on {dataBR(ref)} (file generated by the source on {dataBR(g.gerado_pela_fonte_em)}); tariff flag for{" "}
              {band.vigente ? mesAno(`${band.vigente.mes}-01`) : "month not published"}; IPCA up to {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "month not published"}. Processed on{" "}
              {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <Datas
              itens={[
                { rotulo: tx("Tarifas e componentes", "Tariffs and components"), texto: tx(`até ${dataBR(ref)}`, `up to ${dataBR(ref)}`), natureza: "CALCULADO" },
                {
                  rotulo: tx("Bandeira do simulador", "Simulator tariff flag"),
                  texto: band.vigente ? mesAno(`${band.vigente.mes}-01`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("IPCA da série em reais", "IPCA of the series in reais"),
                  texto: ultimoIpca ? tx(`até ${mesAno(`${ultimoIpca}-01`)}`, `up to ${mesAno(`${ultimoIpca}-01`)}`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={<ContaFaixa vigentes={vigentesCompactos} resumo={t.resumo} dataReferencia={ref} evidenciaMediana={comProcedimentoExterno(t.evidencia_mediana)} comparacao={comparacao} info={info} cobertura={cobertura} />}
        >
          {tx(
            <>
              A distribuidora cobra pela energia (TE) e pelo uso da rede (TUSD) os valores que a ANEEL homologa para cada área. Esta página compara essas tarifas entre distribuidoras, mostra do que
              elas são feitas e estima a conta para um consumo; a variação contra a inflação, as bandeiras e quem paga os descontos estão em{" "}
              <ContaLinkFiltros href={ROTA_REAJUSTES} className="text-energia-dark underline underline-offset-4">
                reajustes, bandeiras e subsídios
              </ContaLinkFiltros>
              . Tributos e iluminação pública ficam fora: não há base oficial estruturada que os leve à tarifa de cada distribuidora.
            </>,
            <>
              The distribution utility charges for energy (TE) and for grid use (TUSD) the amounts that ANEEL ratifies for each area. This page compares those tariffs across distribution
              utilities, shows what they are made of and estimates the bill for a given consumption; the change against inflation, the tariff flags and who pays for the discounts are in{" "}
              <ContaLinkFiltros href={ROTA_REAJUSTES} className="text-energia-dark underline underline-offset-4">
                adjustments, tariff flags and subsidies
              </ContaLinkFiltros>
              . Taxes and public lighting are left out: there is no structured official database that maps them to each distribution utility&apos;s tariff.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          {/* ---------------- P047 ---------------- */}
          <Bloco id="tarifa">
            <PainelEvidencia
              id="p047"
              pergunta={tx("O mesmo consumo, da menor à maior tarifa", "The same consumption, from the lowest to the highest tariff")}
              subtitulo={tx(
                "Tarifa B1 residencial convencional de aplicação (TE + TUSD) · R$/mês por perfil e R$/MWh",
                "Applied conventional residential B1 tariff (TE + TUSD) · R$/month by profile and R$/MWh",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A <Termo slug="tarifa-te-tusd">tarifa homologada</Termo> é a parte da conta que a ANEEL fixa para cada distribuidora: o mesmo consumo custa diferente conforme a
                  área de concessão. Comparar o mesmo perfil, na mesma classe, modalidade e base, isola essa diferença.
                </>,
                <>
                  The <Termo slug="tarifa-te-tusd">ratified tariff</Termo> is the part of the bill that ANEEL sets for each distribution utility: the same consumption costs a different amount
                  depending on the concession area. Comparing the same profile, in the same class, modality and base, isolates that difference.
                </>,
              )}
              oQueMudou={oQueMudouTarifa}
              comoInterpretar={comoInterpretarTarifa}
              naoConcluir={naoConcluirTarifa}
              naoConcluirNoCorpo
              proveniencia={t.proveniencia}
              complementares={[
                {
                  rotulo: tx("Evolução mensal da mediana", "Monthly evolution of the median"),
                  p: t.proveniencia_evolucao,
                },
                {
                  rotulo: tx("IPCA (IBGE), usado para a série em reais", "IPCA (IBGE), used for the series in reais"),
                  p: reaj.proveniencia_ipca,
                },
              ]}
            >
              <div className="space-y-6">
                <ContaTarifas
                  vigentes={vigentesCompactos}
                  resumo={t.resumo}
                  dataReferencia={ref}
                  fonte={fonteTarifas()}
                  info={info}
                  fora={compactarFora(foraRank)}
                  recorte={
                    <Recorte
                      periodo={tx(
                        <>
                          Tarifa vigente em {dataBR(ref)}; histórico de {mesAno(`${evolucao[0]?.m ?? ref.slice(0, 7)}-01`)} a {mesAno(`${evolucao.at(-1)?.m ?? ref.slice(0, 7)}-01`)}
                        </>,
                        <>
                          Tariff in force on {dataBR(ref)}; history from {mesAno(`${evolucao[0]?.m ?? ref.slice(0, 7)}-01`)} to {mesAno(`${evolucao.at(-1)?.m ?? ref.slice(0, 7)}-01`)}
                        </>,
                      )}
                      universo={tx(
                        <>
                          {t.resumo.n} distribuidoras com vigência na data; {fora} fora do ranking (lista em Auditar)
                        </>,
                        <>
                          {t.resumo.n} distribution utilities with a validity period on the date; {fora} out of the ranking (list in Audit)
                        </>,
                      )}
                      unidade={tx("R$/mês para o perfil; R$/MWh para a tarifa (÷ 1000 = R$/kWh)", "R$/month for the profile; R$/MWh for the tariff (÷ 1000 = R$/kWh)")}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudouTarifa} comoInterpretar={comoInterpretarTarifa} naoConcluir={naoConcluirTarifa} />}
                />

                <SecaoDoPainel
                  id="evolucao"
                  titulo={
                    serieReal
                      ? tx(`Como a mediana mudou desde ${mesAno(`${serieReal.inicio}-01`)}, com e sem a inflação?`, `How has the median changed since ${mesAno(`${serieReal.inicio}-01`)}, with and without inflation?`)
                      : tx("Como a mediana mudou ao longo do tempo?", "How has the median changed over time?")
                  }
                  lead={textoSerieReal(serieReal)}
                >
                  <ContaSerieReal evolucao={evolucao} ultimoIpca={ultimoIpca} />
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="serie-real">
                    {serieReal
                      ? tx(
                          `Em cada mês a mediana é de ${faixaN} distribuidoras com tarifa no dia 1º, e o conjunto muda ao longo do tempo (fusões, incorporações, permissionárias que passam a ter tarifa própria); o ranking usa só as vigentes em ${dataBR(ref)}, e os dois números podem diferir; a comparação no mesmo conjunto está nas notas do painel. `,
                          `Each month the median is of ${faixaN} distribution utilities with a tariff on the 1st, and the set changes over time (mergers, incorporations, permit holders that come to have their own tariff); the ranking uses only those in force on ${dataBR(ref)}, and the two numbers may differ; the comparison in the same set is in the panel notes. `,
                        )
                      : ""}
                    {serieReal?.base
                      ? tx(
                          `Em reais de ${mesAno(`${serieReal.base}-01`)}, cada mês é corrigido pela razão entre o índice do IPCA de ${mesAno(`${serieReal.base}-01`)} e o do mês. O IPCA mede preços ao consumidor em geral, não só a energia.`,
                          `In ${mesAno(`${serieReal.base}-01`)} reais, each month is adjusted by the ratio between the IPCA index for ${mesAno(`${serieReal.base}-01`)} and that of the month. The IPCA measures consumer prices in general, not only energy.`,
                        )
                      : tx("Sem IPCA publicado, a série em reais não é calculada.", "Without a published IPCA, the series in reais is not calculated.")}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="historico"
                  nivel="analisar"
                  titulo={tx("Como a tarifa de cada distribuidora evoluiu diante da mediana?", "How has each distribution utility's tariff evolved against the median?")}
                  lead={tx(
                    <>
                      Tarifa vigente no dia 1º de cada mês. O arquivo começa em {t.evolucao[0] ? mesAno(`${t.evolucao[0][0]}-01`) : "mês não publicado"} com poucas distribuidoras, e a mediana só
                      aparece quando a cobertura passa do mínimo da regra (a partir de {evolucao[0] ? mesAno(`${evolucao[0].m}-01`) : "nenhum mês"}; regra nas limitações da evolução mensal, em Sobre este
                      dado). Incorporações aparecem como linhas verticais; todas as mudanças da distribuidora em destaque estão na tabela.
                    </>,
                    <>
                      Tariff in force on the 1st of each month. The file starts in {t.evolucao[0] ? mesAno(`${t.evolucao[0][0]}-01`) : "month not published"} with few distribution utilities, and the
                      median appears only when coverage exceeds the rule&apos;s minimum (from {evolucao[0] ? mesAno(`${evolucao[0].m}-01`) : "no month"}; rule in the limitations of the monthly
                      evolution, in About this data). Mergers appear as vertical lines; all changes of the highlighted distribution utility are in the table.
                    </>,
                  )}
                >
                  <ContaHistorico evolucao={evolucao} entidades={entidades} historicoUrl={t.historico_url} ultimoIpca={ultimoIpca} fonte={fonteTarifas()} dataReferencia={ref} />
                </SecaoDoPainel>

                <Auditoria id="fora-do-ranking" titulo={tx("Quem ficou fora do ranking e por quê", "Who was left out of the ranking and why")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        Recorte do arquivo: {num(g.universo_tarifas.linhas_lidas ?? null, 0)} linhas lidas, {num(g.universo_tarifas.no_recorte ?? null, 0)} no recorte de baixa tensão convencional (
                        {num(g.universo_tarifas.fora_baixa_tensao_b1_b2_b3 ?? null, 0)} de outros subgrupos, {num(g.universo_tarifas.modalidade_nao_convencional ?? null, 0)} de outras modalidades,{" "}
                        {num(g.universo_tarifas.detalhe_especifico ?? null, 0)} com detalhe específico).
                      </>,
                      <>
                        File scope: {num(g.universo_tarifas.linhas_lidas ?? null, 0)} rows read, {num(g.universo_tarifas.no_recorte ?? null, 0)} in the conventional low-voltage scope (
                        {num(g.universo_tarifas.fora_baixa_tensao_b1_b2_b3 ?? null, 0)} from other subgroups, {num(g.universo_tarifas.modalidade_nao_convencional ?? null, 0)} from other modalities,{" "}
                        {num(g.universo_tarifas.detalhe_especifico ?? null, 0)} with specific detail).
                      </>,
                    )}{" "}
                    {dadoNo(g.regras.zero_publicado, "conta-regra-zero", idioma)} {dadoNo(g.regras.unidade, "conta-regra-unidade", idioma)}
                  </p>
                  <ContaTabelaSobDemanda
                    chaveUrl="semvig"
                    rotulo={tx("a lista de distribuidoras sem tarifa vigente", "the list of distribution utilities without a tariff in force")}
                    detalhe={tx(`${linhasSemVigente.length} linhas`, `${linhasSemVigente.length} rows`)}
                    titulo={tx("Distribuidoras com tarifa B1 no conjunto e sem vigência na data", "Distribution utilities with a B1 tariff in the dataset and no validity period on the date")}
                    colunas={COLUNAS_SEM_VIGENTE}
                    linhas={compactarLinhasTabela(COLUNAS_SEM_VIGENTE, linhasSemVigente)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={fonteTarifas()}
                    versao={ref}
                    nomeArquivo="conta-distribuidoras-sem-tarifa-vigente"
                    ordemInicial={{ coluna: "dias", direcao: "asc" }} // i18n: dado
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Vigências sobrepostas na fonte: {g.conflitos_fonte.total} casos no recorte, {g.conflitos_fonte.b1_residencial.length} na tarifa B1 residencial de aplicação.
                      </>,
                      <>
                        Overlapping validity periods in the source: {g.conflitos_fonte.total} cases in the scope, {g.conflitos_fonte.b1_residencial.length} in the applied residential B1 tariff.
                      </>,
                    )}{" "}
                    {dadoNo(g.conflitos_fonte.regra, "conta-conflitos-regra", idioma)}{" "}
                    <a href={g.conflitos_fonte.download} download className="text-energia-dark underline underline-offset-4">
                      {tx("Baixar os casos e a escolha feita (CSV)", "Download the cases and the choice made (CSV)")}
                    </a>
                    .
                  </p>
                  {g.siglas_substituidas.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {tx("Siglas substituídas:", "Replaced acronyms:")}{" "}
                      {g.siglas_substituidas.map((s, i) => (
                        <span key={s.cnpj}>
                          {i > 0 ? "; " : ""}
                          {tx(
                            <>
                              CNPJ {s.cnpj} publicado como &quot;{s.sigla_tarifas}&quot; e exibido como {s.sigla_usada} ({s.fonte})
                            </>,
                            <>
                              CNPJ {s.cnpj} published as &quot;<Nome>{s.sigla_tarifas}</Nome>&quot; and shown as {s.sigla_usada} ({dadoNo(s.fonte, "conta-sigla-fonte", idioma)})
                            </>,
                          )}
                        </span>
                      ))}
                      .
                    </p>
                  )}
                </Auditoria>

                <Seguir
                  ancora="tarifa"
                  proximo={{ href: "#composicao", pergunta: tx("Para onde vai esse valor? Veja a composição da tarifa.", "Where does that money go? See the tariff composition.") }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_tarifas_b1_vigentes.csv", "conta_tarifas_bt_historico.csv", "conta_historico_b1.json", "conta_conflitos_fonte.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- os três números que se confundem com a conta ---------------- */}
          <Bloco id="tres-numeros">
            <section aria-labelledby="tres-numeros-titulo" className="border-t border-linha pt-6">
              <h2 id="tres-numeros-titulo" className="ed-h2 font-serif text-carvao">
                {tx("Três números que costumam ser chamados de conta de luz", "Three numbers often called the electricity bill")}
              </h2>
              <ul className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-3">
                <li className="min-w-0 border-l-2 border-linha pl-4">
                  <h3 className="rotulo text-mineral">{tx("Tarifa homologada (usada aqui)", "Ratified tariff (used here)")}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{dadoNo(g.definicoes.tarifa_homologada, "conta-definicao", idioma)}</p>
                </li>
                <li className="min-w-0 border-l-2 border-linha pl-4">
                  <h3 className="rotulo text-mineral">{tx("Tarifa média de fornecimento (não publicada)", "Average supply tariff (not published)")}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{dadoNo(g.definicoes.tarifa_media_fornecimento, "conta-definicao", idioma)}</p>
                  <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-carvao" data-estado="indisponivel">
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-block h-3.5 w-3.5 shrink-0 border border-mineral"
                      style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
                    />
                    <span>
                      <span className="font-medium">{tx("Indisponível nesta publicação.", "Unavailable in this publication.")}</span>{" "}
                      {tx(
                        "Não há base oficial estruturada com receita, energia e tributos que sirva para calcular a tarifa média, e o observatório não a publica. Para o preço da energia por distribuidora, vale a tarifa homologada desta página.",
                        "There is no structured official database with revenue, energy and taxes that can be used to calculate the average tariff, and the observatory does not publish it. For the price of energy by distribution utility, use the ratified tariff on this page.",
                      )}
                    </span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-nivel="analisar">
                    {tx("Motivo da coleta:", "Collection note:")} {dadoNo(g.tarifa_media_fornecimento.motivo, "conta-tarifa-media-motivo", idioma)}
                  </p>
                </li>
                <li className="min-w-0 border-l-2 border-linha pl-4">
                  <h3 className="rotulo text-mineral">{tx("Conta simulada (estimativa)", "Simulated bill (estimate)")}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{dadoNo(g.definicoes.conta_simulada, "conta-definicao", idioma)}</p>
                </li>
              </ul>
              <p className="mt-4 max-w-prose2 text-sm text-carvao-muted">{dadoNo(g.definicoes.nao_e_conta, "conta-definicao", idioma)}</p>
            </section>
          </Bloco>

          {/* ---------------- P048 ---------------- */}
          <Bloco id="composicao">
            <PainelEvidencia
              id="p048"
              pergunta={tx("Para onde vai o valor da conta?", "Where does the bill money go?")}
              subtitulo={tx(
                "Componentes tarifárias da tarifa B1 residencial agrupadas · R$/MWh e % de TE + TUSD",
                "Grouped tariff components of the residential B1 tariff · R$/MWh and % of TE + TUSD",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Mostra quanto da tarifa paga a energia comprada, a transmissão, a rede de distribuição, as perdas e os encargos setoriais, a partir das componentes que a ANEEL
                  publica para cada processo tarifário.
                </>,
                <>
                  It shows how much of the tariff pays for purchased energy, transmission, the distribution grid, losses and sector charges, based on the components that ANEEL publishes for each
                  tariff process.
                </>,
              )}
              oQueMudou={oQueMudouComposicao}
              comoInterpretar={comoInterpretarComposicao}
              naoConcluir={naoConcluirComposicao}
              naoConcluirNoCorpo
              proveniencia={comp.proveniencia}
            >
              <div className="space-y-6">
                <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
                  <div className="min-w-0 space-y-4">
                    <RespostaCurta id="p048" veredito={vereditoComposicao(comp)}>
                      {respostaComposicao(comp)}
                    </RespostaCurta>
                    {tresValores && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="tres-valores-tipicos">
                        {tresValores}
                      </p>
                    )}
                  </div>
                  <div className="space-y-4">
                    {/* O destaque é o agregado, o mesmo número da frase de abertura: razão de somas das distribuidoras com componentes. A gold só
                        publica ficha de prova para a distribuidora de exemplo (abaixo), então o agregado diz de onde vem em vez de levar ficha. */}
                    <Numero
                      variante="faixa"
                      rotulo={tx(
                        `Encargos setoriais na tarifa média de ${comp.media?.n ?? comp.distribuidoras.length} distribuidoras`,
                        `Sector charges in the average tariff of ${comp.media?.n ?? comp.distribuidoras.length} distribution utilities`,
                      )}
                      natureza="CALCULADO"
                      valor={comp.media?.grupos_pct.encargos ?? null}
                      formato="pct"
                      casas={1}
                      evidencia={null}
                      motivoAusencia={tx("Sem composição média publicada.", "No average composition published.")}
                      nota={tx(
                        "Soma dos encargos de todas dividida pela soma das tarifas (razão de somas). Sem ficha própria: a prova publicada é a do exemplo abaixo, e o cálculo do agregado está na tabela de decomposição.",
                        "Sum of all sector charges divided by the sum of the tariffs (ratio of sums). No sheet of its own: the published evidence is that of the example below, and the aggregate calculation is in the breakdown table.",
                      )}
                      endereco="/setor-eletrico/conta-de-luz#composicao"
                    />
                    <div className="border-t border-linha pt-4">
                      <Numero
                        variante="faixa"
                        rotulo={tx(
                          `Exemplo: encargos na ${comp.evidencia?.entidade ?? "distribuidora de referência"}, de tarifa mais próxima da mediana`,
                          `Example: sector charges at ${comp.evidencia?.entidade ?? "the reference distribution utility"}, the tariff closest to the median`,
                        )}
                        natureza="CALCULADO"
                        evidencia={comProcedimentoExterno(comp.evidencia)}
                        formato="pct"
                        casas={1}
                        motivoAusencia={tx("Sem componentes para a distribuidora de referência.", "No components for the reference distribution utility.")}
                        nota={
                          comp.evidencia
                            ? tx(`Uma distribuidora, não a média: ${comp.evidencia.universo}.`, `One distribution utility, not the average: ${dadoTexto(comp.evidencia.universo, idioma)}.`)
                            : undefined
                        }
                        endereco="/setor-eletrico/conta-de-luz#composicao"
                      />
                    </div>
                  </div>
                  {/* A parcela CDE média está na resposta acima e na linha "Dos encargos: componentes CDE" da
                      tabela de decomposição; a gold não traz evidência própria para ela, então não vira destaque. */}
                </div>
                <ContaComposicao
                  composicao={compactarComposicao(comp)}
                  vigentes={vigentesCompactos}
                  referencia={sim.casos_referencia.cnpj}
                  dataReferencia={ref}
                  fonte={tx("ANEEL, Componentes Tarifárias", "ANEEL, Tariff Components")}
                />
                <Recorte
                  periodo={tx(
                    <>Componentes da vigência que cobre {dataBR(ref)}, a mesma classe, modalidade e data do comparativo</>,
                    <>Components of the validity period covering {dataBR(ref)}, the same class, modality and date as the comparison</>,
                  )}
                  universo={tx(
                    <>
                      {comp.distribuidoras.length} distribuidoras com componentes; sem componentes para o ato vigente: {comp.reconciliacao.sem_componentes.join(", ") || "nenhuma"}
                    </>,
                    <>
                      {comp.distribuidoras.length} distribution utilities with components; without components for the act in force: {comp.reconciliacao.sem_componentes.join(", ") || "none"}
                    </>,
                  )}
                  unidade={tx("R$/MWh de TE + TUSD (ou % da tarifa)", "R$/MWh of TE + TUSD (or % of the tariff)")}
                />
                <NotasDoPainel oQueMudou={oQueMudouComposicao} comoInterpretar={comoInterpretarComposicao} naoConcluir={naoConcluirComposicao} />
                <Auditoria titulo={tx("Componentes de cada grupo, valores atípicos e conferências", "Components of each group, outliers and checks")}>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {comp.grupos.map((gr) => (
                      <div key={gr.id}>
                        <dt className="font-medium text-carvao">{dadoNo(gr.rotulo, "conta-grupo", idioma)}</dt>
                        <dd className="mt-0.5 text-carvao-muted">
                          {gr.componentes.length
                            ? gr.componentes.map((c, i) => (
                                <span key={c.codigo}>
                                  {i > 0 ? "; " : ""}
                                  {c.codigo} ({c.descricao ? dadoNo(c.descricao, "conta-componente", idioma) : tx("sem descrição no dicionário", "no description in the dictionary")})
                                </span>
                              ))
                            : tx("sem código próprio: recebe valor negativo de componente de custo.", "no code of its own: receives the negative value of a cost component.")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-carvao-muted">
                    {tx("Classificação:", "Classification:")} {dadoNo(comp.classificacao, "conta-classificacao", idioma)}. {tx("Fora da tarifa homologada:", "Outside the ratified tariff:")}{" "}
                    {comp.excluidos.map((x) => dadoTexto(x, idioma)).join(", ")}.
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx("Regra de atípico:", "Outlier rule:")} {dadoNo(comp.regra_atipico, "conta-regra-atipico", idioma)}.{" "}
                    {tx("Cada valor abaixo foi conferido no arquivo original da ANEEL e mantido.", "Each value below was checked in ANEEL's original file and kept.")}
                  </p>
                  <ContaTabelaSobDemanda
                    chaveUrl="atip"
                    rotulo={tx("as componentes atípicas", "the outlier components")}
                    detalhe={tx(`${linhasAtipicas.length} linhas`, `${linhasAtipicas.length} rows`)}
                    titulo={tx(`Componentes atípicas na vigência de ${dataBR(ref)}`, `Outlier components in the validity period of ${dataBR(ref)}`)}
                    colunas={COLUNAS_ATIPICAS}
                    linhas={compactarLinhasTabela(COLUNAS_ATIPICAS, linhasAtipicas)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={tx("ANEEL, Componentes Tarifárias", "ANEEL, Tariff Components")}
                    versao={ref}
                    nomeArquivo="conta-componentes-atipicas"
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Conferência das parcelas: {comp.reconciliacao.conferidas} distribuidoras com TE e TUSD iguais nos dois conjuntos da ANEEL,{" "}
                        {comp.reconciliacao.divergentes.length} divergentes, sem componentes: {comp.reconciliacao.sem_componentes.join(", ") || "nenhuma"}. Repetições no arquivo:{" "}
                        {comp.reconciliacao.duplicatas_fonte.iguais} iguais e {comp.reconciliacao.duplicatas_fonte.conflitantes} com valor diferente (
                        {comp.reconciliacao.duplicatas_fonte.regra}).
                      </>,
                      <>
                        Check of the items: {comp.reconciliacao.conferidas} distribution utilities with equal TE and TUSD in ANEEL&apos;s two datasets, {comp.reconciliacao.divergentes.length}{" "}
                        divergent, without components: {comp.reconciliacao.sem_componentes.join(", ") || "none"}. Repetitions in the file: {comp.reconciliacao.duplicatas_fonte.iguais} equal and{" "}
                        {comp.reconciliacao.duplicatas_fonte.conflitantes} with a different value ({dadoNo(comp.reconciliacao.duplicatas_fonte.regra, "conta-duplicatas-regra", idioma)}).
                      </>,
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx("Documento que sustenta a leitura do crédito:", "Document supporting the credit reading:")}{" "}
                    {comp.creditos.documento.map((id, i) => {
                      const d = g.documentos.find((x) => x.id === id);
                      const estado = comp.creditos.documento_estado[id] === "CONFERIDA" ? tx("trechos conferidos na captura", "excerpts checked at capture") : tx("trechos não reconferidos", "excerpts not rechecked");
                      return (
                        <span key={id}>
                          {i > 0 ? "; " : ""}
                          {d ? (
                            <>
                              <TrechoPortugues regiao="conta-documento-titulo">{d.titulo}</TrechoPortugues> ({estado})
                            </>
                          ) : (
                            id
                          )}
                        </span>
                      );
                    })}
                    .
                  </p>
                </Auditoria>
                <Seguir
                  ancora="composicao"
                  proximo={{ href: "#simulador", pergunta: tx("Quanto ficaria a minha conta? Simule o seu consumo.", "What would my bill be? Simulate your consumption.") }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_composicao_b1.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P049 ---------------- */}
          <Bloco id="simulador">
            <PainelEvidencia
              id="p049"
              pergunta={tx("Como a minha conta varia com o consumo e o perfil?", "How does my bill vary with consumption and profile?")}
              subtitulo={tx(
                "Simulação com as tarifas vigentes e as regras publicadas · R$/mês, estimativa sem tributos",
                "Simulation with the tariffs in force and the published rules · R$/month, estimate without taxes",
              )}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  Mostra como a regra de cada classe (mínimo da ligação, faixas da Tarifa Social e do Desconto Social, bandeira) transforma kWh em reais, com a tarifa vigente da
                  distribuidora escolhida.
                </>,
                <>
                  It shows how the rule of each class (connection minimum, <Nome>Tarifa Social</Nome> and <Nome>Desconto Social</Nome> bands, tariff flag) turns kWh into reais, with the tariff in
                  force at the chosen distribution utility.
                </>,
              )}
              oQueMudou={oQueMudouSimulador}
              comoInterpretar={comoInterpretarSimulador}
              naoConcluir={naoConcluirSimulador}
              naoConcluirNoCorpo
              proveniencia={sim.proveniencia}
              complementares={[{ rotulo: tx("Bandeiras", "Tariff flags"), p: band.proveniencia }]}
            >
              <div className="space-y-6">
                <ContaSimulador
                  simulador={{
                    classes: sim.classes,
                    regras: sim.regras,
                    regras_texto: sim.regras_texto,
                    estado_regras: sim.estado_regras,
                    bandeiras: sim.bandeiras,
                    bandeira_vigente: sim.bandeira_vigente,
                    distribuidoras: compactarDistribuidorasSim(sim.distribuidoras),
                    rotulo: sim.rotulo,
                    formula: sim.formula,
                    chaves_tarifa: sim.chaves_tarifa,
                    referencia: {
                      cnpj: sim.casos_referencia.cnpj,
                      sigla: sim.casos_referencia.sigla,
                    },
                  }}
                  evidencia={comProcedimentoExterno(sim.evidencia)}
                  dataReferencia={ref}
                  info={info}
                />
                <Recorte
                  periodo={tx(
                    <>
                      Tarifas vigentes em {dataBR(ref)}; bandeira de {sim.bandeira_vigente ? mesAno(`${sim.bandeira_vigente.mes}-01`) : "mês não publicado"}
                    </>,
                    <>
                      Tariffs in force on {dataBR(ref)}; tariff flag for {sim.bandeira_vigente ? mesAno(`${sim.bandeira_vigente.mes}-01`) : "month not published"}
                    </>,
                  )}
                  universo={tx(
                    <>
                      Uma unidade consumidora de baixa tensão; {sim.distribuidoras.length} distribuidoras com tarifa vigente (Desconto Social em {sim.cobertura_classes.ds1})
                    </>,
                    <>
                      One low-voltage consumer unit; {sim.distribuidoras.length} distribution utilities with a tariff in force (<Nome>Desconto Social</Nome> at {sim.cobertura_classes.ds1})
                    </>,
                  )}
                  unidade={tx("R$/mês (estimativa); tarifas em R$/kWh", "R$/month (estimate); tariffs in R$/kWh")}
                />
                <NotasDoPainel oQueMudou={oQueMudouSimulador} comoInterpretar={comoInterpretarSimulador} naoConcluir={naoConcluirSimulador} />
                <Auditoria titulo={tx("Normas conferidas e casos de referência", "Rules checked and reference cases")}>
                  <ul className="space-y-3 text-sm">
                    {sim.normas.map((n) => (
                      <li key={n.id} className="border-l-2 border-linha pl-3">
                        <a href={n.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                          <Nome>{n.titulo}</Nome>
                        </a>{" "}
                        <span className="text-carvao-muted">
                          (<Nome>{n.orgao}</Nome>;{" "}
                          {n.estado === "CONFERIDA"
                            ? tx(`trechos conferidos na captura de ${carimbo(n.conferido_em)}`, `excerpts checked at the capture of ${carimbo(n.conferido_em)}`)
                            : n.estado === "NAO_RECONFERIDA"
                              ? tx("trecho ausente na última captura", "excerpt missing from the latest capture")
                              : tx("não capturada", "not captured")}
                          ; {dadoNo(n.licenca, "conta-norma-licenca", idioma)})
                        </span>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-carvao-muted">
                          {n.trechos.map((tr) => (
                            <li key={tr.trecho}>
                              “<TrechoPortugues regiao="conta-norma-trecho">{tr.trecho}</TrechoPortugues>” {tr.presente ? tx("(presente)", "(present)") : tx("(ausente na captura)", "(missing from the capture)")}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {sim.regras_texto.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium text-carvao">{dadoNo(r.texto, "conta-regra-texto", idioma)}</span> {tx("Estado:", "Status:")}{" "}
                        {r.estado === "CONFERIDA" ? tx("conferida", "checked") : r.estado === "PARCIAL" ? tx("parcialmente conferida", "partially checked") : tx("não conferida", "not checked")}.
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Casos calculados pelo pipeline para {rotuloDistribuidora(sim.casos_referencia.sigla, sim.casos_referencia.cnpj)} ({sim.casos_referencia.criterio}); o simulador
                        desta página reproduz cada um (teste automatizado). Sem valor: simulação indisponível para a classe.
                      </>,
                      <>
                        Cases calculated by the pipeline for {rotuloDistribuidora(sim.casos_referencia.sigla, sim.casos_referencia.cnpj)} (
                        {dadoNo(sim.casos_referencia.criterio, "conta-casos-criterio", idioma)}); the simulator on this page reproduces each one (automated test). No value: simulation unavailable
                        for the class.
                      </>,
                    )}
                  </p>
                  <ContaTabelaSobDemanda
                    chaveUrl="casos"
                    rotulo={tx("os casos de referência do simulador", "the simulator reference cases")}
                    detalhe={tx(`${linhasCasos.length} casos`, `${linhasCasos.length} cases`)}
                    titulo={tx("Casos de referência do simulador", "Simulator reference cases")}
                    colunas={COLUNAS_CASOS}
                    linhas={compactarLinhasTabela(COLUNAS_CASOS, linhasCasos)}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte={fonteTarifas()}
                    versao={ref}
                    nomeArquivo="conta-simulador-casos-referencia"
                  />
                </Auditoria>
                <Seguir
                  ancora="simulador"
                  proximo={{ href: "#p050", pergunta: tx("O que mudou na tarifa e quem financia os descontos?", "What changed in the tariff and who funds the discounts?") }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_tarifas_b1_vigentes.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P050 (página própria) ---------------- */}
          <Bloco id="p050">
            <section aria-labelledby="p050-titulo" data-navegacao-local="capitulos" className="border-t border-linha pt-6">
              <h2 id="p050-titulo" className="ed-h2 font-serif text-carvao">
                {tx("O que mudou e quem financia os benefícios?", "What changed and who funds the benefits?")}
              </h2>
              <p className="mt-2 text-sm text-carvao-muted">
                {tx(
                  "Variação da tarifa B1 contra o IPCA, bandeiras acionadas e financiamento dos descontos pela CDE. Os painéis completos, com gráfico, tabela e provas, estão em página própria.",
                  "Change in the B1 tariff against the IPCA, tariff flags activated and funding of the discounts by the CDE. The full panels, with chart, table and evidence, are on their own page.",
                )}
              </p>
              <ol className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-3">
                {[
                  {
                    ancora: "reajustes",
                    pergunta: tx("A tarifa subiu mais que a inflação?", "Did the tariff rise more than inflation?"),
                    veredito: janela12 ? vereditoReajustes(janela12) : tx("Sem janela de 12 meses publicada.", "No 12-month window published."),
                    resposta: janela12 ? respostaReajustes(janela12) : tx("Sem janela de 12 meses publicada.", "No 12-month window published."),
                  },
                  {
                    ancora: "bandeiras",
                    pergunta: tx("Quando a bandeira encareceu a conta?", "When did the tariff flag make the bill more expensive?"),
                    veredito: vereditoBandeira(band),
                    resposta: respostaBandeira(band),
                  },
                  {
                    ancora: "subsidios",
                    pergunta: tx("Quem financia os descontos e benefícios?", "Who funds the discounts and benefits?"),
                    veredito: vereditoSubsidios(sub),
                    resposta: `${respostaSubsidios(sub)} ${respostaCde(cde)}`,
                  },
                ].map((x) => (
                  <li key={x.ancora} className="flex min-w-0 flex-col border-l-2 border-linha pl-4">
                    <h3 className="ed-h3 font-serif text-carvao">{x.pergunta}</h3>
                    <div className="mt-2 flex-1">
                      <RespostaCurta id={`p050-${x.ancora}`} tamanho="sm" veredito={x.veredito}>
                        {x.resposta}
                      </RespostaCurta>
                    </div>
                    <ContaLinkFiltros
                      href={`${ROTA_REAJUSTES}#${x.ancora}`}
                      className="mt-2 inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
                    >
                      {tx("Ver o painel com gráfico, tabela e provas", "See the panel with chart, table and evidence")}
                    </ContaLinkFiltros>
                  </li>
                ))}
              </ol>
            </section>
          </Bloco>

          {/* ---------------- Auditoria geral ---------------- */}
          <Bloco nivel="auditar" id="auditoria-conta">
            <section aria-labelledby="auditoria-conta-titulo" className="space-y-5 border-t border-dashed border-linha pt-6">
              <h2 id="auditoria-conta-titulo" className="ed-h2 font-serif text-carvao">
                {tx("Validação, tarifa média avaliada e arquivos", "Validation, average tariff assessed and files")}
              </h2>
              <div>
                <h3 className="font-medium text-carvao">{tx("Regras conferidas antes de publicar", "Rules checked before publishing")}</h3>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                  {g.validacao.regras.map((r) => (
                    <li key={r}>{dadoNo(r, "conta-validacao-regra", idioma)}</li>
                  ))}
                </ul>
                <h3 className="mt-4 font-medium text-carvao">{tx(`Ressalvas desta publicação (${g.validacao.ressalvas.length})`, `Caveats of this publication (${g.validacao.ressalvas.length})`)}</h3>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                  {g.validacao.ressalvas.map((r) => (
                    <li key={r}>{dadoNo(r, "conta-validacao-ressalva", idioma)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-carvao">{tx("Tarifa média de fornecimento: alternativa avaliada e não usada", "Average supply tariff: alternative assessed and not used")}</h3>
                <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{dadoNo(g.tarifa_media_fornecimento.motivo, "conta-tarifa-media-motivo", idioma)}</p>
                {g.tarifa_media_fornecimento.alternativa_avaliada && "arquivo" in g.tarifa_media_fornecimento.alternativa_avaliada && (
                  <div className="mt-2 text-sm text-carvao-muted">
                    <p>
                      {g.tarifa_media_fornecimento.alternativa_avaliada.orgao}, <Nome>{g.tarifa_media_fornecimento.alternativa_avaliada.conjunto}</Nome>, {tx("recurso", "resource")}{" "}
                      {g.tarifa_media_fornecimento.alternativa_avaliada.recurso} ({tx(`${num(g.tarifa_media_fornecimento.alternativa_avaliada.linhas_lidas, 0)} linhas`, `${num(g.tarifa_media_fornecimento.alternativa_avaliada.linhas_lidas, 0)} rows`)}, sha256{" "}
                      <code className="break-all text-xs">{g.tarifa_media_fornecimento.alternativa_avaliada.sha256}</code>
                      ). {tx("Regra:", "Rule:")} {dadoNo(g.tarifa_media_fornecimento.alternativa_avaliada.regra_atipico, "conta-alternativa-regra", idioma)}.{" "}
                      {tx(
                        <>
                          {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_com_mes_atipico} de {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_no_recorte} distribuidoras
                          com mês atípico:
                        </>,
                        <>
                          {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_com_mes_atipico} of {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_no_recorte} distribution
                          utilities with an outlier month:
                        </>,
                      )}
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {g.tarifa_media_fornecimento.alternativa_avaliada.meses_atipicos.map((m) => (
                        <li key={`${m.cnpj}|${m.linha}|${m.mes}`}>
                          {rotuloDistribuidora(m.sigla, m.cnpj)}, <Nome>{m.linha}</Nome>, {mesAno(`${m.mes.slice(0, 7)}-01`)}:{" "}
                          {tx(
                            <>
                              {reais(m.valor_rs === null ? null : m.valor_rs / 1e9, 2)} bilhões contra mediana de {reais(m.mediana_outros_meses_rs === null ? null : m.mediana_outros_meses_rs / 1e9, 2)}{" "}
                              bilhões nos outros meses (razão {num(m.razao, 1)}
                              ).
                            </>,
                            <>
                              {reais(m.valor_rs === null ? null : m.valor_rs / 1e9, 2)} billion against a median of {reais(m.mediana_outros_meses_rs === null ? null : m.mediana_outros_meses_rs / 1e9, 2)}{" "}
                              billion in the other months (ratio {num(m.razao, 1)}
                              ).
                            </>,
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-carvao">{tx("Documentos oficiais conferidos a cada captura", "Official documents checked at each capture")}</h3>
                <ul className="mt-2 space-y-1 text-sm text-carvao-muted">
                  {g.documentos.map((d) => (
                    <li key={d.id}>
                      <a href={d.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                        <TrechoPortugues regiao="conta-documento-titulo">{d.titulo}</TrechoPortugues>
                      </a>{" "}
                      ({d.estado === "CONFERIDA" ? tx(`trechos conferidos em ${carimbo(d.conferido_em)}`, `excerpts checked on ${carimbo(d.conferido_em)}`) : tx("trechos não reconferidos", "excerpts not rechecked")};{" "}
                      {dadoNo(d.licenca, "conta-documento-licenca", idioma)})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-carvao">{tx("Arquivos para download", "Files for download")}</h3>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {g.downloads.map((d) => (
                    <li key={d.url}>
                      <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {dadoNo(d.rotulo, "conta-download", idioma)}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-mineral">
                  {tx(
                    <>
                      Gerado por {g.versao_pipeline} (código {g.versao_codigo ?? "sem versão"}) em {carimbo(g.gerado_em)}. Método completo no documento do módulo
                      (docs/observatorios/energia/modulos/conta.md), na pasta de documentação indicada em{" "}
                    </>,
                    <>
                      Generated by {g.versao_pipeline} (code {g.versao_codigo ?? "no version"}) on {carimbo(g.gerado_em)}. Full method in the module document
                      (docs/observatorios/energia/modulos/conta.md), in the documentation folder indicated in{" "}
                    </>,
                  )}
                  <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                    {tx("Metodologia", "Methodology")}
                  </Link>
                  .
                </p>
              </div>
            </section>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
