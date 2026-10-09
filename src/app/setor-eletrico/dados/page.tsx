import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AoAparecer } from "@/components/energia/AoAparecer";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosCatalogo, DadosRecursosCcee } from "@/components/energia/DadosCatalogo";
import { DadosEscada } from "@/components/energia/DadosEscada";
import { DadosAviso, DadosCapitulos, DadosIndisponivel, DadosLimitacoes, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { COLUNAS_ARQUIVO, DATASETS_INTEGRADOS, catalogoDados } from "@/lib/energia/datasets";
import { CSV_DADOS, ESTADOS_ESCADA, ROTULO_ESTADO_DADOS, compactarLinhas, linhasCatalogo, respostaCatalogo, resumoCatalogo, uni } from "@/lib/energia/dados";
import { contextoDoCatalogo, rotuloDoArquivo } from "@/lib/energia/dados-ficha";
import { agruparRessalvas, conciliarCatalogoEIntegracoes, ressalvaParaLeitor, textoConciliacao, textoMudancaCatalogo, vereditoCatalogo } from "@/lib/energia/dados-leitor";
import { provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Dados do setor elétrico: encontre a fonte e reproduza o número",
  description:
    "Catálogo pesquisável dos dados abertos do setor elétrico (ONS, ANEEL, CCEE e outros), com o estado mais avançado de cada conjunto, o histórico de estados, o período dos dados, o uso declarado, os descontinuados e o estado de cada arquivo da CCEE.",
  alternates: { canonical: "/setor-eletrico/dados" },
};

/** Campos de cada linha do catálogo, na ordem em que viajam para o navegador (as chaves vão uma vez, não uma por linha). */
const CHAVES_DO_CATALOGO = [
  "id",
  "n",
  "titulo",
  "orgao",
  "tema",
  "estado",
  "etapas",
  "verificado",
  "integrado",
  "validado",
  "publicado",
  "uso",
  "ressalva",
  "descontinuado",
  "frequencia",
  "periodo",
  "modificado",
  "recursos",
  "acessados",
  "ficha",
  "slug",
  "baixar",
  "url",
  "formatos",
];

export default function DadosCatalogoPage() {
  const cat = catalogoDados();
  const pub = publicacaoDados();
  if (!cat || !pub) return <DadosIndisponivel atual="dados" />;

  const r = resumoCatalogo(cat);
  const prov = provenienciaDados(pub.proveniencia.catalogo);
  const porId = new Map(cat.entradas.map((e) => [e.id, e]));
  // o catálogo dá o mesmo endereço de ficha a conjuntos que um módulo integra juntos: a ficha vale para todos eles
  const fichas = new Set(DATASETS_INTEGRADOS.filter((d) => porId.has(d.catalogoId)).map((d) => d.slug));
  const linhas = linhasCatalogo(cat, contextoDoCatalogo(cat, pub, fichas));
  const matriz = compactarLinhas(linhas, CHAVES_DO_CATALOGO);
  const baixaveis = Array.from(new Set(cat.entradas.filter((e) => e.slug && fichas.has(e.slug)).flatMap((e) => e.downloads ?? [])));
  const rotulosDosArquivos = Object.fromEntries(baixaveis.map((u) => [u, rotuloDoArquivo(u, COLUNAS_ARQUIVO[u])]));
  const nomesPortais = Object.entries(cat.portais);
  const dataDaListagem = (iso: string | null) => (iso ? dataBR(iso.slice(0, 10)) : "sem coleta");
  const dias = Array.from(new Set(nomesPortais.map(([, p]) => p.colhido_em).filter((x): x is string => !!x).map((x) => carimbo(x).slice(0, 10))));
  const acessados = (o: string) => (cat.recursos[o]?.total ?? 0) - (cat.recursos[o]?.por_estado.CATALOGADO ?? 0);
  const portaisComRecursos = Object.entries(cat.recursos);
  // arquivos de cada portal por etapa, em % do total do portal; as etapas são cumulativas, então as barras são comparações e não partes de um total
  const dadosRecursos = portaisComRecursos.map(([o, x]) => ({
    orgao: o,
    rotulo: `${o} (${num(x.total, 0)} arquivos)`,
    acessados: (100 * acessados(o)) / (x.total || 1),
    publicados: (100 * (x.por_estado.PUBLICADO ?? 0)) / (x.total || 1),
  }));
  const semArquivoIsolado = ESTADOS_ESCADA.filter((s) => s !== "CATALOGADO" && !portaisComRecursos.some(([, x]) => (x.por_estado[s] ?? 0) > 0)).map((s) => ROTULO_ESTADO_DADOS[s].toLowerCase());
  const versao = cat.gerado_em;
  const evPublicados = pub.evidencias.conjuntos_publicados;
  const conciliacao = conciliarCatalogoEIntegracoes(cat, pub);
  const ENDERECO = "https://scrutiniums.com/setor-eletrico/dados#catalogo";
  // a mesma ressalva em vários conjuntos aparece uma vez, no texto; a lista traz só o que é específico de cada um
  const gruposRessalva = agruparRessalvas(r.usadasAbaixo, (e) => e.titulo);
  const ressalvaComum = gruposRessalva[0] && gruposRessalva[0].titulos.length > 1 ? gruposRessalva[0] : null;
  const oQueMudou = (
    <>
      {textoMudancaCatalogo(cat)}
      <span data-nivel="analisar">
        {" "}
        Listagens colhidas em {nomesPortais.map(([o, p]) => `${o}, ${p.colhido_em ? carimbo(p.colhido_em) : "sem coleta"}`).join("; ")}. O catálogo se atualiza a cada coleta automática, e esta página mostra a de {carimbo(cat.gerado_em)}. A coleta da CCEE usa o mesmo cliente do PLD horário.
      </span>
    </>
  );
  const comoInterpretar = (
    <>
      O estado de cada conjunto é o mais avançado que ele alcançou, de catalogado a publicado, e o histórico completo está no detalhe. As etapas são cumulativas: a contagem de cada uma inclui as seguintes, então os números não se somam. Uso declarado é outro eixo
      (indicador, modelo, conferência, contexto, histórico) e não substitui o estado.
    </>
  );
  const naoConcluir = (
    <>
      Que um conjunto publicado esteja atualizado: a atualidade é medida na página de saúde. Que catalogado signifique dado bom: é existência na listagem e licença. Que a contagem de recursos verificados represente a cobertura da fonte: só {num(acessados("ONS"), 0)} dos{" "}
      {num(cat.recursos.ONS?.total ?? 0, 0)} arquivos do ONS foram acessados pelo observatório. Que o catálogo contenha tudo o que é público: ele reúne as listagens de três portais, as fontes que os módulos usam e entradas cadastradas à mão.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["ONS", "ANEEL", "CCEE"]}
          titulo="Encontre a fonte e reproduza o número"
          lead="Pesquise os conjuntos de dados abertos que o observatório conhece, veja até onde cada um chegou e baixe os arquivos. O catálogo reúne o que foi encontrado nas listagens do ONS, da ANEEL e da CCEE e o que os módulos usam: não lista tudo o que é público."
          recorte={`${num(r.total, 0)} conjuntos de ${r.orgaos} órgãos · listagens colhidas em ${dias.length ? dias.join(" e ") : "data não registrada"}`}
          fonte="ONS, ANEEL e CCEE (dados abertos), registros dos módulos e cadastro manual"
          referencia={
            <ReferenciaDados
              processadoEm={cat.gerado_em}
              referencia={dataBR(pub.referencia.hoje)}
              extra={<>Listagens oficiais colhidas em {nomesPortais.map(([o, p]) => `${o} ${p.colhido_em ? carimbo(p.colhido_em) : "sem coleta"}`).join("; ")}.</>}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Indicadores do catálogo" nota="Medidas do catálogo inteiro: não mudam com a busca nem com os filtros da lista.">
              <Numero
                variante="faixa"
                rotulo="Conjuntos no catálogo"
                natureza="CALCULADO"
                valor={r.total}
                casas={0}
                unidade="conjuntos"
                periodo={dataBR(cat.gerado_em.slice(0, 10))}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo="Com recurso verificado ou além"
                natureza="CALCULADO"
                valor={r.cumulativo["RECURSO VERIFICADO"]}
                casas={0}
                unidade="conjuntos"
                periodo={dataBR(cat.gerado_em.slice(0, 10))}
                nota="Etapa cumulativa: inclui os integrados e os publicados."
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo="Publicados no observatório"
                natureza="CALCULADO"
                evidencia={evPublicados ?? null}
                valor={r.cumulativo.PUBLICADO}
                casas={0}
                unidade="conjuntos"
                nota="Não atesta atualização: veja Saúde e revisões."
                motivoAusencia="O catálogo não foi gerado."
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo="Descontinuados pela fonte"
                natureza="CALCULADO"
                valor={r.descontinuados}
                casas={0}
                unidade={uni(r.descontinuados, "conjunto", "conjuntos")}
                periodo={dataBR(cat.gerado_em.slice(0, 10))}
                nota={r.descontinuadasPublicadas.length ? `${r.descontinuadasPublicadas.length} segue publicado, como histórico.` : "Nenhum segue publicado."}
                endereco={ENDERECO}
              />
            </FaixaMetricas>
          }
        >
          Catalogar é registrar que um conjunto existe, com seus metadados oficiais. Verificar o recurso é acessar um arquivo. Integrar é coletá-lo e guardar a cópia original com a impressão digital do arquivo. Validar é conferir a captura sem checagem reprovada. Publicar é alimentar uma
          base publicada e íntegra. Cada conjunto mostra até onde chegou, com a evidência de cada etapa, e o uso que o observatório faz dele fica à parte. As regras de cada indicador estão na{" "}
          <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
            Metodologia
          </Link>
          .
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="catalogo">
            <PainelEvidencia
              id="painel-catalogo"
              pergunta="Quais conjuntos existem, e até onde cada um chegou?"
              subtitulo={`${num(r.total, 0)} conjuntos · estado mais avançado de cada um · busca, filtros e arquivos para baixar`}
              proveniencia={prov}
              porQueImporta={
                <>
                  Um conjunto citado na página de um indicador pode estar apenas catalogado, ou integrado e ainda sem validação. O estado mostra onde cada um está e impede que catalogar passe por usar: o estado de um conjunto nunca sobe sem a evidência da etapa.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <DadosCatalogo
                  matriz={matriz}
                  portais={cat.portais}
                  versao={versao}
                  rotulosDosArquivos={rotulosDosArquivos}
                  arquivoCompleto={{ rotulo: "Catálogo completo com a descrição (CSV)", url: CSV_DADOS.catalogo.url }}
                  tituloTabela="Tabela completa do catálogo, com todas as colunas"
                  apoioTabela="A mesma busca e os mesmos filtros da lista, com todas as colunas para ordenar e comparar. O recorte escolhido na lista aparece aqui, e a tabela baixa o recorte em CSV ou XLSX."
                >
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                    <DadosResposta
                    depois
                    painel="P067"
                    veredito={vereditoCatalogo(r)}
                    prova={evPublicados ? <ComproveNumero evidencia={evPublicados} rotulo="Comprove os conjuntos publicados" endereco={ENDERECO} /> : undefined}
                  >
                    {respostaCatalogo(r)}
                    </DadosResposta>

                    <DadosCapitulos atual="catalogo" />

                    <SecaoDoPainel id="conjuntos-e-integracoes" titulo="Por que o catálogo e a Saúde contam números diferentes?">
                      <DadosAviso>
                        <p>{textoConciliacao(conciliacao)}</p>
                      </DadosAviso>
                    </SecaoDoPainel>

                  {r.usadasAbaixo.length > 0 && (
                      <SecaoDoPainel id="em-uso-abaixo" titulo="Quais conjuntos estão em uso, mas abaixo de publicado?">
                        <DadosAviso>
                          <p>
                          {r.usadasAbaixo.length === 1 ? "Este conjunto alimenta" : `Estes ${r.usadasAbaixo.length} conjuntos alimentam`} uma base publicada, mas o estado calculado pelo observatório não passou de recurso verificado: o observatório abriu um arquivo do conjunto e
                          conferiu o formato e o cabeçalho, mas ainda não guarda o histórico dos dados. Por isso o conjunto não conta como publicado, mesmo que o módulo declare o uso.
                          {ressalvaComum ? ` Em ${ressalvaComum.titulos.length} deles a ressalva do catálogo é a mesma: ${ressalvaComum.texto.charAt(0).toLowerCase()}${ressalvaComum.texto.slice(1)}` : ""}
                          </p>
                          <ul className="mt-2 space-y-1.5" data-lista="em-uso-abaixo">
                          {r.usadasAbaixo.map((e) => {
                            const texto = ressalvaParaLeitor((e.ressalvas ?? []).join(" ")) || `usado em ${e.usado_em.join(", ")}`;
                            return (
                                <li key={e.id} className="leading-relaxed">
                                  <strong className="font-medium text-carvao">{e.titulo}</strong> ({e.orgao}, {ROTULO_ESTADO_DADOS[e.estado].toLowerCase()}){ressalvaComum && texto === ressalvaComum.texto ? "" : `: ${texto}`}
                                </li>
                            );
                          })}
                          </ul>
                        </DadosAviso>
                      </SecaoDoPainel>
                  )}


                </DadosCatalogo>

                <SecaoDoPainel id="etapas-do-catalogo" nivel="analisar" titulo="O que cada etapa exige">
                  <DadosEscada cat={cat} resumo={r} />
                </SecaoDoPainel>

                <SecaoDoPainel id="recurso-a-recurso" nivel="analisar" titulo="Recurso a recurso: até onde chegou cada arquivo, por órgão">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{cat.regra_recurso}</p>
                  <GraficoBarras
                    titulo="Arquivos de cada portal que o observatório acessou e que alimentam bases publicadas (% do total do portal)"
                    dados={dadosRecursos}
                    chaveCategoria="orgao"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "acessados", rotulo: "Acessados pelo observatório (recurso verificado ou além)", cor: "var(--escala-seq-2)" },
                      { id: "publicados", rotulo: "Publicados (alimentam uma base)", cor: "var(--escala-seq-5)" },
                    ]}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                    alturaCategoria={72}
                  />
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                    As duas barras de cada portal não se somam: os arquivos publicados já estão entre os acessados. O estado de um arquivo herda o da integração que o capturou com impressão digital (publicado, nos arquivos que alimentam uma base); o lido só por requisição parcial está em
                    recurso verificado; os demais, em catalogado.
                    {semArquivoIsolado.length ? ` Nenhum arquivo tem ${semArquivoIsolado.join(" nem ")} como estado mais avançado: a captura e a base publicada saem da mesma execução.` : ""}
                  </p>
                  <AoAparecer espera="A tabela dos 733 arquivos da CCEE é lida do CSV publicado quando esta seção aparece na tela." botao="Ler a tabela da CCEE agora">
                    <DadosRecursosCcee url={CSV_DADOS.recursosCcee.url} versao={versao} />
                  </AoAparecer>
                </SecaoDoPainel>

                <SecaoDoPainel id="descontinuados-lista" nivel="analisar" titulo="Descontinuados identificados pela fonte">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    O pipeline marca como descontinuado o conjunto cujo título ou nome diz isso, ou cuja frequência declarada é &quot;Sem atualização&quot;, e escreve a evidência. A marca não apaga o conjunto: o estado da escada continua valendo, e a ficha diz o uso.
                  </p>
                  <ul className="divide-y divide-linha border border-linha text-sm" data-lista="descontinuados">
                    {pub.catalogo.descontinuados_lista.map((d) => (
                      <li key={d.id} className="px-3 py-2 leading-relaxed">
                        <strong className="font-medium text-carvao">{d.titulo}</strong>
                        <span className="ml-2 text-xs text-mineral">{ROTULO_ESTADO_DADOS[d.estado]}</span>
                        <span className="block text-carvao-muted">
                          Critério: {d.motivo ?? "não informado"}. Evidência: {d.evidencia ?? "não informada"}.
                        </span>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel id="catalogo-auditoria" nivel="auditar" titulo="Fontes das listagens e regras do catálogo">
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Portais consultados (tabela rolável)">
                    <table className="w-full min-w-[40rem] border-collapse text-xs">
                      <caption className="sr-only">Portais consultados para montar o catálogo</caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {["Portal", "Endereço da listagem", "Colhido em", "Conjuntos", "Arquivos", "Licença mais frequente"].map((c) => (
                            <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nomesPortais.map(([o, p]) => (
                          <tr key={o} className="border-b border-linha align-top">
                            <td className="px-2 py-1.5 text-carvao">{o}</td>
                            <td className="break-all px-2 py-1.5 text-carvao-muted">{p.url ?? p.origem}</td>
                            <td className="px-2 py-1.5 text-carvao-muted">{p.colhido_em ? carimbo(p.colhido_em) : p.erro ? `sem coleta: ${p.erro}` : "sem coleta"}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{num(p.conjuntos, 0)}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.recursos !== undefined ? num(p.recursos, 0) : "não contados"}</td>
                            <td className="px-2 py-1.5 text-carvao-muted">{p.licenca ?? "não informada"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="rotulo text-mineral">Eixo do estado</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">{cat.eixos.estado}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">Eixo do uso</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">{cat.eixos.uso}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="rotulo text-mineral">Como o arquivo do catálogo é compactado</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">{cat.compactacao}</dd>
                    </div>
                  </dl>
                </SecaoDoPainel>

                <DadosLimitacoes
                  itens={[
                    <>A frequência declarada é o texto da fonte, sem correção; vários conjuntos do ONS trazem a rotina do portal (por exemplo, o horário da atualização) e não uma cadência de novos períodos.</>,
                    <>O estado de recurso, a escada e as datas valem para a execução de {carimbo(cat.gerado_em)}. Conjuntos integrados depois dessa execução só aparecem aqui na próxima.</>,
                    ...prov.limitacoes.map((l) => <TextoDoLeitor key={l} texto={l} />),
                  ]}
                />
                <DadosSeguir
                  ancora="painel-catalogo"
                  proximo={{ href: "/setor-eletrico/dados/saude", pergunta: "O que atrasou ou mudou?" }}
                  downloads={[CSV_DADOS.catalogo, CSV_DADOS.recursosCcee, CSV_DADOS.recursosAneel, CSV_DADOS.recursosOns]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
