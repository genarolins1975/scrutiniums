import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RedeCirculacao } from "@/components/energia/RedeCirculacao";
import { RedeAuditoria, RedeAviso, RedeIndisponivel, RedeNavegacao, RedeRecorte, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, mesAno, num } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COBERTURA,
  COLUNAS_ESQUEMA_NACIONAL,
  COLUNAS_ULTIMO_ANO,
  COR_PAR,
  FRONTEIRAS,
  PERGUNTA_MODULO_REDE,
  ROTULO_REGRA,
  curtoFronteira,
  linhasCobertura,
  linhasEsquemaNacional,
  linhasUltimoAno,
  nomeFronteira,
  paraTabela,
  perguntaPainel,
  provenienciaLegivel,
  rotaPainel,
  situacaoAtualidade,
  textoCobertura,
  textoConferenciaSilver,
  textoOrientacaoArquivos,
} from "@/lib/energia/rede";
import { textoAmplitude, textoFluxos30d } from "@/lib/energia/resumos";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
/** Descrição com o início do histórico lido da gold (nenhuma data escrita à mão). */
export function generateMetadata(): Metadata {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  const desde = integra(g) && g.circulacao.mensal.meses.length ? ` desde ${mesAno(g.circulacao.mensal.meses[0])}` : "";
  return {
    title: "Rede: como a energia circula entre as regiões",
    description: `Energia em cada sentido e saldo de cada fronteira entre subsistemas (ONS), por dia e por hora, com o programa e o PLD da mesma hora (CCEE), exportação e importação brutas por subsistema e histórico mensal${desde}.`,
    alternates: { canonical: "/setor-eletrico/rede" },
  };
}

const FONTE = "ONS, Intercâmbios Entre Subsistemas (releitura do módulo Rede)";
/** Anos cujos arquivos de fronteira trazem o programado, lidos do esquema da fonte publicado na gold. */
const anosComProgramado = (g: GoldRedeDetalhe) =>
  g.esquema_fonte.intercambio_nacional
    .filter((x) => x.tem_programado)
    .map((x) => x.recurso.replace(/\D/g, ""))
    .join(" e ") || "nenhum ano";
const COLUNAS_SALDOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Subsistema", tipo: "texto" },
  { id: "dia", rotulo: "Saldo no dia (positivo = exporta)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "media_30d", rotulo: "Média de 30 dias", tipo: "numero", unidade: "MWmed", casas: 0 },
];

export default function RedePage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const r = gold.rede();
  const pld = gold.pld();
  const c = g.circulacao;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const downloads = [
    ...g.downloads.filter((d) => /fronteiras_diario|subsistemas_diario|horario_20/.test(d.url)),
    { rotulo: "Janela horária de 7 dias (JSON)", url: c.janela_horaria.url },
  ];
  const resumo = c.resumo_30d;
  // as mesmas linhas nos dois gráficos e na tabela equivalente do último ano
  const ultimoAno = integra(r) ? linhasUltimoAno(r.serie_fluxos, r.serie_amplitude_pld) : [];

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 sm:px-6">
        <CabecalhoModulo siglas={["SIN", "PLD", "ONS", "CCEE"]}
          rotulo="Rede"
          titulo={PERGUNTA_MODULO_REDE}
          referencia={
            <>
              ONS, intercâmbios entre subsistemas e com outros países, até {horaLocal(g.referencia.ultima_hora_fluxo)}; PLD horário da CCEE até{" "}
              {g.referencia.ultima_hora_pld ? horaLocal(g.referencia.ultima_hora_pld) : "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A energia passa de uma região para outra pelas linhas de transmissão de fronteira; o ONS publica, hora a hora, o <Termo slug="intercambio">intercâmbio</Termo> verificado em
          quatro fronteiras entre <Termo slug="submercado">subsistemas</Termo> e, no arquivo de {anosComProgramado(g)}, também o programado. Quatro painéis: como a energia circula, de onde vem a diferença entre os balanços,
          que evidência de restrição é publicada e quanto o fluxo se afastou do programa. Os limites operativos de cada fronteira não são públicos; por isso nenhum painel diz que a
          rede estava no limite. Fluxo em <Unidade u="MWmed" />, energia em MWh.
        </CabecalhoModulo>
        <RedeNavegacao atual="p028" />
        <ModoProfundidade>
          <Bloco id="circulacao">
            <PainelEvidencia
              id="p028"
              pergunta={perguntaPainel("p028")}
              subtitulo="Energia em cada sentido, saldo por fronteira e subsistema, por dia e por hora · MWh e MWmed"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  O saldo de um dia diz para onde a energia foi no total; a energia em cada sentido mostra quanto passou nos dois sentidos ao longo das horas. Um saldo pequeno
                  pode esconder muita energia indo e voltando, e é isso que separa uma fronteira de fluxo estável de uma que muda de sentido.
                </>
              }
              oQueMudou={<>{atual.texto}</>}
              comoInterpretar={
                <>
                  Cada fronteira tem um sentido positivo no nome (Norte → Nordeste, Norte → Sudeste/Centro-Oeste, Nordeste → Sudeste/Centro-Oeste e Sul → Sudeste/Centro-Oeste);
                  saldo negativo é energia no sentido contrário. Energia escondida pelo saldo é o menor dos dois sentidos. Cada valor horário em MWmed vale a mesma quantidade em
                  MWh. Na escala horária, o PLD de cada região é o da mesma hora do fluxo.
                </>
              }
              naoConcluir={
                <>
                  Que alguma fronteira estava no limite ou congestionada: os limites operativos e as suas vigências não são públicos, e nem a espessura da seta nem a diferença de
                  preço demonstram saturação. O fluxo de cada linha de transmissão também não é publicado: sentidos opostos em linhas diferentes da mesma fronteira, na mesma hora,
                  não aparecem.
                </>
              }
              proveniencia={provenienciaLegivel(g.proveniencia.fluxo)}
              complementares={[
                { rotulo: "Exportação e importação por subsistema", p: provenienciaLegivel(g.proveniencia.subsistemas) },
                { rotulo: "PLD nas duas pontas na mesma hora", p: provenienciaLegivel(g.proveniencia.pld_na_hora) },
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeCirculacao
                  circulacao={{ diario: c.diario, resumo_30d: c.resumo_30d, mensal: c.mensal, subsistemas_diario: c.subsistemas_diario, janela_horaria: c.janela_horaria }}
                  fonte={FONTE}
                  versao={versao}
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {FRONTEIRAS.map((par) => (
                        <Numero
                          key={par}
                          rotulo={`Energia escondida pelo saldo de 30 dias, ${nomeFronteira(par)}`}
                          natureza="CALCULADO"
                          evidencia={ev[`contra_saldo_30d.${par}`] ?? null}
                          casas={0}
                          tamanho="medio"
                          cor={COR_PAR[par]}
                          motivoAusencia="Sem fluxo publicado na janela de 30 dias."
                          nota={(() => {
                            const x = resumo.find((y) => y.par === par);
                            return x ? `${num(x.liquido_mwh >= 0 ? x.horas_inverso : x.horas_canonico, 0)} de ${num(x.horas, 0)} horas no sentido contrário ao saldo.` : undefined;
                          })()}
                          endereco={`${rotaPainel("p028")}#p028`}
                        />
                      ))}
                    </div>
                  }
                />

                <RedeAuditoria id="p028-regras" titulo="Regras de leitura publicadas com os dados">
                  <RedeRegras
                    regras={(["orientacao", "energia", "bruto_liquido", "nulo", "pld", "limites"] as const).map((k) => ({ rotulo: ROTULO_REGRA[k], texto: g.regras[k] }))}
                  />
                </RedeAuditoria>

                <RedeAuditoria id="p028-fonte" titulo="Como cada arquivo anual do ONS publica as fronteiras">
                  <p className="text-sm text-carvao-muted">
                    {textoOrientacaoArquivos(g.esquema_fonte)} O módulo converte cada linha para a orientação do nome da fronteira, verificado e programado com o mesmo
                    sinal. O dicionário do conjunto não descreve a mudança.
                  </p>
                  <TabelaInterativa
                    titulo="Arquivos do conjunto Intercâmbios Entre Subsistemas"
                    colunas={COLUNAS_ESQUEMA_NACIONAL}
                    linhas={paraTabela(linhasEsquemaNacional(g.esquema_fonte))}
                    chaveLinha="id"
                    colunaRotulo="recurso"
                    fonte="ONS, Intercâmbios Entre Subsistemas"
                    versao={versao}
                    nomeArquivo="rede-esquema-fonte"
                    chaveUrl="esq"
                  />
                </RedeAuditoria>

                <RedeAuditoria id="p028-cobertura" titulo="Cobertura e conferência com o outro coletor">
                  <p className="text-sm text-carvao-muted">{textoCobertura("Fronteiras", g.cobertura.fronteiras, g.cobertura)}</p>
                  <TabelaInterativa
                    titulo="Dias sem as 24 horas nas fronteiras"
                    colunas={COLUNAS_COBERTURA}
                    linhas={paraTabela(linhasCobertura(g.cobertura.fronteiras))}
                    chaveLinha="id"
                    colunaRotulo="dia"
                    fonte="ONS, Intercâmbios Entre Subsistemas"
                    versao={versao}
                    nomeArquivo="rede-cobertura-fronteiras"
                    chaveUrl="cob"
                    semLinhas="Todos os dias têm as 24 horas nas quatro fronteiras."
                  />
                  <p className="text-sm text-carvao-muted">{textoConferenciaSilver("Fronteiras", g.conferencia_silver_principal?.ons_rede_intercambio_nacional)}</p>
                </RedeAuditoria>

                <RedeSeguir ancora="p028" proximo={{ href: `${rotaPainel("p029")}#p029`, pergunta: perguntaPainel("p029") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>

          {integra(r) && (
            <Bloco id="ultimo-ano" nivel="analisar">
              <PainelEvidencia
                id="fluxo-e-preco"
                pergunta="Como o fluxo diário e a diferença entre os preços evoluíram no último ano?"
                subtitulo={`Fluxo médio diário por fronteira (MWmed) e diferença entre o maior e o menor PLD médio diário (R$/MWh), até ${dataBR(r.dia_referencia)}`}
                natureza="CALCULADO"
                porQueImporta={
                  <>
                    Um ano de dias mostra como o sentido e o volume dos fluxos variam ao longo das estações e em que dias os preços médios das regiões se separaram, no
                    mesmo eixo de datas. A página não atribui essas variações a causas.
                  </>
                }
                oQueMudou={
                  <>
                    {textoFluxos30d(r)} {textoAmplitude(r.resumo_amplitude)}
                  </>
                }
                comoInterpretar={
                  <>
                    Os dois gráficos têm o mesmo eixo de dias e a mesma cruz. A diferença de preço usa o PLD médio de cada dia: separações de poucas horas podem sumir na
                    média, e a escala horária do painel acima mostra o preço da mesma hora. A tabela traz também o saldo de cada região no balanço de energia do ONS no último dia.
                  </>
                }
                naoConcluir={<>Qual fronteira causou a separação de preços, nem se alguma estava no limite: os limites operativos não são públicos.</>}
                proveniencia={r.proveniencia.fluxo}
                complementares={[
                  { rotulo: "Diferença entre o maior e o menor PLD médio diário", p: r.proveniencia.amplitude },
                  ...(integra(pld) ? [{ rotulo: "Sobre o PLD médio diário", p: pld.proveniencia.diario }] : []),
                  ...(r.proveniencia.saldos ? [{ rotulo: "Saldo de cada região no balanço do ONS", p: r.proveniencia.saldos }] : []),
                ]}
              >
                <div className="space-y-6">
                  <RedeAviso>
                    Série da rotina diária de operação do observatório (outro coletor), com referência até {dataBR(r.dia_referencia)} para o fluxo e até{" "}
                    {dataBR(r.ultimo_dia_pld)} para o PLD; o painel acima usa a releitura do módulo, até {dataBR(g.referencia.dia)}.
                  </RedeAviso>
                  <RedeRecorte
                    periodo={ultimoAno.length ? `${dataBR(ultimoAno[0].d)} a ${dataBR(ultimoAno[ultimoAno.length - 1].d)}, por dia` : "sem dias publicados"}
                    universo="As quatro fronteiras entre subsistemas (fluxo) e os quatro submercados (PLD)"
                    unidade="MWmed (fluxo médio do dia); R$/MWh (diferença entre PLDs médios do dia)"
                  />
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo="Fluxo médio diário por fronteira (positivo no sentido do nome)"
                      dados={ultimoAno}
                      chaveX="d"
                      formatoX="data"
                      series={FRONTEIRAS.map((p) => ({ id: p, rotulo: nomeFronteira(p), sigla: curtoFronteira(p), cor: COR_PAR[p] }))}
                      unidade="MWmed"
                      casas={0}
                      zeroNoEixo
                      legendaInterativa
                    />
                    <GraficoLinhas
                      titulo="Diferença entre o maior e o menor PLD médio diário dos quatro submercados"
                      dados={ultimoAno}
                      chaveX="d"
                      formatoX="data"
                      series={[{ id: "amplitude", rotulo: "Maior menos menor PLD médio", cor: "var(--cor-energia)" }]}
                      unidade="R$/MWh"
                      casas={2}
                      zeroNoEixo
                    />
                  </CursorSincronizado>
                  <TabelaInterativa
                    titulo="Tabela equivalente: fluxo médio e diferença de preço por dia"
                    colunas={COLUNAS_ULTIMO_ANO}
                    linhas={paraTabela(ultimoAno)}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte="ONS, Intercâmbios Entre Subsistemas; CCEE, PLD horário"
                    versao={r.dia_referencia}
                    nomeArquivo="rede-fluxo-e-preco-ultimo-ano"
                    chaveUrl="ano"
                    ordemInicial={{ coluna: "d", direcao: "desc" }}
                  />
                  <TabelaInterativa
                    titulo={`Saldo de cada região no balanço de energia do ONS em ${dataBR(r.dia_referencia_liquido)}`}
                    colunas={COLUNAS_SALDOS}
                    linhas={r.liquido_subsistemas.map((l) => ({ id: l.sm, nome: l.nome, dia: l.dia, media_30d: l.media_30d }))}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte="ONS, Balanço de Energia nos Subsistemas"
                    versao={r.dia_referencia_liquido ?? r.dia_referencia}
                    nomeArquivo="rede-saldos-balanco"
                    chaveUrl="sal"
                    nota="O saldo do balanço é conferido hora a hora com as fronteiras e o exterior no painel Balanço e exterior."
                  />
                </div>
              </PainelEvidencia>
            </Bloco>
          )}
        </ModoProfundidade>
      </main>
    </>
  );
}
