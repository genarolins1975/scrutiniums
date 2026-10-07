import type { Metadata } from "next";
import {
  AguaAnalise,
  AguaAuditoria,
  AguaAviso,
  AguaFontes,
  AguaIndisponivel,
  AguaNavegacao,
  AguaParteAusente,
  AguaRegras,
  AguaSeguir,
} from "@/components/energia/AguaPagina";
import { AguaReservatorios } from "@/components/energia/AguaReservatorios";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_DECOMPOSICAO_SUBSISTEMAS,
  linhasDecomposicaoSubsistemas,
  nomeProprio,
  perguntaPainel,
  rotaPainel,
  situacaoAtualidade,
  textoFechamento,
  textoSemCadastro,
} from "@/lib/energia/agua";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Água e clima: por que o armazenamento mudou",
  description:
    "Variação da energia armazenada de cada subsistema decomposta por reservatório e balanço hídrico de 30 dias de cada reservatório do ONS, com afluência, defluência, turbinamento, vertimento, transferência e resíduo explícito.",
  alternates: { canonical: "/setor-eletrico/agua-e-clima/reservatorios" },
};

const FONTE = "ONS, Dados Hidráulicos por Reservatório (base diária) e Reservatórios (cadastro)";

export default function ReservatoriosPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const r = g.reservatorios;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const atual = situacaoAtualidade(g.dias_referencia.reservatorios, g.gerado_em, 3, "o ONS publica os dados hidráulicos do dia anterior");
  const downloads = g.downloads.filter((d) => /agua_reservatorios|agua_capacidade/.test(d.url));

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["EAR", "ENA", "MWmed"]}
          rotulo="Água e clima"
          titulo="Reservatórios e balanço"
          referencia={
            <>
              ONS, EAR Diário por Reservatório e Dados Hidráulicos por Reservatório, até {dataBR(g.dias_referencia.reservatorios)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A <Termo slug="ear">EAR</Termo> de um subsistema é a soma da energia guardada em cada reservatório. Esta página mostra quais reservatórios explicam a variação de 30
          dias e, em cada um, a conta da água: o que entrou, o que saiu pelas turbinas, pelos vertedouros e por outras estruturas, e o resíduo que sobra quando a conta não fecha.
        </CabecalhoModulo>
        <AguaNavegacao atual="p020" />
        <ModoProfundidade>
          <Bloco id="reservatorios">
            <PainelEvidencia
              id="p020"
              pergunta={perguntaPainel("p020")}
              subtitulo="Variação da EAR por reservatório (MWmês) e balanço hídrico de 30 dias (hm³) · afluência, defluência, turbinado, vertido, transferência e resíduo"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Saber que a EAR caiu não diz onde nem por quê. A soma reservatório por reservatório localiza a queda, e o balanço de cada um mostra se a água saiu pelas
                  turbinas, pelos vertedouros ou se a afluência diminuiu, com o resíduo à vista.
                </>
              }
              oQueMudou={<>{atual.texto}</>}
              comoInterpretar={
                <>
                  A decomposição é uma identidade contábil: a variação do subsistema é a soma das variações dos reservatórios que contam nele (parte própria e parte a jusante),
                  com o resíduo publicado. O balanço de cada reservatório é variação observada do volume = afluência − defluência + resíduo, em hm³, com o volume útil do
                  cadastro do ONS. ENA e geração hidráulica aparecem como contexto: não fecham balanço com a EAR.
                </>
              }
              naoConcluir={
                <>
                  A afluência publicada pelo ONS é, na maioria dos reservatórios, calculada pelo próprio balanço: resíduo perto de zero não confirma medição de vazão. A variação da
                  EAR não se explica só pela ENA, e nenhum balanço é fechado por ajuste: o resíduo fica visível. A convenção da defluência foi detectada nos dados e pode mudar sem
                  aviso.
                </>
              }
              proveniencia={prov.balanco!}
              complementares={prov.capacidade ? [{ rotulo: "EAR por reservatório (decomposição)", p: prov.capacidade }] : []}
            >
              <div className="space-y-6">
                {atual.defasada && <AguaAviso tipo="alerta">{atual.texto}</AguaAviso>}
                {r ? (
                  <AguaReservatorios
                    lista={r.lista}
                    decomposicao={r.decomposicao_ear}
                    janela={{ inicio: r.inicio, fim: r.fim, periodo_fecham_por_construcao: r.periodo_fecham_por_construcao }}
                    urlSeries={r.series_45d.arquivo}
                    diasSeries={r.series_45d.dias}
                    fonte={FONTE}
                    versao={r.fim}
                    destaques={
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Numero
                          rotulo="Resíduo do balanço de 30 dias no reservatório de maior volume útil"
                          natureza="CALCULADO"
                          evidencia={ev.balanco_maior_reservatorio}
                          formato="num"
                          casas={2}
                          unidade="hm³"
                          tamanho="medio"
                          cor="var(--serie-hidraulica)"
                          nota={ev.balanco_maior_reservatorio ? `${ev.balanco_maior_reservatorio.entidade}: variação observada menos afluência mais defluência.` : undefined}
                          endereco={`${rotaPainel("p020")}#p020`}
                        />
                        <Numero
                          rotulo="Reservatórios que fecham o balanço por construção"
                          natureza="CALCULADO"
                          evidencia={ev.fecham_por_construcao}
                          valor={r.n_fecham_por_construcao}
                          formato="num"
                          casas={0}
                          unidade={`de ${r.n_com_balanco} com balanço`}
                          periodo={r.periodo_fecham_por_construcao ?? undefined}
                          tamanho="medio"
                          cor="var(--serie-referencia)"
                          nota="Nesses, a afluência publicada sai do próprio balanço: o fechamento não é prova independente."
                          endereco={`${rotaPainel("p020")}#p020`}
                        />
                      </div>
                    }
                  />
                ) : (
                  <AguaParteAusente
                    titulo="Reservatórios indisponíveis nesta publicação"
                    motivo={g.pendencias.filter((p) => /reservat/i.test(p)).join("; ") || "O bloco de reservatórios não foi construído nesta execução; nenhum número de reserva é exibido."}
                  />
                )}

                {r && (
                  <AguaAnalise id="decomposicao" titulo="Os quatro subsistemas: variação da EAR, soma dos reservatórios e contexto">
                    <TabelaInterativa
                      titulo="Decomposição da variação de 30 dias da EAR por subsistema"
                      colunas={COLUNAS_DECOMPOSICAO_SUBSISTEMAS}
                      linhas={linhasDecomposicaoSubsistemas(r.decomposicao_ear)}
                      chaveLinha="id"
                      colunaRotulo="sm"
                      fonte="ONS, EAR Diário por Reservatório e por Subsistema; ENA Diário por Subsistema; Balanço de Energia"
                      versao={r.decomposicao_ear[0]?.fim ?? r.fim}
                      nomeArquivo="agua-decomposicao-subsistemas"
                      nota="ENA e geração hidráulica são médias da mesma janela, mostradas como contexto: estão em MWmed e não fecham balanço com a variação da EAR em MWmês."
                    />
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="fechamento">
                      {textoFechamento(r)}
                    </p>
                  </AguaAnalise>
                )}

                {r && (
                  <AguaAuditoria id="regras-p020" titulo="Regras, cobertura, fontes e arquivos">
                    <AguaRegras regras={g.regras} chaves={["balanco_reservatorio", "decomposicao_ear", "capacidade"]} />
                    <p className="text-sm text-carvao-muted">{textoSemCadastro(r.sem_cadastro.map(nomeProprio))}</p>
                    <p className="text-sm text-carvao-muted">{r.criterio_lista}.</p>
                    <AguaFontes provs={[prov.balanco, prov.capacidade]} />
                  </AguaAuditoria>
                )}

                <AguaSeguir ancora="p020" proximo={{ href: `${rotaPainel("p017")}#p017`, pergunta: perguntaPainel("p017") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
