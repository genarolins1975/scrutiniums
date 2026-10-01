import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CargaAnalise, CargaAuditoria, CargaFontes, CargaIndisponivel, CargaNavegacao, CargaSeguir } from "@/components/energia/CargaPagina";
import { CargaPerfil } from "@/components/energia/CargaPerfil";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { NOME_REGIAO, perguntaPainel, rotaPainel, rotuloHora, situacaoAtualidade, textoDiferencaHoraria } from "@/lib/energia/carga";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Carga: MMGD e perfil horário",
  description:
    "Curva de carga horária do ONS, hora do pico por ano, perfil típico por mês e tipo de dia e a decomposição da carga verificada em carga global, MMGD estimada e carga líquida de MMGD, sem misturar os dois produtos do ONS.",
  alternates: { canonical: "/setor-eletrico/carga/perfil-horario" },
};

const FONTE_CURVA = "ONS, Curva de Carga Horária";
const FONTE_API = "ONS, Carga de Energia Verificada (API)";

const ROTULO_CONCEITO: Record<string, string> = {
  carga_curva: "Carga da curva horária",
  carga_global: "Carga global",
  mmgd: "MMGD",
  carga_liquida: "Carga líquida de MMGD",
  dupla_contagem: "Por que não somar nem subtrair",
};

const COLUNAS_COMPAT_ANO: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "horas", rotulo: "Horas comparadas", tipo: "numero", casas: 0 },
  { id: "global_mwmed", rotulo: "Carga global (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "curva_mwmed", rotulo: "Curva de carga", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "diferenca_pct", rotulo: "Global acima da curva", tipo: "percentual", casas: 2 },
];
const COLUNAS_COMPAT_HORA: ColunaTabela[] = [
  { id: "hora", rotulo: "Hora (início)", tipo: "numero", casas: 0 },
  { id: "horas", rotulo: "Horas comparadas", tipo: "numero", casas: 0 },
  { id: "diferenca_mwmed", rotulo: "Global menos curva", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "diferenca_pct", rotulo: "Global acima da curva", tipo: "percentual", casas: 2 },
];
const COLUNAS_A11: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "carga_menos_global", rotulo: "Carga diária menos carga global (API)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "meio_dia_curva_menos_global", rotulo: "Curva menos carga global às 12h", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "mmgd_meio_dia", rotulo: "MMGD da API às 12h", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "solar_balanco", rotulo: "Geração solar do balanço", tipo: "numero", unidade: "MWmed", casas: 0 },
];

export default function PerfilHorarioPage() {
  const g = lerGold<CargaDetalheGold>("carga_detalhe.json");
  if (!integra(g)) return <CargaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const p = g.p026;
  const a11 = g.a11_carga;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(p.ultimo_dia, g.gerado_em);
  const natSeries = g.proveniencia.api.natureza_por_serie;
  const ultimoAno = p.compatibilidade.por_ano.filter((x) => x.sm === "SIN").at(-1);
  const downloads = g.downloads.filter((d) => /horaria|pico|perfil|verificada/.test(d.url));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- campos retirados do que vai ao cliente
  const { compatibilidade: _c, conceitos: _k, ...p026Cliente } = p;
  // hora do pico do dia provado na ficha, lida da mesma série de picos (nunca do texto da ficha)
  const picoEv = p.picos_90d.find((x) => x.d === ev.p026_pico_sin?.periodo?.fim && x.hora !== null) ?? null;
  // onde a carga global da API se afasta da curva, lido da tabela por hora (nunca escrito à mão)
  const porHora = p.compatibilidade.por_hora_sin_365d;
  const diferencaCurva = textoDiferencaHoraria(porHora);
  const diasPorHora = Math.max(0, ...porHora.map((x) => x.horas));

  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Carga"
          titulo="MMGD e perfil horário"
          referencia={
            <>
              ONS, Curva de Carga Horária e Carga de Energia Verificada, até {dataBR(p.ultimo_dia)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A que horas o sistema demanda mais energia, e quanto da carga é atendido por micro e minigeração distribuída (<Termo slug="geracao-distribuida">MMGD</Termo>),
          segundo a estimativa do ONS. O ONS publica dois produtos de carga com definições diferentes: a <Termo slug="curva-de-carga">curva de carga horária</Termo> e a
          carga verificada, com a <Termo slug="carga-global">carga global</Termo> e a <Termo slug="carga-liquida-de-mmgd">carga líquida de MMGD</Termo>. Esta página mostra os
          dois lado a lado e nunca soma nem subtrai um do outro.
        </CabecalhoModulo>
        <CargaNavegacao atual="p026" />
        <ModoProfundidade>
          <Bloco id="perfil">
            <PainelEvidencia
              id="p026"
              pergunta={perguntaPainel("p026")}
              subtitulo="Carga horária da curva e da carga verificada; MMGD estimada e carga líquida de MMGD · MWmed e %"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  A MMGD reduz a energia que o sistema precisa entregar nas horas de sol, e o pico da carga líquida se desloca para o começo da noite. Saber que parte da carga é
                  estimada evita ler a MMGD como medição.
                </>
              }
              oQueMudou={<>{atual.texto}</>}
              comoInterpretar={
                <>
                  Carga global, MMGD e carga líquida vêm da mesma API e fecham por identidade da fonte (global = líquida + MMGD, conferida em cada meia hora). A curva de carga é
                  outro produto, que já inclui uma MMGD estimada sem separá-la; ela aparece em gráfico próprio, alinhado pelo cursor. Hora é a hora local de início; o pico é o
                  maior valor horário do dia (empate: a primeira hora). Dia sem as 24 horas não tem pico.
                </>
              }
              naoConcluir={
                <>
                  A MMGD é estimativa do ONS, não medição: a micro e minigeração não é supervisionada. A parcela de MMGD dentro da curva e da carga diária não é publicada, então
                  não se sabe quanto do pico da curva é MMGD. A carga global da API não substitui a curva{diferencaCurva ? ` (${diferencaCurva})` : ""}.
                </>
              }
              proveniencia={g.proveniencia.api}
              complementares={[{ rotulo: "Curva de carga horária", p: g.proveniencia.curva }]}
            >
              <div className="space-y-6">
                {atual.defasada && (
                  <p role="alert" className="border-l-2 border-aviso pl-3 text-sm text-carvao">
                    {atual.texto}
                  </p>
                )}
                <CargaPerfil
                  p026={p026Cliente}
                  fonteCurva={FONTE_CURVA}
                  fonteApi={FONTE_API}
                  versao={p.ultimo_dia}
                  regimes={g.regimes}
                  diferencaCurva={diferencaCurva}
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Numero
                        rotulo="Parcela da carga global do SIN atendida por MMGD, último mês completo"
                        natureza="ESTIMADO"
                        evidencia={ev.p026_mmgd_mes}
                        formato="pct"
                        casas={1}
                        tamanho="medio"
                        cor="var(--serie-solar)"
                        nota="Estimativa do ONS sobre a carga global da carga verificada, não sobre a curva."
                        endereco={`${rotaPainel("p026")}#p026`}
                      />
                      <Numero
                        rotulo="Pico horário da curva de carga do SIN no dia"
                        natureza="OBSERVADO"
                        evidencia={ev.p026_pico_sin}
                        casas={0}
                        tamanho="medio"
                        cor="var(--cor-energia-dark)"
                        nota={picoEv?.hora != null ? `Às ${rotuloHora(picoEv.hora)} de ${dataBR(picoEv.d)}; a curva inclui MMGD estimada, não separada.` : "Inclui MMGD estimada, não separada."}
                        endereco={`${rotaPainel("p026")}#p026`}
                      />
                    </div>
                  }
                />

                <div className="space-y-3">
                  <h3 className="font-serif text-lg text-carvao">Que carga é cada série</h3>
                  <dl className="grid gap-3 text-sm md:grid-cols-2" data-conceitos="p026">
                    {Object.entries(p.conceitos).map(([k, texto]) => (
                      <div key={k} className="border-l-2 border-linha pl-3">
                        <dt className="font-medium text-carvao">{ROTULO_CONCEITO[k] ?? k}</dt>
                        <dd className="mt-1 leading-relaxed text-carvao-muted">{texto}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {natSeries.map((s) => (
                      <li key={s.serie} className="flex flex-wrap items-center gap-2">
                        <SeloNatureza natureza={s.natureza} />
                        <span>
                          <span className="text-carvao">{s.rotulo}</span>: {s.descricao}
                          {s.componentes.length ? ` Componente: ${s.componentes.map((c) => `${c.descricao} (${c.natureza.toLowerCase()})`).join("; ")}.` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <CargaAnalise id="a11" titulo={`Quando a MMGD entrou na carga: declarada para ${dataBR(a11.declarado)}, observada nos dados em ${dataBR(a11.observado_carga)}`}>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a11">
                    {a11.textos.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <GraficoLinhas
                    titulo="Degraus em torno da data declarada: carga menos carga global, às 12h e no dia"
                    dados={a11.dias}
                    chaveX="d"
                    series={[
                      { id: "meio_dia_curva_menos_global", rotulo: "Curva menos carga global, às 12h", sigla: "12h", cor: "var(--cor-energia)" },
                      { id: "carga_menos_global", rotulo: "Carga diária menos carga global", sigla: "Dia", cor: "var(--serie-referencia)", tracejada: true },
                      { id: "mmgd_meio_dia", rotulo: "MMGD da API às 12h", sigla: "MMGD", cor: "var(--serie-solar)" },
                    ]}
                    unidade="MWmed"
                    casas={0}
                    marcos={[
                      { x: a11.declarado, rotulo: `declarada (${dataBR(a11.declarado)})` },
                      ...(a11.observado_carga && a11.observado_carga !== a11.declarado ? [{ x: a11.observado_carga, rotulo: `observada (${dataBR(a11.observado_carga)})` }] : []),
                    ]}
                    legendaInterativa
                  />
                  <p className="text-sm text-carvao-muted">Regra: {a11.regra}</p>
                  <TabelaInterativa
                    titulo="Tabela equivalente: as séries diárias em torno da data declarada"
                    colunas={COLUNAS_A11}
                    linhas={a11.dias.map((d) => ({ ...d, id: d.d }))}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte="ONS (carga diária, curva horária, carga verificada e balanço de energia)"
                    versao={a11.declarado}
                    nomeArquivo="carga-a11-inclusao-mmgd"
                    chaveUrl="a11"
                  />
                </CargaAnalise>

                <CargaAuditoria id="compatibilidade" titulo="Compatibilidade entre a carga global da API e a curva">
                  <p className="text-sm text-carvao-muted">
                    {p.compatibilidade.conclusao}
                    {ultimoAno && ultimoAno.diferenca_pct !== null
                      ? ` Em ${ultimoAno.ano}, no SIN, a carga global ficou ${num(Math.abs(ultimoAno.diferenca_pct), 2)}% ${ultimoAno.diferenca_pct >= 0 ? "acima" : "abaixo"} da curva nas mesmas ${num(ultimoAno.horas, 0)} horas.`
                      : ""}
                  </p>
                  <TabelaInterativa
                    titulo="Carga global da API contra a curva, mesmas horas, por ano"
                    colunas={COLUNAS_COMPAT_ANO}
                    linhas={p.compatibilidade.por_ano.map((x) => ({ ...x, id: `${x.sm}:${x.ano}`, regiao: NOME_REGIAO[x.sm], ano: String(x.ano) }))}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte={`${FONTE_API}; ${FONTE_CURVA}`}
                    versao={p.ultimo_dia}
                    nomeArquivo="carga-compatibilidade-anual"
                    chaveUrl="compat"
                  />
                  <TabelaInterativa
                    titulo={`SIN, últimos ${plural(diasPorHora, "dia", "dias")}: diferença por hora do dia`}
                    colunas={COLUNAS_COMPAT_HORA}
                    linhas={p.compatibilidade.por_hora_sin_365d.map((x) => ({ ...x, id: String(x.hora) }))}
                    chaveLinha="id"
                    colunaRotulo="hora"
                    fonte={`${FONTE_API}; ${FONTE_CURVA}`}
                    versao={p.ultimo_dia}
                    nomeArquivo="carga-compatibilidade-hora"
                    chaveUrl="compath"
                  />
                  <CargaFontes fontes={g.fontes.filter((f) => f.id === "curva" || f.id === "api")} />
                </CargaAuditoria>

                <CargaSeguir ancora="p026" proximo={{ href: `${rotaPainel("p027")}#p027`, pergunta: perguntaPainel("p027") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
