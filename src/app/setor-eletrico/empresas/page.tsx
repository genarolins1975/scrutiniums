import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasBusca } from "@/components/energia/EmpresasBusca";
import {
  EmpresasCapitulos,
  EmpresasDatas,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasPassosVinculo,
  EmpresasRecorte,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  ancoraPainel,
  dataTexto,
  emMilhoes,
  entidadesBuscaEmpresas,
  inteiro,
  mwTexto,
  nomeOuCnpj,
  padraoFinancas,
  painel,
  passosVinculo,
  pctTexto,
  referenciaPerdasNacional,
  respostaCadastro,
  respostaControle,
  respostaDistribuidoras,
  respostaFinancas,
  rotaEntidade,
  rotaPainel,
  textoFronteiraNoCadastro,
  trimestreTexto,
  vereditoCadastro,
  vereditoControle,
  vereditoDistribuidoras,
  vereditoFinancas,
} from "@/lib/energia/empresas";
import { evidenciasReceita } from "@/lib/energia/empresas-arquivos";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { comValorExibido, type Evidencia } from "@/lib/energia/evidencia";
import { SIGLAS } from "@/lib/energia/siglas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Empresas do setor elétrico: ativos, distribuidoras, finanças e controle",
  description:
    "Quem opera as usinas e as linhas de transmissão (SIGA e SIGET, pelo CNPJ publicado), o perfil de cada distribuidora (perdas, continuidade e tarifa pelo mesmo CNPJ dos módulos de origem), as demonstrações das companhias abertas na CVM e quem controla quanto da capacidade instalada, com HHI sobre fronteira explícita.",
  alternates: { canonical: "/setor-eletrico/empresas" },
};

/** As medidas que parecem somáveis e não são: definições que acompanham os números, depois da informação, em Entender. */
const MEDIDAS = [
  ["Capacidade proporcional", "A potência de cada usina repartida pela participação de cada dono. As parcelas somam a potência da usina, sem dupla contagem."],
  ["Capacidade sob controle", "A usina inteira para quem tem mais de 50% dela. Mede comando, não propriedade; não se soma à proporcional."],
  ["Consolidado e individual", "O consolidado inclui as controladas; o individual, só a companhia. São séries separadas, e nada se soma entre companhias."],
  ["Potência e energia", "MW é capacidade instalada (potência); o que as usinas geram é energia, em MWh, e está na página de Geração."],
] as const;

/**
 * Abertura de Empresas: a entrada para ativos, perfil da distribuidora, finanças e controle, unificados pelo CNPJ que a fonte oficial
 * publica. Na primeira tela, as medidas do cadastro de usinas com data e fonte e a busca por empresa (que leva à ficha útil); logo
 * depois, os quatro caminhos, cada um com a resposta curta, um número com a ficha de prova e o limite da leitura; só então os quatro
 * elos entre empresa, participação, ativo e controle, o recorte e as medidas que não se somam. A página não repete os gráficos dos painéis.
 */
export default function EmpresasPage() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const a = c.ativos;
  const t = c.transmissao;
  const d = g.distribuidoras;
  const f = g.financas;
  const ct = g.controle;
  const datas = g.datas;
  const prov = g.proveniencia;
  const dataSiga = dataTexto(a.data);
  const janela = datas.polimero_janela.length ? `${trimestreTexto(datas.polimero_janela[0])} a ${trimestreTexto(datas.polimero_janela.at(-1))}` : "sem janela";
  const inicioJanela = datas.polimero_janela.length ? trimestreTexto(datas.polimero_janela[0]) : "sem janela";

  const evTaxaNacional = lerGold<{ evidencias?: { taxa_nacional?: Evidencia } }>("perdas.json")?.evidencias?.taxa_nacional ?? null;
  const anoPerdas = d.indice.find((x) => x.perdas?.ano)?.perdas?.ano ?? null;
  const anoQualidade = d.indice.find((x) => x.qualidade?.ano)?.qualidade?.ano ?? null;
  const refPerdas = referenciaPerdasNacional(evTaxaNacional, anoPerdas);
  // a taxa nacional aparece com duas casas, como as perdas de cada distribuidora e a legenda do gráfico do comparador
  const evTaxaNacional2 = evTaxaNacional ? comValorExibido(evTaxaNacional, pctTexto(evTaxaNacional.valor_calculo, 2)) : null;
  const padraoFin = padraoFinancas(f.companhias);
  const compPadrao = f.companhias.find((x) => x.cnpj === padraoFin[0]) ?? null;
  const evReceita = padraoFin.length ? (evidenciasReceita(g.series.evidencias, padraoFin)[padraoFin[0]] ?? null) : null;
  const grupo = ct.concentracao.grupo_proporcional;
  const exemplos = d.indice
    .filter((x) => x.ativa && x.qualidade?.ucs)
    .slice()
    .sort((x, y) => (y.qualidade!.ucs as number) - (x.qualidade!.ucs as number))
    .slice(0, 4)
    .map((x) => ({ rotulo: x.sigla, href: rotaEntidade(x.slug) }));
  const entidades = entidadesBuscaEmpresas(g);
  const semMmgd = prov.ativos.limitacoes.find((x) => /micro e minigera/i.test(x)) ?? "Micro e minigeração distribuída não está no SIGA e fica fora das medidas de capacidade.";

  const oQueMudou = (
    <>
      O SIGA e o SIGET são lidos todo dia; o cadastro de agentes e o conjunto Agentes de Geração, todo mês; as declarações de composição societária, a cada trimestre. Revisões detectadas nos
      dados do SIGA nesta publicação: {inteiro(prov.ativos.revisoes_conhecidas?.total)}. Na CVM, {inteiro(f.revisoes.valores_reapresentados)} valores foram reapresentados no comparativo do ano
      seguinte.
    </>
  );
  const comoInterpretar = (
    <>
      Cada caminho lê uma fonte com a própria data e a própria unidade. O CNPJ liga a empresa ao ativo, ao grupo e às demonstrações; as medidas de caminhos diferentes não se somam, e a
      seção seguinte diz quais são.
    </>
  );
  const naoConcluir = (
    <>
      Capacidade instalada não é energia gerada. O dono direto de uma usina, em geral uma sociedade de propósito específico, não é o controlador econômico. Companhia sem demonstração na CVM não
      tem métrica econômica aqui.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CNPJ", "SIGA", "SIGET", "CVM", "DFP", "ITR"]}
          titulo="Quem atua no setor elétrico?"
          lead={`Donos de usinas e de linhas, distribuidoras, companhias abertas e grupos de controle, ligados pelo CNPJ (${SIGLAS.CNPJ}) publicado pela fonte oficial.`}
          recorte={`Usinas do SIGA (${SIGLAS.SIGA}) de ${dataSiga} · demais fontes com datas próprias`}
          fonte={`ANEEL, ${SIGLAS.ANEEL} (cadastros de geração e de transmissão); CVM, ${SIGLAS.CVM} (demonstrações anuais e trimestrais)`}
          referencia={
            <>
              SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; cadastro de agentes de {dataTexto(datas.cadastro_agentes)}; composição societária declarada à ANEEL de {janela}; CVM com DFP até{" "}
              {f.periodos.ultimo_exercicio ?? "sem dado"} e ITR até {dataTexto(f.periodos.ultimo_trimestre)}; números das distribuidoras copiados das bases publicadas de Perdas, Qualidade e Conta de
              luz. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: "SIGA (usinas)", texto: `até ${dataSiga}`, natureza: "OBSERVADO" },
                ...(t ? [{ rotulo: "SIGET (transmissão)", texto: `até ${dataTexto(t.data)}`, natureza: "OBSERVADO" as const }] : []),
                { rotulo: "Cadastro de agentes", texto: `de ${dataTexto(datas.cadastro_agentes)}`, natureza: "OBSERVADO" },
                { rotulo: "Composição societária", texto: `declarações de ${janela}`, natureza: "OBSERVADO" },
                { rotulo: "Distribuidoras, perdas", texto: `${anoPerdas ?? "sem dado"}, base publicada de Perdas`, natureza: prov.distribuidoras_perdas?.natureza ?? "CALCULADO" },
                { rotulo: "Distribuidoras, continuidade", texto: `${anoQualidade ?? "sem dado"}, base publicada de Qualidade`, natureza: prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO" },
                { rotulo: "Distribuidoras, tarifa", texto: "vigente na data do arquivo de tarifas, base publicada de Conta de luz", natureza: prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO" },
                { rotulo: "CVM, DFP", texto: `até o exercício de ${f.periodos.ultimo_exercicio ?? "sem dado"}`, natureza: "OBSERVADO" },
                { rotulo: "CVM, ITR", texto: `até ${dataTexto(f.periodos.ultimo_trimestre)}`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores do cadastro de usinas"
              nota={
                <>
                  {g.definicoes.vinculo.replace(/^Vínculo provado = /, "Vínculo provado: ")} {semMmgd} Dos {inteiro(a.operacao.usinas)} registros em operação, {inteiro(a.sem_vinculo_total)} ficam sem vínculo
                  completo, todos identificados com o motivo.
                </>
              }
            >
              <Numero variante="faixa" rotulo="Usinas em operação" natureza="CALCULADO" valor={a.operacao.usinas} formato="num" casas={0} unidade="usinas" periodo={`SIGA de ${dataSiga}`} />
              <Numero
                variante="faixa"
                rotulo="Potência fiscalizada"
                natureza="CALCULADO"
                valor={a.operacao.mw_fiscalizado}
                formato="num"
                casas={1}
                unidade="MW"
                periodo={`SIGA de ${dataSiga}`}
                nota="Capacidade instalada, não é energia gerada."
              />
              <Numero
                variante="faixa"
                rotulo="Proprietários identificados"
                natureza="CALCULADO"
                valor={a.proprietarios_cnpj}
                formato="num"
                casas={0}
                unidade="CNPJ"
                periodo={`SIGA de ${dataSiga}, todas as fases`}
                nota="CNPJ distintos; matriz e filial contam separadas."
              />
              <Numero
                variante="faixa"
                rotulo="Potência com donos identificados"
                natureza="CALCULADO"
                evidencia={comValorExibido(a.evidencia, pctTexto(a.evidencia.valor_calculo, 2))}
                formato="pct"
                casas={2}
                unidade="da potência"
                endereco={ancoraPainel("p036")}
              />
            </FaixaMetricas>
          }
        >
          Quatro perguntas sobre quem atua no setor: quem opera as usinas e as linhas, como cada distribuidora atende a sua área, como evoluem os números que as companhias abertas reportam e quem
          controla quanto da capacidade instalada. Toda ligação entre empresa e ativo é o CNPJ publicado pela fonte oficial no mesmo registro; nenhuma é feita por semelhança de nome.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="sintese" />

        <ModoProfundidade>
          <Bloco id="empresas">
            <section id="busca" aria-labelledby="busca-titulo" className="scroll-mt-28 pb-6">
              <h2 id="busca-titulo" className="ed-h2 font-serif text-carvao">
                Qual empresa você procura?
              </h2>
              <div className="mt-2">
                <EmpresasBusca entidades={entidades} hrefArvore={`${rotaPainel("p039")}#arvore`} total={entidades.length} />
              </div>
            </section>

            <EmpresasCapitulos
              itens={[
                {
                  id: "p036",
                  resposta: (
                    <RespostaCurta id="p036" tamanho="sm" veredito={vereditoCadastro(c)}>
                      {respostaCadastro(c)}
                    </RespostaCurta>
                  ),
                  numero: t ? (
                    <Numero
                      variante="faixa"
                      rotulo="Módulos de transmissão ligados ao CNPJ"
                      natureza="CALCULADO"
                      evidencia={comValorExibido(t.evidencia, pctTexto(t.evidencia.valor_calculo, 1))}
                      formato="pct"
                      casas={1}
                      unidade="dos módulos"
                      nota={`${inteiro(t.resumo.modulos_com_cnpj)} de ${inteiro(t.resumo.modulos)} módulos; ${inteiro(t.resumo.cnpjs_com_modulos)} concessionárias com módulos.`}
                      endereco={ancoraPainel("p036")}
                    />
                  ) : (
                    <Numero variante="faixa" rotulo="Módulos de transmissão ligados ao CNPJ" natureza="CALCULADO" valor={null} motivoAusencia="O SIGET não está integrado nesta publicação." />
                  ),
                  contexto: (
                    <>
                      Usinas do SIGA ({SIGLAS.SIGA}) de {dataSiga}, {inteiro(a.usinas)} em todas as fases; linhas do SIGET ({SIGLAS.SIGET}) de {dataTexto(t?.data)}. Potência fiscalizada em operação, em MW.
                    </>
                  ),
                  limite: "a energia que as usinas geram, nem quem controla economicamente: capacidade instalada não é geração, e o dono direto não é o controlador (essa pergunta está na página de controle).",
                },
                {
                  id: "p037",
                  resposta: (
                    <RespostaCurta id="p037" tamanho="sm" veredito={vereditoDistribuidoras(d, refPerdas?.valor ?? null, anoPerdas)}>
                      {respostaDistribuidoras(d)}
                    </RespostaCurta>
                  ),
                  numero:
                    evTaxaNacional2 && refPerdas ? (
                      <Numero
                        variante="faixa"
                        rotulo="Referência: perdas totais na distribuição, Brasil"
                        natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                        evidencia={evTaxaNacional2}
                        formato="pct"
                        casas={2}
                        nota={`Taxa das concessionárias em conjunto (perdas somadas sobre energia injetada somada, não a média das taxas): ${evTaxaNacional2.universo}. Número do módulo Perdas, a referência das barras de perdas no comparador.`}
                        endereco={ancoraPainel("p037")}
                      />
                    ) : (
                      <Numero
                        variante="faixa"
                        rotulo="Referência: perdas totais na distribuição, Brasil"
                        natureza="CALCULADO"
                        valor={null}
                        motivoAusencia="A base publicada de Perdas não publica a taxa nacional do mesmo ano das perdas por distribuidora."
                      />
                    ),
                  contexto: (
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribuidoras pelo CNPJ; perdas de {anoPerdas ?? "sem dado"} (balanço do SAMP, {SIGLAS.SAMP}) e continuidade de {anoQualidade ?? "sem dado"}, o ano de
                      referência de cada módulo de origem, e tarifa vigente na data do arquivo de tarifas.
                    </>
                  ),
                  limite: "eficiência ou culpa da distribuidora: perdas, interrupções e tarifa dependem da área atendida, e anos de referência diferentes não se comparam.",
                  extra:
                    exemplos.length > 0 ? (
                      <div className="text-sm text-carvao-muted">
                        <p>Fichas das distribuidoras com mais unidades consumidoras; as demais estão no índice da página.</p>
                        <ul className="flex flex-wrap gap-x-5">
                          {exemplos.map((x) => (
                            <li key={x.href}>
                              <Link href={x.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                                {x.rotulo}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : undefined,
                },
                {
                  id: "p038",
                  resposta: (
                    <RespostaCurta id="p038" tamanho="sm" veredito={vereditoFinancas(f)}>
                      {respostaFinancas(f)}
                    </RespostaCurta>
                  ),
                  numero: compPadrao ? (
                    <Numero
                      variante="faixa"
                      rotulo={`Receita ${compPadrao.ultimo_exercicio ?? ""}: ${nomeOuCnpj(compPadrao.nome, compPadrao.cnpj)}`}
                      natureza={compPadrao.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                      valor={emMilhoes(evReceita?.valor_calculo ?? null)}
                      casas={1}
                      unidade="R$ milhões"
                      evidencia={evReceita}
                      motivoAusencia="A receita do último exercício não tem ficha publicada."
                      nota="A companhia ativa de maior ativo total sem controladora aberta acima dela; na página, escolha qualquer outra."
                      endereco={ancoraPainel("p038")}
                    />
                  ) : (
                    <Numero variante="faixa" rotulo="Receita do último exercício" natureza="OBSERVADO" valor={null} motivoAusencia="Nenhuma companhia ativa com ativo total publicado." />
                  ),
                  contexto: (
                    <>
                      Companhias abertas registradas na CVM ({SIGLAS.CVM}): {SIGLAS.DFP} (DFP) de {f.periodos.exercicios[0] ?? "sem dado"} a {f.periodos.ultimo_exercicio ?? "sem dado"} e {SIGLAS.ITR} (ITR)
                      até {dataTexto(f.periodos.ultimo_trimestre)}, em R$ nominais.
                    </>
                  ),
                  limite: "o desempenho do setor inteiro (só companhias abertas), nem soma entre companhias; as demonstrações regulatórias da ANEEL estão bloqueadas na fonte e não foram substituídas.",
                },
                {
                  id: "p039",
                  resposta: (
                    <RespostaCurta id="p039" tamanho="sm" veredito={vereditoControle(ct)}>
                      {respostaControle(ct)}
                    </RespostaCurta>
                  ),
                  numero: (
                    <Numero
                      variante="faixa"
                      rotulo="Concentração por grupo de controle (HHI)"
                      natureza="CALCULADO"
                      evidencia={ct.concentracao.evidencia}
                      casas={0}
                      unidade="pontos"
                      nota={`${grupo ? `${inteiro(grupo.participantes)} grupos; fronteira de ${mwTexto(ct.fronteira.mw)}. ` : ""}HHI é o ${SIGLAS.HHI}, de 0 a 10.000; as faixas são as do Guia do CADE (${SIGLAS.CADE}). O período vai do primeiro trimestre de declarações considerado (${inicioJanela}) à data do SIGA.`}
                      endereco={ancoraPainel("p039")}
                    />
                  ),
                  contexto: (
                    <>
                      SIGA de {dataTexto(ct.fronteira.data)} e declarações de composição societária à ANEEL de {janela}; usinas em operação com participações válidas. {textoFronteiraNoCadastro(ct.fronteira, a)}
                    </>
                  ),
                  limite: "poder de mercado: a fronteira é capacidade instalada, não energia vendida nem mercado relevante, e a participação indireta não é calculada.",
                },
              ]}
            />

            <PainelEvidencia
              id="entrada"
              pergunta="Como uma empresa se liga a ativos, grupos e demonstrações?"
              subtitulo="Os quatro elos pelo mesmo CNPJ, com a fonte e a data de cada caminho · contagens, MW e R$ em universos que não se somam"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Saber quem opera, quem distribui, quem reporta demonstrações e quem controla é o primeiro passo para discutir concentração, responsabilidade por atrasos e o peso de cada empresa no
                  sistema. O vínculo só conta quando a própria fonte publica o identificador no registro.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.ativos}
              complementares={[
                { rotulo: "Cadastro de agentes", p: prov.cadastro_agentes },
                ...(prov.transmissao ? [{ rotulo: "Transmissão por CNPJ (SIGET)", p: prov.transmissao }] : []),
                { rotulo: "Distribuidoras pelo CNPJ", p: prov.distribuidoras },
                { rotulo: "Demonstrações na CVM", p: prov.financas },
                { rotulo: "Controle e concentração", p: prov.concentracao },
              ]}
            >
              <div className="space-y-6">
                <EmpresasPassosVinculo passos={passosVinculo(g)} />
                <EmpresasRecorte
                  periodo={
                    <>
                      SIGA de {dataSiga}; SIGET de {dataTexto(t?.data)}; composição societária declarada à ANEEL de {janela}; CVM com DFP até {f.periodos.ultimo_exercicio ?? "sem dado"} e ITR até{" "}
                      {dataTexto(f.periodos.ultimo_trimestre)}; perdas de {anoPerdas ?? "sem dado"} e continuidade de {anoQualidade ?? "sem dado"}
                    </>
                  }
                  universo={
                    <>
                      {inteiro(a.usinas)} usinas do SIGA ({inteiro(a.operacao.usinas)} em operação); {inteiro(d.resumo.distribuidoras)} distribuidoras; {inteiro(f.universo.companhias)} companhias abertas na CVM;{" "}
                      {inteiro(grupo?.participantes)} grupos de controle
                    </>
                  }
                  unidade="MW (potência fiscalizada em operação), km de circuito, R$ nominais e contagens; nada se soma entre caminhos"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="medidas" titulo="Quais medidas não se somam?" lead="Quatro pares que parecem somáveis e não são. Cada página repete a regra junto do número.">
                  <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    {MEDIDAS.map(([n, x]) => (
                      <li key={n} className="border-l-2 border-linha pl-4">
                        <p className="rotulo text-mineral">{n}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{x}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <div id="dados-do-modulo" className="scroll-mt-28">
                  <EmpresasSeguir ancora="entrada" proximo={{ href: rotaPainel("p036"), pergunta: painel("p036").pergunta }} downloads={g.downloads} />
                </div>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
