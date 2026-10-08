import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AoAparecer } from "@/components/energia/AoAparecer";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosCatalogo, DadosRecursosCcee } from "@/components/energia/DadosCatalogo";
import { DadosEscada } from "@/components/energia/DadosEscada";
import {
  DadosAnalise,
  DadosAuditoria,
  DadosAviso,
  DadosIndisponivel,
  DadosLimitacoes,
  DadosNavegacao,
  DadosRecorte,
  DadosResposta,
  DadosSeguir,
  ReferenciaDados,
} from "@/components/energia/DadosPainel";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { catalogoDados, DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { CSV_DADOS, ESTADOS_ESCADA, ROTULO_ESTADO_DADOS, linhasCatalogo, respostaCatalogo, resumoCatalogo, rotuloTema, uni } from "@/lib/energia/dados";
import { nomeDoConjunto } from "@/lib/energia/dados-ficha";
import { agruparRessalvas, conciliarCatalogoEIntegracoes, ressalvaParaLeitor, textoConciliacao, textoMudancaCatalogo, vereditoCatalogo } from "@/lib/energia/dados-leitor";
import { provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Dados do setor elétrico: quais conjuntos estão de fato validados",
  description:
    "Catálogo dos dados abertos do setor elétrico (ONS, ANEEL, CCEE e outros) com a escada de estados de cada conjunto, do catalogado ao publicado, o uso declarado, os descontinuados e o estado de cada arquivo da CCEE.",
  alternates: { canonical: "/setor-eletrico/dados" },
};

export default function DadosCatalogoPage() {
  const cat = catalogoDados();
  const pub = publicacaoDados();
  if (!cat || !pub) return <DadosIndisponivel atual="dados" />;

  const r = resumoCatalogo(cat);
  const prov = provenienciaDados(pub.proveniencia.catalogo);
  const linhas = linhasCatalogo(cat);
  const porId = new Map(cat.entradas.map((e) => [e.id, e]));
  // o catálogo dá o mesmo endereço de ficha a conjuntos que um módulo integra juntos: a lista tem uma linha por ficha
  const fichas = DATASETS_INTEGRADOS.filter((d, i, todas) => porId.has(d.catalogoId) && todas.findIndex((x) => x.slug === d.slug) === i);
  const conjuntosPorFicha = (slug: string) => cat.entradas.filter((x) => x.slug === slug).length;
  const nomesPortais = Object.entries(cat.portais);
  const acessados = (o: string) => (cat.recursos[o]?.total ?? 0) - (cat.recursos[o]?.por_estado.CATALOGADO ?? 0);
  const estadosComRecurso = ESTADOS_ESCADA.filter((s) => Object.values(cat.recursos).some((x) => (x.por_estado[s] ?? 0) > 0));
  const dadosRecursos = Object.entries(cat.recursos).map(([o, x]) => ({
    orgao: o,
    rotulo: `${o} (${num(x.total, 0)} arquivos)`,
    ...Object.fromEntries(ESTADOS_ESCADA.map((s) => [s, (100 * (x.por_estado[s] ?? 0)) / (x.total || 1)])),
  }));
  const versao = cat.gerado_em;
  const evPublicados = pub.evidencias.conjuntos_publicados;
  const conciliacao = conciliarCatalogoEIntegracoes(cat, pub);
  // a mesma ressalva em vários conjuntos aparece uma vez, no texto; a lista traz só o que é específico de cada um
  const gruposRessalva = agruparRessalvas(r.usadasAbaixo, (e) => e.titulo);
  const ressalvaComum = gruposRessalva[0] && gruposRessalva[0].titulos.length > 1 ? gruposRessalva[0] : null;
  const nomeDaFicha = (d: (typeof fichas)[number]) => {
    const e = porId.get(d.catalogoId)!;
    return nomeDoConjunto(e, pub.conjuntos.filter((c) => c.id.endsWith(`/${d.interno}`))).nome;
  };

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["ONS", "ANEEL", "CCEE"]}
          rotulo="Dados e metodologia"
          titulo="Quais dados estão de fato validados?"
          referencia={<ReferenciaDados processadoEm={cat.gerado_em} referencia={dataBR(pub.referencia.hoje)} extra={<>Listagens oficiais colhidas em {nomesPortais.map(([o, p]) => `${o} ${p.colhido_em ? carimbo(p.colhido_em) : "sem coleta"}`).join("; ")}.</>} />}
        >
          Catalogar é registrar que um conjunto existe, com seus metadados oficiais. Verificar o recurso é acessar um arquivo. Integrar é coletá-lo e guardar a cópia original com a impressão digital do arquivo. Validar é conferir a captura sem checagem
          reprovada. Publicar é alimentar uma base publicada e íntegra. Cada conjunto mostra até onde chegou, com a evidência de cada etapa, e o uso que o observatório faz dele fica à parte. As regras de cada indicador estão na{" "}
          <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
            Metodologia
          </Link>
          .
        </CabecalhoModulo>
        <DadosNavegacao atual="catalogo" />

        <ModoProfundidade>
          <Bloco id="catalogo">
            <PainelEvidencia
              id="painel-catalogo"
              pergunta="Quais dados estão de fato validados?"
              subtitulo={`${num(r.total, 0)} conjuntos · escada do catalogado ao publicado · uso declarado à parte`}
              proveniencia={prov}
              porQueImporta={
                <>
                  Um conjunto citado na página de um indicador pode estar apenas catalogado, ou integrado e ainda sem validação. A escada mostra onde cada um está e impede que catalogar passe por usar: o estado de um conjunto nunca
                  sobe sem a evidência da etapa.
                </>
              }
              oQueMudou={
                <>
                  {textoMudancaCatalogo(cat)}
                  <span data-nivel="analisar">
                    {" "}
                    Listagens colhidas em {nomesPortais.map(([o, p]) => `${o}, ${p.colhido_em ? carimbo(p.colhido_em) : "sem coleta"}`).join("; ")}. O catálogo se atualiza a cada coleta automática, e esta página mostra a de {carimbo(cat.gerado_em)}. A coleta da CCEE usa o mesmo cliente do PLD horário.
                  </span>
                </>
              }
              comoInterpretar={
                <>
                  As colunas Recurso verificado, Integrado, Validado e Publicado dizem sim, não ou falhou. A escada é cumulativa: a contagem de cada etapa soma os conjuntos que a alcançaram ou foram além. Uso declarado é outro eixo (indicador, modelo,
                  conferência, contexto, histórico) e não substitui o estado.
                </>
              }
              naoConcluir={
                <>
                  Que um conjunto publicado esteja atualizado: a atualidade é medida na página de saúde. Que catalogado signifique dado bom: é existência na listagem e licença. Que a contagem de recursos verificados represente a cobertura da fonte:
                  só {num(acessados("ONS"), 0)} dos {num(cat.recursos.ONS?.total ?? 0, 0)} arquivos do ONS foram acessados pelo observatório.
                </>
              }
            >
              <DadosResposta
                painel="P067"
                veredito={vereditoCatalogo(r)}
                prova={evPublicados ? <ComproveNumero evidencia={evPublicados} rotulo="Comprove os conjuntos publicados" endereco="https://scrutiniums.com/setor-eletrico/dados#catalogo" /> : undefined}
              >
                {respostaCatalogo(r)}
              </DadosResposta>

              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero rotulo="Conjuntos catalogados" natureza="CALCULADO" valor={r.total} casas={0} unidade="conjuntos" tamanho="medio" periodo={dataBR(cat.gerado_em.slice(0, 10))} endereco="https://scrutiniums.com/setor-eletrico/dados#catalogo" />
                <Numero rotulo="Com recurso verificado ou além" natureza="CALCULADO" valor={r.cumulativo["RECURSO VERIFICADO"]} casas={0} unidade="conjuntos" tamanho="medio" periodo={dataBR(cat.gerado_em.slice(0, 10))} endereco="https://scrutiniums.com/setor-eletrico/dados#catalogo" />
                <Numero
                  rotulo="Publicados"
                  natureza="CALCULADO"
                  evidencia={evPublicados ?? null}
                  valor={r.cumulativo.PUBLICADO}
                  casas={0}
                  unidade="conjuntos"
                  tamanho="medio"
                  motivoAusencia="O catálogo não foi gerado."
                  endereco="https://scrutiniums.com/setor-eletrico/dados#catalogo"
                />
                <Numero
                  rotulo="Descontinuados pela fonte"
                  natureza="CALCULADO"
                  valor={r.descontinuados}
                  casas={0}
                  unidade={uni(r.descontinuados, "conjunto", "conjuntos")}
                  tamanho="medio"
                  periodo={dataBR(cat.gerado_em.slice(0, 10))}
                  nota={<>{r.descontinuadasPublicadas.length ? `${r.descontinuadasPublicadas.length} segue publicado, como histórico` : "nenhum segue publicado"}</>}
                  endereco="https://scrutiniums.com/setor-eletrico/dados#catalogo"
                />
              </div>
              <DadosRecorte
                periodo={<>listagens de {nomesPortais.map(([o, p]) => `${o} em ${p.colhido_em ? dataBR(p.colhido_em.slice(0, 10)) : "sem coleta"}`).join(", ")}; estados da execução de {dataBR(cat.gerado_em.slice(0, 10))}</>}
                universo={`${num(r.total, 0)} conjuntos de ${r.orgaos} órgãos: ONS, ANEEL, CCEE e as fontes citadas pelos módulos`}
                unidade="conjuntos; arquivos (recursos) por estado"
              />

              <DadosEscada cat={cat} resumo={r} />

              <DadosAviso id="conjuntos-e-integracoes">
                <p className="rotulo text-mineral">Conjuntos e integrações: por que os números diferem do rodapé e da página Saúde</p>
                <p className="mt-1">{textoConciliacao(conciliacao)}</p>
              </DadosAviso>

              {r.usadasAbaixo.length > 0 && (
                <DadosAviso id="em-uso-abaixo">
                  <p className="rotulo text-mineral">Em uso, mas abaixo de publicado</p>
                  <p className="mt-1">
                    {r.usadasAbaixo.length === 1 ? "Este conjunto alimenta" : `Estes ${r.usadasAbaixo.length} conjuntos alimentam`} uma base publicada, mas o estado calculado pelo observatório não passou de recurso verificado: o observatório abriu um arquivo do conjunto e conferiu o formato e o
                    cabeçalho, mas ainda não guarda o histórico dos dados. Por isso o conjunto não conta como publicado, mesmo que o módulo declare o uso.
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
              )}

              <div id="tabela" className="mt-6 scroll-mt-28">
                <DadosCatalogo linhas={linhas} slugsComFicha={fichas.map((d) => d.slug)} versao={versao} />
              </div>

              <DadosLimitacoes
                itens={[
                  <>A frequência declarada é o texto da fonte, sem correção; vários conjuntos do ONS trazem a rotina do portal (por exemplo, o horário da atualização) e não uma cadência de novos períodos.</>,
                  <>
                    O estado de recurso, a escada e as datas valem para a execução de {carimbo(cat.gerado_em)}. Conjuntos integrados depois dessa execução só aparecem aqui na próxima.
                  </>,
                  ...prov.limitacoes.map((l) => <TextoDoLeitor key={l} texto={l} />),
                ]}
              />
              <DadosSeguir
                ancora="painel-catalogo"
                proximo={{ href: "/setor-eletrico/dados/saude", pergunta: "O que atrasou ou mudou?" }}
                downloads={[CSV_DADOS.catalogo, CSV_DADOS.recursosCcee, CSV_DADOS.recursosAneel, CSV_DADOS.recursosOns]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="recursos">
            <DadosAnalise titulo="Recurso a recurso: o estado de cada arquivo, por órgão" id="recurso-a-recurso">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{cat.regra_recurso}</p>
              <GraficoBarras
                titulo="Arquivos de cada portal por estado do recurso (% do total do portal)"
                dados={dadosRecursos}
                chaveCategoria="orgao"
                chaveRotulo="rotulo"
                series={estadosComRecurso.map((s) => ({ id: s, rotulo: ROTULO_ESTADO_DADOS[s], cor: `var(--escala-seq-${ESTADOS_ESCADA.indexOf(s) + 1})` }))}
                unidade="%"
                casas={1}
                orientacao="horizontal"
                empilhado
                alturaCategoria={52}
              />
              <p className="text-xs leading-relaxed text-carvao-muted">
                O estado de um arquivo herda o da integração que o capturou com sha256 (publicado, nos arquivos que alimentam gold); o lido só por requisição parcial está em recurso verificado; os demais, em catalogado. Não existem arquivos nos estados integrado e validado
                isolados porque a captura e a gold são da mesma execução.
              </p>
              <AoAparecer espera="A tabela dos 733 arquivos da CCEE é lida do CSV publicado quando esta seção aparece na tela." botao="Ler a tabela da CCEE agora">
                <DadosRecursosCcee url={CSV_DADOS.recursosCcee.url} versao={versao} />
              </AoAparecer>
            </DadosAnalise>
          </Bloco>

          <Bloco id="descontinuados">
            <DadosAnalise titulo="Descontinuados identificados pela fonte" id="descontinuados-lista">
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
            </DadosAnalise>
          </Bloco>

          <Bloco id="auditoria">
            <DadosAuditoria titulo="Fontes das listagens e regras do catálogo" id="catalogo-auditoria">
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
            </DadosAuditoria>
          </Bloco>
        </ModoProfundidade>

        <section aria-labelledby="fichas-h" className="mt-10 border-t border-linha py-8">
          <h2 id="fichas-h" className="font-serif text-xl text-carvao">
            Fichas dos conjuntos integrados
          </h2>
          <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Cada ficha traz a situação dos dados, a licença, os arquivos para baixar e como citar o conjunto; as mudanças metodológicas, quando há, e as capturas guardadas ficam na própria ficha.
          </p>
          <details className="mt-3">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              Lista das {fichas.length} fichas
            </summary>
            <ul className="mt-2 grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {fichas.map((d) => {
                const e = porId.get(d.catalogoId)!;
                return (
                  <li key={d.slug}>
                    <Link href={`/setor-eletrico/dados/${d.slug}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                      {nomeDaFicha(d)} ({e.orgao}, {rotuloTema(e.tema).toLowerCase()})
                      {conjuntosPorFicha(d.slug) > 1 ? `, com mais ${conjuntosPorFicha(d.slug) - 1}` : ""}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      </main>
    </>
  );
}
