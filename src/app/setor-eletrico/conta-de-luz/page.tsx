import type { Metadata } from "next";
import Link from "next/link";
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
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { infoDasDistribuidoras, lerHistoricoB1 } from "./dados";
import { Auditoria, Datas, FONTE_TARIFAS, Navegacao, ROTA_REAJUSTES, Recorte, Seguir, downloadsDoPainel } from "./partes";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Conta de luz: tarifas, composição, simulador e reajustes",
  description:
    "Tarifa B1 residencial de aplicação de cada distribuidora (ANEEL), custo de perfis de consumo comparáveis, composição da tarifa, simulador sem tributos, variação contra o IPCA, bandeiras, subsídios tarifários e orçamento da CDE.",
  alternates: { canonical: "/setor-eletrico/conta-de-luz" },
};

const COLUNAS_SEM_VIGENTE: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "inicio", rotulo: "Início da última vigência", tipo: "data" },
  { id: "fim", rotulo: "Fim da última vigência", tipo: "data" },
  { id: "ato", rotulo: "Ato", tipo: "texto", literal: { classe: "ato-retificacao-sem-numero", origem: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica" } },
  { id: "dias", rotulo: "Dias sem tarifa", tipo: "numero", casas: 0 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "motivo", rotulo: "Motivo", tipo: "texto" },
];

const COLUNAS_ATIPICAS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "codigo", rotulo: "Componente", tipo: "texto", categorica: true },
  { id: "valor", rotulo: "Valor", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pct", rotulo: "Da tarifa", tipo: "percentual", casas: 1 },
  {
    id: "mediana",
    rotulo: "Mediana do módulo",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  { id: "grupo_codigo", rotulo: "Grupo pelo código", tipo: "texto" },
  { id: "grupo_usado", rotulo: "Grupo usado", tipo: "texto" },
  { id: "criterios", rotulo: "Critério", tipo: "texto" },
];

const COLUNAS_CASOS: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe", tipo: "texto", categorica: true },
  { id: "kwh", rotulo: "Consumo", tipo: "numero", unidade: "kWh", casas: 0 },
  { id: "ligacao", rotulo: "Ligação", tipo: "texto", categorica: true },
  { id: "bandeira", rotulo: "Bandeira", tipo: "texto", categorica: true },
  {
    id: "total",
    rotulo: "Estimativa",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
  {
    id: "parcela_bandeira",
    rotulo: "Parcela da bandeira",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
];

export default function ContaDeLuzPage() {
  const g = lerGold<ContaGold>("conta.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="conta-de-luz" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo="Conta de luz indisponível nesta publicação"
            motivo={
              g?.motivo ??
              "A gold do módulo Conta de luz (public/energia/gold/conta.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
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

  const entidades = compactarEntidades(t.vigentes, t.sem_vigente);

  const linhasSemVigente = t.sem_vigente.map((s) => ({
    id: s.cnpj,
    sigla: rotuloDistribuidora(s.sigla, s.cnpj),
    cnpj: s.cnpj,
    inicio: s.ultima_vigencia.inicio,
    fim: s.ultima_vigencia.fim,
    ato: s.ultima_vigencia.ato,
    dias: s.dias_sem_tarifa,
    situacao: s.incorporada_por ? "incorporada" : s.dias_sem_tarifa <= 90 ? "vigência encerrada há até 90 dias" : "sem tarifa há mais de 90 dias",
    motivo: s.motivo,
  }));

  const rotuloGrupo = new Map(comp.grupos.map((x) => [x.id, x.rotulo]));
  const linhasAtipicas = comp.componentes_atipicas.map((a) => ({
    id: `${a.cnpj}|${a.codigo}`,
    sigla: rotuloDistribuidora(a.sigla, a.cnpj),
    codigo: a.codigo,
    valor: a.valor,
    pct: a.pct_tarifa,
    mediana: a.mediana_modulo_rs_mwh,
    grupo_codigo: rotuloGrupo.get(a.grupo_pelo_codigo) ?? a.grupo_pelo_codigo,
    grupo_usado: rotuloGrupo.get(a.grupo_usado) ?? a.grupo_usado,
    criterios: a.criterios.join("; "),
  }));

  const rotuloClasse = new Map(sim.classes.map((c) => [c.id, c.rotulo]));
  const linhasCasos = sim.casos_referencia.casos.map(([classe, kwh, ligacao, bandeira, total, parcela], i) => ({
    id: String(i),
    classe: rotuloClasse.get(classe) ?? classe,
    kwh,
    ligacao,
    bandeira,
    total,
    parcela_bandeira: parcela,
  }));

  // notas do painel de tarifas: ficam logo depois das figuras (o painel é composto e as passa ao corpo)
  const oQueMudouTarifa = mudancaTarifa(ref, t.resumo, evolucao, comparacao);
  const comoInterpretarTarifa = (
    <>
      Cada barra é uma distribuidora (subgrupo B1, residencial, modalidade convencional, tarifa de aplicação). O custo do perfil é kWh × (TE + TUSD) ÷ 1000;{" "}
      {semCustoDisponibilidade ? "nenhum perfil fica abaixo do maior " : "há perfil abaixo do maior "}
      <Termo slug="custo-de-disponibilidade">custo de disponibilidade</Termo> ({sim.regras.custo_disponibilidade_kwh.trifasico} kWh, ligação trifásica)
      {semCustoDisponibilidade
        ? ", então o mínimo não muda a comparação."
        : ": nesse perfil, o mínimo da ligação pode valer mais que o consumo, e o custo publicado não o considera."}{" "}
      A faixa clara da primeira figura vai do 1º ao 3º quartil. A base econômica, na tabela, é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo. No modo
      Analisar, o histórico mostra até quatro distribuidoras sobre a mediana nacional.
    </>
  );
  const naoConcluirTarifa = (
    <>
      Não é a conta final: faltam ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. Não é a tarifa média de fornecimento. A mediana não é ponderada por consumidores e não representa o
      consumidor médio do país; os perfis de {g.perfis_kwh.join(", ")} kWh são referências do observatório, não consumo médio. A diferença de tarifa entre distribuidoras não mede a eficiência de nenhuma delas.
    </>
  );
  const oQueMudouComposicao = (
    <>
      {mudancaComposicaoEm(comp, ref)}
      <span data-nivel="analisar"> Leitura completa do valor negativo: {comp.creditos.leitura}.</span>
    </>
  );
  const comoInterpretarComposicao = (
    <>
      As partes positivas de cada barra passam do total, e os itens negativos (créditos e devoluções) trazem de volta: a soma de tudo é TE + TUSD. Os grupos seguem a classificação do
      observatório pelo código da componente; a parcela das componentes <Termo slug="cde">CDE</Termo> está dentro dos encargos e aparece à parte só para leitura. Na tabela de
      decomposição, a média fecha com o total e a mediana é lida grupo a grupo.
    </>
  );
  const naoConcluirComposicao = (
    <>
      Não se conclui margem ou lucro da distribuidora: o grupo distribuição é a remuneração regulada do fio, não resultado contábil. Não se conclui o valor em reais do crédito tarifário
      por distribuidora (o conjunto dá R$/MWh da tarifa B1, não o mercado a que se aplica). Tributos e iluminação pública não estão na tarifa homologada.
    </>
  );
  const oQueMudouSimulador = (
    <>
      Desde {dataBR(sim.regras.desconto_social_desde)}, o Desconto Social isenta das quotas da CDE o consumo de até {sim.regras.desconto_social_limite_kwh} kWh no mês; a Tarifa Social dá
      desconto integral até {sim.regras.tarifa_social_limite_kwh} kWh. Bandeira do mês publicado:{" "}
      {sim.bandeira_vigente?.bandeira ? `${minuscula(sim.bandeira_vigente.bandeira)} (${mesAno(`${sim.bandeira_vigente.mes}-01`)})` : "não publicada"}.
    </>
  );
  const comoInterpretarSimulador = (
    <>
      A memória de cálculo mostra cada parcela: kWh, preço por kWh e valor. O gráfico mostra a estimativa para todo consumo de zero ao limite do eixo; a linha muda de inclinação onde muda a
      regra. Cada regra traz o seu estado: conferida no texto oficial, ou parcial quando parte dela é leitura declarada.
    </>
  );
  const naoConcluirSimulador = (
    <>
      Não é a fatura: faltam ICMS, PIS/Pasep, Cofins, iluminação pública, multas, parcelamentos e serviços. A aplicação do Desconto Social por parcela, o mínimo da Tarifa Social acima de{" "}
      {sim.regras.tarifa_social_limite_kwh} kWh e a bandeira na Tarifa Social são leituras do observatório, não conferidas no texto da REN nº 1.000/2021. Bandeira não vale em sistemas
      isolados.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="conta-de-luz" />
      <MarcaVisita secao="energia:conta-de-luz" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <Navegacao atual="tarifas" />
        <CabecalhoModulo
          siglas={["TE", "TUSD", "ANEEL", "IPCA", "CDE", "PLD", "REN"]}
          titulo="Quanto custa o mesmo consumo?"
          lead="O mesmo consumo em quilowatt-hora (kWh) custa diferente conforme a distribuidora: cada área tem a sua tarifa de energia (TE) e de uso da rede (TUSD). Tributos, iluminação pública e bandeira ficam de fora."
          limite={
            <>
              Não é a fatura: faltam ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. O menor e o maior custo são das {t.resumo.n} distribuidoras com tarifa no arquivo de {dataBR(ref)} (de{" "}
              {cobertura.universo}), e a mediana não pesa por consumidores.
            </>
          }
          recorte={`${dataBR(ref)} · ${t.resumo.n} distribuidoras · B1 residencial convencional · R$/mês e R$/kWh`}
          fonte="ANEEL, tarifas de aplicação das distribuidoras"
          referencia={
            <>
              Tarifas de aplicação da ANEEL vigentes em {dataBR(ref)} (arquivo gerado pela fonte em {dataBR(g.gerado_pela_fonte_em)}); bandeira de{" "}
              {band.vigente ? mesAno(`${band.vigente.mes}-01`) : "mês não publicado"}; IPCA até {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "mês não publicado"}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <Datas
              itens={[
                { rotulo: "Tarifas e componentes", texto: `até ${dataBR(ref)}`, natureza: "CALCULADO" },
                { rotulo: "Bandeira do simulador", texto: band.vigente ? mesAno(`${band.vigente.mes}-01`) : "sem dado nesta publicação", natureza: "OBSERVADO" },
                { rotulo: "IPCA da série em reais", texto: ultimoIpca ? `até ${mesAno(`${ultimoIpca}-01`)}` : "sem dado nesta publicação", natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={<ContaFaixa vigentes={vigentesCompactos} resumo={t.resumo} dataReferencia={ref} evidenciaMediana={comProcedimentoExterno(t.evidencia_mediana)} comparacao={comparacao} info={info} cobertura={cobertura} />}
        >
          A distribuidora cobra pela energia (TE) e pelo uso da rede (TUSD) os valores que a ANEEL homologa para cada área. Esta página compara essas tarifas entre distribuidoras, mostra do que
          elas são feitas e estima a conta para um consumo; a variação contra a inflação, as bandeiras e quem paga os descontos estão em{" "}
          <ContaLinkFiltros href={ROTA_REAJUSTES} className="text-energia-dark underline underline-offset-4">
            reajustes, bandeiras e subsídios
          </ContaLinkFiltros>
          . Tributos e iluminação pública ficam fora: não há base oficial estruturada que os leve à tarifa de cada distribuidora.
        </CabecalhoModulo>

        <ModoProfundidade>
          {/* ---------------- P047 ---------------- */}
          <Bloco id="tarifa">
            <PainelEvidencia
              id="p047"
              pergunta="O mesmo consumo, da menor à maior tarifa"
              subtitulo="Tarifa B1 residencial convencional de aplicação (TE + TUSD) · R$/mês por perfil e R$/MWh"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A <Termo slug="tarifa-te-tusd">tarifa homologada</Termo> é a parte da conta que a ANEEL fixa para cada distribuidora: o mesmo consumo custa diferente conforme a
                  área de concessão. Comparar o mesmo perfil, na mesma classe, modalidade e base, isola essa diferença.
                </>
              }
              oQueMudou={oQueMudouTarifa}
              comoInterpretar={comoInterpretarTarifa}
              naoConcluir={naoConcluirTarifa}
              naoConcluirNoCorpo
              proveniencia={t.proveniencia}
              complementares={[
                {
                  rotulo: "Evolução mensal da mediana",
                  p: t.proveniencia_evolucao,
                },
                {
                  rotulo: "IPCA (IBGE), usado para a série em reais",
                  p: reaj.proveniencia_ipca,
                },
              ]}
            >
              <div className="space-y-6">
                <ContaTarifas
                  vigentes={vigentesCompactos}
                  resumo={t.resumo}
                  dataReferencia={ref}
                  fonte={FONTE_TARIFAS}
                  info={info}
                  fora={compactarFora(foraRank)}
                  recorte={
                    <Recorte
                      periodo={
                        <>
                          Tarifa vigente em {dataBR(ref)}; histórico de {mesAno(`${evolucao[0]?.m ?? ref.slice(0, 7)}-01`)} a {mesAno(`${evolucao.at(-1)?.m ?? ref.slice(0, 7)}-01`)}
                        </>
                      }
                      universo={
                        <>
                          {t.resumo.n} distribuidoras com vigência na data; {fora} fora do ranking (lista em Auditar)
                        </>
                      }
                      unidade="R$/mês para o perfil; R$/MWh para a tarifa (÷ 1000 = R$/kWh)"
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudouTarifa} comoInterpretar={comoInterpretarTarifa} naoConcluir={naoConcluirTarifa} />}
                />

                <SecaoDoPainel
                  id="evolucao"
                  titulo={serieReal ? `Como a mediana mudou desde ${mesAno(`${serieReal.inicio}-01`)}, com e sem a inflação?` : "Como a mediana mudou ao longo do tempo?"}
                  lead={textoSerieReal(serieReal)}
                >
                  <ContaSerieReal evolucao={evolucao} ultimoIpca={ultimoIpca} />
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="serie-real">
                    {serieReal
                      ? `Em cada mês a mediana é de ${serieReal.nMin === serieReal.nMax ? serieReal.nMin : `${serieReal.nMin} a ${serieReal.nMax}`} distribuidoras com tarifa no dia 1º, e o conjunto muda ao longo do tempo (fusões, incorporações, permissionárias que passam a ter tarifa própria); o ranking usa só as vigentes em ${dataBR(ref)}, e os dois números podem diferir; a comparação no mesmo conjunto está nas notas do painel. `
                      : ""}
                    {serieReal?.base
                      ? `Em reais de ${mesAno(`${serieReal.base}-01`)}, cada mês é corrigido pela razão entre o índice do IPCA de ${mesAno(`${serieReal.base}-01`)} e o do mês. O IPCA mede preços ao consumidor em geral, não só a energia.`
                      : "Sem IPCA publicado, a série em reais não é calculada."}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="historico"
                  nivel="analisar"
                  titulo="Como a tarifa de cada distribuidora evoluiu diante da mediana?"
                  lead={
                    <>
                      Tarifa vigente no dia 1º de cada mês. O arquivo começa em {t.evolucao[0] ? mesAno(`${t.evolucao[0][0]}-01`) : "mês não publicado"} com poucas distribuidoras, e a mediana só
                      aparece quando a cobertura passa do mínimo da regra (a partir de {evolucao[0] ? mesAno(`${evolucao[0].m}-01`) : "nenhum mês"}; regra nas limitações da evolução mensal, em Sobre este
                      dado). Incorporações aparecem como linhas verticais; todas as mudanças da distribuidora em destaque estão na tabela.
                    </>
                  }
                >
                  <ContaHistorico evolucao={evolucao} entidades={entidades} historicoUrl={t.historico_url} ultimoIpca={ultimoIpca} fonte={FONTE_TARIFAS} dataReferencia={ref} />
                </SecaoDoPainel>

                <Auditoria id="fora-do-ranking" titulo="Quem ficou fora do ranking e por quê">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Recorte do arquivo: {num(g.universo_tarifas.linhas_lidas ?? null, 0)} linhas lidas, {num(g.universo_tarifas.no_recorte ?? null, 0)} no recorte de baixa tensão convencional (
                    {num(g.universo_tarifas.fora_baixa_tensao_b1_b2_b3 ?? null, 0)} de outros subgrupos, {num(g.universo_tarifas.modalidade_nao_convencional ?? null, 0)} de outras modalidades,{" "}
                    {num(g.universo_tarifas.detalhe_especifico ?? null, 0)} com detalhe específico). {g.regras.zero_publicado} {g.regras.unidade}
                  </p>
                  <ContaTabelaSobDemanda
                    chaveUrl="semvig"
                    rotulo="a lista de distribuidoras sem tarifa vigente"
                    detalhe={`${linhasSemVigente.length} linhas`}
                    titulo="Distribuidoras com tarifa B1 no conjunto e sem vigência na data"
                    colunas={COLUNAS_SEM_VIGENTE}
                    linhas={compactarLinhasTabela(COLUNAS_SEM_VIGENTE, linhasSemVigente)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={FONTE_TARIFAS}
                    versao={ref}
                    nomeArquivo="conta-distribuidoras-sem-tarifa-vigente"
                    ordemInicial={{ coluna: "dias", direcao: "asc" }}
                  />
                  <p className="text-sm text-carvao-muted">
                    Vigências sobrepostas na fonte: {g.conflitos_fonte.total} casos no recorte, {g.conflitos_fonte.b1_residencial.length} na tarifa B1 residencial de aplicação.{" "}
                    {g.conflitos_fonte.regra}{" "}
                    <a href={g.conflitos_fonte.download} download className="text-energia-dark underline underline-offset-4">
                      Baixar os casos e a escolha feita (CSV)
                    </a>
                    .
                  </p>
                  {g.siglas_substituidas.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      Siglas substituídas:{" "}
                      {g.siglas_substituidas.map((s) => `CNPJ ${s.cnpj} publicado como "${s.sigla_tarifas}" e exibido como ${s.sigla_usada} (${s.fonte})`).join("; ")}.
                    </p>
                  )}
                </Auditoria>

                <Seguir
                  ancora="tarifa"
                  proximo={{ href: "#composicao", pergunta: "Para onde vai esse valor? Veja a composição da tarifa." }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_tarifas_b1_vigentes.csv", "conta_tarifas_bt_historico.csv", "conta_historico_b1.json", "conta_conflitos_fonte.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- os três números que se confundem com a conta ---------------- */}
          <Bloco id="tres-numeros">
            <section aria-labelledby="tres-numeros-titulo" className="border-t border-linha pt-6">
              <h2 id="tres-numeros-titulo" className="ed-h2 font-serif text-carvao">
                Três números que costumam ser chamados de conta de luz
              </h2>
              <ul className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-3">
                <li className="min-w-0 border-l-2 border-linha pl-4">
                  <h3 className="rotulo text-mineral">Tarifa homologada (usada aqui)</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{g.definicoes.tarifa_homologada}</p>
                </li>
                <li className="min-w-0 border-l-2 border-linha pl-4">
                  <h3 className="rotulo text-mineral">Tarifa média de fornecimento (não publicada)</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{g.definicoes.tarifa_media_fornecimento}</p>
                  <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-carvao" data-estado="indisponivel">
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-block h-3.5 w-3.5 shrink-0 border border-mineral"
                      style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
                    />
                    <span>
                      <span className="font-medium">Indisponível nesta publicação.</span> Não há base oficial estruturada com receita, energia e tributos que sirva para calcular a tarifa
                      média, e o observatório não a publica. Para o preço da energia por distribuidora, vale a tarifa homologada desta página.
                    </span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-nivel="analisar">
                    Motivo da coleta: {g.tarifa_media_fornecimento.motivo}
                  </p>
                </li>
                <li className="min-w-0 border-l-2 border-linha pl-4">
                  <h3 className="rotulo text-mineral">Conta simulada (estimativa)</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{g.definicoes.conta_simulada}</p>
                </li>
              </ul>
              <p className="mt-4 max-w-prose2 text-sm text-carvao-muted">{g.definicoes.nao_e_conta}</p>
            </section>
          </Bloco>

          {/* ---------------- P048 ---------------- */}
          <Bloco id="composicao">
            <PainelEvidencia
              id="p048"
              pergunta="Para onde vai o valor da conta?"
              subtitulo="Componentes tarifárias da tarifa B1 residencial agrupadas · R$/MWh e % de TE + TUSD"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Mostra quanto da tarifa paga a energia comprada, a transmissão, a rede de distribuição, as perdas e os encargos setoriais, a partir das componentes que a ANEEL
                  publica para cada processo tarifário.
                </>
              }
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
                      rotulo={`Encargos setoriais na tarifa média de ${comp.media?.n ?? comp.distribuidoras.length} distribuidoras`}
                      natureza="CALCULADO"
                      valor={comp.media?.grupos_pct.encargos ?? null}
                      formato="pct"
                      casas={1}
                      evidencia={null}
                      motivoAusencia="Sem composição média publicada."
                      nota="Soma dos encargos de todas dividida pela soma das tarifas (razão de somas). Sem ficha própria: a prova publicada é a do exemplo abaixo, e o cálculo do agregado está na tabela de decomposição."
                      endereco="/setor-eletrico/conta-de-luz#composicao"
                    />
                    <div className="border-t border-linha pt-4">
                      <Numero
                        variante="faixa"
                        rotulo={`Exemplo: encargos na ${comp.evidencia?.entidade ?? "distribuidora de referência"}, de tarifa mais próxima da mediana`}
                        natureza="CALCULADO"
                        evidencia={comProcedimentoExterno(comp.evidencia)}
                        formato="pct"
                        casas={1}
                        motivoAusencia="Sem componentes para a distribuidora de referência."
                        nota={comp.evidencia ? `Uma distribuidora, não a média: ${comp.evidencia.universo}.` : undefined}
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
                  fonte="ANEEL, Componentes Tarifárias"
                />
                <Recorte
                  periodo={<>Componentes da vigência que cobre {dataBR(ref)}, a mesma classe, modalidade e data do comparativo</>}
                  universo={
                    <>
                      {comp.distribuidoras.length} distribuidoras com componentes; sem componentes para o ato vigente: {comp.reconciliacao.sem_componentes.join(", ") || "nenhuma"}
                    </>
                  }
                  unidade="R$/MWh de TE + TUSD (ou % da tarifa)"
                />
                <NotasDoPainel oQueMudou={oQueMudouComposicao} comoInterpretar={comoInterpretarComposicao} naoConcluir={naoConcluirComposicao} />
                <Auditoria titulo="Componentes de cada grupo, valores atípicos e conferências">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {comp.grupos.map((gr) => (
                      <div key={gr.id}>
                        <dt className="font-medium text-carvao">{gr.rotulo}</dt>
                        <dd className="mt-0.5 text-carvao-muted">
                          {gr.componentes.length
                            ? gr.componentes.map((c) => `${c.codigo} (${c.descricao ?? "sem descrição no dicionário"})`).join("; ")
                            : "sem código próprio: recebe valor negativo de componente de custo."}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-carvao-muted">
                    Classificação: {comp.classificacao}. Fora da tarifa homologada: {comp.excluidos.join(", ")}.
                  </p>
                  <p className="text-sm text-carvao-muted">Regra de atípico: {comp.regra_atipico}. Cada valor abaixo foi conferido no arquivo original da ANEEL e mantido.</p>
                  <ContaTabelaSobDemanda
                    chaveUrl="atip"
                    rotulo="as componentes atípicas"
                    detalhe={`${linhasAtipicas.length} linhas`}
                    titulo={`Componentes atípicas na vigência de ${dataBR(ref)}`}
                    colunas={COLUNAS_ATIPICAS}
                    linhas={compactarLinhasTabela(COLUNAS_ATIPICAS, linhasAtipicas)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte="ANEEL, Componentes Tarifárias"
                    versao={ref}
                    nomeArquivo="conta-componentes-atipicas"
                  />
                  <p className="text-sm text-carvao-muted">
                    Conferência das parcelas: {comp.reconciliacao.conferidas} distribuidoras com TE e TUSD iguais nos dois conjuntos da ANEEL,{" "}
                    {comp.reconciliacao.divergentes.length} divergentes, sem componentes: {comp.reconciliacao.sem_componentes.join(", ") || "nenhuma"}. Repetições no arquivo:{" "}
                    {comp.reconciliacao.duplicatas_fonte.iguais} iguais e {comp.reconciliacao.duplicatas_fonte.conflitantes} com valor diferente (
                    {comp.reconciliacao.duplicatas_fonte.regra}).
                  </p>
                  <p className="text-sm text-carvao-muted">
                    Documento que sustenta a leitura do crédito:{" "}
                    {comp.creditos.documento
                      .map((id) => {
                        const d = g.documentos.find((x) => x.id === id);
                        return d ? `${d.titulo} (${comp.creditos.documento_estado[id] === "CONFERIDA" ? "trechos conferidos na captura" : "trechos não reconferidos"})` : id;
                      })
                      .join("; ")}
                    .
                  </p>
                </Auditoria>
                <Seguir
                  ancora="composicao"
                  proximo={{ href: "#simulador", pergunta: "Quanto ficaria a minha conta? Simule o seu consumo." }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_composicao_b1.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P049 ---------------- */}
          <Bloco id="simulador">
            <PainelEvidencia
              id="p049"
              pergunta="Como a minha conta varia com o consumo e o perfil?"
              subtitulo="Simulação com as tarifas vigentes e as regras publicadas · R$/mês, estimativa sem tributos"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Mostra como a regra de cada classe (mínimo da ligação, faixas da Tarifa Social e do Desconto Social, bandeira) transforma kWh em reais, com a tarifa vigente da
                  distribuidora escolhida.
                </>
              }
              oQueMudou={oQueMudouSimulador}
              comoInterpretar={comoInterpretarSimulador}
              naoConcluir={naoConcluirSimulador}
              naoConcluirNoCorpo
              proveniencia={sim.proveniencia}
              complementares={[{ rotulo: "Bandeiras", p: band.proveniencia }]}
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
                  periodo={
                    <>
                      Tarifas vigentes em {dataBR(ref)}; bandeira de {sim.bandeira_vigente ? mesAno(`${sim.bandeira_vigente.mes}-01`) : "mês não publicado"}
                    </>
                  }
                  universo={
                    <>
                      Uma unidade consumidora de baixa tensão; {sim.distribuidoras.length} distribuidoras com tarifa vigente (Desconto Social em {sim.cobertura_classes.ds1})
                    </>
                  }
                  unidade="R$/mês (estimativa); tarifas em R$/kWh"
                />
                <NotasDoPainel oQueMudou={oQueMudouSimulador} comoInterpretar={comoInterpretarSimulador} naoConcluir={naoConcluirSimulador} />
                <Auditoria titulo="Normas conferidas e casos de referência">
                  <ul className="space-y-3 text-sm">
                    {sim.normas.map((n) => (
                      <li key={n.id} className="border-l-2 border-linha pl-3">
                        <a href={n.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                          {n.titulo}
                        </a>{" "}
                        <span className="text-carvao-muted">
                          ({n.orgao};{" "}
                          {n.estado === "CONFERIDA"
                            ? `trechos conferidos na captura de ${carimbo(n.conferido_em)}`
                            : n.estado === "NAO_RECONFERIDA"
                              ? "trecho ausente na última captura"
                              : "não capturada"}
                          ; {n.licenca})
                        </span>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-carvao-muted">
                          {n.trechos.map((tr) => (
                            <li key={tr.trecho}>
                              “{tr.trecho}” {tr.presente ? "(presente)" : "(ausente na captura)"}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {sim.regras_texto.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium text-carvao">{r.texto}</span> Estado:{" "}
                        {r.estado === "CONFERIDA" ? "conferida" : r.estado === "PARCIAL" ? "parcialmente conferida" : "não conferida"}.
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    Casos calculados pelo pipeline para {rotuloDistribuidora(sim.casos_referencia.sigla, sim.casos_referencia.cnpj)} ({sim.casos_referencia.criterio}); o simulador
                    desta página reproduz cada um (teste automatizado). Sem valor: simulação indisponível para a classe.
                  </p>
                  <ContaTabelaSobDemanda
                    chaveUrl="casos"
                    rotulo="os casos de referência do simulador"
                    detalhe={`${linhasCasos.length} casos`}
                    titulo="Casos de referência do simulador"
                    colunas={COLUNAS_CASOS}
                    linhas={compactarLinhasTabela(COLUNAS_CASOS, linhasCasos)}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte={FONTE_TARIFAS}
                    versao={ref}
                    nomeArquivo="conta-simulador-casos-referencia"
                  />
                </Auditoria>
                <Seguir
                  ancora="simulador"
                  proximo={{ href: "#p050", pergunta: "O que mudou na tarifa e quem financia os descontos?" }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_tarifas_b1_vigentes.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P050 (página própria) ---------------- */}
          <Bloco id="p050">
            <section aria-labelledby="p050-titulo" data-navegacao-local="capitulos" className="border-t border-linha pt-6">
              <h2 id="p050-titulo" className="ed-h2 font-serif text-carvao">
                O que mudou e quem financia os benefícios?
              </h2>
              <p className="mt-2 text-sm text-carvao-muted">
                Variação da tarifa B1 contra o IPCA, bandeiras acionadas e financiamento dos descontos pela CDE. Os painéis completos, com gráfico, tabela e provas, estão em página própria.
              </p>
              <ol className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-3">
                {[
                  {
                    ancora: "reajustes",
                    pergunta: "A tarifa subiu mais que a inflação?",
                    veredito: janela12 ? vereditoReajustes(janela12) : "Sem janela de 12 meses publicada.",
                    resposta: janela12 ? respostaReajustes(janela12) : "Sem janela de 12 meses publicada.",
                  },
                  { ancora: "bandeiras", pergunta: "Quando a bandeira encareceu a conta?", veredito: vereditoBandeira(band), resposta: respostaBandeira(band) },
                  { ancora: "subsidios", pergunta: "Quem financia os descontos e benefícios?", veredito: vereditoSubsidios(sub), resposta: `${respostaSubsidios(sub)} ${respostaCde(cde)}` },
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
                      Ver o painel com gráfico, tabela e provas
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
                Validação, tarifa média avaliada e arquivos
              </h2>
              <div>
                <h3 className="font-medium text-carvao">Regras conferidas antes de publicar</h3>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                  {g.validacao.regras.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <h3 className="mt-4 font-medium text-carvao">Ressalvas desta publicação ({g.validacao.ressalvas.length})</h3>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                  {g.validacao.ressalvas.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-carvao">Tarifa média de fornecimento: alternativa avaliada e não usada</h3>
                <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{g.tarifa_media_fornecimento.motivo}</p>
                {g.tarifa_media_fornecimento.alternativa_avaliada && "arquivo" in g.tarifa_media_fornecimento.alternativa_avaliada && (
                  <div className="mt-2 text-sm text-carvao-muted">
                    <p>
                      {g.tarifa_media_fornecimento.alternativa_avaliada.orgao}, {g.tarifa_media_fornecimento.alternativa_avaliada.conjunto}, recurso{" "}
                      {g.tarifa_media_fornecimento.alternativa_avaliada.recurso} ({num(g.tarifa_media_fornecimento.alternativa_avaliada.linhas_lidas, 0)} linhas, sha256{" "}
                      <code className="break-all text-xs">{g.tarifa_media_fornecimento.alternativa_avaliada.sha256}</code>
                      ). Regra: {g.tarifa_media_fornecimento.alternativa_avaliada.regra_atipico}. {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_com_mes_atipico}{" "}
                      de {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_no_recorte} distribuidoras com mês atípico:
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {g.tarifa_media_fornecimento.alternativa_avaliada.meses_atipicos.map((m) => (
                        <li key={`${m.cnpj}|${m.linha}|${m.mes}`}>
                          {rotuloDistribuidora(m.sigla, m.cnpj)}, {m.linha}, {mesAno(`${m.mes.slice(0, 7)}-01`)}: {reais(m.valor_rs === null ? null : m.valor_rs / 1e9, 2)} bilhões
                          contra mediana de {reais(m.mediana_outros_meses_rs === null ? null : m.mediana_outros_meses_rs / 1e9, 2)} bilhões nos outros meses (razão{" "}
                          {num(m.razao, 1)}
                          ).
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-carvao">Documentos oficiais conferidos a cada captura</h3>
                <ul className="mt-2 space-y-1 text-sm text-carvao-muted">
                  {g.documentos.map((d) => (
                    <li key={d.id}>
                      <a href={d.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                        {d.titulo}
                      </a>{" "}
                      ({d.estado === "CONFERIDA" ? `trechos conferidos em ${carimbo(d.conferido_em)}` : "trechos não reconferidos"}; {d.licenca})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-carvao">Arquivos para download</h3>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {g.downloads.map((d) => (
                    <li key={d.url}>
                      <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {d.rotulo}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-mineral">
                  Gerado por {g.versao_pipeline} (código {g.versao_codigo ?? "sem versão"}) em {carimbo(g.gerado_em)}. Método completo no documento do módulo
                  (docs/observatorios/energia/modulos/conta.md), na pasta de documentação indicada em{" "}
                  <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                    Metodologia
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
