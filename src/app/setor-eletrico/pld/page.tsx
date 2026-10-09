import { linhasArquivo, resumoRodadas, rotuloTipo, textoMotivo } from "@/lib/energia/previsoes";
import { lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";
import { fraseDeRecusa, semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Conferido } from "@/components/evidencia/Conferido";
import { CartoesPld } from "@/components/energia/CartoesPld";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import type { NoComEstado } from "@/components/energia/DiagramaFormacao";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PldFormacao } from "@/components/energia/PldFormacao";
import { PldAviso, PldCapitulos, PldDatas, PldNavegacao, PldPassagem, PldRecorte, PldSeguir } from "@/components/energia/PldPagina";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { PldPeriodos, type PeriodoPld } from "@/components/energia/PldPeriodos";
import { IlustracaoDistribuicao } from "@/components/energia/IlustracaoDistribuicao";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { carimbo, dataBR, horaLocal, num, reais, rotuloRegra } from "@/lib/energia/formato";
import { textoAmplitude } from "@/lib/energia/resumos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { NOS_FORMACAO, PLD_NAO_E, TIPOS_RELACAO } from "@/lib/energia/conteudo/pld";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { CONTRASTES } from "@/lib/energia/conteudo/complementos";
import { estadoCarga, estadoEar, estadoEna, estadoPld } from "@/lib/energia/leituras";
import type { PldGold } from "@/lib/energia/tipos";
import type { PldDetalheGold, RegimeLimites } from "@/lib/energia/tipos-pld";
import {
  COR_SM,
  NOME_SM,
  documentosCitados,
  estadoRenovaveisBalanco,
  estadoTermicasBalanco,
  extremosMediaDiaria,
  horasPorSentidoNoDia,
  intervaloSemanaOperativa,
  ligacoesFormacao,
  linhasMediaDiaria,
  nomesDosSubmercados,
  notaDoisPercentis,
  perguntaPainel,
  pontesSeparacao,
  proximoPainel,
  provenienciaSemRessalvaObsoleta,
  regimeVigenteEm,
  resumoLigacoes,
  respostaP008,
  rotaPainel,
  semCodigoHttp,
  semRessalvaDeLimitesNaoAuditados,
  textoEmpatesMediaDiaria,
  textoHidraulicaBalanco,
  textoLimitesVigentes,
  textoMenorValorEPiso,
  textoMudancaMediaDiaria,
  textoReferenciaDistancia,
  textoRegimesDistribuicao,
  textoSentidoNoDia,
  variacaoComumDoGrupo,
  vereditoMediaDiaria,
  vereditoP008,
} from "@/lib/energia/pld";
import { horarioRecentePld } from "@/lib/energia/pld-arquivos";
import { snapshotLegivel, datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "PLD: o preço horário da energia por submercado, explicado",
  description:
    "O que é o PLD, o que ele não é, de onde vem o preço, o que aconteceu no último dia publicado nos quatro submercados e o estado real da previsão, com fonte, regra e limitação em cada número.",
  alternates: { canonical: "/setor-eletrico/pld" },
};

/** Capítulo da abertura que não é painel de evidência: linha fina, rótulo, título em serifa e o conteúdo; a âncora fica no bloco. */
function Capitulo({ id, rotulo, titulo, children }: { id: string; rotulo: string; titulo: string; children: ReactNode }) {
  return (
    <Bloco id={id}>
      <section aria-labelledby={`${id}-h`} className="border-t border-linha pt-6">
        <p className="rotulo text-mineral">{rotulo}</p>
        <h2 id={`${id}-h`} className="ed-h2 mt-1 max-w-3xl font-serif text-carvao">
          {titulo}
        </h2>
        <div className="mt-6 space-y-6">{children}</div>
      </section>
    </Bloco>
  );
}

function periodos(p: PldGold): PeriodoPld[] {
  const x = (arr: Record<string, unknown>[], chave: string) =>
    arr.map((r) => ({ x: String(r[chave]), SE: r.SE as number | null, S: r.S as number | null, NE: r.NE as number | null, N: r.N as number | null }));
  const h30 = x(p.horario_30d as unknown as Record<string, unknown>[], "t");
  const curva = p.curva_horaria.horas.map((r) => ({ x: `${p.curva_horaria.dia}T${r.h}`, SE: r.SE, S: r.S, NE: r.NE, N: r.N }));
  const diario = x(p.diario as unknown as Record<string, unknown>[], "d");
  const mensal = x(p.mensal as unknown as Record<string, unknown>[], "m");
  const base = (id: keyof PldGold["periodos"], rotulo: string, serie: Record<string, string | number | null>[], formatoX: PeriodoPld["formatoX"], descricaoSerie: string): PeriodoPld => ({
    id,
    rotulo,
    inicio: p.periodos[id].inicio,
    fim: p.periodos[id].fim,
    nHoras: p.periodos[id].n_horas,
    stats: p.periodos[id].por_submercado,
    diferenca: p.periodos[id].diferenca,
    serie,
    formatoX,
    descricaoSerie,
  });
  return [
    base("hoje", `Dia ${dataBR(p.dia_referencia).slice(0, 5)}`, curva, "hora", `curva horária de ${dataBR(p.dia_referencia)} (valores observados)`),
    base("7d", "7 dias", h30.slice(-168), "hora", "valores horários (observados)"),
    base("30d", "30 dias", h30, "hora", "valores horários (observados)"),
    base("12m", "12 meses", diario.slice(-365), "data", "médias diárias (calculadas)"),
    base("historico", "Histórico", mensal, "mes", "médias mensais desde jan/2021 (calculadas; mês corrente parcial)"),
  ];
}

const ligacaoTexto = "underline underline-offset-4 text-energia-dark hover:text-carvao";

/** Como o PLD e a conta de luz se relacionam, na frase do registro de contrastes do observatório (a mesma que o verbete usa). */
const LIGACAO_COM_A_CONTA =
  CONTRASTES.find((c) => c.a === "pld" && c.b === "tarifa-te-tusd")?.texto ??
  "O PLD é o preço das diferenças liquidadas no Mercado de Curto Prazo. A conta do consumidor atendido pela distribuidora segue a TE e a TUSD, que a ANEEL homologa, mais bandeira e tributos.";

export default function PldPage() {
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const carga = gold.carga();
  const rede = gold.rede();
  const cmo = gold.cmo();
  // limites oficiais (atos anuais da ANEEL, com vigência) publicados pelo módulo PLD
  const detalhe = lerGold<PldDetalheGold>("pld_detalhe.json");
  const limDet = integra(detalhe) && detalhe.limites.disponivel ? detalhe.limites : null;
  // o trecho de limites que vale no dia de referência (e não simplesmente o último da lista)
  const diaRef = integra(pld) ? pld.dia_referencia : integra(detalhe) ? detalhe.referencia.dia : null;
  const regimeVigente: RegimeLimites | null = limDet && diaRef ? regimeVigenteEm(limDet.regimes, diaRef) : null;
  const prev = gold.previsoes();
  const mods = gold.modelos();
  const cPld = conceito("pld");

  const semanaRef = integra(detalhe) ? detalhe.cmo_pld.semana_referencia : null;

  const estados: Record<string, NoComEstado["estado"]> = {
    afluencias: estadoEna(hid) ? { texto: estadoEna(hid)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da ENA", href: "/setor-eletrico/agua-e-clima/afluencia#p018" } } : null,
    reservatorios: estadoEar(hid) ? { texto: estadoEar(hid)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da EAR", href: "/setor-eletrico/agua-e-clima#ear" } } : null,
    carga: estadoCarga(carga) ? { texto: estadoCarga(carga)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da carga", href: "/setor-eletrico/carga" } } : null,
    // participações do Balanço de Energia do ONS, cuja solar inclui a MMGD estimada: o texto diz isso e o selo é Estimado
    renovaveis: estadoRenovaveisBalanco(ger) ? { texto: estadoRenovaveisBalanco(ger)!, natureza: "ESTIMADO", historico: { rotulo: "Matriz por janela", href: "/setor-eletrico/geracao" } } : null,
    termicas: estadoTermicasBalanco(ger) ? { texto: estadoTermicasBalanco(ger)!, natureza: "ESTIMADO", historico: { rotulo: "Térmicas em contexto", href: "/setor-eletrico/geracao#termica" } } : null,
    rede: integra(rede)
      ? {
          texto: `Em ${dataBR(rede.dia_referencia)}: ${rede.fronteiras
            .map((f) => {
              if (f.fluxo_dia === null) return `${f.de} e ${f.para} sem dado`;
              const [o, d] = f.fluxo_dia >= 0 ? [f.de, f.para] : [f.para, f.de];
              return `${o}→${d} ${num(Math.abs(f.fluxo_dia), 0)} MWmed`;
            })
            .join("; ")}. Limites de intercâmbio não integrados.`,
          natureza: "CALCULADO",
          historico: { rotulo: "Intercâmbios", href: "/setor-eletrico/rede" },
        }
      : null,
    otimizacao: null,
    cmo: integra(cmo)
      ? {
          // a semana mais recente publicada pelo ONS e a última semana completa nos três produtos (a da tabela de Analisar) são semanas diferentes: as duas vêm com o intervalo
          texto: `CMO semanal do DECOMP publicado pelo ONS para a semana operativa de ${dataBR(intervaloSemanaOperativa(cmo.semana_referencia).inicio)} a ${dataBR(cmo.semana_referencia)} (a mais recente): ${cmo.ultima_semana.map((s) => `${s.sm === "SE" ? "SE/CO" : s.sm} ${reais(s.semanal)}`).join("; ")} por MWh.${semanaRef ? ` A tabela deste capítulo compara a última semana completa nos três produtos, de ${dataBR(semanaRef.inicio)} a ${dataBR(semanaRef.fim)}.` : ""}`,
          // natureza vem da proveniência da gold (ESTIMADO: resultado do modelo DECOMP), nunca escrita aqui
          natureza: cmo.proveniencia.cmo.natureza,
          historico: { rotulo: "Série do CMO", href: "#cmo" },
        }
      : null,
    limites: regimeVigente
      ? {
          texto: `Limites oficiais vigentes desde ${dataBR(regimeVigente.inicio)}: piso ${reais(regimeVigente.pld_min)}/MWh, teto horário ${reais(regimeVigente.pld_max_horario)}/MWh e teto estrutural ${reais(regimeVigente.pld_max_estrutural)}/MWh (${regimeVigente.ato_pld_min ?? "ato não identificado"}).`,
          natureza: "OBSERVADO",
        }
      : null,
    pld: estadoPld(pld) ? { texto: estadoPld(pld)!, natureza: "CALCULADO", historico: { rotulo: "O que está acontecendo", href: "#hoje" } } : null,
  };
  const nos: NoComEstado[] = NOS_FORMACAO.map((n) => ({ ...n, estado: estados[n.id] ?? null }));

  const amplitude = integra(rede) ? rede.serie_amplitude_pld.map((a) => ({ x: a.d, amp: a.amplitude })) : [];
  const ult = prev?.atual?.ultima_execucao;
  // P008: ligações do diagrama conferidas nas passagens normativas e técnicas da gold do módulo
  const conceitoDet = integra(detalhe) ? detalhe.conceito : null;
  const ligacoes = conceitoDet ? ligacoesFormacao(NOS_FORMACAO, conceitoDet.fontes_textuais) : null;
  const resumoLig = ligacoes ? resumoLigacoes(ligacoes) : null;
  const docs = conceitoDet ? documentosCitados(conceitoDet) : null;
  const passagem = (id: string) => conceitoDet?.fontes_textuais.find((f) => f.id === id && f.texto) ?? null;
  const exemplo = conceitoDet?.exemplo_liquidacao ?? null;
  const bloqueioCcee = conceitoDet?.bloqueios.find((b) => b.fonte.startsWith("CCEE")) ?? null;
  const bloqueioCepel = conceitoDet?.bloqueios.find((b) => b.fonte.startsWith("CEPEL")) ?? null;
  // o histórico de previsões é o mesmo arquivo da página de previsões: as contagens saem do CSV completo, não do trecho legado da gold
  const csvEmissoes = lerCsvPrevisoes("/energia/series/previsoes_emissoes.csv");
  const linhasEmissoes = csvEmissoes ? linhasArquivo(csvEmissoes.linhas, Object.fromEntries((mods?.modelos ?? []).map((m) => [m.codigo, m.estado]))) : [];
  const rodadasEmissoes = resumoRodadas(linhasEmissoes);
  const notaPercentis = integra(detalhe) && integra(pld) ? notaDoisPercentis(pld.cartoes.find((c) => c.sm === "SE"), detalhe.historico.posicao_referencia.find((x) => x.sm === "SE")) : null;

  // abertura: a média diária de cada submercado, os extremos (com os empates) e a distância entre as regiões, todos da mesma lista
  const medias = integra(pld) ? linhasMediaDiaria(pld.cartoes) : [];
  const extremos = extremosMediaDiaria(medias);
  const referenciaDistancia = integra(pld) && integra(rede) ? textoReferenciaDistancia(rede.resumo_amplitude, pld.dia_referencia) : null;
  const empates = extremos ? textoEmpatesMediaDiaria(extremos) : null;

  // ponte entre os dois critérios de diferença entre submercados (R$ 1,00 aqui; R$ 0,01 em Diferenças regionais): só nos períodos em que a
  // gold regional tem a mesma janela (mesmas horas e mesma contagem acima de R$ 1,00, que a própria gold publica igual nas duas)
  const pontesRegional = integra(detalhe) ? pontesSeparacao(detalhe.regional) : {};
  const pontes =
    integra(pld) && integra(detalhe)
      ? Object.fromEntries(
          (["30d", "12m"] as const).flatMap((id) => {
            const a = detalhe.regional.amplitude.find((x) => x.periodo === id);
            const per = pld.periodos[id];
            return a && pontesRegional[id] && a.horas === per.n_horas && a.horas_acima_1 === per.diferenca.horas_acima_limiar ? [[id, pontesRegional[id]] as const] : [];
          }),
        )
      : {};
  const notaMenorValor = limDet ? textoMenorValorEPiso(limDet.conferencias) : null;
  const textoRegimes = limDet ? textoRegimesDistribuicao(limDet) : null;
  // o mapa de submercados usa o último dia com fluxo publicado para o preço e para o fluxo: o mesmo dia nas duas medidas
  const recHorario = integra(detalhe) ? horarioRecentePld(detalhe.horario_recente.url) : null;
  const diaDoFluxo = integra(rede) ? rede.dia_referencia : null;
  const diarioDoFluxo = integra(pld) && diaDoFluxo ? pld.diario.find((x) => x.d === diaDoFluxo) : undefined;
  const sentidosNoDia = recHorario && diaDoFluxo ? horasPorSentidoNoDia(recHorario, diaDoFluxo) : [];

  const faixaAbertura =
    integra(pld) && extremos ? (
      <FaixaMetricas
        colunas={3}
        rotulo="Média diária do PLD: menor e maior entre os submercados e a distância entre elas"
        nota={
          <>
            <span className="font-medium text-carvao">Média diária:</span> {pld.regras.media_diaria} Não existe um PLD único do Brasil: cada submercado tem o seu preço, e a
            média simples dos quatro não é publicada pela CCEE.
          </>
        }
      >
        {(
          [
            ["Menor média diária", extremos.menor],
            ["Maior média diária", extremos.maior],
          ] as const
        ).map(([rotulo, e]) => {
          const variacao = variacaoComumDoGrupo(medias, e.submercados);
          return (
            <Numero
              key={rotulo}
              variante="faixa"
              rotulo={rotulo}
              natureza="CALCULADO"
              valor={e.valor}
              formato="reais"
              casas={2}
              unidade="R$/MWh"
              periodo={`${nomesDosSubmercados(e.submercados)}${e.submercados.length > 1 && extremos.distancia > 0 ? " (mesmo valor)" : ""} · ${dataBR(pld.dia_referencia)}`}
              cor={e.submercados.length === 1 ? COR_SM[e.submercados[0]] : undefined}
              variacao={variacao === null ? undefined : { valor: variacao, casas: 2, sufixo: " R$/MWh", referencia: "em relação ao dia anterior" }}
            />
          );
        })}
        <Numero
          variante="faixa"
          rotulo="Distância entre regiões"
          natureza="CALCULADO"
          valor={extremos.distancia}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={`maior menos menor · ${dataBR(pld.dia_referencia)}`}
          nota={referenciaDistancia ?? undefined}
        />
      </FaixaMetricas>
    ) : null;

  // notas do painel de abertura: o que mudou (dia anterior e histórico da distância), como interpretar (regra e limites vigentes) e o que não concluir
  const oQueMudouPrecos = integra(pld) ? (
    <>{textoMudancaMediaDiaria(pld.dia_referencia, medias)}</>
  ) : (
    <>Sem dia com as 24 horas publicadas nos quatro submercados nesta publicação.</>
  );
  const comoInterpretarPrecos = (
    <>
      O PLD valora, no mercado de curto prazo, as diferenças entre a energia contratada e a verificada de cada agente, e a CCEE o calcula para cada hora e cada submercado. Cada
      barra é a média simples das 24 horas do dia em um submercado, em valores nominais; a escala começa em zero e é a mesma nas quatro. {regimeVigente ? textoLimitesVigentes(regimeVigente) : "Os limites vigentes não estão integrados nesta publicação."}
    </>
  );
  const naoConcluirPrecos = (
    <>
      O PLD não é a tarifa nem a conta de luz: PLD, CMO, tarifa e fatura são medidas diferentes (veja{" "}
      <a href="#o-que-e" className={ligacaoTexto}>
        o que o PLD não é
      </a>{" "}
      e a página{" "}
      <Link href="/setor-eletrico/conta-de-luz" className={ligacaoTexto}>
        Conta de luz
      </Link>
      ). A média do dia não mostra a variação das horas, que está abaixo, e este painel não diz para onde o preço vai.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CCEE", "CMO", "MWmed", "ENA", "EAR", "CVU", "ONS", "ANEEL", "REN"]}
          titulo="Quanto custa a energia no curto prazo?"
          lead="O Preço de Liquidação das Diferenças (PLD), calculado pela CCEE para cada hora e para cada submercado: a média do último dia publicado e a distância entre as regiões."
          recorte={integra(pld) ? `${dataBR(pld.dia_referencia)} · quatro submercados · médias diárias · R$/MWh nominais` : undefined}
          fonte="CCEE, PLD horário por submercado"
          referencia={
            integra(pld) ? (
              <>
                CCEE (PLD horário até {horaLocal(pld.ultima_hora)})
                {integra(rede) ? `, ONS (intercâmbio entre subsistemas até ${dataBR(rede.dia_referencia)})` : ""}
                {limDet ? " e ANEEL (atos anuais dos limites do PLD)" : ""}; processado em {carimbo(pld.gerado_em)}.
              </>
            ) : undefined
          }
          datas={
            integra(pld) ? (
              <PldDatas
                itens={[
                  { rotulo: "PLD horário", ate: `até ${horaLocal(pld.ultima_hora)}`, natureza: "OBSERVADO" },
                  { rotulo: "Média diária", ate: dataBR(pld.dia_referencia), natureza: "CALCULADO" },
                  { rotulo: "Intercâmbio entre subsistemas (mapa)", ate: integra(rede) ? `até ${dataBR(rede.dia_referencia)}` : null, natureza: "OBSERVADO" },
                  ...(integra(detalhe) ? [{ rotulo: "CMO semanal (DECOMP)", ate: `até a semana de ${dataBR(detalhe.referencia.ultima_semana_decomp)}`, natureza: "ESTIMADO" as const }] : []),
                  ...(regimeVigente ? [{ rotulo: "Limites vigentes", ate: `desde ${dataBR(regimeVigente.inicio)}`, natureza: "OBSERVADO" as const }] : []),
                ]}
              />
            ) : undefined
          }
          metricas={faixaAbertura}
        />
        <PldNavegacao atual="p008" />

        <ModoProfundidade>
          {/* 1. Os preços: a média do dia em cada submercado, a série horária, o dia em detalhe e a separação entre as regiões */}
          <Bloco id="hoje">
            {integra(pld) && extremos ? (
              <PainelEvidencia
                id="precos"
                pergunta="A média do dia em cada submercado, na mesma escala"
                subtitulo="Média das 24 horas de cada submercado no último dia publicado · R$/MWh nominais"
                porQueImporta={
                  <>
                    O PLD valora as diferenças entre a energia contratada e a verificada; quando os submercados têm preços diferentes, a mesma diferença vale mais em uma região
                    do que em outra. A média diária resume as 24 horas de cada região e permite compará-las na mesma escala, mas não substitui o perfil horário, que vem logo
                    abaixo.
                  </>
                }
                oQueMudou={oQueMudouPrecos}
                comoInterpretar={comoInterpretarPrecos}
                naoConcluir={naoConcluirPrecos}
                naoConcluirNoCorpo
                proveniencia={provenienciaSemRessalvaObsoleta(pld.proveniencia.diario)}
                extraFonte={<>Captura primária de {carimbo(pld.proveniencia.horario.capturado_em)}.</>}
                complementares={[
                  { rotulo: "Sobre o PLD horário", p: provenienciaSemRessalvaObsoleta(pld.proveniencia.horario) },
                  ...(pld.proveniencia.estatisticas ? [{ rotulo: "Sobre as estatísticas do período", p: provenienciaSemRessalvaObsoleta(pld.proveniencia.estatisticas) }] : []),
                  ...(pld.proveniencia.mensal ? [{ rotulo: "Sobre as médias mensais", p: provenienciaSemRessalvaObsoleta(pld.proveniencia.mensal) }] : []),
                  { rotulo: "Sobre a posição histórica", p: provenienciaSemRessalvaObsoleta(pld.proveniencia.posicao) },
                  ...(integra(rede)
                    ? [
                        { rotulo: "Sobre os fluxos", p: rede.proveniencia.fluxo },
                        { rotulo: "Sobre a diferença entre o maior e o menor PLD médio", p: rede.proveniencia.amplitude },
                      ]
                    : []),
                ]}
              >
                <div className="space-y-6">
                  {/* a faixa de métricas já traz a resposta em números: o gráfico vem primeiro e a resposta em palavras logo depois dele */}
                  <div className="space-y-3">
                    <GraficoBarras
                      titulo={`Média diária do PLD por submercado, ${dataBR(pld.dia_referencia)}`}
                      dados={medias.map((m) => ({ id: m.id, rotulo: m.nome, media: m.media }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "media", rotulo: "Média diária", cor: "var(--cor-energia)" }]}
                      unidade="R$/MWh"
                      casas={2}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <p className="text-xs leading-relaxed text-carvao-muted" data-texto="empates-media-diaria">
                      Escala iniciada em zero e igual para os quatro submercados. {empates}
                    </p>
                  </div>

                  <RespostaCurta id="hoje" depois veredito={vereditoMediaDiaria(pld.dia_referencia, extremos)}>
                    <p>{pld.regras.dia_referencia}</p>
                    <p className="mt-1">{pld.regras.media_diaria}</p>
                    <p className="mt-1">
                      Empate é igualdade nos centavos exibidos: se mais de um submercado tem a maior ou a menor média, todos aparecem. A distância é a maior média menos a menor,
                      calculada sobre esses valores.
                    </p>
                  </RespostaCurta>

                  <NotasDoPainel oQueMudou={oQueMudouPrecos} comoInterpretar={comoInterpretarPrecos} naoConcluir={naoConcluirPrecos} />

                  <PldCapitulos />

                  <SecaoDoPainel id="periodos" titulo="Em que horas o preço sobe, e as regiões se separam?" lead="PLD por submercado · R$/MWh nominais · hora local de Brasília.">
                    <PldPeriodos
                      periodos={periodos(pld)}
                      limiar={pld.limiar_diferenca}
                      ponte={pontes}
                      regimes={limDet?.regimes ?? []}
                      fonte="CCEE, PLD horário por submercado"
                      versao={pld.dia_referencia}
                      notaMenorValor={notaMenorValor}
                    />
                    <NotasDoPainel
                      oQueMudou={<>Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh entre submercados.</>}
                      comoInterpretar={<>Alterne os períodos. O dia de referência, 7 e 30 dias mostram horas; 12 meses mostra médias diárias; o histórico, médias mensais desde 2021.</>}
                      naoConcluir={
                        <>
                          Uma posição alta ou baixa no histórico não diz para onde o preço vai. Anos diferentes têm limites regulatórios diferentes (piso e tetos de cada ano, com o
                          ato da ANEEL, no modo Auditar e na página de limites).
                        </>
                      }
                    />
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p010")}#p010`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {perguntaPainel("p010")} Calendário e permanência no piso e nos tetos
                      </Link>
                    </p>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="dia-em-detalhe" titulo="O dia em detalhe, por submercado" lead="Faixa horária observada, variação contra o dia anterior e posição da média entre as médias diárias desde 2021.">
                    <CartoesPld pld={pld} />
                    <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                      <span className="rotulo mr-1 text-mineral">O que não é possível concluir:</span>
                      a posição no histórico não diz para onde o preço vai, e a faixa horária mostra os extremos de um único dia. Faixa horária: valores observados; média, variação e
                      percentil: calculados.
                    </p>
                    {textoRegimes && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="nominal-e-regimes">
                        <span className="rotulo mr-1 text-mineral">Percentil e faixas:</span>
                        {textoRegimes}{" "}
                        <Link href={`${rotaPainel("p010")}#p010`} className="text-energia-dark underline underline-offset-4">
                          Ver os limites de cada ano
                        </Link>
                        . A série semanal do PLD de 2001 a 2020, que a CCEE também publica, tem outra granularidade e ainda não está integrada: as referências começam em janeiro de 2021.
                      </p>
                    )}
                    {notaPercentis && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="dois-percentis">
                        {notaPercentis}{" "}
                        <Link href={`${rotaPainel("p011")}#p011`} className="text-energia-dark underline underline-offset-4">
                          Ver o Histórico
                        </Link>
                        .
                      </p>
                    )}
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p011")}#p011`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {perguntaPainel("p011")} Percentis da mesma época e médias ponderadas
                      </Link>
                    </p>
                  </SecaoDoPainel>

                  {/* a separação entre as regiões: o mapa, o texto que a explica e a série da distância entre o maior e o menor PLD médio */}
                  <SecaoDoPainel id="submercados" titulo="Por que os preços dos submercados podem diferir?">
                    {integra(rede) ? (
                      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="min-w-0">
                          <MapaSubmercados
                            fluxos={rede.fronteiras.map((f) => ({ de: f.de, para: f.para, fluxo: f.fluxo_dia }))}
                            precos={
                              diarioDoFluxo
                                ? { SE: diarioDoFluxo.SE, S: diarioDoFluxo.S, NE: diarioDoFluxo.NE, N: diarioDoFluxo.N }
                                : Object.fromEntries(pld.cartoes.map((c) => [c.sm, c.media_dia]))
                            }
                            diaFluxo={dataBR(rede.dia_referencia)}
                            diaPreco={diarioDoFluxo ? dataBR(rede.dia_referencia) : dataBR(pld.dia_referencia)}
                          />
                          {diarioDoFluxo && rede.dia_referencia !== pld.dia_referencia && (
                            <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-texto="mapa-mesmo-dia">
                              O último dia com PLD é {dataBR(pld.dia_referencia)}; o fluxo do ONS está publicado até {dataBR(rede.dia_referencia)}. O mapa usa o dia {dataBR(rede.dia_referencia)}{" "}
                              para o preço e para o fluxo, e as setas mostram o sentido da média do dia.
                            </p>
                          )}
                          {sentidosNoDia.some((x) => x.horas > 0) && (
                            <div className="mt-2 text-xs leading-relaxed text-carvao-muted" data-texto="horas-por-sentido">
                              <p className="font-medium text-carvao">Horas em cada sentido em {dataBR(rede.dia_referencia)}, no arquivo horário do ONS:</p>
                              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                {sentidosNoDia.map((x) => {
                                  const t = textoSentidoNoDia(x);
                                  return t ? <li key={x.fronteira}>{t}</li> : null;
                                })}
                              </ul>
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                            <span>Fonte: CCEE (PLD) e ONS (intercâmbio). O mapa não mostra limites de transferência nem explica diferenças de preço.</span>
                          </div>
                          <TabelaDados
                            titulo="Dados do mapa: PLD médio por submercado e fluxo por fronteira"
                            colunas={["Item", "Valor", "Unidade", "Dia"]}
                            linhas={[
                              ...pld.cartoes.map((c) => [`PLD médio, ${c.nome}`, c.media_dia, "R$/MWh", dataBR(pld.dia_referencia)] as (string | number | null)[]),
                              ...rede.fronteiras.map((f) => [`Fluxo ${f.nome}`, f.fluxo_dia === null ? null : num(f.fluxo_dia, 0), "MWmed", dataBR(rede.dia_referencia)] as (string | number | null)[]),
                            ]}
                            casas={[null, 2, null, null]}
                          />
                        </div>
                        <div className="min-w-0 space-y-4 leading-relaxed text-carvao">
                          <p>
                            A CCEE calcula um PLD para cada submercado. As regiões estão ligadas por linhas de transmissão de fronteira, e o ONS mede o{" "}
                            <Termo slug="intercambio">intercâmbio</Termo> entre elas hora a hora, em MWmed (megawatt médio).
                          </p>
                          <p className="border border-dashed border-mineral p-3 text-sm text-carvao-muted">
                            <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                            Se a energia pudesse circular sem limite, o custo de atender uma carga a mais seria o mesmo em todo lugar. Como a capacidade de transferência entre
                            regiões é finita, uma região com sobra pode não conseguir enviar tudo o que teria para outra, e os preços se separam.
                          </p>
                          <ul className="space-y-1 text-xs text-mineral">
                            <li className="flex flex-wrap items-center gap-2">
                              Definições de PLD por submercado (CCEE) e de intercâmbio (ONS): <Conferido ok />
                            </li>
                            <li className="flex flex-wrap items-center gap-2">
                              Mecanismo de separação por limite de transferência: <Conferido ok={false} />
                            </li>
                          </ul>
                          <p className="flex flex-wrap items-center gap-2 border-l-2 border-energia pl-4 text-sm text-carvao-muted">
                            <span>
                              {rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia) ? (
                                <>
                                  Em {dataBR(pld.dia_referencia)}, a diferença entre o maior e o menor PLD médio foi de{" "}
                                  {reais(rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)!.amplitude)}/MWh.{" "}
                                </>
                              ) : null}
                              Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh.
                            </span>
                            <SeloNatureza natureza="CALCULADO" />
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Indisponivel titulo="Dados de rede indisponíveis" motivo="As golds de rede ou de PLD não foram geradas nesta publicação." />
                    )}
                  </SecaoDoPainel>

                  {integra(rede) && (
                    <SecaoDoPainel id="amplitude" titulo="Quando os submercados se separaram no último ano?">
                      <GraficoLinhas
                        titulo="Diferença entre o maior e o menor PLD médio diário"
                        dados={amplitude}
                        chaveX="x"
                        series={[{ id: "amp", rotulo: "Diferença máx.−mín.", cor: "var(--cor-energia)" }]}
                        unidade="R$/MWh"
                        casas={2}
                        zeroNoEixo
                      />
                      <NotasDoPainel
                        oQueMudou={<>{textoAmplitude(rede.resumo_amplitude)}</>}
                        comoInterpretar={<>Zero significa os quatro submercados com a mesma média diária. A série usa médias diárias; diferenças de poucas horas podem sumir na média.</>}
                        naoConcluir={
                          <>
                            A série não identifica qual fronteira ou linha causou a separação, nem se o limite de transferência foi atingido: os limites não estão integrados. A
                            causa de uma separação não é atribuída.
                          </>
                        }
                      />
                      <p className="text-sm">
                        <Link href={`${rotaPainel("p012")}#p012`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                          {perguntaPainel("p012")} Separação hora a hora, por par e com o fluxo na mesma hora
                        </Link>
                      </p>
                    </SecaoDoPainel>
                  )}

                  <SecaoDoPainel id="regras" titulo="Como classificamos" nivel="analisar" lead="Nenhuma classificação sem regra. Estas são as regras que produzem cada resposta desta seção.">
                    <dl className="grid gap-4 md:grid-cols-2">
                      {Object.entries(pld.regras).map(([k, v]) => (
                        <div key={k}>
                          <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                          <dd className="mt-1 text-sm leading-relaxed text-carvao">{semRessalvaDeLimitesNaoAuditados(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </SecaoDoPainel>

                  {limDet && (
                    <SecaoDoPainel id="limites-por-vigencia" titulo="Limites oficiais do PLD por vigência" nivel="auditar">
                      <p className="max-w-prose2 text-sm text-carvao-muted">
                        Piso, teto horário e teto estrutural fixados nos atos anuais da ANEEL, em vigor em cada trecho; o último trecho vai até o dia de referência.{" "}
                        {limDet.conferencia_atos.leitura}
                      </p>
                      <TabelaDados
                        titulo="Limites do PLD por trecho de vigência (R$/MWh)"
                        colunas={["Início", "Fim", "Piso", "Teto horário", "Teto estrutural", "Ato do piso"]}
                        linhas={limDet.regimes.map((r) => [dataBR(r.inicio), dataBR(r.fim), r.pld_min, r.pld_max_horario, r.pld_max_estrutural, r.ato_pld_min])}
                        casas={[null, null, 2, 2, 2, null]}
                      />
                    </SecaoDoPainel>
                  )}
                  <SecaoDoPainel id="menor-valor-por-ano" titulo="Menor valor horário observado por ano" nivel="auditar">
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      Referência descritiva, nunca usada como piso: o piso regulatório é o do ato vigente{limDet ? " (tabela acima)" : ""}.
                    </p>
                    <TabelaDados
                      titulo="Menor valor horário observado por ano e submercado"
                      colunas={["Ano", "Até", "SE/CO", "Sul", "Nordeste", "Norte"]}
                      linhas={pld.menor_valor_ano.map((m) => [m.ano, dataBR(m.ate), m.SE, m.S, m.NE, m.N])}
                      casas={[null, null, 2, 2, 2, 2]}
                    />
                    <p className="text-xs text-mineral [overflow-wrap:anywhere]">
                      Versão dos dados {pld.snapshot.id ? snapshotLegivel(pld.snapshot.id) : "sem identificador"} · sha256 {pld.snapshot.sha256} · série de {horaLocal(pld.primeira_hora)} a{" "}
                      {horaLocal(pld.ultima_hora)} (horário de Brasília)
                    </p>
                  </SecaoDoPainel>

                  <PldSeguir ancora="hoje" proximo={proximoPainel("p008")} downloads={pld.downloads} />
                </div>
              </PainelEvidencia>
            ) : (
              <>
                <Indisponivel titulo="PLD indisponível" motivo={pld?.motivo ?? "Os dados processados do PLD não foram gerados."} />
                <div className="mt-6">
                  <PldCapitulos />
                </div>
              </>
            )}
          </Bloco>

          {/* 2. A aula: o que é o PLD, o que ele não é e as bases conferidas */}
          <Capitulo id="o-que-e" rotulo="Entenda em 90 segundos" titulo="O que é o PLD, e o que ele não é">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                {/* Entender: a resposta curta. A norma, as citações e a leitura usual do setor estão em Analisar */}
                <p className="ed-lead text-carvao">
                  No <Termo slug="mcp">Mercado de Curto Prazo</Termo>, a CCEE compara, hora a hora e por submercado, a energia que cada agente contratou com a que gerou ou
                  consumiu de fato, e calcula o resultado financeiro dessa diferença. O PLD é o preço desse mercado.
                </p>
                <p className="mt-3 text-base leading-relaxed text-carvao">
                  É um valor em R$/MWh que a CCEE calcula todos os dias para cada hora do dia seguinte e para cada um dos quatro <Termo slug="submercado">submercados</Termo>. O
                  cálculo é feito por modelos computacionais (<Termo slug="newave">NEWAVE</Termo>, <Termo slug="decomp">DECOMP</Termo> e <Termo slug="dessem">DESSEM</Termo>), tem como
                  base o <Termo slug="cmo">custo marginal de operação</Termo> e respeita os <Termo slug="limites-do-pld">limites mínimo e máximos</Termo> vigentes.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                  Base: descrições oficiais da CCEE no portal de dados abertos, capturadas em 27/09/2026 e 28/09/2026. <Conferido ok />
                  <span data-nivel="auditar"> Conjuntos consultados: PLD_HORARIO, PLD_HORARIO_SUBMERCADO, SUMARIO_BE_HORARIO_SUBMERCADO e SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO.</span>
                </p>

                <div data-nivel="analisar" className="mt-6 space-y-6" data-bloco="aula-analisar">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    A CCEE publica os valores do balanço de energia (MWh) e do resultado (R$) somados por submercado e hora e, no consolidado do mês, separa o resultado de venda e o
                    de compra; na descrição da CCEE, os dois são apurados para cada perfil de agente, por submercado e hora.
                  </p>
                  {passagem("ren957_art5_p4") && (
                    <div className="border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao">
                      <p className="rotulo text-mineral">O que a norma diz</p>
                      <p className="mt-2">
                        Pela Convenção de Comercialização da ANEEL, as operações no Mercado de Curto Prazo são contabilizadas pela CCEE e as exposições dos agentes são valoradas ao
                        PLD. A plataforma não mostra valores de liquidação de nenhum agente: o painel abaixo traz um exemplo sintético, com quantidades hipotéticas e o PLD real de
                        uma hora, para mostrar o mecanismo.
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                        {passagem("ren957_art5_p4")!.origem}. <Conferido ok />
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="leading-relaxed text-carvao-muted">
                      Como o balanço de cada agente é formado (contratos, geração e consumo medidos) e como o resultado é liquidado entre quem vende e quem compra estão nas Regras
                      de Comercialização da CCEE.
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                      Regras de Comercialização: <Conferido ok={false} />{" "}
                      {bloqueioCcee ? (
                        <>
                          o documento não pôde ser lido nesta publicação. {bloqueioCcee.consequencia}
                          {fraseDeRecusa(bloqueioCcee.evidencia, "da CCEE") ? ` ${fraseDeRecusa(bloqueioCcee.evidencia, "da CCEE")}` : ""}
                          <span data-nivel="auditar"> Evidência registrada: {bloqueioCcee.evidencia.replace(/\.$/, "")}.</span>
                        </>
                      ) : (
                        "documento não conferido nesta publicação."
                      )}
                    </p>
                  </div>
                  <div className="border-l-2 border-energia pl-5">
                    <p className="rotulo text-mineral">A ideia central</p>
                    {textoHidraulicaBalanco(ger) && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 leading-relaxed text-carvao">
                        <span>{textoHidraulicaBalanco(ger)}</span>
                        <SeloNatureza natureza="ESTIMADO" />
                      </p>
                    )}
                    <p className="mt-3 border border-dashed border-mineral p-3 text-sm leading-relaxed text-carvao-muted">
                      <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                      O sistema brasileiro é descrito como <strong className="font-medium">hidrotérmico e intertemporal</strong>: parte da geração hidráulica vem de usinas com
                      reservatório, e a água usada agora não estará disponível depois. Nessa leitura, a água guardada tem valor para o futuro, esse valor pesa na decisão de gerar
                      com água agora ou acionar outras fontes, e o preço sai dessa decisão, não de uma única variável.
                    </p>
                    {passagem("dessem_acoplamento") && (
                      <div className="mt-3">
                        <PldPassagem p={passagem("dessem_acoplamento")!} />
                      </div>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                      Mecanismo do valor da água: <Conferido ok={false} />{" "}
                      {bloqueioCepel
                        ? "o manual do DESSEM confirma o acoplamento pela função de custo futuro (trecho acima), mas não descreve o valor da água; os manuais do DECOMP e do NEWAVE não estão entre os arquivos públicos do CEPEL."
                        : "documentação dos modelos não acessada nesta publicação."}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="rotulo text-mineral">O que o PLD não é</h3>
                <ul className="mt-3 space-y-5">
                  {PLD_NAO_E.map((x) => {
                    const tarifa = /tarifa/i.test(x.titulo);
                    return (
                      <li key={x.titulo} className="border-l-2 border-linha pl-4">
                        <p className="font-medium text-carvao">{x.titulo}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{x.porque}</p>
                        {tarifa && (
                          <div className="mt-2" data-texto="pld-e-conta">
                            {/* a frase do registro de contrastes repete o que o cartão já diz (e não expande TE e TUSD): fica em Analisar, e o link fica à vista */}
                            <p data-nivel="analisar" className="text-sm leading-relaxed text-carvao-muted">
                              {LIGACAO_COM_A_CONTA}
                            </p>
                            <Link href="/setor-eletrico/conta-de-luz" className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                              Ver como a conta de luz é formada
                            </Link>
                          </div>
                        )}
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                          {x.base} <Conferido ok={x.conferencia === "CONFERIDO"} />
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {cPld?.fontes[0]?.trecho && (
              <blockquote data-nivel="auditar" className="border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao-muted">
                <p className="rotulo mb-2 text-mineral">Íntegra da fonte (CCEE)</p>“{cPld.fontes[0].trecho}”
                <footer className="mt-2 text-xs text-mineral">
                  <a href={cPld.fontes[0].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {cPld.fontes[0].documento}
                  </a>
                </footer>
              </blockquote>
            )}
          </Capitulo>

          {/* 3. De onde vem o preço: painel P008 (conceito, formação e exemplo de liquidação) */}
          <Bloco id="formacao">
            {conceitoDet && ligacoes && resumoLig && docs && integra(pld) ? (
              <PainelEvidencia
                id="p008"
                pergunta={perguntaPainel("p008")}
                subtitulo="Conceito nas normas vigentes, formação do preço em etapas e exemplo sintético de liquidação · R$/MWh"
                porQueImporta={
                  <>
                    O PLD não é tarifa nem cotação de bolsa: é o preço que valora as diferenças entre o contratado e o verificado no Mercado de Curto Prazo, calculado a partir do custo
                    marginal dos modelos oficiais e limitado pela ANEEL. Saber de onde ele vem ajuda a não confundir regra com causa.
                  </>
                }
                oQueMudou={
                  <>
                    Passagens conferidas nos documentos baixados até {dataBR(detalhe!.gerado_em.slice(0, 10))}: {resumoLig.conferidas} de {resumoLig.total} ligações do diagrama conferidas.
                    {resumoLig.pendentes.length ? ` Pendentes: ${resumoLig.pendentes.map((l) => `${NOS_FORMACAO.find((n) => n.id === l.de)?.titulo ?? l.de} para ${NOS_FORMACAO.find((n) => n.id === l.para)?.titulo ?? l.para}`).join("; ")}.` : ""}
                  </>
                }
                comoInterpretar={
                  <>
                    Toque em cada etapa do diagrama: o detalhe, ao lado do diagrama em tela larga e abaixo dele no celular, diz o que ela é, o último dado publicado quando há dado
                    integrado e cada ligação com a etapa seguinte, com o tipo da relação e o trecho do documento que a sustenta. Ligação marcada como pendente tem só base editorial.
                  </>
                }
                naoConcluir={
                  <>
                    O exemplo de liquidação é sintético: não reproduz a contabilização de nenhum agente nem de nenhum mês, e a convenção de crédito e débito é do exemplo, porque as
                    regras algébricas da CCEE estão inacessíveis. O diagrama descreve regras e entradas dos modelos; não mede quanto cada etapa pesou no preço de uma hora.
                  </>
                }
                proveniencia={pld.proveniencia.horario}
              >
                <div className="space-y-6">
                  <RespostaCurta id="p008" veredito={vereditoP008(conceitoDet)}>
                    {respostaP008(conceitoDet, ligacoes)}
                  </RespostaCurta>
                  <PldRecorte
                    periodo={<>Normas e procedimentos vigentes, conferidos nas capturas mais recentes; exemplo com o PLD de {exemplo ? `${dataBR(exemplo.pld.hora)} às ${exemplo.pld.hora.slice(11, 13)}h` : "uma hora real"}</>}
                    universo={<>Mercado de Curto Prazo da CCEE; PLD horário dos quatro submercados</>}
                    unidade={<>R$/MWh (preço); MWh e R$ no exemplo</>}
                  />
                  <div className="grid gap-3 md:grid-cols-2" data-nivel="analisar">
                    {["ren957_art2_xiii", "ren957_art5_p4", "d5163_art57_p1", "ren957_art78"].map((id) => {
                      const f = passagem(id);
                      return f ? <PldPassagem key={id} p={f} compacta /> : null;
                    })}
                  </div>

                  <SecaoDoPainel id="diagrama-formacao" titulo="O PLD emerge de um sistema, não de uma variável">
                    <PldFormacao nos={nos} ligacoes={ligacoes} />
                  </SecaoDoPainel>

                  {exemplo && (
                    <SecaoDoPainel id="exemplo-liquidacao" titulo="Como a diferença entre contratado e verificado é valorada ao PLD?">
                      <div className="space-y-3 border border-dashed border-mineral bg-papel p-4 md:p-5">
                        <p className="rotulo text-mineral">Exemplo sintético, não é contabilização real</p>
                        <p className="text-sm leading-relaxed text-carvao">{exemplo.aviso}</p>
                        <p className="text-sm text-carvao-muted">
                          PLD usado: {reais(exemplo.pld.valor)}/MWh, {exemplo.pld.nome}, {dataBR(exemplo.pld.hora)} às {exemplo.pld.hora.slice(11, 13)}h (
                          {exemplo.pld.fonte.replace(/PLD_HORARIO/g, "PLD horário por submercado")}; {exemplo.pld.regra_escolha}) <SeloNatureza natureza="OBSERVADO" />
                        </p>
                        <p className="text-sm text-carvao-muted">Regra do exemplo: {exemplo.formula}.</p>
                        <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Exemplo sintético de liquidação (tabela rolável)">
                          <table className="w-full min-w-[34rem] text-sm tabular-nums">
                            <caption className="sr-only">Exemplo sintético de liquidação: quantidades hipotéticas e PLD real da hora</caption>
                            <thead>
                              <tr className="border-b border-linha text-left text-xs text-mineral">
                                <th scope="col" className="py-2 pr-3 font-normal">Agente hipotético</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">Compras contratadas (MWh)</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">Vendas contratadas (MWh)</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">Geração verificada (MWh)</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">Consumo verificado (MWh)</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">Diferença (MWh)</th>
                                <th scope="col" className="py-2 text-right font-normal">Valor no MCP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exemplo.agentes.map((a) => (
                                <tr key={a.id} className="border-b border-linha">
                                  <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">{a.rotulo}</th>
                                  <td className="py-2 pr-3 text-right">{num(a.compras_contratadas_mwh, 0)}</td>
                                  <td className="py-2 pr-3 text-right">{num(a.vendas_contratadas_mwh, 0)}</td>
                                  <td className="py-2 pr-3 text-right">{num(a.geracao_verificada_mwh, 0)}</td>
                                  <td className="py-2 pr-3 text-right">{num(a.consumo_verificado_mwh, 0)}</td>
                                  <td className="py-2 pr-3 text-right">{num(a.diferenca_mwh, 0)}</td>
                                  <td className="py-2 text-right">
                                    {reais(a.valor_rs)} ({a.resultado})
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-sm leading-relaxed text-carvao">{exemplo.leitura}</p>
                        <div>
                          <p className="rotulo text-mineral">Simplificações do exemplo</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                            {exemplo.simplificacoes.map((t) => (
                              <li key={t}>{semCodigoHttp(t)}</li>
                            ))}
                          </ul>
                        </div>
                        <details className="text-sm">
                          <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Base normativa do exemplo</summary>
                          <div className="mt-2 space-y-2">
                            {exemplo.base_normativa.map((id) => {
                              const f = passagem(id);
                              return f ? <PldPassagem key={id} p={f} /> : null;
                            })}
                          </div>
                        </details>
                      </div>
                    </SecaoDoPainel>
                  )}

                  <SecaoDoPainel id="tipos-de-relacao" titulo="Tipos de relação usados no diagrama" nivel="analisar">
                    <dl className="grid gap-3 md:grid-cols-2">
                      {Object.values(TIPOS_RELACAO).map((t) => (
                        <div key={t.rotulo}>
                          <dt className="font-medium text-carvao">{t.rotulo}</dt>
                          <dd className="text-sm text-carvao-muted">{t.definicao}</dd>
                        </div>
                      ))}
                    </dl>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="cmo" titulo="CMO e PLD: três produtos na mesma semana">
                    {semanaRef ? (
                      <>
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                          Semana operativa de {dataBR(semanaRef.inicio)} a {dataBR(semanaRef.fim)}: o CMO semanal do DECOMP (ONS), a média das meias horas do CMO do DESSEM (ONS) e a média
                          das horas do PLD (CCEE), em R$/MWh. São produtos diferentes; a comparação só vale no mesmo intervalo.
                        </p>
                        <div className="tabela-scroll" tabIndex={0} role="region" aria-label="CMO e PLD na semana de referência (tabela rolável)">
                          <table className="w-full min-w-[28rem] text-sm tabular-nums">
                            <caption className="sr-only">CMO semanal do DECOMP, média do DESSEM e média do PLD na semana de referência, R$/MWh</caption>
                            <thead>
                              <tr className="border-b border-linha text-left text-xs text-mineral">
                                <th scope="col" className="py-2 pr-3 font-normal">Submercado</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">CMO semanal (DECOMP)</th>
                                <th scope="col" className="py-2 pr-3 text-right font-normal">Média do DESSEM</th>
                                <th scope="col" className="py-2 text-right font-normal">Média do PLD</th>
                              </tr>
                            </thead>
                            <tbody>
                              {semanaRef.por_sm.map((x) => (
                                <tr key={x.sm} className="border-b border-linha">
                                  <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">{NOME_SM[x.sm]}</th>
                                  <td className="py-2 pr-3 text-right">{reais(x.decomp)}</td>
                                  <td className="py-2 pr-3 text-right">{reais(x.dessem)}</td>
                                  <td className="py-2 text-right">{reais(x.pld)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-carvao-muted">Nenhuma semana operativa completa nos três produtos nesta publicação.</p>
                    )}
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p009")}#p009`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        Séries alinhadas, momento do cálculo e relação por ano no painel CMO e formação de preço
                      </Link>
                    </p>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="normas" titulo="Documentos normativos e técnicos citados, com a passagem conferida" nivel="auditar">
                    {docs.documentos.map((d) => (
                      <div key={d.id} className="space-y-2">
                        <p className="text-sm text-carvao [overflow-wrap:anywhere]">
                          <span className="font-medium">{d.doc.titulo}</span>. Órgão: {d.doc.orgao}.{" "}
                          <a href={d.doc.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                            Endereço oficial
                          </a>
                          {d.doc.url_copia ? (
                            <>
                              {"; "}
                              <a href={d.doc.url_copia} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                                cópia lida
                              </a>
                            </>
                          ) : null}
                          {`. Captura de ${carimbo(d.doc.capturado_em)}; sha256 ${d.doc.sha256 ?? "não registrado"}. ${d.doc.licenca}`}
                        </p>
                        {d.passagens.length === 0 ? (
                          <p className="text-xs text-aviso">Nenhuma passagem deste documento conferida nesta publicação.</p>
                        ) : (
                          d.passagens.map((f) => <PldPassagem key={f.id} p={f} compacta />)
                        )}
                      </div>
                    ))}
                    <p className="rotulo text-mineral">Descrições oficiais dos conjuntos de dados</p>
                    {docs.descricoes.map((f) => (
                      <PldPassagem key={f.id} p={f} />
                    ))}
                    {conceitoDet.normas_nao_conferidas.length > 0 && (
                      <PldAviso tipo="alerta">
                        Passagens não conferidas e fora da página: {conceitoDet.normas_nao_conferidas.map((n) => `${n.documento}, ${n.dispositivo} (${n.motivo})`).join("; ")}.
                      </PldAviso>
                    )}
                  </SecaoDoPainel>

                  <SecaoDoPainel id="bloqueios" titulo="O que não foi possível conferir e por quê" nivel="auditar">
                    <ul className="space-y-2 text-sm text-carvao-muted">
                      {conceitoDet.bloqueios.map((b) => (
                        <li key={b.fonte} className="leading-relaxed [overflow-wrap:anywhere]">
                          <span className="text-carvao">{b.fonte}</span>: {datasLegiveis(b.evidencia.replace(/\.$/, ""))}. {datasLegiveis(b.consequencia)}
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>

                  <PldSeguir
                    ancora="p008"
                    proximo={proximoPainel("p008")}
                    downloads={detalhe!.downloads.filter((d) => /cmo_horario/.test(d.url))}
                  />
                </div>
              </PainelEvidencia>
            ) : (
              <>
                <PldAviso tipo="alerta">
                  As passagens normativas conferidas não estão nesta publicação: o diagrama abaixo mostra só as ligações do conteúdo editorial, com o estado de
                  conferência de cada uma.
                </PldAviso>
                <PldFormacao nos={nos} ligacoes={Object.fromEntries(nos.map((n) => [n.id, n.relacaoSaida ? [{ de: n.id, para: n.relacaoSaida.para, tipo: n.relacaoSaida.tipo, texto: n.relacaoSaida.texto, estado: n.relacaoSaida.conferencia, bases: [], faltantes: [], baseTexto: n.relacaoSaida.fonte, origem: "conteudo" as const }] : []]))} />
              </>
            )}
          </Bloco>

          {/* 4. Previsão */}
          <Capitulo id="previsao" rotulo="Previsão" titulo="Para onde o PLD pode ir?">
            <p className="ed-lead max-w-prose2 text-carvao">Previsão é distribuição de possibilidades, não um único número.</p>
            <div className="grid items-start gap-8 lg:grid-cols-2">
              <IlustracaoDistribuicao />
              <div>
                {prev && !prev.atual.disponivel ? (
                  <Indisponivel
                    titulo="Previsão indisponível"
                    motivo={<>{prev.atual.motivo} A Scrutiniums não publica previsão de modelo em pesquisa ou em validação.</>}
                    ultimaExecucao={
                      ult ? (
                        <>
                          {rotuloTipo(ult.tipo).replace(/^./, (c) => c.toUpperCase())} de {dataBR(ult.origem)}, com o modelo {ult.modelo} ({ult.estado_modelo === "PESQUISA" ? "em pesquisa" : ult.estado_modelo.toLowerCase()}):{" "}
                          {ult.celulas} previsões tentadas, {ult.com_numero === 0 ? "nenhuma com número" : `${ult.com_numero} com número`}.
                          {ult.motivos.length > 0 ? ` Motivo: ${ult.motivos.map((m) => textoMotivo(m)).join("; ")}.` : ""}
                        </>
                      ) : (
                        "Nenhuma rodada registrada."
                      )
                    }
                    faltante={prev.atual.informacao_faltante}
                    estado={semCaminhosDeArquivo(prev.atual.estado_pipeline ?? "").replace(/ no workflow [\w.-]+\.yml/, "")}
                  >
                    <p className="mt-5 flex flex-wrap gap-4 text-sm">
                      <Link href="/setor-eletrico/pld/modelos" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">Registro de modelos</Link>
                      <Link href="/setor-eletrico/pld/previsoes" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">Histórico de previsões ({csvEmissoes ? `${linhasEmissoes.length.toLocaleString("pt-BR")} registros de ${rodadasEmissoes.length} ${rodadasEmissoes.length === 1 ? "rodada" : "rodadas"}` : "arquivo não lido nesta publicação"})</Link>
                    </p>
                  </Indisponivel>
                ) : prev && prev.atual.disponivel ? (
                  <div className="border-l-2 border-energia pl-4">
                    <p className="rotulo text-mineral">Previsão publicada</p>
                    <p className="mt-2 text-sm leading-relaxed text-carvao">
                      Há publicação do modelo em produção no arquivo imutável de previsões. Cada registro traz modelo, versão, corte e faixas de incerteza.
                    </p>
                    <Link href="/setor-eletrico/pld/previsoes" className="mt-3 inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
                      Ver no histórico de previsões
                    </Link>
                  </div>
                ) : (
                  <Indisponivel titulo="Previsão indisponível" motivo="O arquivo de previsões não foi gerado nesta publicação." />
                )}
              </div>
            </div>

            <div className="grid gap-x-8 gap-y-6 md:grid-cols-3" data-nivel="analisar">
              <div className="border-l-2 border-linha pl-4">
                <h3 className="ed-h3 font-serif text-carvao">Como ler, quando houver previsão</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  A mediana é o valor central da distribuição. As faixas mostram onde o realizado caiu no passado em casos comparáveis. A
                  frase &quot;em cerca de 80% dos casos&quot; só aparece quando a cobertura medida sustentar; caso contrário, a página diz
                  quanto a faixa realmente cobriu.
                </p>
              </div>
              <div className="border-l-2 border-linha pl-4">
                <h3 className="ed-h3 font-serif text-carvao">O que mudou desde a previsão anterior</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Sem previsões publicadas para comparar. Quando houver, esta seção separa o que <strong className="font-medium">mudou na informação</strong> (EAR, ENA, carga, renováveis, térmicas, intercâmbio) do que foi <strong className="font-medium">contribuição do modelo</strong>, que nunca é chamada de causa.
                </p>
              </div>
              <div className="border-l-2 border-linha pl-4">
                <h3 className="ed-h3 font-serif text-carvao">Por que confiar? O modelo tem acertado?</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Ainda não há previsão publicada com realizado para comparar. Os resultados retrospectivos da pesquisa estão{" "}
                  {mods?.publicacao_resultados.liberada ? "no registro de modelos" : "retidos até a conclusão da revisão da pesquisa e a liberação pelo responsável pela plataforma"}.
                  Toda avaliação futura começa por previsão, realizado e erro, depois erro típico, depois cobertura da faixa, e só então métricas técnicas contra referências simples.
                </p>
              </div>
            </div>
            <SecaoDoPainel id="governanca" titulo="Regras de governança aplicadas" nivel="auditar">
              <dl className="grid gap-4 md:grid-cols-2">
                {prev &&
                  Object.entries(prev.regras).map(([k, v]) => (
                    <div key={k}>
                      <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-carvao">{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="text-sm text-carvao-muted">
                Validações automáticas, executadas a cada atualização antes de publicar (validador de governança do código do portal), bloqueiam: publicação de modelo não promovido, uso de dado posterior ao corte, alteração silenciosa de registro publicado, previsão sem versão ou snapshot, faixa não calibrada rotulada como 80%, cenário como previsão e ausência como número.
              </p>
            </SecaoDoPainel>
          </Capitulo>
        </ModoProfundidade>
      </main>
    </>
  );
}
