import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { ModeloDidatico, type ListaDeFora } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, NumeroIndicador, PaginaPainel, TabelaDados } from "@/components/painel";
import type { NumeroProps } from "@/components/painel";
import { ConsultaMunicipal } from "@/components/familias/credito-imobiliario/ConsultaMunicipal";
import { SimuladorPrestacao } from "@/components/familias/credito-imobiliario/SimuladorPrestacao";
import { CONFIABILIDADE, dinheiro, n0, num, pc } from "@/components/familias/credito-imobiliario/formato";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { dataBr } from "@/lib/perguntas/leitura";
import {
  ARQUIVO_MUNICIPIOS,
  DESCRICAO_MORADIA,
  NATUREZA_DO_SELO,
  PERGUNTA_MORADIA,
  ROTA_MORADIA,
  SEGMENTOS,
  achadosExibidos,
  base,
  dadosMoradia,
  leituraDaConcentracao,
  provMoradia,
  somasPorUf,
  textoDaGold,
  type ItemRanking,
  type Selo,
} from "@/lib/familias/credito-imobiliario";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao(PERGUNTA_MORADIA, ROTA_MORADIA),
  description: DESCRICAO_MORADIA,
  alternates: { canonical: ROTA_MORADIA },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const acao = "inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao";
const prosa = "t-corpo max-w-prose2 text-carvao";
const meta = "t-meta max-w-prose2 text-carvao-muted";
/** Renda de partida do simulador: valor de exemplo, o mesmo da vista antiga; não vem de nenhuma base. */
const RENDA_DE_EXEMPLO = 6000;

const ROTULO_SELO: Record<Selo, string> = { observado: "observado", calculado: "calculado", estimado: "estimado", cenario: "cenário", indisponivel: "indisponível" };
const SITUACAO = { viavel: "viável", parcial: "parcial", indisponivel: "indisponível" } as const;

/** Ressalva material, sempre à vista: filete escuro, sem cor de aviso. */
function Alerta({ titulo, children }: Readonly<{ titulo?: string; children: ReactNode }>) {
  return (
    <p role="note" className="t-corpo max-w-prose2 border-l-2 border-carvao pl-4 text-carvao">
      {titulo && <span className="font-medium">{titulo} </span>}
      {children}
    </p>
  );
}

/** Número em texto da gold, ou ausência declarada. */
function numero(b: Omit<NumeroProps, "valor" | "valorTexto" | "motivoAusencia" | "formato">, v: number | null | undefined, texto: (v: number) => string): NumeroProps {
  return typeof v === "number"
    ? ({ ...b, formato: "texto", valorTexto: texto(v) } as NumeroProps)
    : ({ ...b, valor: null, motivoAusencia: "A publicação usada nesta página não traz este valor." } as NumeroProps);
}

function TabelaLacuna({ id, titulo, lead, coluna, itens, valor, aviso }: Readonly<{ id: string; titulo: string; lead: string; coluna: string; itens: ItemRanking[]; valor: (v: number) => number; aviso: string }>) {
  return (
    <TabelaDados
      id={id}
      tituloVisivel={titulo}
      lead={lead}
      titulo={titulo}
      colunas={["Posição", "Município", "UF", coluna, "Confiabilidade do saldo"]}
      linhas={itens.map((m, i) => [String(i + 1), m.n, m.uf, valor(m.v), CONFIABILIDADE[m.sel] ?? m.sel])}
      casas={[null, null, null, coluna.includes("R$") ? 1 : 0, null]}
      links={{ Município: itens.map((m) => `${ROTA_MORADIA}?municipio=${m.c}#municipios`) }}
      limite={itens.length}
      recolhida={false}
      nota={`Estimado. ${textoDaGold(aviso)} O nome abre o perfil do município.`}
    />
  );
}

/**
 * Painel "Crédito imobiliário e moradia" (Observatório das Famílias, coleção Moradia), com conta. Reescrita, no molde de painel, da
 * vista da aplicação do Crédito (/observatorio/housing-credit, renderMoradia em public/obs/app.js): a mesma gold
 * (public/obs/data/gold/moradia.json) e os mesmos valores. As seis seções da vista antiga viram figuras e capítulos na mesma ordem; o
 * arquivo por município (moradia_mun.json) só é pedido pelo navegador, na consulta por município; o simulador Price e SAC é
 * preservado e identificado como cálculo, não previsão.
 */
export default function CreditoImobiliarioPage() {
  const d = dadosMoradia();
  const cabecalho = (
    <header>
      <MarcaVisita secao="familias:credito-imobiliario" />
      <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_MORADIA} fontes={["credito"]} />
      <NavegacaoColecao colecao="moradia" />
    </header>
  );
  if ("indisponivel" in d) {
    return (
      <>
        {cabecalho}
        <main id="conteudo" tabIndex={-1} className="ed-pagina pb-6">
          <h1 className="t-h1 mt-6 max-w-4xl text-carvao">{PERGUNTA_MORADIA}</h1>
          <p className="t-corpo mt-4 max-w-prose2 text-carvao" data-ausencia="">
            Painel indisponível nesta publicação. {textoDaGold(d.indisponivel)} Nenhum número é mostrado no lugar.
          </p>
        </main>
      </>
    );
  }

  const C = d.censo;
  const B = d.brasil;
  // achados e frase da concentração na forma de exibição: percentual publicado no lugar da fração errada da gold, sem juízo de valor
  const achados = achadosExibidos(d);
  const concentracao = leituraDaConcentracao(d);
  const cat = (k: string) => C.categorias.find((c) => c.k === k);
  const pagando = cat("proprio_pagando");
  const alugado = cat("alugado");
  const quitado = cat("proprio_pago");
  const somaCategorias = C.categorias.reduce((a, c) => a + c.n, 0);
  const somas = somasPorUf(d);
  const bEstban = base(d.datas.estban);
  const bMi = base(d.datas.mi_credito);
  const bImoveis = base(d.datas.mi_imoveis);
  const bScr = base(d.datas.scr);
  const fonteCenso = `IBGE, Censo ${C.ano}`;
  const fonteMi = "Banco Central, Informações do Mercado Imobiliário";
  const fonteEstban = "Banco Central, ESTBAN (verbete 169)";
  const carteira = B.series.carteira;
  const ultimaCarteira = carteira[carteira.length - 1];
  const mp = d.modelos.penetracao;
  const ms = d.modelos.saldo;
  const sim = d.simulador;
  const valorFinanciado = Math.round((sim.partida.valor_imovel * sim.partida.ltv_pct) / 100);
  const seriesCarteira = [
    { id: "sfh", rotulo: "SFH (poupança)", sigla: "SFH" },
    { id: "fgts", rotulo: "FGTS", sigla: "FGTS" },
    { id: "livre", rotulo: "Taxas de mercado", sigla: "Mercado" },
    { id: "home_equity", rotulo: "Home equity", sigla: "Home equity" },
  ];
  const limitesMi = ["Granularidade máxima é a unidade da federação; não existe versão municipal.", "Prestação média é do estoque de contratos ativos, não de um contrato novo."];

  return (
    <>
      {cabecalho}
      <PaginaPainel
        rota={ROTA_MORADIA}
        abertura={{
          grupo: "Moradia",
          acento: "bronze",
          titulo: PERGUNTA_MORADIA,
          lead: "Como o país mora, quanto crédito imobiliário existe e onde ele não chega. O Censo e as três bases do Banco Central medem coisas diferentes e ficam separadas em toda a página.",
          recorte: {
            periodo: `Censo ${C.ano}; crédito de ${bEstban} a ${bScr}`,
            universo: `Brasil, ${d.estados.length} UFs e 5.570 municípios`,
            unidade: "domicílios, R$ e %",
            fonte: `${fonteCenso}; Banco Central, ESTBAN, Informações do Mercado Imobiliário e SCR`,
          },
          limite:
            "que domicílio ainda sendo pago é contrato bancário, que o verbete 169 é crédito habitacional residencial ou que a lacuna estimada é demanda comprovada. Nenhum comprometimento de renda observado é publicado aqui.",
          fontesDatasSiglas: (
            <>
              <p>
                {textoDaGold(C.tabela)} ESTBAN, data-base {bEstban}. Informações do Mercado Imobiliário: seção de crédito, data-base {dataBr(d.datas.mi_credito)}; seção
                Imóveis, {dataBr(d.datas.mi_imoveis)}. SCR: {bScr}. Publicação processada em {dataBr(d.geradoEm)}.
              </p>
              <p>
                ESTBAN: Estatística Bancária Mensal por município. SCR: Sistema de Informações de Crédito do Banco Central. SFH: Sistema Financeiro da Habitação, que usa recursos da
                poupança. FGTS: Fundo de Garantia do Tempo de Serviço. LTV: parte do valor do imóvel coberta pelo financiamento. COSIF: plano de contas das instituições
                financeiras. LIG: Letra Imobiliária Garantida. UF: unidade da federação.
              </p>
            </>
          ),
        }}
        rotuloNumeros="Moradia e crédito imobiliário no Brasil"
        numeros={[
          numero({ rotulo: "Domicílios ocupados", unidade: "milhões de domicílios", periodo: String(C.ano), recorte: "Brasil", fonte: fonteCenso, natureza: "OBSERVADO" }, C.total, (v) => num(v / 1e6, 2)),
          numero(
            { rotulo: "Domicílios próprios ainda sendo pagos", unidade: "% dos domicílios", periodo: String(C.ano), recorte: "Brasil", fonte: fonteCenso, natureza: "OBSERVADO", tamanho: "m", nota: pagando ? `${num(pagando.n / 1e6, 2)} milhões de domicílios. Não são contratos bancários.` : undefined },
            pagando?.pct,
            (v) => num(v, 1),
          ),
          numero(
            { rotulo: "Domicílios alugados", unidade: "% dos domicílios", periodo: String(C.ano), recorte: "Brasil", fonte: fonteCenso, natureza: "OBSERVADO", tamanho: "m", nota: alugado ? `${num(alugado.n / 1e6, 1)} milhões de domicílios.` : undefined },
            alugado?.pct,
            (v) => num(v, 1),
          ),
          numero(
            { rotulo: "Saldo imobiliário contabilizado nas agências", unidade: "saldo do verbete 169", periodo: bEstban, recorte: "Brasil", fonte: fonteEstban, natureza: "OBSERVADO", tamanho: "m", nota: "Inclui imóvel não residencial, pessoa jurídica e infraestrutura." },
            d.totais.estban169,
            (v) => dinheiro(v),
          ),
        ]}
        notaNumeros={
          <>
            Nas contratações de {bMi} pelo SFH, a taxa média foi de {pc(B.taxa.sfh, 2)} ao ano e o financiamento cobriu {pc(B.ltv.sfh, 1)} do valor do imóvel ({fonteMi}, observado). O Censo é
            de {C.ano} e o crédito é das datas correntes: a comparação entre os dois é de estrutura, não de período.
          </>
        }
        navegacaoLocal={
          <div className="mt-6 space-y-6">
            <section aria-labelledby="achados-t" data-achados="">
              <h2 id="achados-t" className="rotulo text-mineral">
                O que os dados mostram
              </h2>
              <ul className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2">
                {achados.map((a) => (
                  <li key={a.t} className="border-l border-linha pl-4">
                    <p className="t-corpo font-medium text-carvao">{textoDaGold(a.t)}</p>
                    <p className="t-meta mt-1 text-carvao-muted">
                      {textoDaGold(a.d)} <span className="text-mineral">Natureza: {ROTULO_SELO[a.selo]}.</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <nav aria-label="Seções desta página" className="flex flex-wrap gap-x-6">
              {[
                ["#como-mora", "Como o Brasil mora"],
                ["#municipios", "Por município"],
                ["#onde-esta", "Onde está o crédito"],
                ["#quem-financia", "Quem financia"],
                ["#peso", "Peso no orçamento"],
                ["#simulador", "Simulador"],
                ["#potencial", "Potencial de expansão"],
              ].map(([href, rotulo]) => (
                <a key={href} href={href} className={acao}>
                  {rotulo}
                </a>
              ))}
            </nav>
          </div>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="como-mora"
              pergunta="Como o Brasil mora?"
              subtitulo={`Domicílios por condição de ocupação · % dos ${n0(C.total)} domicílios particulares permanentes ocupados · Brasil, Censo ${C.ano}`}
              natureza="OBSERVADO"
              proveniencia={provMoradia(d, "censo", {
                indicador: "Domicílios particulares permanentes ocupados por condição de ocupação",
                natureza: "OBSERVADO",
                unidade: "domicílios e %",
                inicio: String(C.ano),
                fim: String(C.ano),
                limitacoes: [textoDaGold(C.arredondamento), "Domicílio ainda sendo pago não é contrato bancário."],
              })}
              extraFonte={
                <>
                  {textoDaGold(C.tabela)} A soma das categorias ({n0(somaCategorias)}) difere do total em {n0(Math.abs(C.total - somaCategorias))} domicílios. {textoDaGold(C.arredondamento)}
                </>
              }
              leitura={
                <LeituraGuiada>
                  O Censo pergunta a cada domicílio se ele é próprio, alugado ou cedido e, quando próprio, se ainda está sendo pago. É a única medida de moradia que existe para os 5.570
                  municípios. {pc(quitado?.pct)} dos domicílios são próprios e já pagos, herdados ou ganhos, e {pc(pagando?.pct)} seguem sendo pagos.
                </LeituraGuiada>
              }
              ressalva={
                <>
                  Domicílio ainda sendo pago não é contrato bancário. A pergunta do Censo é sobre a situação do morador, não sobre o credor. A resposta abrange consórcio, financiamento
                  feito direto com construtora ou incorporadora, programas habitacionais, compra parcelada entre particulares e qualquer outra forma de pagamento em curso. O Censo não
                  pergunta quem financiou, quanto falta nem quanto se paga por mês.
                </>
              }
              naoConcluir="quantas famílias têm financiamento em banco nem quanto a moradia pesa no orçamento: o Censo conta a condição declarada pelo morador e não coletou valor de aluguel nem de prestação."
              tabela={{
                titulo: `Domicílios por condição de ocupação, Brasil, Censo ${C.ano}`,
                colunas: ["Condição de ocupação", "Domicílios", "Parte do total, %"],
                linhas: C.categorias.map((c) => [c.rot, c.n, c.pct]),
                casas: [null, 0, 2],
                limite: C.categorias.length,
              }}
              complemento={
                <div data-nao-coletado="">
                  <h3 className="t-h3 text-carvao">O que o Censo {C.ano} não coletou</h3>
                  <ul className="t-corpo mt-2 list-disc space-y-1 pl-5 text-carvao">
                    {C.nao_coletado.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  <p className={`${meta} mt-2`}>Natureza: indisponível. {textoDaGold(C.verificacao_ausencia)}</p>
                  <p className={`${meta} mt-2`}>
                    Por isso esta página não publica comprometimento de renda observado com moradia. A prestação que aparece em{" "}
                    <a href="#peso" className={link}>
                      Peso no orçamento
                    </a>{" "}
                    é média do estoque por unidade da federação, vinda do Banco Central, e a do{" "}
                    <a href="#simulador" className={link}>
                      simulador
                    </a>{" "}
                    é um cálculo feito com os valores de quem usa a página.
                  </p>
                </div>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Domicílios por condição de ocupação, Brasil, Censo ${C.ano}`}
                dados={C.categorias.map((c) => ({ id: c.k, nome: c.rot, pct: c.pct }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[{ id: "pct", rotulo: "Parte dos domicílios", cor: "var(--serie-1)" }]}
                unidade="%"
                casas={1}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            <Recolhido id="municipios" aberto nivelTitulo={2} titulo="Moradia e saldo contabilizado, município a município" resumo="Os 25 maiores municípios em cada medida, por região, e o perfil completo de um município.">
              <div className="space-y-4 pb-8">
                <p className={prosa}>
                  Quatro medidas existem para os 5.570 municípios: a parte dos domicílios ainda sendo pagos e a dos alugados (Censo {C.ano}, observadas), o saldo do verbete 169 por domicílio
                  (ESTBAN de {bEstban} sobre o Censo, calculado) e a lacuna de penetração (estimada).
                </p>
                <Alerta>
                  O saldo municipal mostra onde a agência escritura o crédito, não onde mora quem o tomou. {n0(d.totais.municipios_sem_dependencia)} municípios não têm dependência bancária
                  que reporte saldo imobiliário: neles o valor é ausência, não zero.
                </Alerta>
                <Suspense fallback={<p className={meta}>A consulta por município é carregada pelo navegador.</p>}>
                  <ConsultaMunicipal arquivo={ARQUIVO_MUNICIPIOS} nomesInstituicoes={d.nomesInstituicoes} censoAno={C.ano} baseEstban={bEstban} />
                </Suspense>
              </div>
            </Recolhido>

            <Recolhido id="onde-esta" aberto nivelTitulo={2} titulo="Onde está o crédito imobiliário" resumo="Três medidas do mesmo fenômeno, com geografias e conceitos diferentes, lado a lado.">
              <div className="space-y-5 pb-8">
                <p className={prosa}>
                  Não existe uma medida única de crédito imobiliário no Brasil. Existem três, com geografias e conceitos diferentes, e forçá-las à igualdade produziria um número falso. A
                  tabela mostra as três lado a lado, com o que cada uma abrange.
                </p>
                <TabelaDados
                  titulo="Três medidas de crédito imobiliário: comparação de conceito, não de qualidade"
                  colunas={["Medida", "Saldo, R$ bilhões", "Geografia", "Data-base", "O que abrange"]}
                  linhas={[
                    ["Verbete 169 do ESTBAN", d.totais.estban169 / 1e9, "município", bEstban, "Saldo contabilizado na dependência bancária. Inclui imóvel não residencial, pessoa jurídica e infraestrutura."],
                    ["Carteira imobiliária de pessoa física", somas.carteiraMi / 1e9, "unidade da federação", bMi, "Residencial e comercial de pessoa física, por origem dos recursos. Não existe em nível municipal."],
                    ["Exposição imobiliária de pessoa física", somas.exposicaoScr / 1e9, "unidade da federação", bScr, `Exposição de crédito dos clientes reportada ao SCR, em ${n0(somas.operacoesScr)} operações.`],
                  ]}
                  casas={[null, 1, null, null, null]}
                  recolhida={false}
                  nota={`Observado. As duas medidas estaduais são somas das ${d.estados.length} UFs e ficam a ${pc(Math.abs((100 * (somas.carteiraMi - somas.exposicaoScr)) / somas.exposicaoScr), 1)} uma da outra. O ESTBAN é maior porque abrange mais coisa, e é isso que a composição do verbete explica. A diferença entre as medidas é informação.`}
                />
                <div data-verbete-169="">
                  <h3 className="t-h3 text-carvao">O que exatamente está dentro do verbete 169</h3>
                  <p className={`${prosa} mt-2`}>
                    O ESTBAN é a única fonte pública do Banco Central com crédito imobiliário por município. Mas o verbete 169 soma quatro rubricas contábeis distintas, e uma delas não é
                    crédito imobiliário.
                  </p>
                  <TabelaDados
                    titulo="Contas do plano contábil somadas no verbete 169 do ESTBAN"
                    colunas={["Conta COSIF", "Título", "Função contábil oficial", "É crédito habitacional residencial?"]}
                    linhas={d.verbete169.contas.map((c) => [c.conta, c.titulo, textoDaGold(c.funcao), c.habitacional === true ? "sim" : c.habitacional === false ? "não" : "não classificado na publicação"])}
                    recolhida={false}
                  />
                  <p className={`${meta} mt-2`}>Não distingue: {d.verbete169.nao_distingue.join("; ")}.</p>
                  <div className="mt-3">
                    <Alerta>{textoDaGold(d.verbete169.alerta)}</Alerta>
                  </div>
                  <p className={`${meta} mt-3`}>
                    {textoDaGold(d.verbete169.fonte)} {textoDaGold(d.verbete169.invercao_cosif)}
                  </p>
                </div>
                <Alerta titulo={`${concentracao.titulo}.`}>
                  {n0(d.concentracao.instituicoes_ate_2_municipios)} das {n0(d.concentracao.instituicoes_total)} instituições com saldo no verbete 169 contabilizam em no máximo dois
                  municípios, somando {dinheiro(d.concentracao.saldo_dessas)} (calculado, ESTBAN de {bEstban}). {textoDaGold(concentracao.complemento)}
                </Alerta>
              </div>
            </Recolhido>

            <FiguraAnalitica
              id="carteira-origem"
              pergunta="De onde vem o dinheiro do crédito imobiliário das famílias?"
              subtitulo={`Carteira imobiliária de pessoa física por origem dos recursos · R$ bilhões · Brasil, ${base(carteira[0].d)} a ${base(ultimaCarteira.d)}`}
              natureza="OBSERVADO"
              proveniencia={provMoradia(d, "mi", {
                indicador: "Carteira de crédito imobiliário de pessoa física por origem dos recursos",
                natureza: "OBSERVADO",
                unidade: "R$ bilhões",
                inicio: carteira[0].d,
                fim: ultimaCarteira.d,
                limitacoes: limitesMi,
              })}
              leitura={
                <LeituraGuiada>
                  Em {base(ultimaCarteira.d)}, a carteira era de R$ {num(ultimaCarteira.fgts ?? 0, 1)} bilhões com recursos do FGTS, R$ {num(ultimaCarteira.sfh ?? 0, 1)} bilhões no SFH, R${" "}
                  {num(ultimaCarteira.livre ?? 0, 1)} bilhões a taxas de mercado e R$ {num(ultimaCarteira.home_equity ?? 0, 1)} bilhões em home equity.
                </LeituraGuiada>
              }
              comoInterpretar="SFH e FGTS são recursos direcionados, com taxa limitada por norma. Home equity usa o imóvel como garantia, mas não financia a compra dele."
              naoConcluir="quanto crédito chega a cada município nem a cada família: a carteira por origem dos recursos só existe para o país e por unidade da federação, e saldo não é número de contratos."
              tabela={{
                titulo: "Carteira imobiliária de pessoa física por origem dos recursos, R$ bilhões",
                colunas: ["Mês", ...seriesCarteira.map((s) => `${s.rotulo}, R$ bilhões`)],
                linhas: carteira.map((p) => [base(p.d), ...seriesCarteira.map((s) => p[s.id] ?? null)]),
                casas: [null, 2, 2, 2, 2],
                limite: carteira.length,
              }}
              complemento={
                <div data-direcionamento="">
                  <h3 className="t-h3 text-carvao">Para que serve o dinheiro da poupança aplicado em habitação</h3>
                  <div className="mt-3 grid gap-x-8 gap-y-6 sm:grid-cols-3">
                    {(
                      [
                        ["Aquisição", B.direcionamento.aquisicao],
                        ["Construção", B.direcionamento.construcao],
                        ["Reforma e ampliação", B.direcionamento.reforma_ampliacao],
                      ] as const
                    ).map(([rotulo, v]) => (
                      <NumeroIndicador
                        key={rotulo}
                        {...numero({ rotulo, unidade: "recursos da poupança em habitação residencial", periodo: bMi, recorte: "Brasil", fonte: fonteMi, natureza: "OBSERVADO", tamanho: "p" }, v, (x) => dinheiro(x))}
                        idioma="pt"
                      />
                    ))}
                  </div>
                  <p className={`${prosa} mt-4`}>
                    No direcionamento da poupança, os recursos aplicados em aquisição superam os de construção e os de reforma e ampliação. Isso é o desenho do sistema, não uma falha do
                    dado, e ajuda a entender por que a lacuna estimada em{" "}
                    <a href="#potencial" className={link}>
                      Potencial de expansão
                    </a>{" "}
                    não se traduz automaticamente em demanda que um banco atenderia.
                  </p>
                </div>
              }
            >
              <GraficoLinhas
                semTabela
                titulo="Carteira imobiliária de pessoa física por origem dos recursos"
                dados={carteira.map((p) => ({ mes: p.d.slice(0, 7), sfh: p.sfh ?? null, fgts: p.fgts ?? null, livre: p.livre ?? null, home_equity: p.home_equity ?? null }))}
                chaveX="mes"
                formatoX="mes"
                series={seriesCarteira.map((s, i) => ({ ...s, cor: `var(--serie-${i + 1})` }))}
                unidade="R$ bilhões"
                casas={1}
                zeroNoEixo
                zoom
              />
            </FiguraAnalitica>

            <Recolhido id="quem-financia" aberto nivelTitulo={2} titulo="Quem financia" resumo={`As ${d.totais.instituicoes_no_169} instituições com saldo no verbete 169, em ${bEstban}: saldo, participação e número de municípios.`}>
              <div className="space-y-4 pb-8">
                <p className={prosa}>
                  Onde uma instituição escritura o saldo e onde ela atende pessoas são coisas diferentes. A tabela mostra as duas informações juntas para que a distância entre elas fique
                  visível: um banco pode responder por uma parte grande do saldo nacional e aparecer em dois municípios.
                </p>
                <TabelaDados
                  titulo={`Instituições com saldo no verbete 169 do ESTBAN, ${bEstban}`}
                  colunas={["Instituição", "Saldo, R$ milhões", "Participação no saldo nacional, %", "Municípios em que contabiliza", "Quociente locacional mediano"]}
                  linhas={d.instituicoes.map((i) => [i.nome, i.saldo / 1e6, i.part_nacional, i.municipios, i.ql_mediano ?? null])}
                  casas={[null, 1, 2, 0, 2]}
                  ausencia={{ "Quociente locacional mediano": "não aplicável" }}
                  idiomaTexto={["nome", null, null, null, null]}
                  limite={d.instituicoes.length}
                  recolhida={false}
                  fixarPrimeiraColuna
                  nota="Calculado. Participação é do saldo contabilizado, não de clientes: o ESTBAN não publica clientes. O quociente locacional compara a presença da instituição no município com a presença dela no país; 1 significa proporcional. É publicado apenas para instituições em ao menos 25 municípios, porque abaixo disso o quociente é alto por aritmética, não por concentração real. Ordem decrescente de saldo."
                />
                <p className={meta}>
                  A instituição com maior participação no saldo de cada município está no perfil do município, em{" "}
                  <a href="#municipios" className={link}>
                    Por município
                  </a>
                  .
                </p>
              </div>
            </Recolhido>

            <Recolhido id="peso" aberto nivelTitulo={2} titulo="Quanto a moradia pesa no orçamento" resumo={`Taxa, parte financiada, prestação média e atraso por origem dos recursos e por UF, observados em ${bMi}.`}>
              <div className="space-y-5 pb-8">
                <p className={prosa}>
                  Esta é a parte em que a fonte muda de geografia. Taxa, parte financiada do imóvel (LTV), prestação média e valor do imóvel existem por unidade da federação, não por
                  município, e são publicados aqui exatamente nessa granularidade. Nenhum desses números é desagregado para o nível municipal.
                </p>
                <TabelaDados
                  titulo={`Crédito imobiliário de pessoa física por origem dos recursos, Brasil, ${bMi}`}
                  colunas={["Segmento", "Carteira, R$ bilhões", "Taxa, % ao ano", "Parte financiada do imóvel (LTV), %", "Prestação média, R$", "Inadimplência, %"]}
                  linhas={SEGMENTOS.map(([k, rot]) => [rot, typeof B.carteira_pf[k] === "number" ? (B.carteira_pf[k] as number) / 1e9 : null, B.taxa[k], B.ltv[k], B.parcela[k], B.inad[k]])}
                  casas={[null, 1, 2, 1, 0, 2]}
                  recolhida={false}
                  fixarPrimeiraColuna
                  nota={`Observado. Fonte: ${fonteMi}, ${bMi}. Prestação média é do estoque de contratos ativos, com prazos e datas de contratação distintos: não é a prestação de um contrato novo e não se aplica aos domicílios que o Censo registra como ainda sendo pagos. LTV e taxa referem-se às contratações do mês.`}
                />
                <div>
                  <h3 className="t-h3 text-carvao">Taxa, prestação e valor do imóvel por unidade da federação</h3>
                  <TabelaDados
                    titulo="Taxa, prestação e valor do imóvel por unidade da federação"
                    colunas={["UF", "Domicílios ainda sendo pagos, %", "Taxa do SFH, % ao ano", "Parte financiada (LTV), %", "Prestação média do SFH, R$", "Valor de compra, R$", "Área privativa, m²", "Inadimplência do SFH, %"]}
                    linhas={d.estados.map((e) => [e.nome, e.pgp, e.taxa_sfh, e.ltv_sfh, e.parcela_sfh, e.valor_compra, e.area_privativa, e.inad_sfh])}
                    casas={[null, 1, 2, 1, 0, 0, 1, 2]}
                    limite={d.estados.length}
                    fixarPrimeiraColuna
                    nota={`Observado. Domicílios ainda sendo pagos: ${fonteCenso}. Taxa, LTV, prestação e inadimplência: ${fonteMi}, seção de crédito, ${bMi}. Valor de compra e área são da seção Imóveis, com data-base ${bImoveis}, mais defasada que a de crédito. As duas datas nunca são apresentadas como se fossem do mesmo mês.`}
                  />
                </div>
              </div>
            </Recolhido>

            <Recolhido id="simulador" aberto nivelTitulo={2} titulo="Simulador de prestação: cálculo, não previsão" resumo="Primeira e última prestação pela tabela Price e pelo sistema SAC, com os valores que você informar.">
              <div className="pb-8">
                <ModeloDidatico
                  id="simulador-prestacao"
                  titulo="Quanto seria a prestação?"
                  fundo="papel"
                  largo
                  descricao={
                    <>
                      Os valores de partida vêm de médias observadas pelo Banco Central em {bMi}: {pc(sim.partida.ltv_pct, 2)} de um imóvel de {dinheiro(sim.partida.valor_imovel)}, à taxa de{" "}
                      {pc(sim.partida.taxa_aa_pct, 2)} ao ano, em {n0(sim.partida.prazo_meses)} meses. A renda de partida, de R$ {num(RENDA_DE_EXEMPLO, 0)}, é só um exemplo. Tudo o mais é
                      escolha de quem usa a página. O resultado é aritmética da tabela Price e do sistema SAC: um cálculo, não uma previsão nem uma proposta de crédito.
                    </>
                  }
                  deixaDeFora={sim.avisos.map((a) => textoDaGold(a)) as unknown as ListaDeFora}
                >
                  <SimuladorPrestacao
                    partida={{ valorFinanciado, taxa: sim.partida.taxa_aa_pct, prazo: sim.partida.prazo_meses, renda: RENDA_DE_EXEMPLO }}
                    estados={d.estados.map((e) => ({ uf: e.uf, nome: e.nome, parcela: e.parcela_sfh }))}
                    mesReferencia={bMi}
                  />
                </ModeloDidatico>
              </div>
            </Recolhido>

            <Recolhido id="potencial" aberto nivelTitulo={2} titulo="Onde existe potencial de expansão" resumo="Duas lacunas estimadas por dois métodos, com os 25 municípios de maior lacuna em cada um.">
              <div className="space-y-6 pb-8">
                <Alerta titulo="Lacuna não é demanda comprovada.">
                  Os dois modelos comparam um município com municípios parecidos e mostram a diferença. Essa diferença pode refletir preferência por aluguel, herança, autoconstrução,
                  informalidade fundiária, um parque domiciliar mais antigo ou crédito tomado fora do município. Nada disso é observável nas bases usadas aqui.
                </Alerta>
                <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
                  <div>
                    <NumeroIndicador
                      {...numero({ rotulo: "Lacuna de penetração habitacional", unidade: "domicílios", periodo: `Censo ${C.ano}`, recorte: `${n0(mp.municipios_abaixo)} municípios abaixo da mediana do seu grupo`, fonte: `estimativa desta publicação sobre o ${fonteCenso}`, natureza: "ESTIMADO", tamanho: "m" }, mp.lacuna_domicilios, (v) => n0(v))}
                      idioma="pt"
                    />
                    <p className={`${meta} mt-3`}>
                      Diferença entre a proporção de domicílios ainda sendo pagos e a mediana dessa proporção em municípios comparáveis, somada sobre os municípios abaixo da mediana do
                      seu grupo.
                    </p>
                    <dl className="t-meta mt-3 space-y-2 text-carvao-muted">
                      <div>
                        <dt className="font-medium text-carvao">Agrupamento</dt>
                        <dd>{textoDaGold(mp.criterio)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-carvao">Grupos</dt>
                        <dd>
                          {n0(mp.grupos)}, cobrindo {n0(mp.municipios_cobertos)} municípios
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-carvao">Referência</dt>
                        <dd>{textoDaGold(mp.referencia)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <NumeroIndicador
                      {...numero({ rotulo: "Lacuna de saldo", unidade: "soma das lacunas", periodo: bEstban, recorte: `${n0(ms.municipios_abaixo)} municípios abaixo da referência`, fonte: `estimativa desta publicação sobre o ESTBAN e o Censo ${C.ano}`, natureza: "ESTIMADO", tamanho: "m" }, ms.lacuna_total, (v) => dinheiro(v))}
                      idioma="pt"
                    />
                    <p className={`${meta} mt-3`}>
                      Diferença entre a mediana condicional estimada e o saldo do verbete 169 efetivamente contabilizado, somada sobre os municípios abaixo da referência.
                    </p>
                    <dl className="t-meta mt-3 space-y-2 text-carvao-muted">
                      <div>
                        <dt className="font-medium text-carvao">Especificação</dt>
                        <dd>{textoDaGold(ms.especificacao)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-carvao">Ajuste</dt>
                        <dd>
                          {n0(ms.n)} municípios na amostra; R² de {num(ms.r2, 3)}; desvio residual de {num(ms.sigma, 3)}, em logaritmo
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-carvao">Referência</dt>
                        <dd>{textoDaGold(ms.referencia)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div>
                  <h3 className="t-h3 text-carvao">Por que a amostra do modelo de saldo é restrita</h3>
                  <p className={`${prosa} mt-2`}>
                    O modelo só considera municípios com duas ou mais instituições contabilizando. Município com uma única instituição no verbete 169 é, quase sempre, o ponto onde um banco
                    centraliza a escrituração de uma carteira nacional, e o saldo ali não descreve mercado local nenhum. Com a restrição, o desvio residual do modelo é de {num(ms.sigma, 2)},
                    em logaritmo.
                  </p>
                  <p className={`${meta} mt-2`}>{textoDaGold(ms.faixa).replace(/(\d)\.(\d)/g, "$1,$2")}</p>
                </div>
                <TabelaLacuna
                  id="lacuna-saldo"
                  titulo="Os 25 municípios com maior lacuna de saldo estimada"
                  lead={`Lacuna de saldo em R$ milhões: mediana condicional estimada menos o saldo contabilizado no verbete 169, ESTBAN de ${bEstban}.`}
                  coluna="Lacuna estimada, R$ milhões"
                  itens={d.rankings.maior_lacuna_saldo}
                  valor={(v) => v / 1e6}
                  aviso={ms.aviso}
                />
                <TabelaLacuna
                  id="lacuna-domicilios"
                  titulo="Os 25 municípios com maior lacuna de penetração estimada"
                  lead={`Lacuna em domicílios: quantos domicílios ainda sendo pagos faltam para a mediana do grupo de municípios comparáveis, Censo ${C.ano}.`}
                  coluna="Lacuna estimada, domicílios"
                  itens={d.rankings.maior_lacuna_domicilios}
                  valor={(v) => v}
                  aviso={mp.aviso}
                />
              </div>
            </Recolhido>
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Domicílio ainda sendo pago", definicao: "Domicílio próprio cujo morador declarou ao Censo que o imóvel ainda está sendo pago, a qualquer credor. Não é o mesmo que contrato de financiamento em banco." },
            { termo: "Verbete 169 do ESTBAN", definicao: "Saldo de financiamentos imobiliários que cada agência bancária registra, somado por município. Mistura residencial, não residencial, pessoa jurídica e infraestrutura." },
            { termo: "SFH e FGTS", definicao: "As duas origens de recursos direcionados: a poupança (Sistema Financeiro da Habitação) e o Fundo de Garantia. Têm taxa limitada por norma." },
            { termo: "LTV", definicao: "Parte do valor de avaliação do imóvel coberta pelo financiamento, nas contratações do mês.", exemplo: `${pc(B.ltv.sfh, 1)} no SFH em ${bMi}.` },
            { termo: "Home equity", definicao: "Empréstimo que usa um imóvel como garantia, mas não financia a compra dele." },
            { termo: "Lacuna estimada", definicao: "Diferença entre o município e municípios parecidos, calculada por modelo. É estimativa, não dado observado, e não prova que existe demanda." },
          ],
          nota: "Para ler: trate as três bases como medidas distintas. O Censo conta domicílios, o ESTBAN registra saldo contabilizado por município e o Mercado Imobiliário detalha o crédito residencial por estado. Nenhuma se converte na outra. A página põe moradia e crédito lado a lado para mostrar a distância entre morar e financiar.",
        }}
        metodo={
          <>
            <p>
              Antes de publicar qualquer número, cada pergunta que a página poderia responder foi testada contra as fontes. A tabela é o resultado desse teste, e as linhas marcadas
              como indisponíveis não foram preenchidas por aproximação.
            </p>
            <TabelaDados
              titulo="Auditoria de viabilidade: o que as fontes públicas permitem responder"
              colunas={["Pergunta", "Situação", "Fonte", "Observação"]}
              linhas={d.matriz.map((m) => [m.pergunta, SITUACAO[m.status] ?? m.status, textoDaGold(m.fonte) || null, textoDaGold(m.obs)])}
              ausencia={{ Fonte: "nenhuma fonte pública" }}
              limite={d.matriz.length}
              recolhida={false}
            />
            <div data-dicionario="">
              <p className="font-medium text-carvao">Dicionário de indicadores ({d.dicionario.length})</p>
              <dl className="mt-2 space-y-4">
                {d.dicionario.map((x) => (
                  <div key={x.t}>
                    <dt className="font-medium text-carvao">
                      {textoDaGold(x.t)} <span className="font-normal text-mineral">({x.selo === "indisponivel" ? "indisponível" : NATUREZA_DO_SELO[x.selo].toLowerCase().replace("cenario", "cenário")})</span>
                    </dt>
                    <dd className="mt-1">
                      Definição: {textoDaGold(x.d)} Fonte: {textoDaGold(x.f)} Limite: {textoDaGold(x.l)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div data-limitacoes="">
              <p className="font-medium text-carvao">O que esta página não autoriza concluir</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {d.limitacoes.map((l) => (
                  <li key={l}>{textoDaGold(l).replace(/^(\d)(\d{3}) municípios/, "$1.$2 municípios")}</li>
                ))}
              </ul>
            </div>
            <div data-formulas-simulador="">
              <p className="font-medium text-carvao">Fórmulas do simulador</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Taxa ao mês: (1 + taxa ao ano ÷ 100) elevado a 1/12, menos 1.</li>
                <li>Price: prestação = valor financiado × taxa ao mês ÷ [1 − (1 + taxa ao mês) elevado a menos o prazo], constante ao longo do contrato.</li>
                <li>SAC: amortização = valor financiado ÷ prazo; cada prestação é a amortização mais a taxa ao mês sobre o saldo devedor do mês anterior, decrescente.</li>
                <li>Peso na renda: primeira prestação ÷ renda mensal informada.</li>
              </ul>
            </div>
            <p>
              A Scrutiniums não recalcula os valores desta página: são os da publicação do Observatório de Crédito, processada em {dataBr(d.geradoEm)}. As únicas contas feitas aqui são
              as três somas das {d.estados.length} UFs na comparação das medidas e a aritmética do simulador. O déficit habitacional, o aluguel e a inadequação das moradias estão em{" "}
              <Link href="/eficiencia-estatal/habitacao" prefetch={false} className={link}>
                Habitação
              </Link>
              , na mesma coleção. Método do Observatório de Crédito em{" "}
              <Link href="/observatorio-do-credito/metodologia" prefetch={false} className={link}>
                Metodologia e fontes do Crédito
              </Link>
              .
            </p>
          </>
        }
      />
    </>
  );
}
