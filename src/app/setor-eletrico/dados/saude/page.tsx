import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosCalendario, DadosSaudeTabela } from "@/components/energia/DadosSaude";
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
import { carimbo, dataBR, num, pct, plural } from "@/lib/energia/formato";
import { CSV_DADOS, ROTULO_SITUACAO, conjuntosComRevisao, inicioRegistroCapturas, janelaCalendario, linhasSaude, refLegivel, respostaSaude, resumoSaude, situacaoPorCadencia, uni } from "@/lib/energia/dados";
import { provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Saúde das fontes e revisões: o que atrasou ou mudou nos dados do setor elétrico",
  description:
    "Atualidade de cada conjunto integrado pelo prazo da frequência declarada pela fonte, calendário de capturas, falhas e revisões, completude, último período e magnitude das revisões entre capturas.",
  alternates: { canonical: "/setor-eletrico/dados/saude" },
};

export default function DadosSaudePage() {
  const pub = publicacaoDados();
  if (!pub) return <DadosIndisponivel atual="dados" />;

  const r = resumoSaude(pub);
  const prov = provenienciaDados(pub.proveniencia.saude);
  const provRev = provenienciaDados(pub.proveniencia.revisoes);
  const linhas = linhasSaude(pub);
  const cadencias = situacaoPorCadencia(pub);
  const revisados = conjuntosComRevisao(pub);
  const mudancasCadastro = pub.conjuntos.filter((c) => (c.revisoes?.registros?.mudancas ?? 0) > 0);
  const evAtrasados = pub.evidencias.conjuntos_atrasados;
  const evRevisao = pub.evidencias.maior_revisao_relativa;
  const janela = pub.referencia.janela_calendario_dias ?? 120;
  const versao = pub.gerado_em;
  const emDia = r.porSituacao["EM DIA"] ?? 0;
  const inicioRegistro = inicioRegistroCapturas(pub.calendario);
  const jan = janelaCalendario(pub.referencia.hoje, janela);
  const ultimaCaptura = pub.conjuntos.map((c) => c.capturas.ultima).filter((x): x is string => !!x).sort().at(-1);

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados:saude" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Dados e metodologia"
          titulo="O que atrasou ou mudou?"
          referencia={<ReferenciaDados geradoEm={pub.gerado_em} referencia={dataBR(pub.referencia.hoje)} extra={<>Última captura registrada: {ultimaCaptura ? carimbo(ultimaCaptura) : "nenhuma"}.</>} />}
        >
          Cada conjunto integrado tem uma frequência declarada pela fonte e um prazo derivado dela. Esta página mostra quem passou do prazo, quando o pipeline capturou, quando falhou e quanto os valores já publicados mudaram entre capturas. A situação vale para a
          data de referência da publicação, não para o dia em que você lê.
        </CabecalhoModulo>
        <DadosNavegacao atual="saude" />

        <ModoProfundidade>
          <Bloco id="saude">
            <PainelEvidencia
              id="painel-saude"
              pergunta="O que atrasou ou mudou?"
              subtitulo={`${num(r.integracoes, 0)} integrações de conjuntos · situação em ${dataBR(r.hoje)} · calendário dos últimos ${janela} dias`}
              proveniencia={prov}
              complementares={[{ rotulo: "Revisões entre capturas", p: provRev }]}
              porQueImporta={
                <>
                  Um número publicado só vale tanto quanto o dado de que veio. Se a fonte parou de publicar, ou se revisou valores que já tinham sido usados, o leitor precisa saber antes de comparar períodos ou de citar a série.
                </>
              }
              oQueMudou={
                r.comRevisao.length ? (
                  <>
                    {plural(r.comRevisao.length, "conjunto teve", "conjuntos tiveram")} {num(r.observacoesRevisadas, 0)} observações revisadas entre capturas, em {num(r.referenciasRevisadas, 0)} referências (períodos distintos). {r.atrasados.length ? `${plural(r.atrasados.length, "conjunto está", "conjuntos estão")} atrasado${r.atrasados.length === 1 ? "" : "s"}.` : "Nenhum conjunto está atrasado."}
                  </>
                ) : (
                  <>Nenhuma revisão entre capturas foi detectada nesta publicação.</>
                )
              }
              comoInterpretar={
                <>
                  Em dia quer dizer que o período seguinte ao último disponível ainda está dentro do prazo (fim do último período mais a tolerância da cadência). Sem SLA é a fonte que não declara frequência: o pipeline não inventa uma. Revisão é a troca de valor de uma mesma série e
                  referência entre capturas do mesmo arquivo; a captura anterior continua guardada. Atrasado é a fonte sem período novo, e a causa só é afirmada quando a coleta dá evidência.
                </>
              }
              naoConcluir={
                <>
                  Que uma revisão grande seja erro da fonte ou do pipeline: a página mostra o tamanho e as duas capturas, não a causa. Que sem SLA signifique desatualizado. Que a ausência de falha seja saúde da fonte: a primeira captura registrada é de{" "}
                  {dataBR(inicioRegistro ?? pub.referencia.hoje)}.
                </>
              }
            >
              <DadosResposta
                painel="P068"
                prova={
                  <>
                    {evAtrasados && <ComproveNumero evidencia={evAtrasados} rotulo="Comprove os atrasados" endereco="https://scrutiniums.com/setor-eletrico/dados/saude#saude" />}
                    {evRevisao && <ComproveNumero evidencia={evRevisao} rotulo="Comprove a maior revisão" endereco="https://scrutiniums.com/setor-eletrico/dados/saude#saude" />}
                  </>
                }
              >
                {respostaSaude(r)}
              </DadosResposta>

              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero rotulo="Conjuntos em dia" natureza="CALCULADO" valor={emDia} casas={0} unidade="conjuntos" tamanho="medio" periodo={dataBR(r.hoje)} nota={<>de {num(r.integracoes, 0)} integrados</>} endereco="https://scrutiniums.com/setor-eletrico/dados/saude#saude" />
                <Numero
                  rotulo="Conjuntos atrasados"
                  natureza="CALCULADO"
                  evidencia={evAtrasados ?? null}
                  valor={r.atrasados.length}
                  casas={0}
                  unidade={uni(r.atrasados.length, "conjunto", "conjuntos")}
                  tamanho="medio"
                  nota={r.atrasados[0] ? <>{r.atrasados[0].titulo}: {plural(r.atrasados[0].atualidade.dias_atraso ?? 0, "dia", "dias")} além do prazo</> : undefined}
                  motivoAusencia="Sem medida de atraso nesta publicação."
                  endereco="https://scrutiniums.com/setor-eletrico/dados/saude#saude"
                />
                <Numero
                  rotulo="Maior revisão relativa"
                  natureza="CALCULADO"
                  evidencia={evRevisao ?? null}
                  formato="pct"
                  casas={1}
                  tamanho="medio"
                  nota={<>entre duas capturas do mesmo arquivo</>}
                  motivoAusencia="Nenhuma revisão detectada."
                  endereco="https://scrutiniums.com/setor-eletrico/dados/saude#saude"
                />
                <Numero
                  rotulo="Conjuntos com falha de coleta"
                  natureza="CALCULADO"
                  valor={r.comFalha.length}
                  casas={0}
                  unidade={uni(r.comFalha.length, "conjunto", "conjuntos")}
                  tamanho="medio"
                  periodo={dataBR(r.hoje)}
                  nota={<>{num(r.comFalhaRecente, 0)} com falha recente; {num(r.atrasFonte.length, 0)} com arquivo mais novo na fonte</>}
                  endereco="https://scrutiniums.com/setor-eletrico/dados/saude#saude"
                />
              </div>
              <DadosRecorte
                periodo={<>situação em {dataBR(r.hoje)}; calendário de {dataBR(jan.inicio)} a {dataBR(jan.fim)} ({janela} dias)</>}
                universo={`${num(r.integracoes, 0)} integrações de conjuntos feitas pelos módulos (o catálogo conta conjuntos, e um conjunto pode ter mais de uma integração)`}
                unidade="dias de atraso; % de períodos e de séries; contagem de capturas, falhas e observações"
              />
              <GraficoBarras
                titulo={`Situação dos conjuntos por cadência declarada pela fonte, em ${dataBR(r.hoje)}`}
                dados={cadencias.map((c) => ({ ...c, rotulo: c.tolerancia === null ? "Sem cadência" : `${c.rotulo} · ${c.tolerancia} d` }))}
                chaveCategoria="cadencia"
                chaveRotulo="rotulo"
                series={[
                  { id: "EM DIA", rotulo: ROTULO_SITUACAO["EM DIA"], cor: "var(--escala-seq-4)" },
                  { id: "ATRASADO", rotulo: ROTULO_SITUACAO.ATRASADO, cor: "var(--serie-termica)" },
                  { id: "SEM DADO", rotulo: ROTULO_SITUACAO["SEM DADO"], cor: "var(--serie-3)" },
                  { id: "SEM SLA", rotulo: ROTULO_SITUACAO["SEM SLA"], cor: "var(--escala-seq-1)" },
                ]}
                unidade="conjuntos"
                casas={0}
                orientacao="horizontal"
                empilhado
                rotulosValor
                alturaCategoria={48}
              />
              <DadosAviso>
                SLA é o prazo derivado da frequência que a própria fonte declara: diária, 2 dias; semanal, 7; quinzenal, 15; mensal, 60; trimestral, 90; anual, 365, contados do fim do último período disponível. Conjunto sem frequência legível fica sem SLA.
              </DadosAviso>
              <div id="calendario" className="mt-6 scroll-mt-28">
                <h3 className="font-serif text-lg text-carvao">Calendário de atualização e mudanças</h3>
                <div className="mt-3">
                  <DadosCalendario calendario={pub.calendario} hoje={pub.referencia.hoje} janela={janela} />
                </div>
              </div>
              <div id="tabela" className="mt-8 scroll-mt-28">
                <DadosSaudeTabela linhas={linhas} versao={versao} />
              </div>
              <DadosLimitacoes
                itens={[
                  <>A primeira captura registrada é de {dataBR(inicioRegistro ?? pub.referencia.hoje)}: ausência de revisão antes disso não quer dizer que a fonte não revisou, porque o pipeline não tinha como ver.</>,
                  <>
                    A situação vale para {dataBR(r.hoje)}. Os conjuntos novos e as capturas posteriores só entram na próxima execução do pipeline.
                  </>,
                  ...prov.limitacoes,
                ]}
              />
              <DadosSeguir
                ancora="painel-saude"
                proximo={{ href: "/setor-eletrico/dados/reproducao", pergunta: "Consigo reproduzir este gráfico?" }}
                downloads={[CSV_DADOS.conjuntos, CSV_DADOS.calendario, CSV_DADOS.revisoes]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="revisoes">
            <DadosAnalise titulo="Revisões entre capturas: alcance e magnitude" id="revisoes-analise">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{datasLegiveis(pub.regras.revisao)}</p>
              {revisados.length === 0 ? (
                <p className="text-sm text-carvao-muted">Nenhuma revisão de valor entre capturas foi detectada nesta publicação.</p>
              ) : (
                <ul className="space-y-4" data-lista="revisoes">
                  {revisados.map((c) => {
                    const rv = c.revisoes!;
                    const ev = rv.maior_rel;
                    return (
                      <li key={c.id} className="border border-linha bg-superficie p-4">
                        <p className="font-medium text-carvao">{c.titulo}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                          {num(rv.observacoes ?? 0, 0)} observações (pares série e referência) em {num(rv.referencias ?? 0, 0)} referências e {plural(rv.series ?? 0, "série", "séries")}
                          {rv.ref_min && rv.ref_max ? `, de ${refLegivel(rv.ref_min)} a ${refLegivel(rv.ref_max)}` : ""}.
                        </p>
                        {rv.maior_abs && (
                          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                            Maior mudança absoluta: <strong className="font-medium text-carvao">{rv.maior_abs.serie}</strong> em {refLegivel(rv.maior_abs.ref)}, de {num(rv.maior_abs.de, 2)} para {num(rv.maior_abs.para, 2)} (diferença de{" "}
                            {num(rv.maior_abs.diferenca, 2)}, na unidade da série).
                          </p>
                        )}
                        {ev && (
                          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                            Maior mudança relativa: <strong className="font-medium text-carvao">{ev.serie}</strong> em {refLegivel(ev.ref)}, de {num(ev.de, 2)} para {num(ev.para, 2)} ({ev.relativa_pct === null ? "valor anterior zero" : pct(ev.relativa_pct, 1)}). Arquivo {ev.recurso}.
                          </p>
                        )}
                        {ev && (
                          <p className="mt-1 text-xs leading-relaxed text-mineral">
                            O valor anterior vem da captura de {carimbo(ev.capturado_de)} e o novo, da captura de {carimbo(ev.capturado_para)}; as duas continuam guardadas no histórico (só acrescenta), com sha256 do original.
                          </p>
                        )}
                        {rv.conflitos_entre_recursos && (
                          <p className="mt-1 text-xs leading-relaxed text-mineral">
                            Além disso, {plural(rv.conflitos_entre_recursos.referencias, "referência tem", "referências têm")} valores diferentes em arquivos diferentes: não é revisão da fonte e fica à parte.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {mudancasCadastro.length > 0 && (
                <div>
                  <p className="rotulo text-mineral">Mudanças em cadastros e atos entre capturas</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted" data-lista="registros">
                    {mudancasCadastro.map((c) => (
                      <li key={c.id}>
                        {c.titulo}: {plural(c.revisoes!.registros!.mudancas ?? 0, "campo mudou", "campos mudaram")} em {plural(c.revisoes!.registros!.chaves ?? 0, "chave", "chaves")}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </DadosAnalise>
          </Bloco>

          <Bloco id="falhas">
            <DadosAnalise titulo="Falhas de coleta: a data do dado não é renovada" id="falhas-analise">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{datasLegiveis(pub.regras.falha)}</p>
              {r.comFalha.length === 0 ? (
                <p className="text-sm text-carvao-muted">Nenhum conjunto registra falha de coleta nesta publicação.</p>
              ) : (
                <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Conjuntos com falha de coleta (tabela rolável)">
                  <table className="w-full min-w-[46rem] border-collapse text-xs">
                    <caption className="sr-only">Conjuntos com falha de coleta, com o último período e a última captura bem-sucedida</caption>
                    <thead>
                      <tr className="text-left text-mineral">
                        {["Conjunto", "Falhas / tentativas", "Seguidas", "Última falha", "Motivo", "Último período disponível", "Última captura com conteúdo"].map((h) => (
                          <th key={h} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.comFalha.map((c) => (
                        <tr key={c.id} className="border-b border-linha align-top">
                          <td className="px-2 py-1.5 text-carvao">{c.titulo}</td>
                          <td className="px-2 py-1.5 tabular-nums text-carvao-muted">
                            {num(c.coleta.falhas, 0)} / {num(c.coleta.tentativas, 0)}
                          </td>
                          <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{c.coleta.falhas_consecutivas ?? 0}</td>
                          <td className="px-2 py-1.5 text-carvao-muted">{c.coleta.ultima_falha ? carimbo(c.coleta.ultima_falha.tentado_em) : "sem registro"}</td>
                          <td className="px-2 py-1.5 text-carvao-muted [overflow-wrap:anywhere]">{c.coleta.ultima_falha ? datasLegiveis(c.coleta.ultima_falha.detalhe) : "sem registro"}</td>
                          <td className="px-2 py-1.5 text-carvao-muted">{c.atualidade.ultimo_periodo ? refLegivel(c.atualidade.ultimo_periodo) : "sem referência"}</td>
                          <td className="px-2 py-1.5 text-carvao-muted">{c.capturas.ultima ? carimbo(c.capturas.ultima) : "sem captura"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DadosAnalise>
          </Bloco>

          <Bloco id="regras-saude">
            <DadosAuditoria titulo="Regras de atualidade, completude e revisão" id="regras-saude-auditoria">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="rotulo text-mineral">SLA e os cinco casos (A a E)</dt>
                  <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{datasLegiveis(pub.regras.sla_texto)}</dd>
                </div>
                <div>
                  <dt className="rotulo text-mineral">Completude interna e cobertura do último período</dt>
                  <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{datasLegiveis(pub.regras.completude)}</dd>
                </div>
                <div>
                  <dt className="rotulo text-mineral">Captura atrás da fonte</dt>
                  <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{datasLegiveis(pub.regras.captura_atras_da_fonte)}</dd>
                </div>
              </dl>
              <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Tolerância do SLA por cadência (tabela rolável)">
                <table className="w-full min-w-[24rem] border-collapse text-xs">
                  <caption className="sr-only">Tolerância do SLA por cadência declarada</caption>
                  <thead>
                    <tr className="text-left text-mineral">
                      {["Cadência declarada", "Período aproximado", "Tolerância"].map((h) => (
                        <th key={h} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(pub.regras.sla).map(([k, v]) => (
                      <tr key={k} className="border-b border-linha">
                        <td className="px-2 py-1.5 capitalize text-carvao">{k.replace("diaria", "diária")}</td>
                        <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{plural(v.periodo_dias_aprox, "dia", "dias")}</td>
                        <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{plural(v.tolerancia_dias, "dia", "dias")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DadosAuditoria>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
