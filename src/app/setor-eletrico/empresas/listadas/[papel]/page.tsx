import type { Metadata } from "next";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasIndisponivel, EmpresasNavegacao } from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { ListadasEstrutura } from "@/components/energia/ListadasEstrutura";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { ListadasMapaUf } from "@/components/energia/ListadasMapaUf";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { lerSerie } from "@/lib/energia/empresas-arquivos";
import { rotaEntidade } from "@/lib/energia/empresas";
import { carimbo, dataBR, datasLegiveis, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  ROTA_LISTADAS,
  logoDe,
  nomeCurto,
  participacoesCruzadas,
  rotaFicha,
  serieBase100,
  sinalPct,
  textoAtuacao,
  textoBolsa,
  textoControle,
  textoCruzada,
} from "@/lib/energia/listadas";
import { lerManifestoLogos } from "@/lib/energia/logos";
import type { CompanhiaListada, EvidenciasListadas, ListadasGold } from "@/lib/energia/tipos-listadas";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const g = lerGold<ListadasGold>("listadas.json");
  return integra(g) ? g.companhias.map((c) => ({ papel: c.slug })) : [];
}

function achar(papel: string): { g: ListadasGold; c: CompanhiaListada } | null {
  const g = lerGold<ListadasGold>("listadas.json");
  if (!integra(g)) return null;
  const c = g.companhias.find((x) => x.slug === papel.toLowerCase());
  return c ? { g, c } : null;
}

export function generateMetadata({ params }: { params: { papel: string } }): Metadata {
  const r = achar(params.papel);
  if (!r) return {};
  const nome = nomeCurto(r.c, lerManifestoLogos());
  return {
    title: `${nome} (${r.c.papel}): ativos, controle, finanças e ações`,
    description: `Ficha da ${nome} na carteira do Índice de Energia Elétrica da B3: usinas, linhas e distribuidoras sob controle, acionistas e cadeia de controle, demonstrações consolidadas, retorno da ação com proventos e fatos relevantes.`,
    alternates: { canonical: rotaFicha(r.c) },
  };
}

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";
const ROTULO_TIPO: Record<string, string> = {
  UHE: "Hidrelétrica (UHE)",
  PCH: "Pequena central hidrelétrica (PCH)",
  CGH: "Central geradora hidrelétrica (CGH)",
  UTE: "Termelétrica (UTE)",
  UTN: "Termonuclear (UTN)",
  EOL: "Eólica (EOL)",
  UFV: "Solar fotovoltaica (UFV)",
};
const FIN: { id: "receita" | "ebit" | "lucro_liquido" | "divida_bruta" | "patrimonio_liquido"; rotulo: string }[] = [
  { id: "receita", rotulo: "Receita" },
  { id: "ebit", rotulo: "Resultado antes do financeiro e dos tributos" },
  { id: "lucro_liquido", rotulo: "Lucro líquido" },
  { id: "divida_bruta", rotulo: "Dívida bruta" },
  { id: "patrimonio_liquido", rotulo: "Patrimônio líquido" },
];

export default function FichaListada({ params }: { params: { papel: string } }) {
  const r = achar(params.papel);
  if (!r) return <EmpresasIndisponivel motivo="A companhia não está na carteira do IEE publicada nesta atualização." />;
  const { g, c } = r;
  const logos = lerManifestoLogos();
  const nome = nomeCurto(c, logos);
  const logo = logoDe(logos, c.papel);
  const ev = lerSerie<EvidenciasListadas>(g.series.evidencias)?.evidencias?.[c.papel] ?? {};
  const prov = g.proveniencia;
  const ger = c.geracao;
  const tr = c.transmissao;
  const dist = c.distribuicao;
  const b = c.bolsa;
  const fin = c.financas;
  const dataSiga = dataBR(g.datas.siga);
  const outras = g.companhias.filter((x) => x.papel !== c.papel);

  const barrasTipo = ger.por_tipo.map((t) => ({ tipo: t.tipo, nome: ROTULO_TIPO[t.tipo] ?? t.tipo, controle: t.mw_controle, proporcional: t.mw_proporcional }));
  const inicioBolsa = b && !b.motivo ? (b.retorno_desde_2020 ? "2020-12" : undefined) : undefined;
  const base = b && !b.motivo ? serieBase100(b, inicioBolsa) : [];
  const mensalTela = b && !b.motivo ? new Map(b.mensal.map(([m, f]) => [m, f])) : new Map<string, number>();
  const f0 = base.length ? (mensalTela.get(base[0].m) ?? null) : null;
  const dadosBolsa = base.map((x) => ({ m: x.m, total: x.total, preco: x.preco, tela: f0 ? (100 * (mensalTela.get(x.m) ?? NaN)) / f0 : null }));
  const desde = b?.retorno_desde_2020 ?? b?.retorno_desde_inicio ?? null;
  const ultFin = fin?.serie.at(-1) ?? null;
  const cruzadas = participacoesCruzadas(g).filter((x) => x.de.papel === c.papel || x.em.papel === c.papel);

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-listadas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="listadas" />
        <div className="flex flex-wrap items-center gap-4 pt-6">
          <ListadasLogo logo={logo} nome={nome} tamanho="lg" />
          <p className="text-sm text-carvao-muted">
            <Link href={ROTA_LISTADAS} className={link}>
              Companhias listadas
            </Link>{" "}
            · {c.papel} · {pct(c.iee.peso_pct, 2)} da carteira do IEE de {dataBR(g.datas.carteira_iee)}
          </p>
        </div>
        <CabecalhoModulo
          rotulo="Empresas listadas"
          siglas={["IEE", "B3", "CVM", "FCA", "FRE", "SIGA", "SIGET", "ANEEL"]}
          titulo={`${nome}: ativos, controle, números e ações`}
          lead={textoAtuacao(c)}
          recorte={`${c.nome ?? nome} · CNPJ ${c.cnpj ?? "sem dado"} · ${c.iee.segmento_nome ?? c.iee.segmento ?? "segmento sem dado"} · ativos do SIGA de ${dataSiga}`}
          fonte="ANEEL (SIGA, SIGET, Composição Societária); CVM (FCA, FRE, DFP, IPE); B3 (cotações e proventos)"
          limite="Ativos de coligadas e de sociedades com controle compartilhado não entram; retorno passado não indica retorno futuro."
          referencia={
            <>
              Formulário Cadastral de {dataBR(c.fca.data_referencia)} (versão {c.fca.versao ?? "sem dado"}); papel ligado ao CNPJ pelo código CVM {c.codigo_cvm ?? "sem dado"} publicado pela B3, conferência{" "}
              {c.conferencia_cnpj.resultado === "igual" ? "igual no FCA" : c.conferencia_cnpj.resultado}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo={`Indicadores da ${nome}`} nota="Cada medida tem a sua fonte e a sua data; nenhuma se soma à outra.">
              {ev.mw_controle ? (
                <Numero variante="faixa" rotulo="Potência em operação sob controle" natureza="CALCULADO" evidencia={ev.mw_controle} casas={0} unidade="MW" endereco={`${rotaFicha(c)}#ativos`} />
              ) : (
                <Numero variante="faixa" rotulo="Potência em operação sob controle" natureza="CALCULADO" valor={ger.mw_controle} casas={0} unidade="MW" periodo={`SIGA de ${dataSiga}`} />
              )}
              <Numero
                variante="faixa"
                rotulo="Transmissão em operação"
                natureza="CALCULADO"
                valor={tr ? tr.km_circuito_operacao : null}
                casas={0}
                unidade="km de circuito"
                periodo={`SIGET de ${dataBR(g.datas.siget)}`}
                motivoAusencia="Sem concessionária de transmissão sob controle."
              />
              <Numero
                variante="faixa"
                rotulo="Unidades consumidoras das distribuidoras"
                natureza="OBSERVADO"
                valor={dist?.unidades_consumidoras ?? null}
                casas={0}
                unidade="unidades"
                periodo={dist?.anos.length ? `ano ${dist.anos.join(", ")}` : undefined}
                motivoAusencia="Sem distribuidora sob controle."
              />
              {ev.retorno_total_12m ? (
                <Numero variante="faixa" rotulo={`Retorno total de ${c.papel} em 12 meses`} natureza="CALCULADO" evidencia={ev.retorno_total_12m} casas={1} unidade="%" endereco={`${rotaFicha(c)}#bolsa`} />
              ) : (
                <Numero variante="faixa" rotulo={`Retorno total de ${c.papel} em 12 meses`} natureza="CALCULADO" valor={null} motivoAusencia="Sem 12 meses de cotações." />
              )}
            </FaixaMetricas>
          }
        >
          {c.descricao_atividade ? (
            <>
              Atividade como a companhia a descreve no Formulário Cadastral da CVM: “{c.descricao_atividade}”
              {c.nome_anterior ? ` Nome empresarial anterior: ${c.nome_anterior}${c.data_nome ? ` (até ${dataBR(c.data_nome)})` : ""}.` : ""}
              {c.pagina_web ? ` Página informada: ${c.pagina_web}.` : ""}
            </>
          ) : (
            "A companhia não descreve a atividade no Formulário Cadastral lido."
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="ficha">
            {c.descricao_atividade && (
              <blockquote className="max-w-prose2 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
                <p>“{c.descricao_atividade}”</p>
                <footer className="mt-1 text-xs text-mineral">Descrição da atividade no Formulário Cadastral entregue à CVM ({dataBR(c.fca.data_referencia)}).</footer>
              </blockquote>
            )}

            <PainelEvidencia
              id="ativos"
              pergunta="Quais ativos a companhia controla?"
              subtitulo={`Usinas em MW (SIGA de ${dataSiga}), transmissão em km de circuito (SIGET), distribuidoras em unidades consumidoras`}
              natureza="CALCULADO"
              porQueImporta={<>A composição dos ativos define de onde vem a receita: geração vende energia, transmissão recebe receita anual permitida e distribuição tem tarifa revista pela ANEEL.</>}
              oQueMudou={<>Usinas do SIGA de {dataSiga}; transmissão do SIGET de {dataBR(g.datas.siget)}; cadeia de controle do trimestre {g.datas.polimero_trimestre ?? "sem dado"}.</>}
              comoInterpretar={<>{g.definicoes.sob_controle} {g.definicoes.mw_proporcional}</>}
              naoConcluir={<>Capacidade instalada não é energia gerada nem receita. Participações minoritárias e em controle compartilhado ficam fora.</>}
              proveniencia={prov.ativos}
            >
              <div className="space-y-6">
                <RespostaCurta id="ativos-resposta" tamanho="sm" veredito={textoAtuacao(c)}>
                  {g.definicoes.mw_controle} {ger.mw_controle !== ger.mw_proporcional ? `Proporcional às participações diretas das empresas sob controle: ${num(ger.mw_proporcional, 0)} MW.` : ""}{" "}
                  {c.controle.empresas_sob_controle} CNPJ sob controle, inclusive a companhia.
                </RespostaCurta>
                {ger.usinas_controle > 0 ? (
                  <>
                    <GraficoBarras
                      titulo={`Potência em operação por tipo de usina, SIGA de ${dataSiga}`}
                      dados={barrasTipo}
                      chaveCategoria="tipo"
                      chaveRotulo="nome"
                      series={[
                        { id: "controle", rotulo: "Sob controle", cor: "var(--cor-energia)" },
                        { id: "proporcional", rotulo: "Proporcional", cor: "var(--serie-referencia)" },
                      ]}
                      unidade="MW"
                      casas={0}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <ListadasMapaUf
                      porUf={ger.por_uf}
                      titulo={`Potência em operação sob controle por UF, SIGA de ${dataSiga}`}
                      periodo={`SIGA de ${dataSiga}`}
                      nota="UF da usina como publicada no SIGA (a principal, quando a usina é multiestadual). UF sem usina sob controle aparece como não se aplica."
                    />
                    <SecaoDoPainel id="maiores" titulo="Quais são as maiores usinas sob controle?">
                      <div className="tabela-scroll overflow-x-auto" role="region" aria-label="Maiores usinas sob controle" tabIndex={0}>
                        <table className="w-full min-w-[640px] border-collapse text-sm">
                          <thead>
                            <tr className="text-left text-xs text-carvao-muted">
                              <th scope="col" className="pb-2 pr-3 font-medium">Usina</th>
                              <th scope="col" className="pb-2 pr-3 font-medium">Tipo</th>
                              <th scope="col" className="pb-2 pr-3 font-medium">UF</th>
                              <th scope="col" className="pb-2 pr-3 text-right font-medium">MW</th>
                              <th scope="col" className="pb-2 font-medium">Dona direta (participação)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ger.maiores.map((u) => (
                              <tr key={u.nucleo} className="border-t border-linha">
                                <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">{u.nome}</th>
                                <td className="py-1.5 pr-3 text-carvao-muted">{u.tipo}{u.fonte ? ` · ${u.fonte}` : ""}</td>
                                <td className="py-1.5 pr-3 text-carvao-muted">{u.uf}</td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-carvao">{num(u.mw, 1)}</td>
                                <td className="py-1.5 text-carvao-muted">
                                  {u.dono_nome ?? u.dono_cnpj} ({pct(u.pct_dono, 1)}){u.nivel > 0 ? ` · ${u.nivel} ${u.nivel === 1 ? "degrau" : "degraus"} abaixo` : " · a própria companhia"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {ger.mw_em_implantacao > 0 && (
                        <p className="text-sm text-carvao-muted">
                          Em implantação sob controle: {num(ger.mw_em_implantacao, 0)} MW outorgados em {ger.usinas_em_implantacao} usinas
                          {ger.em_implantacao.length ? `, entre elas ${ger.em_implantacao.slice(0, 3).map((u) => `${u.nome} (${u.tipo}, ${num(u.mw, 0)} MW, ${u.fase.toLowerCase()})`).join("; ")}` : ""}.
                        </p>
                      )}
                      <p className="text-xs text-carvao-muted">
                        Lista completa no arquivo{" "}
                        <a className={link} href="/energia/series/listadas_usinas.csv">
                          listadas_usinas.csv
                        </a>{" "}
                        (filtre pelo papel {c.papel}).
                      </p>
                    </SecaoDoPainel>
                  </>
                ) : (
                  <p className="text-sm text-carvao-muted">Nenhuma usina em operação sob controle da companhia no SIGA de {dataSiga}.</p>
                )}
                {tr && (
                  <SecaoDoPainel id="transmissao" titulo="Que linhas de transmissão a companhia controla?">
                    <p className="text-sm text-carvao-muted">
                      {tr.concessionarias} {tr.concessionarias === 1 ? "concessionária" : "concessionárias"} sob controle, com {num(tr.km_circuito_operacao, 0)} km de circuito em operação, {num(tr.km_circuito_implantacao, 0)} km em implantação e{" "}
                      {num(tr.mva_transformacao_operacao, 0)} MVA de transformação em operação, em {tr.ufs.length} UFs ({tr.ufs.join(", ")}). Linha de circuito duplo conta duas vezes; a mesma subestação pode estar em mais de uma
                      concessionária.
                    </p>
                    <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                      {tr.maiores.map((x) => (
                        <li key={x.cnpj} className="flex justify-between gap-3 border-b border-linha py-1">
                          <span className="text-carvao">{x.nome}</span>
                          <span className="whitespace-nowrap tabular-nums text-carvao-muted">{num(x.km, 0)} km</span>
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                )}
                {dist && (
                  <SecaoDoPainel id="distribuicao" titulo="Que distribuidoras a companhia controla?" lead="Cada distribuidora tem ficha própria com perdas, continuidade, tarifa e demonstrações.">
                    <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                      {dist.distribuidoras.map((d) => (
                        <li key={d.slug} className="flex justify-between gap-3 border-b border-linha py-1">
                          <Link href={rotaEntidade(d.slug)} className={link}>
                            {d.sigla}
                            <span className="sr-only">: ficha da distribuidora</span>
                          </Link>
                          <span className="whitespace-nowrap text-carvao-muted">
                            {d.ufs.join(", ")} · {d.ucs !== null ? `${num(d.ucs / 1e6, 2)} milhões de UCs` : "UCs sem dado"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                )}
              </div>
            </PainelEvidencia>

            <PainelEvidencia
              id="controle"
              pergunta="Quem controla a companhia?"
              subtitulo="Cadeia de controle declarada à ANEEL e acionistas diretos declarados no Formulário de Referência da CVM"
              natureza="OBSERVADO"
              porQueImporta={<>O controlador indica quem decide a estratégia, os investimentos e a distribuição de lucros.</>}
              oQueMudou={
                c.controle.mudancas.length ? (
                  <>
                    Desde o formulário de {c.controle.mudancas_desde?.ano_formulario}:{" "}
                    {c.controle.mudancas
                      .map((m) => (m.tipo === "entrada" ? `${m.acionista} passa a constar com ${pct(m.depois, 2)}` : m.tipo === "saida" ? `${m.acionista} deixa de constar` : `${m.acionista} de ${pct(m.antes, 2)} para ${pct(m.depois, 2)}`))
                      .join("; ")}
                    .
                  </>
                ) : (
                  <>Nenhuma mudança de pelo menos 0,5 ponto percentual entre os dois últimos formulários lidos.</>
                )
              }
              comoInterpretar={<>{textoControle(c)} Espécie de controle declarada no Formulário Cadastral: {c.controle.especie_fca ?? "sem dado"}.</>}
              naoConcluir={<>As duas fontes têm datas e critérios próprios; a cadeia da ANEEL para em controle compartilhado e não mostra acordos de acionistas.</>}
              proveniencia={prov.controle}
              complementares={[{ rotulo: "Cadeia de controle (ANEEL)", p: prov.ativos }]}
            >
              <ListadasEstrutura c={c} nome={nome} />
              {cruzadas.length > 0 && (
                <SecaoDoPainel id="cruzadas" titulo="Participações entre companhias da carteira">
                  <ul className="space-y-1.5 text-sm leading-relaxed text-carvao-muted">
                    {cruzadas.map((x) => (
                      <li key={`${x.de.papel}-${x.em.papel}`}>{textoCruzada(x, (y) => nomeCurto(y, logos))}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>
              )}
            </PainelEvidencia>

            {fin && (
              <PainelEvidencia
                id="financas"
                pergunta="O que mostram as demonstrações?"
                subtitulo="DFP consolidada na CVM, R$ milhões nominais, exercícios encerrados"
                natureza="OBSERVADO"
                porQueImporta={<>Receita, resultado, dívida e patrimônio são a base para comparar a companhia com ela mesma ao longo do tempo.</>}
                oQueMudou={<>Último exercício: {fin.ultimo_exercicio ?? "sem dado"}. {fin.valores_reapresentados ? `${fin.valores_reapresentados} valores reapresentados pela companhia no comparativo do ano seguinte.` : ""}</>}
                comoInterpretar={<>{g.definicoes.margem_ebit} {g.definicoes.divida_bruta_sobre_pl} {g.definicoes.lucro_sobre_pl}</>}
                naoConcluir={<>Valores nominais, sem correção pela inflação; o consolidado mistura todos os negócios da companhia, inclusive fora do setor elétrico.</>}
                proveniencia={prov.financas ?? prov.ativos}
              >
                <div className="space-y-6">
                  <GraficoBarras
                    titulo="Receita, resultado antes do financeiro e dos tributos e lucro líquido, consolidado"
                    dados={fin.serie.map((x) => ({ ano: String(x.exercicio), receita: x.receita, ebit: x.ebit, lucro: x.lucro_liquido }))}
                    chaveCategoria="ano"
                    series={[
                      { id: "receita", rotulo: "Receita", cor: "var(--serie-referencia)" },
                      { id: "ebit", rotulo: "Resultado antes do financeiro e dos tributos", cor: "var(--serie-comp-4)" },
                      { id: "lucro", rotulo: "Lucro líquido", cor: "var(--cor-energia)" },
                    ]}
                    unidade="R$ milhões"
                    casas={0}
                  />
                  <div className="tabela-scroll overflow-x-auto" role="region" aria-label="Demonstrações e razões por exercício" tabIndex={0}>
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr className="text-xs text-carvao-muted">
                          <th scope="col" className="pb-2 pr-3 text-left font-medium">R$ milhões</th>
                          {fin.serie.map((x) => (
                            <th key={x.exercicio} scope="col" className="pb-2 pl-3 text-right font-medium">
                              {x.exercicio}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {FIN.map((f) => (
                          <tr key={f.id} className="border-t border-linha">
                            <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">{f.rotulo}</th>
                            {fin.serie.map((x) => (
                              <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao">{num(x[f.id], 0)}</td>
                            ))}
                          </tr>
                        ))}
                        <tr className="border-t border-linha">
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">Margem antes do financeiro e dos tributos (%)</th>
                          {fin.serie.map((x) => (
                            <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao-muted">{num(x.margem_ebit_pct, 1)}</td>
                          ))}
                        </tr>
                        <tr className="border-t border-linha">
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">Dívida bruta ÷ patrimônio líquido (vezes)</th>
                          {fin.serie.map((x) => (
                            <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao-muted">{num(x.divida_bruta_sobre_pl, 2)}</td>
                          ))}
                        </tr>
                        <tr className="border-t border-linha">
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">Lucro dos controladores ÷ patrimônio (%)</th>
                          {fin.serie.map((x) => (
                            <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao-muted">{num(x.lucro_sobre_pl_pct, 1)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {ultFin && (
                    <p className="text-xs text-carvao-muted">
                      Séries completas, trimestres e o individual na página de{" "}
                      <Link href="/setor-eletrico/empresas/financas#p038" className={link}>
                        finanças das companhias abertas
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </PainelEvidencia>
            )}

            {b && !b.motivo && (
              <PainelEvidencia
                id="bolsa"
                pergunta={`Como a ação ${c.papel} se comportou?`}
                subtitulo={`Índice mensal em base 100 · último pregão de cada mês até ${dataBR(b.ultimo_pregao)}`}
                natureza="CALCULADO"
                porQueImporta={<>O retorno total mostra o que o acionista obteve com a ação e os proventos; o preço sozinho ignora dividendos e juros sobre capital próprio.</>}
                oQueMudou={<>{textoBolsa(b)}</>}
                comoInterpretar={<>{g.definicoes.retorno_total} {g.definicoes.retorno_preco}</>}
                naoConcluir={<>Retorno passado não indica retorno futuro e não é recomendação de investimento.</>}
                proveniencia={prov.bolsa}
              >
                <div className="space-y-6">
                  <GraficoLinhas
                    titulo={`${c.papel}: retorno total, preço ajustado e fechamento de tela (base 100 em ${dataBR(base[0]?.m)})`}
                    dados={dadosBolsa}
                    chaveX="m"
                    formatoX="mes"
                    unidade="base 100"
                    casas={1}
                    series={[
                      { id: "total", rotulo: "Retorno total", cor: "var(--cor-energia)", espessura: 2.5 },
                      { id: "preco", rotulo: "Preço ajustado", cor: "var(--serie-comp-4)" },
                      { id: "tela", rotulo: "Fechamento de tela", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    legendaInterativa
                    zoom
                  />
                  <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                    {[
                      { rot: "12 meses", r: b.retorno_12m },
                      { rot: "No ano", r: b.retorno_no_ano },
                      { rot: desde ? `Desde ${dataBR(desde.de)}` : "Desde o início da série", r: desde },
                    ].map((x) => (
                      <div key={x.rot} className="border-l-2 border-linha pl-3">
                        <dt className="rotulo text-mineral">{x.rot}</dt>
                        <dd className="tabular-nums text-carvao">
                          {sinalPct(x.r?.total_pct)} com proventos · {sinalPct(x.r?.preco_pct)} no preço
                        </dd>
                        {x.r && <dd className="text-xs text-mineral">de {dataBR(x.r.de)} a {dataBR(x.r.ate)}</dd>}
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-carvao-muted">
                    Fechamento em {dataBR(b.ultimo_pregao)}: R$ {num(b.fechamento, 2)} por {c.iee.classe === "UNT" ? "unit" : "ação"}. Volume médio diário nos últimos 3 meses: R$ {num((b.volume_medio_diario_3m ?? 0) / 1e6, 1)} milhões em {b.pregoes_3m} pregões.
                    Proventos com data ex nos últimos 12 meses: R$ {num(b.proventos_12m, 2)} por {c.iee.classe === "UNT" ? "unit" : "ação"}, brutos.
                  </p>
                  {(b.emendas.length > 0 || b.notas.length > 0 || b.eventos_acoes.length > 0 || b.bonificacoes_outra_classe.length > 0) && (
                    <ul className="space-y-1.5 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
                      {b.emendas.map((e) => (
                        <li key={e.codigo_anterior}>
                          A série emenda {e.codigo_anterior} (até {dataBR(e.ultimo_pregao_anterior)}) e {e.codigo} (desde {dataBR(e.primeiro_pregao)}): mesma companhia e mesma classe no Formulário Cadastral.
                        </li>
                      ))}
                      {b.eventos_acoes.map((e) => (
                        <li key={e.data_ex}>
                          {dataBR(e.data_ex)}: evento em ações com multiplicador {num(e.multiplicador, 2)} (data com {dataBR(e.data_com)}), publicado pela B3.
                        </li>
                      ))}
                      {b.bonificacoes_outra_classe.map((e) => (
                        <li key={e.data_com}>
                          Bonificação em ações de outra classe ({e.isin_emitido}), {num(e.fator, 2)} por 100 ações, valorizada em R$ {num(e.valor, 2)} por ação pelo primeiro fechamento da classe recebida em{" "}
                          {dataBR(e.data_fechamento)} (estimativa do observatório).
                        </li>
                      ))}
                      {b.notas.map((t) => (
                        <li key={t}>{datasLegiveis(t)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </PainelEvidencia>
            )}

            <PainelEvidencia
              id="movimentos"
              pergunta="Como a companhia tem se movimentado?"
              subtitulo={`Fatos relevantes entregues à CVM desde ${dataBR(c.movimentos.desde)} · os mais recentes`}
              natureza="OBSERVADO"
              porQueImporta={<>Aquisições, vendas de ativos, emissões, mudanças de controle e decisões regulatórias aparecem primeiro nos fatos relevantes.</>}
              oQueMudou={
                <>
                  {c.movimentos.fatos_relevantes_24m} fatos relevantes no período
                  {Object.keys(c.movimentos.por_ano).length ? ` (${Object.entries(c.movimentos.por_ano).map(([a, n]) => `${a}: ${n}`).join("; ")})` : ""}.
                </>
              }
              comoInterpretar={<>O título é o assunto que a própria companhia deu ao documento; o link leva ao arquivo no sistema da CVM.</>}
              naoConcluir={<>O observatório não resume nem classifica o conteúdo dos documentos.</>}
              proveniencia={prov.movimentos}
            >
              {c.movimentos.recentes.length ? (
                <ol className="space-y-2" aria-label={`Fatos relevantes mais recentes de ${nome}`}>
                  {c.movimentos.recentes.map((f, i) => (
                    <li key={`${f.protocolo ?? f.data_entrega}-${i}`} className="grid gap-x-4 border-b border-linha pb-2 text-sm sm:grid-cols-[6.5rem_1fr]">
                      <time dateTime={f.data_entrega} className="tabular-nums text-mineral">
                        {dataBR(f.data_entrega)}
                      </time>
                      {f.link ? (
                        <a href={f.link} className={link} rel="noopener noreferrer">
                          {f.assunto ?? "Fato relevante sem assunto informado"}
                          <span className="sr-only"> (documento na CVM)</span>
                        </a>
                      ) : (
                        <span className="text-carvao">{f.assunto ?? "Fato relevante sem assunto informado"}</span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-carvao-muted">Nenhum fato relevante entregue no período.</p>
              )}
              <p className="mt-2 text-xs text-carvao-muted">
                Todos os fatos relevantes de 24 meses no arquivo{" "}
                <a className={link} href="/energia/series/listadas_fatos_relevantes.csv">
                  listadas_fatos_relevantes.csv
                </a>
                .
              </p>
            </PainelEvidencia>

            <nav aria-label="Outras companhias da carteira" className="border-t border-linha pt-6">
              <h2 className="ed-h3 font-serif text-carvao">Outras companhias da carteira</h2>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {outras.map((x) => (
                  <li key={x.papel}>
                    <Link href={rotaFicha(x)} className={`${link} inline-flex min-h-[44px] items-center`}>
                      {nomeCurto(x, logos)} ({x.papel})
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
