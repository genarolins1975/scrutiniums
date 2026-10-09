import type { Metadata } from "next";
import { AguaAviso, AguaDatas, AguaFontes, AguaIndisponivel, AguaNavegacao, AguaParteAusente, AguaRegras, AguaSeguir } from "@/components/energia/AguaPagina";
import { AguaReservatorios } from "@/components/energia/AguaReservatorios";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_DECOMPOSICAO_SUBSISTEMAS,
  REVISOES_CAPTURA_UNICA,
  entidadesEar,
  linhasDecomposicaoSubsistemas,
  nomeProprio,
  perguntaPainel,
  rotaPainel,
  situacaoAtualidade,
  textoFechamento,
  textoMudancaDecomposicao,
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
  const fimEar = r?.decomposicao_ear[0]?.fim ?? null;
  // nomes legíveis dos reservatórios sem cadastro quando estão na lista; os demais ficam com o identificador do ONS
  const semCadastroNomes = r?.sem_cadastro.map((id) => {
    const x = r.lista.find((y) => y.id === id);
    return x ? `${nomeProprio(x.nome)} (${id})` : id;
  });
  const oQueMudou = (
    <>
      {atual.texto} {r ? textoMudancaDecomposicao(r.decomposicao_ear) : ""}
    </>
  );
  const comoInterpretar = (
    <>
      A decomposição é uma identidade contábil: a variação do subsistema é a soma das variações dos reservatórios que contam nele (parte própria e parte a jusante), com o resíduo
      publicado. O balanço de cada reservatório é variação observada do volume = afluência − defluência + resíduo, em hm³, com o volume útil do cadastro do ONS. A energia natural
      afluente (ENA) e a geração hidráulica aparecem como contexto: não fecham balanço com a EAR.
    </>
  );
  const naoConcluir = (
    <>
      A afluência publicada pelo ONS é, na maioria dos reservatórios, calculada pelo próprio balanço: resíduo perto de zero não confirma medição de vazão. A variação da EAR não se
      explica só pela ENA, e nenhum balanço é fechado por ajuste: o resíduo fica visível. A convenção da defluência foi detectada nos dados e pode mudar sem aviso.
    </>
  );
  const qualidade = r ? (
    <SecaoDoPainel
      id="qualidade"
      titulo="O balanço dos reservatórios fecha por construção?"
      lead={`Dos ${r.n_reservatorios} reservatórios dos dados hidráulicos do ONS, ${r.n_com_balanco} têm balanço de 30 dias, e ${r.n_fecham_por_construcao} desses fecham por construção: a afluência publicada sai do próprio balanço, e o fechamento não é prova independente. A lista desta página é menor, os reservatórios com EAR máxima positiva.`}
    >
      <FaixaMetricas colunas={2} rotulo="Qualidade do balanço dos reservatórios">
        <Numero
          variante="faixa"
          rotulo="Reservatórios com balanço de 30 dias"
          natureza="CALCULADO"
          valor={r.n_com_balanco}
          formato="num"
          casas={0}
          unidade={`de ${r.n_reservatorios} nos dados hidráulicos`}
          periodo={`${dataBR(r.inicio)} a ${dataBR(r.fim)}`}
        />
        <Numero
          variante="faixa"
          rotulo="Reservatórios que fecham o balanço por construção"
          natureza="CALCULADO"
          evidencia={ev.fecham_por_construcao}
          revisoes={REVISOES_CAPTURA_UNICA}
          valor={r.n_fecham_por_construcao}
          formato="num"
          casas={0}
          unidade={`de ${r.n_com_balanco} com balanço`}
          periodo={r.periodo_fecham_por_construcao ?? undefined}
          nota="Nesses, a afluência publicada sai do próprio balanço: o fechamento não é prova independente."
          endereco={`${rotaPainel("p020")}#qualidade`}
        />
      </FaixaMetricas>
    </SecaoDoPainel>
  ) : null;

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <AguaNavegacao atual="p020" />
        <CabecalhoModulo
          rotulo="Água e clima"
          siglas={["EAR", "ENA", "MWmed", "ONS"]}
          titulo={perguntaPainel("p020")}
          lead="A variação de 30 dias da energia armazenada (EAR) de cada subsistema, repartida por reservatório, e a conta da água de cada um."
          recorte={r ? `EAR até ${dataBR(fimEar)} · balanço até ${dataBR(r.fim)} · MWmês e hm³` : undefined}
          fonte="ONS, EAR e dados hidráulicos por reservatório"
          referencia={
            <>
              ONS, EAR Diário por Reservatório e Dados Hidráulicos por Reservatório, até {dataBR(g.dias_referencia.reservatorios)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <AguaDatas
              itens={[
                { rotulo: "EAR por reservatório (energia derivada pelo ONS)", dia: fimEar, natureza: "OBSERVADO" },
                { rotulo: "Dados hidráulicos (afluência e defluência derivadas pelo ONS)", dia: g.dias_referencia.reservatorios, natureza: "OBSERVADO" },
              ]}
            />
          }
        >
          A <Termo slug="ear">EAR</Termo> de um subsistema é a soma da energia guardada em cada reservatório, em <Unidade u="MWmês" />; a parte &ldquo;própria&rdquo; de um reservatório é a energia que a
          água dele produz na própria usina, e a parte &ldquo;a jusante&rdquo;, a que ela produz nas usinas rio abaixo, na cascata. Esta página mostra quais reservatórios
          explicam a variação de 30 dias e, em cada um, a conta da água, em hm³ (milhões de metros cúbicos): o que entrou (afluência), o que saiu (defluência, pelas turbinas,
          pelos vertedouros e por outras estruturas) e o resíduo, a diferença que sobra quando a conta não fecha.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="reservatorios">
            <PainelEvidencia
              id="p020"
              pergunta="Quais reservatórios pesaram na variação da energia armazenada?"
              subtitulo="Variação da EAR por reservatório, em MWmês, e a conta da água de cada um"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Saber que a EAR caiu não diz onde nem por quê. A soma reservatório por reservatório localiza a queda, e o balanço de cada um mostra se a água saiu pelas
                  turbinas, pelos vertedouros ou se a afluência diminuiu, com o resíduo à vista.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
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
                    armazenamento={entidadesEar(g.armazenamento)}
                    urlSeries={r.series_45d.arquivo}
                    diasSeries={r.series_45d.dias}
                    fonte={FONTE}
                    versao={r.fim}
                    notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                    qualidade={qualidade}
                    semCadastro={r.sem_cadastro}
                    evidenciaResiduo={ev.balanco_maior_reservatorio}
                    enderecoBalanco={`${rotaPainel("p020")}#balanco`}
                  />
                ) : (
                  <>
                    <AguaParteAusente
                      titulo="Reservatórios indisponíveis nesta publicação"
                      motivo={g.pendencias.filter((p) => /reservat/i.test(p)).join("; ") || "O bloco de reservatórios não foi construído nesta execução; nenhum número de reserva é exibido."}
                    />
                    <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  </>
                )}

                {r && (
                  <SecaoDoPainel id="decomposicao" nivel="analisar" titulo="Os quatro subsistemas: variação da EAR, soma dos reservatórios e contexto">
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
                  </SecaoDoPainel>
                )}

                {r && (
                  <SecaoDoPainel id="regras-p020" nivel="auditar" titulo="Regras, cobertura, fontes e arquivos">
                    <AguaRegras regras={g.regras} chaves={["balanco_reservatorio", "decomposicao_ear", "capacidade"]} />
                    <p className="text-sm text-carvao-muted">{textoSemCadastro(semCadastroNomes ?? [])}</p>
                    <p className="text-sm text-carvao-muted">{r.criterio_lista}.</p>
                    <AguaFontes provs={[prov.balanco, prov.capacidade]} />
                  </SecaoDoPainel>
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
