import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco } from "@/components/energia/CabecalhoModulo";
import { LinhaDoTempo } from "@/components/energia/LinhaDoTempo";
import { PldLimites } from "@/components/energia/PldLimites";
import {
  PldAnalise,
  PldAuditoria,
  PldAviso,
  PldCabecalho,
  PldControles,
  PldIndisponivel,
  PldNavegacao,
  PldPassagem,
  PldSeguir,
} from "@/components/energia/PldPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  CATEGORIAS_ATOS,
  COLUNAS_ATOS,
  COLUNAS_CONFERENCIAS,
  COLUNAS_REGIMES,
  SUBMERCADOS,
  anosPermanencia,
  atualidadePld,
  eventosAtos,
  linhasAtos,
  linhasConferencias,
  linhasRegimes,
  perguntaPainel,
  proximoPainel,
} from "@/lib/energia/pld";
import { fichasPld } from "@/lib/energia/pld-arquivos";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "PLD: limites, piso e tetos",
  description:
    "Piso, teto horário e teto estrutural do PLD em cada ano, com o ato da ANEEL, a vigência e o nível de conferência de cada valor; calendário dos dias no limite, permanência por ano e empates no piso, com a tolerância monetária documentada.",
  alternates: { canonical: "/setor-eletrico/pld/limites" },
};

const FONTE = "CCEE, PLD_HORARIO; ANEEL, atos anuais de limites do PLD";

export default function PldLimitesPage() {
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const l = g.limites;
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const anoRef = Number(g.referencia.dia.slice(0, 4));
  const passagensLimites = g.conceito.fontes_textuais.filter((f) => ["d5163_art57_p1", "d5163_art57_p2", "d5163_art57_p3", "ren957_art78"].includes(f.id) && f.texto);

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <PldCabecalho
          titulo="Limites, piso e tetos"
          referencia={
            <>
              CCEE (PLD até {dataBR(g.referencia.dia)}) e atos anuais da ANEEL{l.disponivel ? ` (${num(l.atos.length, 0)} atos de ${l.atos[0]?.ano ?? ""} a ${l.atos[l.atos.length - 1]?.ano ?? ""})` : ""}; processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
        >
          A ANEEL fixa, a cada ano, três limites para o PLD: o piso (valor mínimo), o teto horário (o máximo de cada hora) e o teto estrutural. Este painel mostra quando o preço
          encostou em cada um, com os valores lidos no ato e a vigência de cada campo.
        </PldCabecalho>
        <PldNavegacao atual="p010" />
        <ModoProfundidade>
          <Bloco id="limites">
            {!l.disponivel ? (
              <Indisponivel
                titulo="Limites do PLD indisponíveis nesta publicação"
                motivo={
                  <>
                    {l.motivo} Dependência: {l.dependencia}. O menor valor observado não substitui o piso, por isso o painel não mostra permanência sem os atos.
                  </>
                }
              />
            ) : (
              <PainelEvidencia
                id="p010"
                pergunta={perguntaPainel("p010")}
                subtitulo="Horas no piso e no teto horário, dias com média no teto estrutural · horas e % das horas"
                porQueImporta={
                  <>
                    No piso e nos tetos, o PLD deixa de acompanhar o custo e passa a ser o limite do ato. Saber quanto tempo o preço passou em cada limite muda a leitura de médias,
                    percentis e diferenças entre regiões.
                  </>
                }
                oQueMudou={
                  <>
                    {atual.texto} Limites vigentes desde {dataBR(l.regimes[l.regimes.length - 1]?.inicio)}: {l.regimes[l.regimes.length - 1]?.ato_pld_min ?? "ato não identificado"}.
                  </>
                }
                comoInterpretar={
                  <>
                    Hora no piso é a hora em que o PLD é igual ao piso do ato ao centavo; o mesmo para o teto horário. O teto estrutural é conferido sobre a média das 24 horas do
                    dia. Um centavo acima do piso já é outro preço e fica contado à parte. Cada ano é comparado com o próprio piso.
                  </>
                }
                naoConcluir={
                  <>
                    Permanência no piso não diz que o custo de operar foi baixo nem por quê: diz que o preço calculado ficou no mínimo do ato. O menor valor observado num ano é só
                    conferência e nunca substitui o piso. Ano parcial não se compara a ano completo sem ressalva.
                  </>
                }
                proveniencia={g.proveniencia.limites ?? g.proveniencia.distribuicao}
                complementares={[{ rotulo: "Sobre a distribuição por regime", p: g.proveniencia.distribuicao }]}
              >
                <div className="space-y-6">
                  {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                  <PldLimites
                    l={{ permanencia_anual: l.permanencia_anual, regimes: l.regimes, empates_piso: l.empates_piso, calendario: l.calendario, tolerancia: l.tolerancia }}
                    anos={anosPermanencia(l)}
                    diaReferencia={g.referencia.dia}
                    fichas={fichasPld(g.evidencias.arquivo, SUBMERCADOS.map((sm) => `piso_${anoRef}_${sm}`))}
                    fonte={FONTE}
                    versao={versao}
                  />

                  <PldAnalise id="atos" titulo="Os atos anuais, com publicação e vigência">
                    <PldAviso>{l.conferencia_atos.leitura}</PldAviso>
                    <LinhaDoTempo titulo="Atos da ANEEL que fixaram os limites do PLD" eventos={eventosAtos(l.atos)} categorias={CATEGORIAS_ATOS} ordem="cronologica" />
                    <TabelaInterativa
                      titulo="Limites por trecho de vigência (o que vale em cada dia)"
                      colunas={COLUNAS_REGIMES}
                      linhas={linhasRegimes(l.regimes)}
                      chaveLinha="id"
                      colunaRotulo="inicio"
                      fonte="ANEEL, atos anuais de limites do PLD"
                      versao={versao}
                      nomeArquivo="pld-limites-vigencia"
                      chaveUrl="vig"
                      nota="Em cada dia, cada limite vem do ato vigente mais recente que informa aquele campo; o último trecho vai até o dia de referência."
                    />
                  </PldAnalise>

                  <PldAuditoria id="atos-conferencia" titulo="Cada ato, o documento lido e o nível de conferência">
                    <TabelaInterativa
                      titulo="Atos de limites do PLD"
                      colunas={COLUNAS_ATOS}
                      linhas={linhasAtos(l.atos)}
                      chaveLinha="id"
                      colunaRotulo="ato"
                      fonte="ANEEL (via módulo Regulação)"
                      versao={versao}
                      nomeArquivo="pld-atos-limites"
                      chaveUrl="atos"
                    />
                    {l.conferencia_atos.pendencias.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                        {l.conferencia_atos.pendencias.map((p) => (
                          <li key={`${p.ano}:${p.item}`}>
                            {p.ano}: {p.item} ({p.situacao}).
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="space-y-2">
                      <p className="rotulo text-mineral">Trecho literal de cada ato ou documento do processo</p>
                      {l.atos.map((a) => (
                        <blockquote key={`${a.ato}:${a.ano}`} className="border-l-2 border-energia pl-3 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
                          <p>“{a.trecho ?? "trecho não publicado"}”</p>
                          <footer className="mt-1 text-xs text-carvao-muted">
                            {a.ato}, {a.dispositivo ?? "dispositivo não identificado"}.{" "}
                            <a href={a.documento_url ?? a.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                              endereço oficial
                            </a>
                            {a.documento_copia ? (
                              <>
                                {"; "}
                                <a href={a.documento_copia} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                                  cópia lida
                                </a>
                              </>
                            ) : null}
                          </footer>
                        </blockquote>
                      ))}
                    </div>
                  </PldAuditoria>

                  <PldAuditoria id="norma-limites" titulo="O que a norma diz sobre os limites">
                    {passagensLimites.map((p) => (
                      <PldPassagem key={p.id} p={p} />
                    ))}
                    <PldAviso>{l.nota_teto_estrutural}</PldAviso>
                  </PldAuditoria>

                  <PldAuditoria id="tolerancia" titulo="Tolerância monetária: por que igualdade ao centavo">
                    <p className="text-sm leading-relaxed text-carvao">{l.tolerancia.regra}</p>
                    <p className="text-sm leading-relaxed text-carvao-muted">{l.tolerancia.justificativa}</p>
                  </PldAuditoria>

                  <PldAuditoria id="menor-observado" titulo="Conferência: menor e maior valor observado contra o ato">
                    <p className="text-sm text-carvao-muted">{l.regra_menor_observado}</p>
                    <TabelaInterativa
                      titulo="Menor e maior PLD horário observado por ano e submercado, contra os limites dos atos"
                      colunas={COLUNAS_CONFERENCIAS}
                      linhas={linhasConferencias(l)}
                      chaveLinha="id"
                      colunaRotulo="ano"
                      fonte={FONTE}
                      versao={versao}
                      nomeArquivo="pld-conferencia-atos"
                      chaveUrl="conf"
                    />
                  </PldAuditoria>

                  <PldAuditoria id="controles" titulo="Controles automáticos da construção">
                    <PldControles controles={g.controles.filter((x) => /limite|Ato|piso/i.test(x.nome))} />
                  </PldAuditoria>

                  <PldSeguir ancora="p010" proximo={proximoPainel("p010")} downloads={g.downloads.filter((d) => /limites_diario/.test(d.url))} />
                </div>
              </PainelEvidencia>
            )}
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
