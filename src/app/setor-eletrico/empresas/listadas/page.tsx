import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasDatas, EmpresasIndisponivel, EmpresasNavegacao } from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { ListadasLabControle, type CompanhiaLabControle } from "@/components/energia/ListadasLabControle";
import { ListadasLabRetorno, type PapelLab } from "@/components/energia/ListadasLabRetorno";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { ListadasMatriz } from "@/components/energia/ListadasMatriz";
import { ListadasTabela, type ColunaListadas, type LinhaListadas } from "@/components/energia/ListadasTabela";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, datasLegiveis, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import {
  AUSENCIA_LOGO_EN,
  DEFINICAO_LISTADAS_EN,
  DOWNLOAD_LISTADAS_EN,
  ESPECIE_CONTROLE_EN,
  SEGMENTO_B3_EN,
  notaBolsa,
  comNomes,
  traduzir,
} from "@/lib/energia/i18n/empresas-leiloes";
import {
  MOTIVO_TOPO,
  ROTA_LISTADAS,
  contagemAtuacao,
  controladoresFre,
  estreiasDepoisDe2020,
  logoDe,
  matrizAtuacao,
  participacoesCruzadas,
  comPonto,
  textoCruzada,
  nomeCurto,
  porEspecieControle,
  respostaPanorama,
  rotaFicha,
  sinalPct,
  textoControle,
} from "@/lib/energia/listadas";
import { lerManifestoLogos } from "@/lib/energia/logos";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import type { CompanhiaListada, ListadasGold } from "@/lib/energia/tipos-listadas";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/empresas/listadas", {
    title: tx("Companhias listadas de energia elétrica: ativos, controle, finanças e bolsa", "Listed electric power companies: assets, control, finances and stock market"),
    description: tx(
      "As companhias da carteira do Índice de Energia Elétrica (IEE) da B3: usinas, linhas e distribuidoras sob controle de cada uma, quem as controla (CVM e ANEEL), indicadores financeiros da CVM, retorno das ações com proventos e fatos relevantes dos últimos 24 meses.",
      "The companies in the portfolio of the B3 Electric Power Index (IEE): plants, lines and distribution utilities under each one's control, who controls them (CVM and ANEEL), CVM financial indicators, stock returns with distributions and material facts from the last 24 months.",
    ),
    alternates: { canonical: ROTA_LISTADAS },
  }, anterior);
}

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

function colunas(): ColunaListadas[] {
  const indice = tx("Índice", "Index");
  const ativos = tx("Ativos sob controle", "Assets under control");
  const financas = tx("Finanças, consolidado", "Finances, consolidated");
  const bolsa = tx("Bolsa", "Stock market");
  const milhoes = tx("R$ milhões", "R$ million");
  return [
    { id: "peso", rotulo: tx("Peso no IEE", "Weight in the IEE"), unidade: "%", casas: 2, tipo: "numero", grupo: indice },
    { id: "mw", rotulo: tx("Usinas sob controle", "Plants under control"), unidade: "MW", casas: 0, tipo: "numero", grupo: ativos },
    { id: "km", rotulo: tx("Transmissão", "Transmission"), unidade: tx("km de circuito", "circuit km"), casas: 0, tipo: "numero", grupo: ativos },
    { id: "ucs", rotulo: tx("Distribuição", "Distribution"), unidade: tx("mil UCs", "thousand consumer units"), casas: 0, tipo: "numero", grupo: ativos },
    { id: "receita", rotulo: tx("Receita", "Revenue"), unidade: milhoes, casas: 0, tipo: "numero", grupo: financas },
    { id: "lucro", rotulo: tx("Lucro líquido", "Net income"), unidade: milhoes, casas: 0, tipo: "numero", grupo: financas },
    { id: "margem", rotulo: tx("Margem EBIT", "EBIT margin"), unidade: "%", casas: 1, tipo: "numero", grupo: financas },
    { id: "divpl", rotulo: tx("Dívida bruta ÷ PL", "Gross debt ÷ equity"), unidade: tx("vezes", "times"), casas: 2, tipo: "numero", grupo: financas },
    { id: "r12", rotulo: tx("Retorno total 12 meses", "Total return 12 months"), unidade: "%", casas: 1, tipo: "sinal", grupo: bolsa },
    { id: "r20", rotulo: tx("Retorno total desde o fim de 2020", "Total return since the end of 2020"), unidade: "%", casas: 1, tipo: "sinal", grupo: bolsa },
    { id: "vol", rotulo: tx("Volume diário", "Daily volume"), unidade: tx("R$ milhões, 3 meses", "R$ million, 3 months"), casas: 1, tipo: "numero", grupo: bolsa },
    { id: "fatos", rotulo: tx("Fatos relevantes", "Material facts"), unidade: tx("24 meses", "24 months"), casas: 0, tipo: "numero", grupo: tx("Movimentos", "Moves") },
  ];
}

function ultimaFin(c: CompanhiaListada) {
  return c.financas?.serie.at(-1) ?? null;
}

/** Definição ou regra publicada pela gold de Listadas, no idioma da página. */
const def = (x: string) => comNomes(traduzir(DEFINICAO_LISTADAS_EN, x));

export default function ListadasPage() {
  const g = lerGold<ListadasGold>("listadas.json");
  if (!integra(g))
    return (
      <EmpresasIndisponivel
        motivo={(g as { motivo?: string } | null)?.motivo ?? tx("O painel de companhias listadas não foi gerado nesta publicação.", "The listed companies panel was not generated in this release.")}
      />
    );
  const logos = lerManifestoLogos();
  const cs = g.companhias;
  const n = contagemAtuacao(g);
  const dataCart = dataBR(g.datas.carteira_iee);
  const exercicio = g.datas.financas_ultimo_exercicio;
  const ultimoPregao = dataBR(g.datas.ultimo_pregao);
  const prov = g.proveniencia;
  const nome = (c: CompanhiaListada) => nomeCurto(c, logos);
  const semLogo = (logos?.logos ?? []).filter((l) => !l.arquivo);
  const semDado = tx("sem dado", "no data");
  const motivoSemRegistro = tx("motivo não registrado", "reason not recorded");

  const linhas: LinhaListadas[] = cs.map((c) => {
    const f = ultimaFin(c);
    return {
      id: c.papel,
      href: rotaFicha(c),
      nome: nome(c),
      papel: c.papel,
      logo: logoDe(logos, c.papel),
      valores: {
        peso: c.iee.peso_pct,
        mw: c.atuacao.geracao ? c.geracao.mw_controle : null,
        km: c.transmissao?.km_circuito_operacao ?? null,
        ucs: c.distribuicao?.unidades_consumidoras != null ? c.distribuicao.unidades_consumidoras / 1000 : null,
        receita: f?.receita ?? null,
        lucro: f?.lucro_liquido ?? null,
        margem: f?.margem_ebit_pct ?? null,
        divpl: f?.divida_bruta_sobre_pl ?? null,
        r12: c.bolsa?.retorno_12m?.total_pct ?? null,
        r20: c.bolsa?.retorno_desde_2020?.total_pct ?? null,
        vol: c.bolsa?.volume_medio_diario_3m != null ? c.bolsa.volume_medio_diario_3m / 1e6 : null,
        fatos: c.movimentos.fatos_relevantes_24m,
      },
    };
  });

  const matriz = matrizAtuacao(g).map((m) => {
    const c = cs.find((x) => x.papel === m.papel)!;
    return { ...m, nome: nome(c), href: rotaFicha(c), logo: logoDe(logos, c.papel) };
  });

  // participações cruzadas declaradas no FRE entre companhias da carteira (ex.: Cemig na Taesa)
  const cruzadas = participacoesCruzadas(g);
  const textoCruzadas = (c: CompanhiaListada) => cruzadas.filter((x) => x.de.papel === c.papel).map((x) => textoCruzada(x, nome));
  const labControle: CompanhiaLabControle[] = cs
    .filter((c) => c.atuacao.geracao)
    .map((c) => ({
      papel: c.papel,
      nome: nome(c),
      mwControle: c.geracao.mw_controle,
      mwProporcional: c.geracao.mw_proporcional,
      porNivel: (c.geracao.por_nivel ?? []).map((x) => ({ nivel: x.nivel, mw: x.mw_controle, usinas: x.usinas })),
      cruzadas: textoCruzadas(c),
      nomesCruzadas: cruzadas.filter((x) => x.de.papel === c.papel).flatMap((x) => [nome(x.de), nome(x.em)]),
    }));
  // começa por uma companhia que é controladora de outra da carteira em controle compartilhado (o caso que mais confunde)
  const inicialControle =
    cruzadas.find((x) => x.controlador && labControle.some((l) => l.papel === x.de.papel))?.de.papel ?? labControle.find((x) => x.cruzadas.length)?.papel ?? labControle[0]?.papel ?? "";

  const labRetorno: PapelLab[] = cs
    .filter((c) => c.bolsa && !c.bolsa.motivo && c.bolsa.mensal.length)
    .map((c) => ({
      papel: c.papel,
      nome: nome(c),
      mensal: c.bolsa!.mensal,
      eventos: [
        ...c.bolsa!.eventos_acoes.map((e) => ({
          data_ex: e.data_ex,
          texto: tx(
            `${dataBR(e.data_ex)}: evento em ações (multiplicador ${num(e.multiplicador, 2)}): o fechamento de tela cai na data ex e o preço ajustado não.`,
            `${dataBR(e.data_ex)}: stock event (multiplier ${num(e.multiplicador, 2)}): the screen close drops on the ex-date and the adjusted price does not.`,
          ),
        })),
        ...c.bolsa!.bonificacoes_outra_classe.map((e) => ({
          data_ex: e.data_fechamento,
          texto: tx(
            `${dataBR(e.data_fechamento)}: bonificação em ações de outra classe, valorizada em R$ ${num(e.valor, 2)} por ação pelo primeiro fechamento da classe recebida (estimativa do observatório).`,
            `${dataBR(e.data_fechamento)}: bonus in shares of another class, valued at R$ ${num(e.valor, 2)} per share by the first close of the class received (observatory estimate).`,
          ),
        })),
      ],
    }));
  // começa por um papel com bonificação publicada pela B3 e proventos no período: as três linhas se separam
  const inicialRetorno =
    cs.find((c) => c.bolsa && !c.bolsa.motivo && c.bolsa.eventos_acoes.some((e) => e.data_ex >= "2021-01-01") && (c.bolsa.proventos_12m ?? 0) > 0)?.papel ??
    labRetorno.find((x) => x.eventos.length)?.papel ??
    labRetorno[0]?.papel ??
    "";

  // índice de retorno total mensal em base 100 no fim de 2020 (papel que estreou depois parte do primeiro mês)
  const meses = Array.from(new Set(cs.flatMap((c) => (c.bolsa?.mensal ?? []).map((x) => x[0])))).sort();
  const base100 = Object.fromEntries(
    cs.map((c) => {
      const m = c.bolsa?.mensal ?? [];
      const ini = m.find((x) => x[0] >= "2020-12") ?? null;
      return [c.papel, { ini, mapa: new Map(m.map((x) => [x[0], x[3]])) }];
    }),
  );
  const dadosMultiplos = meses
    .filter((m) => m >= "2020-12")
    .map((m) => {
      const linha: Record<string, string | number | null> = { m };
      for (const c of cs) {
        const b = base100[c.papel];
        const v = b.mapa.get(m);
        linha[c.papel] = b.ini && v !== undefined ? (100 * v) / b.ini[3] : null;
      }
      return linha;
    });
  const estreias = estreiasDepoisDe2020(g);
  const barras12 = cs.map((c) => ({ papel: c.papel, nome: `${nome(c)} (${c.papel})`, preco: c.bolsa?.retorno_12m?.preco_pct ?? null, total: c.bolsa?.retorno_12m?.total_pct ?? null }));
  const r12 = cs.find((c) => c.bolsa?.retorno_12m)?.bolsa?.retorno_12m ?? null;

  const fatos = cs
    .flatMap((c) => c.movimentos.recentes.map((f) => ({ ...f, c })))
    .sort((a, b) => b.data_entrega.localeCompare(a.data_entrega))
    .slice(0, 18);
  const barrasFatos = cs.map((c) => ({ papel: c.papel, nome: `${nome(c)} (${c.papel})`, fatos: c.movimentos.fatos_relevantes_24m }));
  const mudancas = cs.flatMap((c) => c.controle.mudancas.map((m) => ({ ...m, c })));
  const especies = porEspecieControle(g);
  /** Assunto do fato relevante: título que a própria companhia deu ao documento, em português. */
  const assunto = (a: string | null | undefined) =>
    a ? <TrechoPortugues regiao="listadas-fato-assunto">{a}</TrechoPortugues> : tx("Fato relevante sem assunto informado", "Material fact with no subject stated");

  const notasPainel = {
    oQueMudou: tx(
      <>
        A carteira do IEE é a de {dataCart}; a B3 revisa o índice a cada quatro meses e o painel acompanha a carteira do dia da coleta. Cotações até {ultimoPregao}; demonstrações até o exercício de{" "}
        {exercicio ?? "sem dado"}.
      </>,
      <>
        The IEE portfolio is the one of {dataCart}; B3 reviews the index every four months and the panel follows the portfolio of the collection day. Quotes up to {ultimoPregao}; financial statements
        up to fiscal year {exercicio ?? semDado}.
      </>,
    ),
    comoInterpretar: tx(
      <>
        Cada companhia é medida pela própria cadeia de controle: usinas, linhas e distribuidoras cuja dona está abaixo dela entre controladores únicos declarados à ANEEL. Unidades diferentes não se
        somam, e companhias diferentes também não: uma pode ter participação na outra.
      </>,
      <>
        Each company is measured by its own control chain: plants, lines and distribution utilities whose owner is below it among single controlling shareholders declared to ANEEL. Different units are
        not added together, and neither are different companies: one may hold a stake in the other.
      </>,
    ),
    naoConcluir: tx(
      <>
        Quem é melhor investimento ou empresa mais eficiente: retorno passado não indica retorno futuro, o tamanho dos ativos não mede rentabilidade e as margens dependem da composição dos negócios
        (distribuição registra receita de construção). Participações minoritárias e em controle compartilhado não entram nas medidas de ativos.
      </>,
      <>
        Which is the better investment or the more efficient company: past returns do not indicate future returns, the size of the assets does not measure profitability and margins depend on the business
        mix (distribution books construction revenue). Minority stakes and stakes under shared control do not enter the asset measures.
      </>,
    ),
  };
  const notasMovimentos = {
    oQueMudou: tx(<>Documentos do IPE da CVM capturados diariamente.</>, <>CVM IPE documents captured daily.</>),
    comoInterpretar: tx(
      <>O assunto é o título que a própria companhia deu ao documento; o link leva ao arquivo no sistema da CVM.</>,
      <>The subject is the title the company itself gave the document, in Portuguese; the link leads to the file in the CVM system.</>,
    ),
    naoConcluir: tx(
      <>Mais fatos relevantes não significa mais risco nem mais atividade: cada companhia decide o que comunica como fato relevante.</>,
      <>More material facts do not mean more risk or more activity: each company decides what it discloses as a material fact.</>,
    ),
  };

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-listadas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="listadas" />
        <CabecalhoModulo
          rotulo={tx("Empresas", "Companies")}
          siglas={["IEE", "B3", "CVM", "FRE", "FCA", "IPE", "SIGA", "SIGET", "ANEEL", "EBIT"]}
          titulo={tx("Quem são as companhias listadas de energia elétrica?", "Who are the listed electric power companies?")}
          lead={tx(
            `As ${g.universo.companhias} companhias da carteira do Índice de Energia Elétrica (IEE) da B3: os ativos que cada uma controla, quem a controla, os números que publica e como as ações se comportaram.`,
            `The ${g.universo.companhias} companies in the portfolio of the B3 Electric Power Index (IEE): the assets each one controls, who controls it, the numbers it publishes and how its shares have performed.`,
          )}
          recorte={tx(
            `Carteira do IEE de ${dataCart} · ativos do SIGA de ${dataBR(g.datas.siga)} · cotações até ${ultimoPregao} · DFP até ${exercicio ?? "sem dado"}`,
            `IEE portfolio of ${dataCart} · SIGA assets as of ${dataBR(g.datas.siga)} · quotes up to ${ultimoPregao} · DFP up to ${exercicio ?? semDado}`,
          )}
          fonte={comNomes(
            tx(
              "B3 (índice, cotações e proventos); CVM (FCA, FRE, DFP e IPE); ANEEL (SIGA, SIGET e Composição Societária)",
              "B3 (index, quotes and distributions); CVM (FCA, FRE, DFP and IPE); ANEEL (SIGA, SIGET and Composição Societária)",
            ),
          )}
          limite={tx(
            "Não ordena companhias por mérito: a ordem padrão é o peso no índice, e cada medida tem a sua unidade e a sua data.",
            "It does not rank companies by merit: the default order is the weight in the index, and each measure has its own unit and date.",
          )}
          referencia={tx(
            <>
              {g.universo.regra} {g.universo.nota} Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {def(g.universo.regra)} {def(g.universo.nota)} Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: tx("Carteira do IEE", "IEE portfolio"), texto: tx(`de ${dataCart}`, `as of ${dataCart}`), natureza: "OBSERVADO" },
                { rotulo: tx("Usinas (SIGA)", "Plants (SIGA)"), texto: tx(`até ${dataBR(g.datas.siga)}`, `up to ${dataBR(g.datas.siga)}`), natureza: "OBSERVADO" },
                { rotulo: tx("Transmissão (SIGET)", "Transmission (SIGET)"), texto: tx(`até ${dataBR(g.datas.siget)}`, `up to ${dataBR(g.datas.siget)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Composição societária (ANEEL)", "Shareholding structure (ANEEL)"),
                  texto: tx(`referência ${g.datas.polimero_trimestre ?? "sem dado"}`, `reference ${g.datas.polimero_trimestre ?? semDado}`),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Formulário de Referência (CVM)", "Reference Form (CVM)"),
                  texto: tx(`formulários de ${g.datas.fre_anos.join(", ")}`, `forms of ${g.datas.fre_anos.join(", ")}`),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Demonstrações (CVM, DFP)", "Financial statements (CVM, DFP)"),
                  texto: tx(`até o exercício de ${exercicio ?? "sem dado"}`, `up to fiscal year ${exercicio ?? semDado}`),
                  natureza: "OBSERVADO",
                },
                { rotulo: tx("Cotações (B3)", "Quotes (B3)"), texto: tx(`até ${ultimoPregao}`, `up to ${ultimoPregao}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Fatos relevantes (CVM, IPE)", "Material facts (CVM, IPE)"),
                  texto: tx(`de ${dataBR(g.datas.ipe_desde)} em diante`, `from ${dataBR(g.datas.ipe_desde)} onward`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Atuação das companhias da carteira", "Activities of the portfolio companies")}
              nota={tx(
                "Contagens de companhias, não de ativos; uma companhia pode atuar em mais de um segmento.",
                "Counts of companies, not of assets; a company can operate in more than one segment.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Companhias na carteira do IEE", "Companies in the IEE portfolio")}
                natureza="OBSERVADO"
                valor={g.universo.companhias}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx(`carteira de ${dataCart}`, `portfolio of ${dataCart}`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Controlam usinas em operação", "Control plants in operation")}
                natureza="CALCULADO"
                valor={n.geracao}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx(`SIGA de ${dataBR(g.datas.siga)}`, `SIGA as of ${dataBR(g.datas.siga)}`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Controlam linhas de transmissão", "Control transmission lines")}
                natureza="CALCULADO"
                valor={n.transmissao}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx(`SIGET de ${dataBR(g.datas.siget)}`, `SIGET as of ${dataBR(g.datas.siget)}`)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Controlam distribuidoras", "Control distribution utilities")}
                natureza="CALCULADO"
                valor={n.distribuicao}
                formato="num"
                casas={0}
                unidade={tx("companhias", "companies")}
                periodo={tx("índice de distribuidoras", "distribution utility index")}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O painel começa pelas companhias que a própria B3 reúne no índice setorial de energia elétrica. Cada papel é ligado à companhia pelo código CVM publicado pela B3 e conferido no código de
              negociação que a companhia declara no Formulário Cadastral ({SIGLAS.FCA}). Os ativos vêm dos cadastros da ANEEL já usados no módulo Empresas, pelo CNPJ; nada é ligado por semelhança de nome.
            </>,
            <>
              The panel starts from the companies that B3 itself groups in the electric power sector index. Each stock is linked to the company by the CVM code published by B3 and checked against the
              ticker the company declares in its Registration Form ({SIGLAS_IDIOMAS.en.FCA}). The assets come from the ANEEL registries already used in the Companies module, by CNPJ; nothing is linked by
              name similarity.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="listadas">
            <section aria-labelledby="quem-titulo" className="space-y-4 pb-8" id="quem">
              <h2 id="quem-titulo" className="ed-h2 font-serif text-carvao">
                {tx("As companhias da carteira", "The portfolio companies")}
              </h2>
              <RespostaCurta id="quem" tamanho="sm" veredito={respostaPanorama(g)}>
                {tx(
                  <>
                    {g.universo.regra} Soma dos pesos lidos: {num(g.universo.soma_pesos_pct, 3)}%. {g.universo.nota}
                  </>,
                  <>
                    {def(g.universo.regra)} Sum of the weights read: {num(g.universo.soma_pesos_pct, 3)}%. {def(g.universo.nota)}
                  </>,
                )}
              </RespostaCurta>
              <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3" data-cartoes-listadas="">
                {cs.map((c) => {
                  const ctrl = controladoresFre(c);
                  const r = c.bolsa?.retorno_12m;
                  const segmento = c.iee.segmento_nome ? traduzir(SEGMENTO_B3_EN, c.iee.segmento_nome) : (c.iee.segmento ?? tx("segmento sem dado", "segment without data"));
                  const pf = c.controle.fre?.pessoas_fisicas?.controladores;
                  return (
                    <li key={c.papel} className="flex min-w-0 flex-col gap-2 border-t border-linha pt-4">
                      <div className="flex items-center gap-3">
                        <ListadasLogo logo={logoDe(logos, c.papel)} nome={nome(c)} decorativo={!!logoDe(logos, c.papel)?.arquivo} />
                        <div className="min-w-0 leading-tight">
                          <Link href={rotaFicha(c)} className={`${link} font-serif text-lg`}>
                            <Nome>{nome(c)}</Nome>
                          </Link>
                          <p className="text-xs text-mineral">
                            {c.papel} · {comNomes(segmento)} · {tx(`${pct(c.iee.peso_pct, 2)} do IEE`, `${pct(c.iee.peso_pct, 2)} of the IEE`)}
                          </p>
                        </div>
                      </div>
                      <p className="flex flex-wrap gap-1.5" aria-label={tx("Segmentos com ativos sob controle", "Segments with assets under control")}>
                        {(["geracao", "transmissao", "distribuicao"] as const).map((s) => (
                          <span
                            key={s}
                            className={`rounded-sm border px-1.5 py-0.5 text-xs ${c.atuacao[s] ? "border-energia text-energia-dark" : "border-linha text-mineral line-through"}`}
                          >
                            {s === "geracao" ? tx("Geração", "Generation") : s === "transmissao" ? tx("Transmissão", "Transmission") : tx("Distribuição", "Distribution")}
                            <span className="sr-only">{c.atuacao[s] ? tx(": atua", ": operates") : tx(": não atua", ": does not operate")}</span>
                          </span>
                        ))}
                      </p>
                      <p className="text-sm leading-relaxed text-carvao-muted">
                        {ctrl.length || pf
                          ? tx<ReactNode>(
                              comPonto(`Controle declarado: ${[...ctrl.map((a) => a.nome), ...(pf ? ["pessoas físicas"] : [])].join(", ")}`),
                              <>
                                Declared control:{" "}
                                {[...ctrl.map((a) => <Nome key={a.nome}>{a.nome}</Nome>), ...(pf ? [<span key="pf">individuals</span>] : [])].map((x, i) => (
                                  <span key={i}>
                                    {i ? ", " : ""}
                                    {x}
                                  </span>
                                ))}
                                .
                              </>,
                            )
                          : tx("Sem acionista controlador declarado no Formulário de Referência.", "No controlling shareholder declared in the Reference Form.")}
                      </p>
                      <p className="text-xs text-mineral">
                        {tx("Retorno total em 12 meses:", "Total return over 12 months:")} <span className="tabular-nums text-carvao">{sinalPct(r?.total_pct)}</span>
                        {r ? tx(` (até ${dataBR(r.ate)})`, ` (up to ${dataBR(r.ate)})`) : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {semLogo.length > 0 && (
                <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  {tx(
                    <>
                        Símbolos: arquivos oficiais publicados pelas próprias companhias, sem alteração. Sem arquivo oficial obtido: {semLogo.map((l) => `${l.nome_exibicao} (${l.ausencia?.motivo ?? motivoSemRegistro})`).join("; ")}. O nome aparece em texto.
                    </>,
                    <>
                      Logos: official files published by the companies themselves, unaltered. No official file obtained:{" "}
                      {semLogo.map((l, i) => (
                        <span key={l.papel ?? l.nome_exibicao}>
                          {i ? "; " : ""}
                          <Nome>{l.nome_exibicao}</Nome> ({l.ausencia?.motivo ? traduzir(AUSENCIA_LOGO_EN, l.ausencia.motivo) : motivoSemRegistro})
                        </span>
                      ))}
                      . The name appears as text.
                    </>,
                  )}
                </p>
              )}
            </section>

            <PainelEvidencia
              id="ativos"
              pergunta={tx("Quais ativos cada companhia controla?", "Which assets does each company control?")}
              subtitulo={tx(
                "Geração em MW, transmissão em km de circuito, distribuição em unidades consumidoras · cada coluna na sua escala",
                "Generation in MW, transmission in circuit km, distribution in consumer units · each column on its own scale",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>Saber em que segmento cada companhia atua e com que escala é o ponto de partida para ler o resultado, o risco regulatório e a exposição a cada mercado.</>,
                <>Knowing in which segment each company operates and at what scale is the starting point for reading its earnings, regulatory risk and exposure to each market.</>,
              )}
              oQueMudou={notasPainel.oQueMudou}
              comoInterpretar={tx(
                <>A barra de cada coluna é a fração do maior valor da mesma coluna. Uma companhia pode ter a maior barra numa coluna e nenhuma em outra; as colunas não se somam.</>,
                <>Each column&apos;s bar is the fraction of the largest value in the same column. A company can have the largest bar in one column and none in another; the columns are not added together.</>,
              )}
              naoConcluir={notasPainel.naoConcluir}
              proveniencia={prov.ativos}
              complementares={[{ rotulo: tx("Carteira do IEE", "IEE portfolio"), p: prov.carteira }]}
            >
              <ListadasMatriz
                linhas={matriz}
                legenda={tx(`Ativos sob controle de cada companhia da carteira do IEE de ${dataCart}`, `Assets under the control of each company in the IEE portfolio of ${dataCart}`)}
              />
              <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                {def(g.definicoes.sob_controle)} {def(g.definicoes.mw_controle)}
              </p>
            </PainelEvidencia>

            <PainelEvidencia
              id="controle"
              pergunta={tx("Quem controla cada companhia?", "Who controls each company?")}
              subtitulo={tx(
                "Controladores declarados no Formulário de Referência da CVM e espécie de controle declarada no Formulário Cadastral",
                "Controlling shareholders declared in the CVM Reference Form and type of control declared in the Registration Form",
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>O controlador define estratégia, dividendos e investimento. Estado, grupos estrangeiros, famílias e companhias sem controlador definido respondem a incentivos diferentes.</>,
                <>The controlling shareholder sets strategy, dividends and investment. The State, foreign groups, families and companies with no defined controlling shareholder respond to different incentives.</>,
              )}
              oQueMudou={tx(
                <>
                  Posições declaradas nos Formulários de Referência de {g.datas.fre_anos.join(", ")}; cada acionista traz a data da última alteração que a companhia informou. {mudancas.length} mudanças de pelo menos 0,5 ponto
                  percentual entre o formulário anterior e o atual.
                </>,
                <>
                  Positions declared in the Reference Forms of {g.datas.fre_anos.join(", ")}; each shareholder carries the date of the latest change the company reported. {mudancas.length} changes of at
                  least 0.5 percentage point between the previous form and the current one.
                </>,
              )}
              comoInterpretar={tx(
                <>Controlador é o acionista que a companhia marca como tal. Pessoas físicas aparecem somadas, sem nome. A espécie de controle é a que a própria companhia declara à CVM.</>,
                <>A controlling shareholder is the shareholder the company flags as such. Individuals appear added together, without names. The type of control is the one the company itself declares to the CVM.</>,
              )}
              naoConcluir={tx(
                <>A posição no formulário pode estar desatualizada entre uma entrega e outra; para mudança recente, confira os fatos relevantes da companhia.</>,
                <>The position in the form may be out of date between one filing and the next; for a recent change, check the company&apos;s material facts.</>,
              )}
              proveniencia={prov.controle}
              complementares={[{ rotulo: tx("Cadeia de controle (ANEEL)", "Control chain (ANEEL)"), p: prov.ativos }]}
            >
              <div className="space-y-6">
                <div className="tabela-scroll overflow-x-auto" role="region" aria-label={tx("Controle de cada companhia", "Control of each company")} tabIndex={0}>
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <caption className="sr-only">{tx("Controle declarado de cada companhia da carteira", "Declared control of each portfolio company")}</caption>
                    <thead>
                      <tr className="text-left text-xs text-carvao-muted">
                        <th scope="col" className="pb-2 pr-3 font-medium">
                          {tx("Companhia", "Company")}
                        </th>
                        <th scope="col" className="pb-2 pr-3 font-medium">
                          {tx("Espécie de controle (FCA)", "Type of control (FCA)")}
                        </th>
                        <th scope="col" className="pb-2 pr-3 font-medium">
                          {tx("Controladores e acionistas de referência (FRE)", "Controlling and reference shareholders (FRE)")}
                        </th>
                        <th scope="col" className="pb-2 font-medium">
                          {tx("Topo da cadeia declarada à ANEEL", "Top of the chain declared to ANEEL")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cs.map((c) => (
                        <tr key={c.papel} className="border-t border-linha align-top">
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            <Link href={`${rotaFicha(c)}#controle`} className={link}>
                              <Nome>{nome(c)}</Nome>
                            </Link>
                            <span className="block text-xs text-mineral">{c.papel}</span>
                          </th>
                          <td className="py-2 pr-3 text-carvao">{c.controle.especie_fca ? traduzir(ESPECIE_CONTROLE_EN, c.controle.especie_fca) : semDado}</td>
                          <td className="py-2 pr-3 text-carvao-muted">{comNomes(textoControle(c), controladoresFre(c).map((a) => a.nome))}</td>
                          <td className="py-2 text-carvao-muted">
                            {c.controle.topo_cnpj === c.cnpj ? tx("A própria companhia", "The company itself") : c.controle.topo_nome ? <Nome>{c.controle.topo_nome}</Nome> : c.controle.topo_cnpj}
                            <span className="block text-xs text-mineral">{MOTIVO_TOPO[c.controle.motivo_parada] ?? c.controle.motivo_parada}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SecaoDoPainel
                  id="especies"
                  titulo={tx("Como as companhias declaram o próprio controle?", "How do the companies declare their own control?")}
                  lead={tx(
                    "Agrupamento pela espécie de controle que cada companhia declara à CVM no Formulário Cadastral.",
                    "Grouping by the type of control each company declares to the CVM in the Registration Form.",
                  )}
                >
                  <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {especies.map((e) => (
                      <li key={e.especie} className="border-l-2 border-linha pl-3">
                        <p className="rotulo text-mineral">{traduzir(ESPECIE_CONTROLE_EN, e.especie)}</p>
                        <p className="text-sm text-carvao">
                          <Nome>{e.papeis.map((p) => nome(cs.find((c) => c.papel === p)!)).join(", ")}</Nome>
                        </p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>
                <SecaoDoPainel
                  id="lab-controle"
                  titulo={tx("Laboratório: como ler uma cadeia de controle", "Lab: how to read a control chain")}
                  lead={tx(
                    "Os ativos de um grupo listado raramente estão na própria companhia: ficam em controladas e em controladas das controladas. Mova os degraus para ver quanto da potência sob controle está em cada nível, e compare comando (sob controle) com propriedade direta (proporcional).",
                    "A listed group's assets are rarely in the company itself: they sit in subsidiaries and in subsidiaries of subsidiaries. Move the steps to see how much of the capacity under control is at each level, and compare command (under control) with direct ownership (proportional).",
                  )}
                >
                  {labControle.length > 0 ? (
                    <ListadasLabControle companhias={labControle} inicial={inicialControle} />
                  ) : (
                    <p className="text-sm text-carvao-muted">{tx("Nenhuma companhia com usinas sob controle nesta publicação.", "No company with plants under control in this release.")}</p>
                  )}
                </SecaoDoPainel>
                {mudancas.length > 0 && (
                  <SecaoDoPainel
                    id="mudancas"
                    titulo={tx("Que posições acionárias mudaram entre os dois últimos formulários?", "Which shareholdings changed between the two latest forms?")}
                    lead={tx(
                      "Entradas, saídas e variações de pelo menos 0,5 ponto percentual no total de ações, como declaradas.",
                      "Entries, exits and changes of at least 0.5 percentage point in total shares, as declared.",
                    )}
                  >
                    <ul className="space-y-1 text-sm text-carvao-muted">
                      {mudancas.map((m) => (
                        <li key={`${m.c.papel}-${m.acionista}-${m.tipo}`}>
                          <span className="text-carvao">
                            <Nome>{nome(m.c)}</Nome>
                          </span>
                          : <Nome>{m.acionista}</Nome>{" "}
                          {m.tipo === "entrada"
                            ? tx(`passa a constar com ${pct(m.depois, 2)}`, `now appears with ${pct(m.depois, 2)}`)
                            : m.tipo === "saida"
                              ? tx(`deixa de constar (tinha ${pct(m.antes, 2)})`, `no longer appears (it had ${pct(m.antes, 2)})`)
                              : tx(`de ${pct(m.antes, 2)} para ${pct(m.depois, 2)}`, `from ${pct(m.antes, 2)} to ${pct(m.depois, 2)}`)}
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                )}
              </div>
            </PainelEvidencia>

            <PainelEvidencia
              id="desempenho"
              pergunta={tx("Como as ações das companhias se comportaram?", "How have the companies' shares performed?")}
              subtitulo={tx(
                "Retorno total (proventos reinvestidos) e retorno de preço ajustado, em % · índice mensal em base 100 no fim de 2020",
                "Total return (distributions reinvested) and adjusted price return, in % · monthly index based 100 at the end of 2020",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>O retorno total é o que o acionista obteve com a ação e os proventos; o preço sozinho subestima companhias que distribuem muito do lucro, como as transmissoras.</>,
                <>Total return is what the shareholder obtained from the share and the distributions; price alone underestimates companies that pay out much of their profit, such as transmission companies.</>,
              )}
              oQueMudou={tx(
                <>Cotações da série histórica da B3 até {ultimoPregao}; proventos e eventos em ações publicados pela B3 por emissor.</>,
                <>Quotes from the B3 historical series up to {ultimoPregao}; distributions and stock events published by B3 by issuer.</>,
              )}
              comoInterpretar={tx(
                <>
                  {g.definicoes.retorno_total} {g.definicoes.retorno_preco}
                </>,
                <>
                  {def(g.definicoes.retorno_total)} {def(g.definicoes.retorno_preco)}
                </>,
              )}
              naoConcluir={tx(
                <>Retorno passado não indica retorno futuro, e janelas diferentes contam histórias diferentes. Não é recomendação de investimento.</>,
                <>Past returns do not indicate future returns, and different windows tell different stories. This is not investment advice.</>,
              )}
              proveniencia={prov.bolsa}
            >
              <div className="space-y-6">
                <GraficoBarras
                  rotulosSaoNomes
                  titulo={r12 ? tx(`Retorno em 12 meses, até ${dataBR(r12.ate)}`, `12-month return, up to ${dataBR(r12.ate)}`) : tx("Retorno em 12 meses", "12-month return")}
                  dados={barras12}
                  chaveCategoria="papel"
                  chaveRotulo="nome"
                  series={[
                    { id: "preco", rotulo: tx("Preço ajustado", "Adjusted price"), cor: "var(--serie-comp-4)" },
                    // i18n: dado (chave de dado ou forma de um ramo do tx)
                    { id: "total", rotulo: tx("Retorno total", "Total return"), cor: "var(--cor-energia)" },
                  ]}
                  unidade="%"
                  casas={1}
                  orientacao="horizontal"
                  rotulosValor
                  alturaMaxima={760}
                />
                <PequenosMultiplos
                  titulo={tx("Retorno total acumulado desde o fim de 2020 (base 100 em dez/2020)", "Cumulative total return since the end of 2020 (base 100 in Dec 2020)")}
                  dados={dadosMultiplos}
                  chaveX="m"
                  formatoX="mes"
                  unidade={tx("base 100", "base 100")}
                  casas={0}
                  colunas={4}
                  escala="compartilhada"
                  paineis={cs.map((c) => ({
                    id: c.papel,
                    titulo: `${nome(c)} (${c.papel})`,
                    tituloEhNome: true,
                    nota: estreias.some((e) => e.papel === c.papel)
                      ? tx(`série começa em ${dataBR(c.bolsa!.primeiro_pregao)}`, `series starts on ${dataBR(c.bolsa!.primeiro_pregao)}`)
                      : undefined,
                  }))}
                  sincronizarCursor={false}
                />
                <SecaoDoPainel
                  id="lab-retorno"
                  titulo={tx("Laboratório: fechamento de tela, preço ajustado e retorno total", "Lab: screen close, adjusted price and total return")}
                  lead={tx(
                    "Escolha um papel. O fechamento de tela é o que a bolsa mostra no dia; ele cai na data de uma bonificação sem que o acionista perca nada. O preço ajustado corrige isso, e o retorno total soma os proventos.",
                    "Choose a stock. The screen close is what the exchange shows on the day; it drops on the date of a bonus share issue without the shareholder losing anything. The adjusted price corrects that, and total return adds the distributions.",
                  )}
                >
                  {labRetorno.length > 0 ? (
                    <ListadasLabRetorno papeis={labRetorno} inicial={inicialRetorno} />
                  ) : (
                    <p className="text-sm text-carvao-muted">{tx("Sem séries de cotações nesta publicação.", "No quote series in this release.")}</p>
                  )}
                </SecaoDoPainel>
                {cs.some((c) => c.bolsa?.notas.length || c.bolsa?.emendas.length) && (
                  <SecaoDoPainel id="notas-bolsa" titulo={tx("O que muda a leitura das séries?", "What changes the reading of the series?")} nivel="analisar">
                    <ul className="space-y-1.5 text-sm leading-relaxed text-carvao-muted">
                      {cs.flatMap((c) => [
                        ...(c.bolsa?.emendas ?? []).map((e) => (
                          <li key={`${c.papel}-em-${e.codigo_anterior}`}>
                            {tx(
                              <>
                                {c.papel}: a série emenda {e.codigo_anterior} (até {dataBR(e.ultimo_pregao_anterior)}) e {e.codigo} (desde {dataBR(e.primeiro_pregao)}), mesma companhia e mesma classe no Formulário
                                Cadastral.
                              </>,
                              <>
                                {c.papel}: the series joins {e.codigo_anterior} (up to {dataBR(e.ultimo_pregao_anterior)}) and {e.codigo} (since {dataBR(e.primeiro_pregao)}), same company and same class in
                                the Registration Form.
                              </>,
                            )}
                          </li>
                        )),
                        ...(c.bolsa?.notas ?? []).map((t) => (
                          <li key={`${c.papel}-${t}`}>
                            {c.papel}: {datasLegiveis(notaBolsa(t))}
                          </li>
                        )),
                      ])}
                    </ul>
                  </SecaoDoPainel>
                )}
              </div>
            </PainelEvidencia>

            <PainelEvidencia
              id="comparacao"
              pergunta={tx("Como se comparam os indicadores financeiros e de mercado?", "How do the financial and market indicators compare?")}
              subtitulo={tx(
                `Ativos sob controle, demonstrações consolidadas do exercício de ${exercicio ?? "sem dado"} e bolsa até ${ultimoPregao} · clique no cabeçalho para ordenar`,
                `Assets under control, consolidated statements for fiscal year ${exercicio ?? semDado} and stock market up to ${ultimoPregao} · click the header to sort`,
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>Receita, lucro, alavancagem e retorno na mesma linha permitem localizar cada companhia; a ficha de cada uma mostra a série e o contexto.</>,
                <>Revenue, income, leverage and return on the same row let you place each company; each one&apos;s profile shows the series and the context.</>,
              )}
              oQueMudou={notasPainel.oQueMudou}
              comoInterpretar={tx(
                <>
                  {g.definicoes.margem_ebit} {g.definicoes.divida_bruta_sobre_pl}
                </>,
                <>
                  {def(g.definicoes.margem_ebit)} {def(g.definicoes.divida_bruta_sobre_pl)}
                </>,
              )}
              naoConcluir={notasPainel.naoConcluir}
              proveniencia={prov.financas ?? prov.bolsa}
              complementares={[
                { rotulo: tx("Bolsa", "Stock market"), p: prov.bolsa },
                { rotulo: tx("Ativos", "Assets"), p: prov.ativos },
              ]}
            >
              <ListadasTabela colunas={colunas()} linhas={linhas} legenda={tx("Companhias da carteira do IEE: ativos, finanças e bolsa", "IEE portfolio companies: assets, finances and stock market")} />
              <p className="mt-2 text-xs text-carvao-muted">
                {tx(<>Ausência é &quot;sem dado&quot; e fica no fim de qualquer ordenação.</>, <>Missing values read &quot;no data&quot; and go to the end of any sorting.</>)}{" "}
                {cs.filter((c) => c.bolsa && !c.bolsa.motivo && !c.bolsa.retorno_desde_2020).length > 0 &&
                  tx(
                    `Retorno desde o fim de 2020 sem dado para ${cs
                      .filter((c) => c.bolsa && !c.bolsa.motivo && !c.bolsa.retorno_desde_2020)
                      // i18n: dado (chave de dado ou forma de um ramo do tx)
                      .map((c) => `${c.papel} (série desde ${dataBR(c.bolsa!.primeiro_pregao)}${c.bolsa!.serie_reiniciada_em ? ", recomeçada depois de evento em ações sem fator publicado pela B3" : ", estreia na bolsa"})`)
                      .join("; ")}: a ficha de cada uma mostra o retorno desde o início da série. `,
                    `Return since the end of 2020 without data for ${cs
                      .filter((c) => c.bolsa && !c.bolsa.motivo && !c.bolsa.retorno_desde_2020)
                      .map(
                        (c) =>
                          `${c.papel} (series since ${dataBR(c.bolsa!.primeiro_pregao)}${c.bolsa!.serie_reiniciada_em ? ", restarted after a stock event without a factor published by B3" : ", stock market debut"})`,
                      )
                      .join("; ")}: each one's profile shows the return since the start of the series. `,
                  )}
                {tx("Arquivo completo:", "Full file:")}{" "}
                <a className={link} href="/energia/series/listadas_companhias.csv">
                  listadas_companhias.csv
                </a>
                .
              </p>
            </PainelEvidencia>

            <PainelEvidencia
              id="movimentos"
              pergunta={tx("Como as companhias têm se movimentado?", "How have the companies been moving?")}
              subtitulo={tx(
                `Fatos relevantes entregues à CVM de ${dataBR(g.datas.ipe_desde)} em diante · contagem e os mais recentes`,
                `Material facts filed with the CVM from ${dataBR(g.datas.ipe_desde)} onward · count and the most recent ones`,
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>Aquisições, vendas de ativos, emissões, mudanças de controle e decisões regulatórias aparecem primeiro nos fatos relevantes.</>,
                <>Acquisitions, asset sales, issuances, changes of control and regulatory decisions appear first in material facts.</>,
              )}
              oQueMudou={notasMovimentos.oQueMudou}
              comoInterpretar={notasMovimentos.comoInterpretar}
              naoConcluir={notasMovimentos.naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.movimentos}
            >
              <div className="space-y-6">
                <GraficoBarras
                  rotulosSaoNomes
                  titulo={tx(`Fatos relevantes por companhia, desde ${dataBR(g.datas.ipe_desde)}`, `Material facts by company, since ${dataBR(g.datas.ipe_desde)}`)}
                  dados={barrasFatos}
                  chaveCategoria="papel"
                  chaveRotulo="nome"
                  // i18n: dado (chave de dado ou forma de um ramo do tx)
                  series={[{ id: "fatos", rotulo: tx("Fatos relevantes", "Material facts"), cor: "var(--cor-energia)" }]}
                  unidade={tx("documentos", "documents")}
                  casas={0}
                  orientacao="horizontal"
                  rotulosValor
                  alturaMaxima={640}
                />
                <NotasDoPainel oQueMudou={notasMovimentos.oQueMudou} comoInterpretar={notasMovimentos.comoInterpretar} naoConcluir={notasMovimentos.naoConcluir} />
                <SecaoDoPainel id="recentes" titulo={tx("Os fatos relevantes mais recentes", "The most recent material facts")}>
                  <ol className="space-y-2">
                    {fatos.map((f) => (
                      <li key={`${f.c.papel}-${f.protocolo ?? f.data_entrega}-${f.assunto}`} className="grid gap-x-4 text-sm sm:grid-cols-[6.5rem_9rem_1fr]">
                        <time dateTime={f.data_entrega} className="tabular-nums text-mineral">
                          {dataBR(f.data_entrega)}
                        </time>
                        <Link href={`${rotaFicha(f.c)}#movimentos`} className={link}>
                          <Nome>{nome(f.c)}</Nome>
                        </Link>
                        <span className="text-carvao">
                          {f.link ? (
                            <a href={f.link} className={link} rel="noopener noreferrer">
                              {assunto(f.assunto)}
                              <span className="sr-only">{tx(" (documento na CVM)", " (document at the CVM)")}</span>
                            </a>
                          ) : (
                            assunto(f.assunto)
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>

            <section aria-labelledby="dados-titulo" className="space-y-3 border-t border-linha pt-6" id="dados-do-painel">
              <h2 id="dados-titulo" className="ed-h3 font-serif text-carvao">
                {tx("Dados para baixar", "Data to download")}
              </h2>
              <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {g.downloads.map((d) => (
                  <li key={d.url}>
                    <a className={link} href={d.url}>
                      {traduzir(DOWNLOAD_LISTADAS_EN, d.rotulo)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
