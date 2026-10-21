import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { tx } from "@/lib/energia/idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Histograma } from "@/components/energia/Histograma";
import { LeiloesDispersao } from "@/components/energia/LeiloesDispersao";
import { LabLeilao, LinhaDosProdutos, type ProdutoNaBase } from "@/components/energia/LeiloesLabs";
import { LeiloesAlternar, LeiloesMapaUf, LeiloesPrecoAno } from "@/components/energia/LeiloesOpcoes";
import { BarrasSituacao, DiagramaAcr, FrasesCitaveis, GruposControle, LeiloesIndisponivel, ListaRegras } from "@/components/energia/LeiloesPagina";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  CATEGORIA_LEILAO_EN,
  DOWNLOAD_LEILAO_EN,
  MODULO_EN,
  OBRA_RALIE_EN,
  SITUACAO_LEILAO_EN,
  TIPO_LEILAO_EN,
  comNomes,
  evidenciaMwMedio,
  regraLeilao,
  regraLeilaoTraduzida,
  temTraducao,
  traduzir,
} from "@/lib/energia/i18n/empresas-leiloes";
import {
  COR_CATEGORIA_LEILAO,
  COR_SITUACAO,
  COR_TIPO_LEILAO,
  CURTO_CATEGORIA,
  CURTO_SITUACAO,
  ORDEM_CATEGORIAS,
  ORDEM_SITUACOES,
  PAGINAS_LEILOES,
  ROTA_LEILOES,
  ROTA_LEILOES_TRANSMISSAO,
  categoriasComPreco,
  fonteLeiloes,
  frasesCitaveis,
  linhasEnergiaPorAno,
  linhasEntregaPorAno,
  mwmed,
  nomeLeilao,
  numeroAneel,
  participacao,
  rsMwh,
} from "@/lib/energia/leiloes";
import { lerManifestoLogos } from "@/lib/energia/logos-servidor";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { IdEntrada, LeiloesGold } from "@/lib/energia/tipos-leiloes";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/leiloes", {
    title: tx("Leilões do ACR: o que o mercado regulado comprou, a que preço e de quem", "ACR auctions: what the regulated market bought, at what price and from whom"),
    description: tx(
      "Os leilões de geração do Ambiente de Contratação Regulada desde 2005, com dados da ANEEL: energia contratada por ano, fonte e tipo de leilão, preço médio em reais da época e corrigido pelo IPCA, deságio, onde estão as usinas, vencedoras e grupos que as controlam no cadastro mais recente, e o que já está em operação. Com laboratório do leilão e números para citar.",
      "Generation auctions of the regulated contracting environment (ACR) since 2005, with ANEEL data: energy contracted by year, source and auction type, average price in reais of the time and adjusted by the IPCA, discount below the ceiling price, where the plants are, the winners and the groups that control them in the most recent registry, and what is already in operation. With an auction lab and numbers to cite.",
    ),
    alternates: { canonical: ROTA_LEILOES },
  }, anterior);
}

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

function colunasLeiloes(): ColunaTabela[] {
  return [
    { id: "data", rotulo: tx("Data", "Date"), tipo: "data" },
    { id: "nome", rotulo: tx("Leilão", "Auction"), tipo: "texto" },
    { id: "tipo", rotulo: tx("Tipo", "Type"), tipo: "texto", categorica: true },
    { id: "empreendimentos", rotulo: tx("Vendas (empreendimento vencedor no leilão)", "Sales (winning project in the auction)"), tipo: "numero", casas: 0 },
    { id: "energia_mwmed", rotulo: tx("Energia", "Energy"), tipo: "numero", unidade: tx("MWmédio", "MWavg"), casas: 1 },
    { id: "mw", rotulo: tx("Potência das usinas", "Plant capacity"), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "preco_medio", rotulo: tx("Preço médio da época", "Average price at the time"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "preco_medio_real", rotulo: tx("Preço médio corrigido pelo IPCA", "Average price adjusted by the IPCA"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto_medio", rotulo: tx("Teto médio", "Average ceiling"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "desagio_agregado_pct", rotulo: tx("Deságio agregado", "Aggregate discount"), tipo: "percentual", casas: 2 },
    { id: "operacao_pct", rotulo: tx("Energia de usinas em operação no SIGA", "Energy from plants in operation in SIGA"), tipo: "percentual", casas: 1 },
    { id: "leilao", rotulo: tx("Número ANEEL (nº/ano)", "ANEEL number (No./year)"), tipo: "texto", nivel: "auditar" },
  ];
}

/** Regra da gold no idioma da página; sem forma inglesa, o trecho sai marcado como só em português. */
function Regra({ texto, regiao }: { texto: string; regiao: string }) {
  return regraLeilaoTraduzida(texto) ? <>{comNomes(regraLeilao(texto))}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

export default function LeiloesAcrPage() {
  const g = lerGold<LeiloesGold>("leiloes.json");
  if (!integra(g)) return <LeiloesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const ref = g.referencias;
  const ev = g.evidencias;
  const t = g.totais;
  const ipca = mesAno(ref.ipca_ate);
  const periodo = tx(`${mesAno(ref.primeiro_leilao.slice(0, 7))} a ${mesAno(ref.ultimo_leilao.slice(0, 7))}`, `${mesAno(ref.primeiro_leilao.slice(0, 7))} to ${mesAno(ref.ultimo_leilao.slice(0, 7))}`);
  const siga = dataBR(ref.siga);
  const logos = lerManifestoLogos();
  const nomeCat = Object.fromEntries(g.categorias.map((c) => [c.id, traduzir(CATEGORIA_LEILAO_EN, c.rotulo)]));
  const u = g.ultimo_leilao;
  const op = participacao(g, "operacao");
  const frases = frasesCitaveis(g);
  const mwmedio = tx("MWmédio", "MWavg");
  const FONTE_LEILOES = fonteLeiloes();

  // séries de energia (fonte e tipo)
  const seriesCat = ORDEM_CATEGORIAS.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA_LEILAO[k] }));
  const seriesTipo = g.cobertura.tipos_presentes.map((x) => ({ id: x.id, rotulo: x.id === "Estruturante" ? tx("Estruturante", "Structuring") : x.id, cor: COR_TIPO_LEILAO[x.id] ?? "var(--serie-referencia)" }));
  const semLeilao = g.cobertura.anos_sem_leilao_na_base;

  // produtos A-x e demais tipos
  const produtos: ProdutoNaBase[] = g.tipos.map((tp) => {
    const ls = g.leiloes.filter((l) => l.tipo === tp.id);
    const ex = ls.at(-1);
    const ent = g.entrega.entrada_vs_ano_a[tp.id];
    return {
      id: tp.id,
      rotulo: traduzir(TIPO_LEILAO_EN, tp.rotulo),
      antecedencia: tp.antecedencia,
      leiloes: ls.length,
      energiaMwmed: ls.reduce((s, l) => s + l.energia_mwmed, 0),
      exemplo: ex ? { nome: nomeLeilao(ex), data: dataBR(ex.data), ano: Number(ex.ano) } : null,
      entrada: ent ? (Object.fromEntries(Object.entries(ent).map(([k, v]) => [k, v.energia_mwmed])) as Record<IdEntrada, number>) : null,
    };
  });

  // preço por fonte e ano
  const comPreco = categoriasComPreco(g);
  const pontosPreco = g.preco_ano_categoria.map((x) => ({
    ano: x.ano, categoria: x.categoria, preco: x.preco_medio, precoReal: x.preco_medio_real, teto: x.teto_medio, energia: x.energia_mwmed, leiloes: x.leiloes,
  }));

  // deságio: histograma por empreendimento
  const hist = montaHistograma(g.desagio.valores, { largura: 5 });

  // UF
  const ufs = g.por_uf.map((x) => ({
    uf: x.uf,
    energia: x.energia_mwmed,
    empreendimentos: x.empreendimentos,
    preco: x.preco_medio,
    fontes: Object.entries(x.por_categoria)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([k, v]) => `${CURTO_CATEGORIA[k as keyof typeof CURTO_CATEGORIA]} ${num(v, 1)}`)
      .join("; "),
  }));

  // entrega
  const seriesSit = ORDEM_SITUACOES.map((k) => ({ id: k, rotulo: CURTO_SITUACAO[k], cor: COR_SITUACAO[k] }));
  const entregaCat = g.entrega.por_categoria.map((x) => {
    const valores = Object.fromEntries(ORDEM_SITUACOES.map((k) => [k, x.situacao[k].energia_mwmed])) as Record<string, number>;
    return { id: x.id, rotulo: nomeCat[x.id], valores, total: Object.values(valores).reduce((s, v) => s + v, 0) };
  });

  const linhasLeiloes = g.leiloes.map((l) => ({
    leilao: numeroAneel(l.leilao),
    data: l.data,
    nome: nomeLeilao(l),
    tipo: l.tipo,
    empreendimentos: l.empreendimentos,
    energia_mwmed: l.energia_mwmed,
    mw: l.mw,
    preco_medio: l.preco_medio,
    preco_medio_real: l.preco_medio_real,
    teto_medio: l.teto_medio,
    desagio_agregado_pct: l.desagio_agregado_pct,
    operacao_pct: l.energia_mwmed ? (100 * l.situacao_mwmed.operacao) / l.energia_mwmed : null,
  }));

  const oQueMudou = tx(
    <>
      O leilão mais recente da base é o {nomeLeilao(u)}, de {dataBR(u.data)}: {mwmed(u.energia_mwmed)} a {rsMwh(u.preco_medio)} em média,
      deságio agregado de {pct(u.desagio_agregado_pct, 2)}. O arquivo da ANEEL foi gerado em {dataBR(ref.arquivo_gerado_em)}.
    </>,
    <>
      The most recent auction in the database is the <Nome>{nomeLeilao(u)}</Nome>, on {dataBR(u.data)}: {mwmed(u.energia_mwmed)} at {rsMwh(u.preco_medio)} on
      average, with an aggregate discount of {pct(u.desagio_agregado_pct, 2)}. The ANEEL file was generated on {dataBR(ref.arquivo_gerado_em)}.
    </>,
  );
  const comoInterpretar = tx(
    <>
      Energia em MWmédio é a energia média vendida no ano e soma entre leilões; MW é potência e não soma entre leilões quando a mesma usina
      vende mais de uma vez. Preço é a média ponderada pela energia; o preço corrigido usa o IPCA do mês do leilão até {ipca}. Termelétricas
      por disponibilidade são contratadas pelo Índice de Custo Benefício (ICB), que não é o custo da energia que elas acabam gerando.
    </>,
    <>
      Energy in MWavg is the average energy sold in the year and adds up across auctions; MW is capacity and does not add up across auctions when the
      same plant sells more than once. Price is the energy-weighted average; the adjusted price uses the IPCA from the auction month up to {ipca}. Thermal
      plants contracted by availability are contracted by the Cost-Benefit Index (ICB), which is not the cost of the energy they end up generating.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que uma fonte é mais barata para o consumidor só pelo preço do leilão: contratos têm prazos, riscos e formas de pagamento diferentes. Que
      deságio alto indica muita concorrência: o arquivo não traz o número de proponentes, e o teto muda a cada edital. Que usina fora de operação
      descumpriu o contrato: prazos alterados por ato, rescisões e substituições não estão nos arquivos. Que o grupo que controla a usina no cadastro mais recente venceu o leilão. Que
      não houve leilão nos anos ou tipos ausentes da base.
    </>,
    <>
      That a source is cheaper for consumers from the auction price alone: contracts have different terms, risks and forms of payment. That a high
      discount indicates strong competition: the file does not include the number of bidders, and the ceiling changes with each tender. That a plant out
      of operation breached its contract: deadlines changed by act, terminations and substitutions are not in the files. That the group that controls the
      plant in the most recent registry won the auction. That no auction took place in the years or types missing from the database.
    </>,
  );
  const complementares: ProvenienciaComplementar[] = [
    { rotulo: tx("Preço corrigido pelo IPCA", "Price adjusted by the IPCA"), p: g.proveniencia.preco_real },
    { rotulo: tx("Situação atual das usinas (SIGA e atos)", "Current status of the plants (SIGA and acts)"), p: g.proveniencia.situacao },
    { rotulo: tx("Grupo que controla a usina no cadastro mais recente", "Group that controls the plant in the most recent registry"), p: g.proveniencia.controle },
  ];
  const definicaoSituacao = (k: string) => {
    const d = g.situacoes.find((s) => s.id === k)?.definicao;
    if (!d) return d;
    return temTraducao(SITUACAO_LEILAO_EN, d) ? traduzir(SITUACAO_LEILAO_EN, d) : <TrechoPortugues regiao="leiloes-situacao">{d}</TrechoPortugues>;
  };

  return (
    <>
      <CabecalhoEnergia atual="leiloes" />
      <MarcaVisita secao="energia:leiloes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <NavegacaoLocal rotulo={tx("Páginas de leilões", "Auction pages")} itens={PAGINAS_LEILOES.map((p) => ({ ...p }))} atual="acr" />
        <CabecalhoModulo
          siglas={["ACR", "ACL", "MME", "EPE", "ANEEL", "CCEE", "ONS", "CCEAR", "CER", "LEN", "LER", "LFA", "ICB", "IPCA", "SIGA", "CEG", "PLD", "TE", "MWmed"]}
          rotulo={tx("Preços e mercado · Leilões", "Prices and market · Auctions")}
          titulo={tx("O que o mercado regulado comprou em leilão, a que preço e de quem", "What the regulated market bought at auction, at what price and from whom")}
          lead={tx(
            <>
              As distribuidoras compram a energia dos consumidores cativos em leilões, no{" "}
              <Termo slug="acr">Ambiente de Contratação Regulada (ACR)</Termo>. Esta página reúne os leilões de geração publicados pela ANEEL desde 2005:
              quanto se contratou, a que preço, onde, de quem e o que já está operando.
            </>,
            <>
              Distribution utilities buy the energy for their captive consumers in auctions, in the{" "}
              <Termo slug="acr">regulated contracting environment (ACR)</Termo>. This page brings together the generation auctions published by ANEEL since 2005:
              how much was contracted, at what price, where, from whom and what is already operating.
            </>,
          )}
          recorte={tx(
            `${periodo} · ${num(g.cobertura.leiloes, 0)} leilões · ${num(t.empreendimentos, 0)} vendas · MWmédio, MW e R$/MWh`,
            `${periodo} · ${num(g.cobertura.leiloes, 0)} auctions · ${num(t.empreendimentos, 0)} sales · MWavg, MW and R$/MWh`,
          )}
          fonte={`${FONTE_LEILOES}; IBGE, IPCA; ANEEL, SIGA`}
          limite={tx(
            "A base aberta não traz leilões de energia existente, de ajuste, de reserva de capacidade e de sistemas isolados; situação da usina não é cumprimento do contrato.",
            "The open database does not include existing energy, adjustment, capacity reserve or isolated systems auctions; a plant's status is not contract compliance.",
          )}
          referencia={tx(
            <>
              {FONTE_LEILOES}, arquivo gerado em {dataBR(ref.arquivo_gerado_em)} e capturado em {carimbo(ref.capturado_em)}; IPCA do IBGE (tabela 1737)
              até {ipca}; SIGA de {siga} e atos de outorga até {dataBR(ref.atos)}, como publicados pelo módulo Expansão; proprietários e cadeia de
              controle como publicados pelo módulo Empresas. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE_LEILOES}, file generated on {dataBR(ref.arquivo_gerado_em)} and captured on {carimbo(ref.capturado_em)}; IBGE IPCA (table 1737) up to {ipca};
              SIGA as of {siga} and grant acts up to {dataBR(ref.atos)}, as published by the Expansion module; owners and control chain as published by the
              Companies module. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Leilões de geração do ACR na base da ANEEL", "ACR generation auctions in the ANEEL database")}
              nota={tx(`Período: ${periodo}. Situação das usinas no SIGA de ${siga}.`, `Period: ${periodo}. Plant status in SIGA as of ${siga}.`)}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Energia contratada", "Energy contracted")}
                natureza="CALCULADO"
                evidencia={evidenciaMwMedio(ev.energia_total)}
                valor={t.energia_mwmed}
                unidade={mwmedio}
                casas={1}
                endereco={`${ROTA_LEILOES}#quanto`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Leilões na base", "Auctions in the database")}
                natureza="OBSERVADO"
                valor={g.cobertura.leiloes}
                unidade={tx(
                  `com ${num(t.empreendimentos, 0)} vendas${t.usinas_distintas ? ` de ${num(t.usinas_distintas, 0)} usinas distintas` : ""}`,
                  `with ${num(t.empreendimentos, 0)} sales${t.usinas_distintas ? ` from ${num(t.usinas_distintas, 0)} distinct plants` : ""}`,
                )}
                casas={0}
                periodo={periodo}
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Preço médio do último leilão (${u.nome ?? numeroAneel(u.leilao)})`, `Average price of the latest auction (${u.nome ?? `No. ${numeroAneel(u.leilao)}`})`)}
                natureza="CALCULADO"
                evidencia={ev.ultimo_preco}
                valor={u.preco_medio}
                formato="reais"
                unidade="R$/MWh"
                casas={2}
                endereco={`${ROTA_LEILOES}#preco`}
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Energia de usinas em operação em ${siga}`, `Energy from plants in operation on ${siga}`)}
                natureza="CALCULADO"
                evidencia={ev.pct_operacao}
                valor={op}
                formato="pct"
                casas={1}
                unidade={tx("da energia contratada", "of the energy contracted")}
                endereco={`${ROTA_LEILOES}#entrega`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Os números vêm do arquivo de resultados dos leilões de geração da ANEEL, uma linha por empreendimento vencedor. A situação atual de cada
              usina vem do cadastro da ANEEL (SIGA) e dos atos de encerramento de outorga, e o grupo que a controla, da composição societária
              declarada à ANEEL. Os leilões de transmissão estão na{" "}
              <Link href={ROTA_LEILOES_TRANSMISSAO} className={link}>
                página de transmissão
              </Link>
              .
            </>,
            <>
              The numbers come from ANEEL&apos;s generation auction results file, one row per winning project. The current status of each plant comes from the
              ANEEL registry (SIGA) and the grant termination acts, and the group that controls it, from the shareholding structure declared to ANEEL.
              Transmission auctions are on the{" "}
              <Link href={ROTA_LEILOES_TRANSMISSAO} className={link}>
                transmission page
              </Link>
              .
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="leiloes">
            <PainelEvidencia
              id="painel-leiloes"
              pergunta={tx("Leilões de geração do ACR: quanto, a que preço, onde, de quem e o que já opera", "ACR generation auctions: how much, at what price, where, from whom and what is already operating")}
              subtitulo={tx(
                "Energia vendida em MWmédio, preço em R$/MWh da época e corrigido pelo IPCA, deságio em %, situação no SIGA",
                "Energy sold in MWavg, price in R$/MWh of the time and adjusted by the IPCA, discount in %, status in SIGA",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  O que as distribuidoras compram em leilão vira a parcela de energia da conta de luz dos consumidores cativos por muitos anos. Os
                  leilões também decidem que usinas são construídas, de que fontes e onde.
                </>,
                <>
                  What distribution utilities buy at auction becomes the energy portion of captive consumers&apos; electricity bills for many years. The
                  auctions also decide which plants are built, from which sources and where.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.resultado}
              complementares={complementares}
            >
              <div className="space-y-10">
                <SecaoDoPainel
                  id="como-funciona"
                  titulo={tx("O que é o ACR e quem compra", "What the ACR is and who buys")}
                  lead={tx("Cinco papéis e três caminhos que não se confundem: o do contrato, o do dinheiro e o da energia.", "Five roles and three paths that must not be confused: the contract's, the money's and the energy's.")}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      [
                        tx("Quem compra", "Who buys"),
                        tx(
                          "As distribuidoras, para atender todo o seu mercado de consumidores cativos, por meio de licitação (Lei nº 10.848/2004, art. 2º).",
                          "Distribution utilities, to serve their entire market of captive consumers, through a tender (Law No. 10,848/2004, art. 2).",
                        ),
                      ],
                      [
                        tx("Quem vende", "Who sells"),
                        tx(
                          "Geradores com usinas novas ou existentes; nos leilões de energia nova, projetos que ainda vão ser construídos.",
                          "Generators with new or existing plants; in new energy auctions, projects that are still to be built.",
                        ),
                      ],
                      [
                        tx("O que se compra", "What is bought"),
                        tx(
                          "Energia média ao longo de muitos anos (MWmédio), a um preço por MWh atualizado pelo contrato, ou disponibilidade de usinas térmicas.",
                          "Average energy over many years (MWavg), at a price per MWh adjusted under the contract, or the availability of thermal plants.",
                        ),
                      ],
                    ].map(([a, b]) => (
                      <div key={a} className="border-t border-linha pt-3">
                        <p className="font-medium text-carvao">{a}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{b}</p>
                      </div>
                    ))}
                  </div>
                  <DiagramaAcr />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        O outro ambiente é o livre (<Termo slug="acl">ACL</Termo>), onde consumidores e comercializadores negociam contratos bilaterais sem
                        leilão. A divisão entre os dois está em{" "}
                        <Link href="/setor-eletrico/mercado#livre-regulado" className={link}>
                          Mercado
                        </Link>
                        .
                      </>,
                      <>
                        The other environment is the free one (<Termo slug="acl">ACL</Termo>), where consumers and traders negotiate bilateral contracts without
                        an auction. The split between the two is in{" "}
                        <Link href="/setor-eletrico/mercado#livre-regulado" className={link}>
                          Market
                        </Link>
                        .
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="produtos"
                  titulo={tx("Os produtos: A-3, A-5, reserva, fontes alternativas", "The products: A-3, A-5, reserve, alternative sources")}
                  lead={tx("O nome do produto diz quantos anos separam o leilão do início da entrega.", "The product name says how many years separate the auction from the start of delivery.")}
                >
                  <LinhaDosProdutos produtos={produtos} dataSiga={siga} />
                  <TabelaDados
                    titulo={tx("Leilões e energia contratada por tipo de leilão", "Auctions and energy contracted by auction type")}
                    colunas={[
                      tx("Tipo", "Type"),
                      tx("Leilões", "Auctions"),
                      tx("Empreendimentos", "Projects"),
                      tx("Energia (MWmédio)", "Energy (MWavg)"),
                      tx("Preço médio da época (R$/MWh)", "Average price at the time (R$/MWh)"),
                      tx(`Preço médio de ${ipca} (R$/MWh)`, `Average price of ${ipca} (R$/MWh)`),
                      tx("Deságio agregado (%)", "Aggregate discount (%)"),
                    ]}
                    linhas={g.por_tipo.map((x) => [traduzir(TIPO_LEILAO_EN, x.rotulo), x.leiloes, x.empreendimentos, x.energia_mwmed, x.preco_medio, x.preco_medio_real, x.desagio_agregado_pct])}
                    casas={[null, 0, 0, 1, 2, 2, 2]}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="laboratorio"
                  titulo={tx("Laboratório: como a concorrência derruba o preço", "Lab: how competition brings the price down")}
                  lead={tx("Um modelo simples do leilão de preço descendente para ver de onde vem o deságio.", "A simple model of the descending-price auction to see where the discount comes from.")}
                >
                  <LabLeilao />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="quanto"
                  titulo={tx("Quanto se contratou, ano a ano", "How much was contracted, year by year")}
                  lead={tx(`${mwmed(t.energia_mwmed)} em ${num(g.cobertura.leiloes, 0)} leilões, de ${periodo}.`, `${mwmed(t.energia_mwmed)} in ${num(g.cobertura.leiloes, 0)} auctions, ${periodo}.`)}
                >
                  <LeiloesAlternar
                    rotulo={tx("Ver por", "View by")}
                    nome="leiloes-energia"
                    opcoes={[
                      ["categoria", tx("Fonte", "Source")],
                      ["tipo", tx("Tipo de leilão", "Auction type")],
                    ]}
                    conteudo={{
                      categoria: (
                        <GraficoBarras
                          titulo={tx(`Energia contratada por ano do leilão e fonte, ${periodo}`, `Energy contracted by auction year and source, ${periodo}`)}
                          dados={linhasEnergiaPorAno(g, "categoria")}
                          chaveCategoria="ano" // i18n: dado
                          series={seriesCat}
                          unidade={mwmedio}
                          casas={0}
                          empilhado
                          altura={320}
                        />
                      ),
                      tipo: (
                        <GraficoBarras
                          titulo={tx(`Energia contratada por ano do leilão e tipo de leilão, ${periodo}`, `Energy contracted by auction year and auction type, ${periodo}`)}
                          dados={linhasEnergiaPorAno(g, "tipo")}
                          chaveCategoria="ano" // i18n: dado
                          series={seriesTipo}
                          unidade={mwmedio}
                          casas={0}
                          empilhado
                          altura={320}
                        />
                      ),
                    }}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {semLeilao.length
                      ? tx(
                          `Anos sem leilão de geração na base aberta: ${semLeilao.join(", ")} (barra hachurada, ausência, não zero). `,
                          `Years without a generation auction in the open database: ${semLeilao.join(", ")} (hatched bar, missing, not zero). `,
                        )
                      : ""}
                    {tx(
                      <>
                        A numeração da CCEE presente no arquivo tem lacunas ({Object.entries(g.cobertura.lacunas_numeracao_ccee)
                          .filter(([, v]) => v.length)
                          .map(([k, v]) => `${k}: ${v.map((x) => `${x}º`).join(", ")}`)
                          .join("; ")}); o observatório não verificou o que cada número ausente foi.
                      </>,
                      <>
                        The CCEE numbering present in the file has gaps ({Object.entries(g.cobertura.lacunas_numeracao_ccee)
                          .filter(([, v]) => v.length)
                          .map(([k, v]) => `${k}: ${v.map((x) => `${x}º`).join(", ")}`)
                          .join("; ")}); the observatory has not verified what each missing number was.
                      </>,
                    )}
                  </p>
                  <TabelaDados
                    titulo={tx("Energia contratada por fonte, todo o período", "Energy contracted by source, whole period")}
                    colunas={[tx("Fonte", "Source"), tx("Leilões", "Auctions"), tx("Empreendimentos", "Projects"), tx("Energia (MWmédio)", "Energy (MWavg)"), tx("Primeiro leilão", "First auction"), tx("Último leilão", "Latest auction")]}
                    linhas={g.por_categoria.map((x) => [traduzir(CATEGORIA_LEILAO_EN, x.rotulo), x.leiloes, x.empreendimentos, x.energia_mwmed, dataBR(x.primeiro), dataBR(x.ultimo)])}
                    casas={[null, 0, 0, 1, null, null]}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="preco" titulo={tx("A que preço", "At what price")} lead={tx(`Preço médio de venda por fonte, em reais da época e em reais de ${ipca}.`, `Average sale price by source, in reais of the time and in reais of ${ipca}.`)}>
                  <LeiloesPrecoAno
                    anos={Array.from({ length: (g.cobertura.anos?.[1] ?? 0) - (g.cobertura.anos?.[0] ?? 0) + 1 }, (_, i) => String((g.cobertura.anos?.[0] ?? 0) + i))}
                    categorias={comPreco.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA_LEILAO[k] }))}
                    pontos={pontosPreco}
                    ipcaAte={ipca}
                    iniciais={["eolica", "solar", "uhe", "gas"].filter((k) => comPreco.includes(k as never))}
                  />
                  <TabelaDados
                    titulo={tx(`Preço médio por fonte: primeiro e último ano com venda, em reais de ${ipca}`, `Average price by source: first and latest year with sales, in reais of ${ipca}`)}
                    colunas={[
                      tx("Fonte", "Source"),
                      tx("Primeiro ano", "First year"),
                      tx("Preço (R$/MWh)", "Price (R$/MWh)"),
                      tx("Último ano", "Latest year"),
                      tx("Preço (R$/MWh)", "Price (R$/MWh)"),
                      tx("Todo o período (R$/MWh)", "Whole period (R$/MWh)"),
                    ]}
                    linhas={g.por_categoria.map((x) => [
                      traduzir(CATEGORIA_LEILAO_EN, x.rotulo),
                      x.primeiro_ano?.ano ?? null,
                      x.primeiro_ano?.preco_medio_real ?? null,
                      x.ultimo_ano?.ano ?? null,
                      x.ultimo_ano?.preco_medio_real ?? null,
                      x.preco_medio_real,
                    ])}
                    casas={[null, null, 2, null, 2, 2]}
                  />
                  <LeiloesDispersao
                    url="/energia/series/leiloes_empreendimentos.json"
                    categorias={g.categorias.filter((c) => comPreco.includes(c.id)).map((c) => ({ ...c, rotulo: traduzir(CATEGORIA_LEILAO_EN, c.rotulo) }))}
                    ipcaAte={ipca}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="desagio"
                  titulo={tx("Deságio: quanto o preço ficou abaixo do teto", "Discount: how far the price fell below the ceiling")}
                  lead={tx("Distância entre o preço de venda e o preço teto do edital, por empreendimento.", "Distance between the sale price and the tender's ceiling price, by project.")}
                >
                  <Histograma
                    titulo={tx(`Deságio por empreendimento, ${periodo}`, `Discount by project, ${periodo}`)}
                    dados={hist}
                    rotuloX={tx("Deságio sobre o preço teto", "Discount below the ceiling price")}
                    unidade="%"
                    casas={1}
                    contagem={tx({ singular: "venda", plural: "vendas" }, { singular: "sale", plural: "sales" })}
                    periodo={periodo}
                    nota={tx(
                      `${num(g.desagio.zero, 0)} vendas saíram no próprio teto (deságio zero). O deságio publicado confere com 100 × (1 − preço ÷ teto) em ${g.conferencias.desagio_publicado_confere}.`,
                      `${num(g.desagio.zero, 0)} ${g.desagio.zero === 1 ? "sale was" : "sales were"} awarded at the ceiling itself (zero discount). The published discount matches 100 × (1 − price ÷ ceiling) in ${g.conferencias.desagio_publicado_confere.replace(/^(\d+) de (\d+) linhas com preço e teto$/, "$1 of $2 rows with a price and a ceiling")}.`,
                    )}
                  />
                  <GraficoBarras
                    titulo={tx("Deságio agregado por ano do leilão (ponderado pela energia)", "Aggregate discount by auction year (weighted by energy)")}
                    dados={g.desagio.por_ano.map((x) => ({ ano: x.ano, agregado: x.agregado_pct }))}
                    chaveCategoria="ano" // i18n: dado
                    series={[{ id: "agregado", rotulo: tx("Deságio agregado", "Aggregate discount"), cor: "var(--cor-energia)" }]} // i18n: dado
                    unidade="%"
                    casas={1}
                    altura={260}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      "Deságio mede a distância ao teto do edital, não a concorrência: o teto muda a cada leilão e o arquivo não traz o número de proponentes nem os lances perdedores.",
                      "The discount measures the distance from the tender's ceiling, not competition: the ceiling changes with each auction and the file includes neither the number of bidders nor the losing bids.",
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="onde" titulo={tx("Onde estão as usinas contratadas", "Where the contracted plants are")} lead={tx("Energia contratada pela UF principal do empreendimento.", "Energy contracted by the project's main state.")}>
                  <LeiloesMapaUf ufs={ufs} periodo={periodo} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="quem"
                  titulo={tx("Quem venceu, e quem controla as usinas", "Who won, and who controls the plants")}
                  lead={tx(
                    `A vencedora como a ANEEL publica e, à parte, o grupo que controla a usina no cadastro de ${siga}.`,
                    `The winner as ANEEL publishes it and, separately, the group that controls the plant in the registry as of ${siga}.`,
                  )}
                >
                  {g.grupos_controle ? (
                    <GruposControle g={g.grupos_controle} logos={logos} dataSiga={siga} />
                  ) : (
                    <p className="text-sm text-carvao-muted">{tx("O vínculo com o grupo de controle atual não está nesta publicação.", "The link to the current controlling group is not in this release.")}</p>
                  )}
                  <TabelaDados
                    titulo={tx("Vencedoras como publicadas pela ANEEL, pelas 20 maiores em energia contratada", "Winners as published by ANEEL, the 20 largest by energy contracted")}
                    colunas={[tx("Vencedora publicada", "Published winner"), tx("Contratos", "Contracts"), tx("Leilões", "Auctions"), tx("Energia (MWmédio)", "Energy (MWavg)"), tx("Fontes", "Sources")]}
                    idiomaTexto={["nome"]}
                    linhas={g.vencedoras.maiores.map((x) => [x.nome ?? tx("sem nome", "unnamed"), x.empreendimentos, x.leiloes, x.energia_mwmed, x.categorias.map((c) => CURTO_CATEGORIA[c]).join(", ")])}
                    casas={[null, 0, 0, 1, null]}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    <Regra texto={g.vencedoras.regra} regiao="leiloes-vencedoras-regra" />{" "}
                    {tx(`São ${num(g.vencedoras.nomes_distintos, 0)} grafias distintas no arquivo.`, `There are ${num(g.vencedoras.nomes_distintos, 0)} distinct spellings in the file.`)}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="entrega"
                  titulo={tx("O que foi entregue", "What was delivered")}
                  lead={tx(`Situação atual, no cadastro da ANEEL de ${siga}, das usinas que venderam em cada ano.`, `Current status, in the ANEEL registry as of ${siga}, of the plants that sold in each year.`)}
                >
                  <GraficoBarras
                    titulo={tx(`Energia contratada por ano do leilão e situação atual da usina (SIGA de ${siga})`, `Energy contracted by auction year and current plant status (SIGA as of ${siga})`)}
                    dados={linhasEntregaPorAno(g)}
                    chaveCategoria="ano" // i18n: dado
                    series={seriesSit}
                    unidade={mwmedio}
                    casas={0}
                    empilhado
                    altura={320}
                  />
                  <BarrasSituacao
                    titulo={tx(`Parcela da energia contratada de cada fonte por situação da usina (SIGA de ${siga})`, `Share of each source's contracted energy by plant status (SIGA as of ${siga})`)}
                    linhas={entregaCat}
                    ordem={ORDEM_SITUACOES}
                    cores={COR_SITUACAO}
                    rotulos={CURTO_SITUACAO}
                  />
                  <TabelaDados
                    titulo={tx(`Energia contratada por fonte e situação da usina, MWmédio (SIGA de ${siga})`, `Energy contracted by source and plant status, MWavg (SIGA as of ${siga})`)}
                    colunas={[tx("Fonte", "Source"), ...ORDEM_SITUACOES.map((k) => CURTO_SITUACAO[k])]}
                    linhas={entregaCat.map((x) => [x.rotulo, ...ORDEM_SITUACOES.map((k) => x.valores[k])])}
                    casas={[null, ...ORDEM_SITUACOES.map(() => 1)]}
                  />
                  <dl className="grid gap-4 text-sm md:grid-cols-3">
                    {ORDEM_SITUACOES.map((k) => (
                      <div key={k} className="border-l-4 pl-3" style={{ borderColor: COR_SITUACAO[k] }}>
                        <dt className="font-medium text-carvao">
                          {CURTO_SITUACAO[k]}: {mwmed(g.entrega.total[k].energia_mwmed)} ({pct(participacao(g, k), 1)})
                        </dt>
                        <dd className="mt-1 text-xs leading-relaxed text-carvao-muted">{definicaoSituacao(k)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Leilões recentes ainda estão dentro do prazo de implantação. Das usinas contratadas que ainda não operam, o acompanhamento da
                        fiscalização (RALIE de {dataBR(ref.ralie)}) registra{" "}
                        {Object.entries(g.entrega.ralie_situacao_obra)
                          .map(([k, v]) => `${num(v, 0)} com obra "${k.toLowerCase()}"`) // i18n: dado (forma portuguesa do tx)
                          .join(", ")}
                        . O cronograma de cada uma está em{" "}
                        <Link href="/setor-eletrico/expansao/cronograma#p041" className={link}>
                          Expansão, cronograma
                        </Link>
                        .
                      </>,
                      <>
                        Recent auctions are still within the implementation period. Of the contracted plants that are not yet operating, inspection monitoring
                        (RALIE as of {dataBR(ref.ralie)}) records{" "}
                        {Object.entries(g.entrega.ralie_situacao_obra)
                          .map(([k, v]) => `${num(v, 0)} with works "${traduzir(OBRA_RALIE_EN, k)}"`)
                          .join(", ")}
                        . The schedule of each one is in{" "}
                        <Link href="/setor-eletrico/expansao/cronograma#p041" className={link}>
                          Expansion, schedule
                        </Link>
                        .
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="citar"
                  titulo={tx("Números para citar", "Numbers to cite")}
                  lead={tx("Frases calculadas da base publicada, com data e fonte. Atualizam a cada publicação.", "Sentences calculated from the published database, with date and source. They are updated with each release.")}
                >
                  <FrasesCitaveis frases={frases} rotulo={tx("Frases citáveis sobre os leilões do ACR", "Citable sentences about the ACR auctions")} />
                </SecaoDoPainel>

                <SecaoDoPainel id="lista" titulo={tx(`Os ${num(g.cobertura.leiloes, 0)} leilões da base`, `The ${num(g.cobertura.leiloes, 0)} auctions in the database`)}>
                  <TabelaInterativa
                    titulo={tx("Leilões de geração do ACR na base da ANEEL", "ACR generation auctions in the ANEEL database")}
                    colunas={colunasLeiloes()}
                    linhas={linhasLeiloes}
                    chaveLinha="leilao"
                    colunaRotulo="nome"
                    fonte={tx(`${FONTE_LEILOES}; IBGE, IPCA até ${ipca}; ANEEL, SIGA de ${siga}`, `${FONTE_LEILOES}; IBGE, IPCA up to ${ipca}; ANEEL, SIGA as of ${siga}`)}
                    versao={ref.arquivo_gerado_em ?? ref.ultimo_leilao}
                    nomeArquivo="leiloes-acr"
                    chaveUrl="leiloes"
                    ordemInicial={{ coluna: "data", direcao: "desc" }}
                    dicaBusca={tx("Número, tipo ou ano do leilão", "Auction number, type or year")}
                  />
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  <ul className="space-y-1 text-sm">
                    {g.downloads.map((d) => (
                      <li key={d.url}>
                        <a href={d.url} className={link} download>
                          {traduzir(DOWNLOAD_LEILAO_EN, d.rotulo)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras" titulo={tx("Regras, cobertura e conferências", "Rules, coverage and checks")}>
                  <ListaRegras
                    itens={[
                      [
                        tx("Cobertura", "Coverage"),
                        <>
                          <Regra texto={g.cobertura.descricao_fonte} regiao="leiloes-cobertura" /> <Regra texto={g.cobertura.ausentes} regiao="leiloes-ausentes" />
                        </>,
                      ],
                      [tx("Energia", "Energy"), <Regra key="energia" texto={g.regras.energia} regiao="leiloes-regra-energia" />],
                      [tx("Preço", "Price"), <Regra key="preco" texto={g.regras.preco} regiao="leiloes-regra-preco" />],
                      [tx("Preço corrigido", "Adjusted price"), <Regra key="preco-real" texto={g.regras.preco_real} regiao="leiloes-regra-preco-real" />],
                      [tx("Deságio", "Discount"), <Regra key="desagio" texto={g.regras.desagio} regiao="leiloes-regra-desagio" />],
                      [tx("Zeros da fonte", "Zeros in the source"), <Regra key="zeros" texto={g.regras.zeros} regiao="leiloes-regra-zeros" />],
                      [tx("Situação atual", "Current status"), <Regra key="situacao" texto={g.regras.situacao} regiao="leiloes-regra-situacao" />],
                      [tx("Ano A", "Year A"), <Regra key="ano-a" texto={g.regras.ano_a} regiao="leiloes-regra-ano-a" />],
                      [tx("Fonte", "Source"), <Regra key="categoria" texto={g.regras.categoria} regiao="leiloes-regra-categoria" />],
                      [
                        tx("Grupo controlador", "Controlling group"),
                        g.grupos_controle?.regra ? <Regra key="grupo" texto={g.grupos_controle.regra} regiao="leiloes-regra-grupo" /> : tx("sem vínculo nesta publicação", "no link in this release"),
                      ],
                    ]}
                  />
                  <TabelaDados
                    titulo={tx("Conferência das unidades nos leilões estruturantes", "Check of the units in the structuring auctions")}
                    colunas={[tx("Empreendimento", "Project"), tx("Leilão", "Auction"), tx("Energia vendida (MWmédio)", "Energy sold (MWavg)"), tx("Garantia física (MWmédio)", "Physical guarantee (MWavg)")]}
                    idiomaTexto={["nome"]}
                    linhas={g.conferencias.estruturantes_mwmed.map((x) => [x.empreendimento, numeroAneel(x.leilao), x.energia_mwmed, x.garantia_fisica_mwmed])}
                    casas={[null, null, 1, 1]}
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>
                      {tx(
                        <>
                          CEG repetido no mesmo leilão em {g.entrega.ceg_repetido.length} casos:{" "}
                          {g.entrega.ceg_repetido.map((x) => `${numeroAneel(x.leilao)} (${x.empreendimentos.join(" e ")})`).join("; ")}. A situação e o grupo vêm da usina do CEG.
                        </>,
                        <>
                          CEG repeated in the same auction in {g.entrega.ceg_repetido.length} {g.entrega.ceg_repetido.length === 1 ? "case" : "cases"}:{" "}
                          {g.entrega.ceg_repetido.map((x, i) => (
                            <span key={`${x.leilao}-${i}`}>
                              {i ? "; " : ""}
                              {numeroAneel(x.leilao)} (
                              {x.empreendimentos.map((e, j) => (
                                <span key={e}>
                                  {j ? tx(" e ", " and ") : ""}
                                  <Nome>{e}</Nome>
                                </span>
                              ))}
                              )
                            </span>
                          ))}
                          . The status and the group come from the CEG&apos;s plant.
                        </>,
                      )}
                    </li>
                    <li>
                      {tx(
                        <>
                          Energia vendida acima da garantia física publicada em {g.conferencias.energia_acima_da_garantia_fisica.length} linhas (mantidas como
                          publicadas): {g.conferencias.energia_acima_da_garantia_fisica.map((x) => `${x.empreendimento} (${numeroAneel(x.leilao)})`).join("; ")}.
                        </>,
                        <>
                          Energy sold above the published physical guarantee in {g.conferencias.energia_acima_da_garantia_fisica.length}{" "}
                          {g.conferencias.energia_acima_da_garantia_fisica.length === 1 ? "row" : "rows"} (kept as published):{" "}
                          {g.conferencias.energia_acima_da_garantia_fisica.map((x, i) => (
                            <span key={`${x.leilao}-${i}`}>
                              {i ? "; " : ""}
                              <Nome>{x.empreendimento}</Nome> ({numeroAneel(x.leilao)})
                            </span>
                          ))}
                          .
                        </>,
                      )}
                    </li>
                    <li>
                      {tx(
                        <>
                          Zeros tratados como ausência: preço em {g.conferencias.zeros_tratados.preco} linha, garantia física em{" "}
                          {g.conferencias.zeros_tratados.garantia_fisica} e investimento em {g.conferencias.zeros_tratados.investimento}.
                        </>,
                        <>
                          Zeros treated as missing: price in {g.conferencias.zeros_tratados.preco} {g.conferencias.zeros_tratados.preco === 1 ? "row" : "rows"}, physical guarantee
                          in {g.conferencias.zeros_tratados.garantia_fisica} and investment in {g.conferencias.zeros_tratados.investimento}.
                        </>,
                      )}
                    </li>
                    <li>
                      {tx(
                        <>
                          {g.entrega.operacao_com_ato_encerramento} vendas de usinas em operação no SIGA têm ato de revogação ou extinção publicado
                          (conversão de regime ou nova outorga); a fase do SIGA prevalece.
                        </>,
                        <>
                          {g.entrega.operacao_com_ato_encerramento} sales of plants in operation in SIGA have a published act of revocation or extinction
                          (regime conversion or new grant); the SIGA phase prevails.
                        </>,
                      )}
                    </li>
                    {g.ressalvas.map((r) => (
                      <li key={r}>
                        <TrechoPortugues regiao="leiloes-ressalva">{r}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Insumos de outros módulos (tabela rolável)", "Inputs from other modules (scrollable table)")}>
                    <table className="w-full min-w-[36rem] border-collapse text-xs">
                      <caption className="mb-2 text-left text-sm font-medium text-carvao">
                        {tx("Insumos publicados por outros módulos na mesma execução", "Inputs published by other modules in the same run")}
                      </caption>
                      <thead>
                        <tr>
                          {[tx("Arquivo", "File"), tx("Módulo", "Module"), "sha256", tx("Gerado em", "Generated on")].map((h) => (
                            <th key={h} scope="col" className="border-b border-linha px-2 py-1.5 text-left font-medium text-mineral">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.insumos.map((x) => (
                          <tr key={x.arquivo} className="border-b border-linha">
                            <td className="px-2 py-1">
                              <a href={x.url} className={link}>
                                {x.arquivo}
                              </a>
                            </td>
                            <td className="px-2 py-1">{tx(x.modulo, MODULO_EN[x.modulo] ?? x.modulo)}</td>
                            <td className="px-2 py-1 font-mono">{x.sha256.slice(0, 16)}…</td>
                            <td className="px-2 py-1">{carimbo(x.gerado_em)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
