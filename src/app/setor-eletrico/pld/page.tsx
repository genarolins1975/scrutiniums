import { linhasArquivo, resumoRodadas, rotuloTipo, textoMotivo } from "@/lib/energia/previsoes";
import { lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";
import { LegendaDeSiglas } from "@/components/energia/CabecalhoModulo";
import { fraseDeRecusa, semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { Termo } from "@/components/evidencia/Termo";
import { Conferido } from "@/components/evidencia/Conferido";
import { CartoesPld } from "@/components/energia/CartoesPld";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import type { NoComEstado } from "@/components/energia/DiagramaFormacao";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PldFormacao } from "@/components/energia/PldFormacao";
import { PldAuditoria, PldAviso, PldNavegacao, PldPassagem, PldRecorte, PldSeguir } from "@/components/energia/PldPagina";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { PldPeriodos, type PeriodoPld } from "@/components/energia/PldPeriodos";
import { IlustracaoDistribuicao } from "@/components/energia/IlustracaoDistribuicao";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { carimbo, dataBR, horaLocal, num, pct, reais, rotuloRegra } from "@/lib/energia/formato";
import { textoAmplitude } from "@/lib/energia/resumos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { NOS_FORMACAO, PLD_NAO_E, TIPOS_RELACAO } from "@/lib/energia/conteudo/pld";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { estadoCarga, estadoEar, estadoEna, estadoPld, estadoRenovaveis, estadoTermicas } from "@/lib/energia/leituras";
import type { PldGold } from "@/lib/energia/tipos";
import type { PldDetalheGold, RegimeLimites } from "@/lib/energia/tipos-pld";
import {
  NOME_SM,
  documentosCitados,
  ligacoesFormacao,
  perguntaPainel,
  proximoPainel,
  resumoLigacoes,
  respostaP008,
  rotaPainel,
  notaDoisPercentis,
  semCodigoHttp,
  vereditoP008,
} from "@/lib/energia/pld";
import { snapshotLegivel, datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "PLD: o preço horário da energia por submercado, explicado",
  description:
    "O que é o PLD, o que ele não é, de onde vem o preço, o que aconteceu no último dia publicado nos quatro submercados e o estado real da previsão, com fonte, regra e limitação em cada número.",
  alternates: { canonical: "/setor-eletrico/pld" },
};

function Capitulo({ id, numero, titulo, subtitulo, children, nivel }: { id: string; numero: string; titulo: string; subtitulo?: string; children: React.ReactNode; nivel?: string }) {
  return (
    <section id={id} data-nivel={nivel} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t border-linha py-12 md:py-16">
      <p className="rotulo flex items-center gap-3 text-mineral">
        <span className="font-serif text-lg normal-case tracking-normal text-energia">{numero}</span>
        {subtitulo}
      </p>
      <h2 id={`${id}-h`} className="mt-2 max-w-3xl font-serif text-2xl leading-snug text-carvao md:text-[2rem]">
        {titulo}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
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
  const regimeVigente: RegimeLimites | null = limDet ? (limDet.regimes.at(-1) ?? null) : null;
  const prev = gold.previsoes();
  const mods = gold.modelos();
  const cPld = conceito("pld");

  const estados: Record<string, NoComEstado["estado"]> = {
    afluencias: estadoEna(hid) ? { texto: estadoEna(hid)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da ENA", href: "/setor-eletrico/agua-e-clima/afluencia#p018" } } : null,
    reservatorios: estadoEar(hid) ? { texto: estadoEar(hid)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da EAR", href: "/setor-eletrico/agua-e-clima#ear" } } : null,
    carga: estadoCarga(carga) ? { texto: estadoCarga(carga)!, natureza: "CALCULADO", historico: { rotulo: "Histórico da carga", href: "/setor-eletrico/carga" } } : null,
    renovaveis: estadoRenovaveis(ger) ? { texto: estadoRenovaveis(ger)!, natureza: "CALCULADO", historico: { rotulo: "Matriz por janela", href: "/setor-eletrico/geracao" } } : null,
    termicas: estadoTermicas(ger) ? { texto: estadoTermicas(ger)!, natureza: "CALCULADO", historico: { rotulo: "Térmicas em contexto", href: "/setor-eletrico/geracao#termica" } } : null,
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
          texto: `CMO semanal publicado pelo ONS para a semana operativa de ${dataBR(cmo.semana_referencia)}: ${cmo.ultima_semana.map((s) => `${s.sm === "SE" ? "SE/CO" : s.sm} ${reais(s.semanal)}`).join("; ")} por MWh.`,
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
  const semanaRef = integra(detalhe) ? detalhe.cmo_pld.semana_referencia : null;
  // o histórico de previsões é o mesmo arquivo da página de previsões: as contagens saem do CSV completo, não do trecho legado da gold
  const csvEmissoes = lerCsvPrevisoes("/energia/series/previsoes_emissoes.csv");
  const linhasEmissoes = csvEmissoes ? linhasArquivo(csvEmissoes.linhas, Object.fromEntries((mods?.modelos ?? []).map((m) => [m.codigo, m.estado]))) : [];
  const rodadasEmissoes = resumoRodadas(linhasEmissoes);
  const notaPercentis = integra(detalhe) && integra(pld) ? notaDoisPercentis(pld.cartoes.find((c) => c.sm === "SE"), detalhe.historico.posicao_referencia.find((x) => x.sm === "SE")) : null;

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <header className="pb-6 pt-10 md:pt-14">
          <p className="rotulo text-mineral">Preço de Liquidação das Diferenças</p>
          <h1 className="mt-3 font-serif text-[clamp(2.6rem,6vw,4rem)] leading-none text-carvao">PLD</h1>
          <p className="mt-4 max-w-2xl font-serif text-xl leading-snug text-carvao-muted md:text-2xl">
            O preço horário da energia no Brasil, explicado.
          </p>
          <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[
              ["#o-que-e", "O que é"],
              ["#formacao", "De onde vem o preço"],
              ["#hoje", "Último dia publicado"],
              ["#submercados", "Por que as regiões diferem"],
              ["#previsao", "Para onde pode ir"],
            ].map(([h, r]) => (
              <a key={h} href={h} className="inline-flex min-h-[44px] items-center text-energia-dark underline decoration-energia/40 underline-offset-4 hover:text-carvao">
                {r}
              </a>
            ))}
          </nav>
          <LegendaDeSiglas siglas={["CCEE", "CMO", "MWmed", "ENA", "EAR", "CVU", "ONS", "ANEEL", "REN"]} />
        </header>
        <PldNavegacao atual="p008" />

        <ModoProfundidade>
          {/* 1. Entenda em 90 segundos */}
          <Capitulo
            id="o-que-e"
            numero="1"
            subtitulo="Entenda em 90 segundos"
            titulo="A que preço se acerta a energia no curto prazo, hora a hora e em cada região?"
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                <p className="font-serif text-xl leading-relaxed text-carvao md:text-2xl">
                  No <Termo slug="mcp">Mercado de Curto Prazo</Termo>, a CCEE compara, hora a hora e por submercado, a energia que cada agente contratou com a que gerou ou
                  consumiu de fato, e calcula o resultado financeiro dessa diferença. O PLD é o preço desse mercado. A CCEE publica esses valores somados por submercado e hora e,
                  no consolidado do mês, separa o resultado de venda e o de compra.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                  Base: descrições oficiais da CCEE no portal de dados abertos, capturadas em 28/09/2026. <Conferido ok />
                </p>
                <p data-nivel="analisar" className="mt-2 max-w-prose2 text-xs leading-relaxed text-mineral [overflow-wrap:anywhere]">
                  Na descrição da CCEE, o balanço de energia (MWh) e o resultado (R$) são apurados para cada perfil de agente, por submercado e hora. Conjuntos consultados:
                  PLD_HORARIO_SUBMERCADO, SUMARIO_BE_HORARIO_SUBMERCADO e SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO.
                </p>
                {passagem("ren957_art5_p4") && (
                  <div className="mt-5 border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao">
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
                <p className="mt-6 text-lg leading-relaxed text-carvao">
                  É um valor em R$/MWh que a CCEE calcula todos os dias para cada hora do dia seguinte e para cada um dos quatro{" "}
                  <Termo slug="submercado">submercados</Termo>. O cálculo é feito por modelos computacionais (NEWAVE, DECOMP e
                  DESSEM), tem como base o <Termo slug="cmo">custo marginal de operação</Termo> e respeita os limites mínimo e
                  máximos vigentes.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral">
                  Base: descrição oficial da CCEE no portal de dados abertos, capturada em 27/09/2026. <Conferido ok />
                  <span data-nivel="analisar"> Conjunto consultado: PLD_HORARIO.</span>
                </p>
                <p className="mt-6 leading-relaxed text-carvao-muted">
                  Como o balanço de cada agente é formado (contratos, geração e consumo medidos) e como o resultado é liquidado entre quem vende e quem compra estão nas Regras de
                  Comercialização da CCEE.
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral [overflow-wrap:anywhere]">
                  Regras de Comercialização: <Conferido ok={false} />{" "}
                  {bloqueioCcee ? (
                    <>
                      o documento não pôde ser lido nesta publicação. {bloqueioCcee.consequencia}
                      <span data-nivel="analisar">
                        {" "}
                        {fraseDeRecusa(bloqueioCcee.evidencia, "da CCEE")} Evidência: {bloqueioCcee.evidencia.replace(/\.$/, "")}.
                      </span>
                    </>
                  ) : (
                    "documento não conferido nesta publicação."
                  )}
                </p>
                <div className="mt-8 border-l-2 border-energia pl-5">
                  <p className="rotulo text-mineral">A ideia central</p>
                  {integra(ger) && ger.regioes.find((r) => r.rg === "SIN")?.["12m"] && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 leading-relaxed text-carvao">
                      <span>
                        Nos 12 meses até {dataBR(ger.dia_referencia)}, a geração hidráulica respondeu por{" "}
                        {pct(ger.regioes.find((r) => r.rg === "SIN")!["12m"]!.participacao.hidraulica)} da geração verificada do <Termo slug="sin">SIN</Termo>{" "}
                        (ONS, Balanço de Energia nos Subsistemas).
                      </span>
                      <SeloNatureza natureza="CALCULADO" />
                    </p>
                  )}
                  <p className="mt-3 border border-dashed border-mineral p-3 text-sm leading-relaxed text-carvao-muted">
                    <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                    O sistema brasileiro é descrito como <strong className="font-medium">hidrotérmico e intertemporal</strong>: parte da
                    geração hidráulica vem de usinas com reservatório, e a água usada agora não estará disponível depois. Nessa leitura,
                    a água guardada tem valor para o futuro, esse valor pesa na decisão de gerar com água agora ou acionar outras
                    fontes, e o preço sai dessa decisão, não de uma única variável.
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
              <div>
                <p className="rotulo text-mineral">O que o PLD não é</p>
                <ul className="mt-3 space-y-3">
                  {PLD_NAO_E.map((x) => (
                    <li key={x.titulo} className="border border-linha bg-superficie p-4">
                      <p className="font-medium text-carvao">{x.titulo}</p>
                      <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{x.porque}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
                        {x.base} <Conferido ok={x.conferencia === "CONFERIDO"} />
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {cPld?.fontes[0]?.trecho && (
              <blockquote data-nivel="auditar" className="mt-8 border border-linha bg-superficie p-5 text-sm leading-relaxed text-carvao-muted">
                <p className="rotulo mb-2 text-mineral">Íntegra da fonte (CCEE)</p>“{cPld.fontes[0].trecho}”
                <footer className="mt-2 text-xs text-mineral">
                  <a href={cPld.fontes[0].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {cPld.fontes[0].documento}
                  </a>
                </footer>
              </blockquote>
            )}
          </Capitulo>

          {/* 2. De onde vem o preço: painel P008 (conceito, formação e exemplo de liquidação) */}
          <Capitulo id="formacao" numero="2" subtitulo="De onde vem o preço?" titulo="O PLD emerge de um sistema, não de uma variável">
            {conceitoDet && ligacoes && resumoLig && docs && integra(pld) ? (
              <PainelEvidencia
                nivelTitulo={3}
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
                    Toque em cada etapa do diagrama: o painel ao lado diz o que ela é, o estado atual quando há dado integrado e cada ligação com a etapa seguinte, com o tipo da
                    relação e o trecho do documento que a sustenta. Ligação marcada como pendente tem só base editorial.
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

                  <PldFormacao nos={nos} ligacoes={ligacoes} />

                  {exemplo && (
                    <section aria-labelledby="exemplo-liquidacao-titulo" className="space-y-3 border border-dashed border-mineral bg-papel p-4 md:p-5">
                      <p className="rotulo text-mineral">Exemplo sintético, não é contabilização real</p>
                      <h4 id="exemplo-liquidacao-titulo" className="font-serif text-lg text-carvao">
                        Como a diferença entre contratado e verificado é valorada ao PLD?
                      </h4>
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
                    </section>
                  )}

                  <details data-nivel="analisar" className="border border-linha bg-superficie p-5">
                    <summary className="rotulo min-h-[44px] cursor-pointer text-carvao">Tipos de relação usados no diagrama</summary>
                    <dl className="mt-3 grid gap-3 md:grid-cols-2">
                      {Object.values(TIPOS_RELACAO).map((t) => (
                        <div key={t.rotulo}>
                          <dt className="font-medium text-carvao">{t.rotulo}</dt>
                          <dd className="text-sm text-carvao-muted">{t.definicao}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>

                  <div id="cmo" data-nivel="analisar" className="scroll-mt-28 space-y-3 border-t border-linha pt-5">
                    <h4 className="font-serif text-lg text-carvao">CMO e PLD: três produtos na mesma semana</h4>
                    {semanaRef ? (
                      <>
                        <p className="text-sm leading-relaxed text-carvao-muted">
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
                  </div>

                  <PldAuditoria id="normas" titulo="Documentos normativos e técnicos citados, com a passagem conferida">
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
                  </PldAuditoria>

                  <PldAuditoria id="bloqueios" titulo="O que não foi possível conferir e por quê">
                    <ul className="space-y-2 text-sm text-carvao-muted">
                      {conceitoDet.bloqueios.map((b) => (
                        <li key={b.fonte} className="leading-relaxed [overflow-wrap:anywhere]">
                          <span className="text-carvao">{b.fonte}</span>: {datasLegiveis(b.evidencia.replace(/\.$/, ""))}. {datasLegiveis(b.consequencia)}
                        </li>
                      ))}
                    </ul>
                  </PldAuditoria>

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
                  As passagens normativas conferidas (pld_detalhe.json) não estão nesta publicação: o diagrama abaixo mostra só as ligações do conteúdo editorial, com o estado de
                  conferência de cada uma.
                </PldAviso>
                <PldFormacao nos={nos} ligacoes={Object.fromEntries(nos.map((n) => [n.id, n.relacaoSaida ? [{ de: n.id, para: n.relacaoSaida.para, tipo: n.relacaoSaida.tipo, texto: n.relacaoSaida.texto, estado: n.relacaoSaida.conferencia, bases: [], faltantes: [], baseTexto: n.relacaoSaida.fonte, origem: "conteudo" as const }] : []]))} />
              </>
            )}
          </Capitulo>

          {/* 3. O que está acontecendo */}
          <Capitulo id="hoje" numero="3" subtitulo="O que está acontecendo" titulo={integra(pld) ? `O PLD em ${dataBR(pld.dia_referencia)} e no período recente` : "O PLD no período recente"}>
            {integra(pld) ? (
              <>
                <CartoesPld pld={pld} />
                <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  <span className="rotulo mr-1 text-mineral">O que não é possível concluir:</span>
                  a posição no histórico não diz para onde o preço vai, e a faixa horária mostra os extremos de um único dia. Faixa horária:{" "}
                  valores observados; média, variação e percentil: calculados.
                </p>
                {notaPercentis && (
                  <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="dois-percentis">
                    {notaPercentis}{" "}
                    <Link href={`${rotaPainel("p011")}#p011`} className="text-energia-dark underline underline-offset-4">
                      Ver o Histórico
                    </Link>
                    .
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                  <span>Fonte: CCEE, PLD horário por submercado; médias e posição calculadas pela Scrutiniums.</span>
                  <SobreEsteDado p={pld.proveniencia.horario} rotulo="Sobre o PLD horário" />
                  <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre a média diária" />
                  <SobreEsteDado p={pld.proveniencia.posicao} rotulo="Sobre a posição histórica" />
                </div>
                <div className="mt-8">
                  <PainelEvidencia
                    nivelTitulo={3}
                    id="periodos"
                    pergunta="Em que horas o preço sobe, e as regiões se separam?"
                    subtitulo="PLD por submercado · R$/MWh nominais · hora local de Brasília"
                    porQueImporta={<>O PLD é horário. A curva mostra em que horas do dia o preço de cada submercado sobe ou cai e se os quatro seguem juntos.</>}
                    oQueMudou={<>Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh entre submercados.</>}
                    comoInterpretar={<>Alterne os períodos. O dia de referência, 7 e 30 dias mostram horas; 12 meses mostra médias diárias; o histórico, médias mensais desde 2021.</>}
                    naoConcluir={<>Uma posição alta ou baixa no histórico não diz para onde o preço vai. Anos diferentes têm limites regulatórios diferentes (piso e tetos de cada ano, com o ato da ANEEL, no modo Auditar).</>}
                    proveniencia={pld.proveniencia.horario}
                    extraFonte={<>Captura primária de {carimbo(pld.proveniencia.horario.capturado_em)}.</>}
                    complementares={[
                      ...(pld.proveniencia.estatisticas ? [{ rotulo: "Sobre as estatísticas do período", p: pld.proveniencia.estatisticas }] : []),
                      { rotulo: "Sobre as médias diárias", p: pld.proveniencia.diario },
                      ...(pld.proveniencia.mensal ? [{ rotulo: "Sobre as médias mensais", p: pld.proveniencia.mensal }] : []),
                    ]}
                  >
                    <PldPeriodos periodos={periodos(pld)} limiar={pld.limiar_diferenca} />
                  </PainelEvidencia>
                </div>
                <nav aria-label="Aprofundar o período recente" className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <Link href={`${rotaPainel("p010")}#p010`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                    {perguntaPainel("p010")} Calendário e permanência no piso e nos tetos
                  </Link>
                  <Link href={`${rotaPainel("p011")}#p011`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                    {perguntaPainel("p011")} Percentis da mesma época e médias ponderadas
                  </Link>
                </nav>
                <div id="regras" data-nivel="analisar" className="mt-8 scroll-mt-28 border border-linha bg-superficie p-6">
                  <h3 className="font-serif text-xl text-carvao">Como classificamos</h3>
                  <p className="mt-1 text-sm text-carvao-muted">Nenhuma classificação sem regra. Estas são as regras que produzem cada resposta desta seção.</p>
                  <dl className="mt-4 grid gap-4 md:grid-cols-2">
                    {Object.entries(pld.regras).map(([k, v]) => (
                      <div key={k}>
                        <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-carvao">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-4">
                    <SobreEsteDado p={pld.proveniencia.posicao} rotulo="Sobre a posição histórica" />
                    <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre a média diária" />
                  </div>
                </div>
                <div data-nivel="auditar" className="mt-8 border border-linha bg-superficie p-6">
                  {limDet ? (
                    <>
                      <h3 className="font-serif text-xl text-carvao">Limites oficiais do PLD por vigência</h3>
                      <p className="mt-1 text-sm text-carvao-muted">
                        Piso, teto horário e teto estrutural fixados nos atos anuais da ANEEL, em vigor em cada trecho; o último trecho vai até o dia de referência. {limDet.conferencia_atos.leitura}
                      </p>
                      <TabelaDados
                        titulo="Limites do PLD por trecho de vigência (R$/MWh)"
                        colunas={["Início", "Fim", "Piso", "Teto horário", "Teto estrutural", "Ato do piso"]}
                        linhas={limDet.regimes.map((r) => [dataBR(r.inicio), dataBR(r.fim), r.pld_min, r.pld_max_horario, r.pld_max_estrutural, r.ato_pld_min])}
                        casas={[null, null, 2, 2, 2, null]}
                      />
                    </>
                  ) : null}
                  <h3 className="mt-8 font-serif text-xl text-carvao">Menor valor horário observado por ano</h3>
                  <p className="mt-1 text-sm text-carvao-muted">
                    Referência descritiva, nunca usada como piso: o piso regulatório é o do ato vigente{limDet ? " (tabela acima)" : ""}.
                  </p>
                  <TabelaDados
                    titulo="Menor valor horário observado por ano e submercado"
                    colunas={["Ano", "Até", "SE/CO", "Sul", "Nordeste", "Norte"]}
                    linhas={pld.menor_valor_ano.map((m) => [m.ano, dataBR(m.ate), m.SE, m.S, m.NE, m.N])}
                    casas={[null, null, 2, 2, 2, 2]}
                  />
                  <p className="rotulo mt-6 text-mineral">Downloads</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {pld.downloads.map((d) => (
                      <li key={d.url}>
                        <a href={d.url} download className="text-energia-dark underline underline-offset-4">{d.rotulo}</a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-mineral [overflow-wrap:anywhere]">
                    Versão dos dados {pld.snapshot.id ? snapshotLegivel(pld.snapshot.id) : "sem identificador"} · sha256 {pld.snapshot.sha256} · série de {horaLocal(pld.primeira_hora)} a {horaLocal(pld.ultima_hora)} (horário de Brasília)
                  </p>
                </div>
              </>
            ) : (
              <Indisponivel titulo="PLD indisponível" motivo={pld?.motivo ?? "Os dados processados do PLD não foram gerados."} />
            )}
          </Capitulo>

          {/* 4. Submercados */}
          <Capitulo id="submercados" numero="4" subtitulo="Por que os preços dos submercados podem diferir?" titulo="Quatro preços, quatro regiões e as linhas de transmissão entre elas">
            {integra(rede) && integra(pld) ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <MapaSubmercados
                    fluxos={rede.fronteiras.map((f) => ({ de: f.de, para: f.para, fluxo: f.fluxo_dia }))}
                    precos={Object.fromEntries(pld.cartoes.map((c) => [c.sm, c.media_dia]))}
                    diaFluxo={dataBR(rede.dia_referencia)}
                    diaPreco={dataBR(pld.dia_referencia)}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mineral">
                    <span>Fonte: CCEE (PLD) e ONS (intercâmbio). O mapa não mostra limites de transferência nem explica diferenças de preço.</span>
                    <SobreEsteDado p={pld.proveniencia.diario} rotulo="Sobre o PLD médio" />
                    <SobreEsteDado p={rede.proveniencia.fluxo} rotulo="Sobre os fluxos" />
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
                    A CCEE calcula um PLD para cada submercado. As regiões estão ligadas por linhas de transmissão de fronteira, e o
                    ONS mede o <Termo slug="intercambio">intercâmbio</Termo> entre elas hora a hora, em MWmed (megawatt médio).
                  </p>
                  <p className="border border-dashed border-mineral p-3 text-sm text-carvao-muted">
                    <span className="rotulo mb-1 block text-mineral">Leitura usual do setor, ainda não conferida em documento primário</span>
                    Se a energia pudesse circular sem limite, o custo de atender uma carga a mais seria o mesmo em todo lugar. Como a
                    capacidade de transferência entre regiões é finita, uma região com sobra pode não conseguir enviar tudo o que
                    teria para outra, e os preços se separam.
                  </p>
                  <ul className="space-y-1 text-xs text-mineral">
                    <li className="flex flex-wrap items-center gap-2">Definições de PLD por submercado (CCEE) e de intercâmbio (ONS): <Conferido ok /></li>
                    <li className="flex flex-wrap items-center gap-2">Mecanismo de separação por limite de transferência: <Conferido ok={false} /></li>
                  </ul>
                  <p className="flex flex-wrap items-center gap-2 border-l-2 border-energia pl-4 text-sm text-carvao-muted">
                    <span>
                      {rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)
                        ? <>Em {dataBR(pld.dia_referencia)}, a diferença entre o maior e o menor PLD médio foi de {reais(rede.serie_amplitude_pld.find((a) => a.d === pld.dia_referencia)!.amplitude)}/MWh. </>
                        : null}
                      Nos últimos 30 dias, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença acima de {reais(pld.limiar_diferenca)}/MWh.
                    </span>
                    <SeloNatureza natureza="CALCULADO" />
                  </p>
                </div>
                <div className="lg:col-span-2" data-nivel="analisar">
                  <PainelEvidencia
                    nivelTitulo={3}
                    id="amplitude"
                    pergunta="Quando os submercados se separaram no último ano?"
                    subtitulo="Diferença entre o maior e o menor PLD médio diário · R$/MWh"
                    porQueImporta={<>Picos desta série marcam dias em que os PLDs médios das regiões ficaram mais distantes entre si.</>}
                    oQueMudou={<>{textoAmplitude(rede.resumo_amplitude)}</>}
                    comoInterpretar={<>Zero significa os quatro submercados com a mesma média diária. A série usa médias diárias; diferenças de poucas horas podem sumir na média.</>}
                    naoConcluir={<>A série não identifica qual fronteira ou linha causou a separação, nem se o limite de transferência foi atingido: os limites não estão integrados. A causa de uma separação não é atribuída.</>}
                    proveniencia={rede.proveniencia.amplitude}
                  >
                    <GraficoLinhas
                      titulo="Diferença entre o maior e o menor PLD médio diário"
                      dados={amplitude}
                      chaveX="x"
                      series={[{ id: "amp", rotulo: "Diferença máx.−mín.", cor: "var(--cor-energia)" }]}
                      unidade="R$/MWh"
                      casas={2}
                      zeroNoEixo
                    />
                  </PainelEvidencia>
                  <p className="mt-4 text-sm">
                    <Link href={`${rotaPainel("p012")}#p012`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                      {perguntaPainel("p012")} Separação hora a hora, por par e com o fluxo na mesma hora
                    </Link>
                  </p>
                </div>
              </div>
            ) : (
              <Indisponivel titulo="Dados de rede indisponíveis" motivo="As golds de rede ou de PLD não foram geradas nesta publicação." />
            )}
          </Capitulo>

          {/* 5. Previsão */}
          <Capitulo id="previsao" numero="5" subtitulo="Previsão" titulo="Para onde o PLD pode ir?">
            <p className="max-w-prose2 font-serif text-xl leading-snug text-carvao">Previsão é distribuição de possibilidades, não um único número.</p>
            <div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
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
                  <div className="border border-linha bg-superficie p-5">
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

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">Como ler, quando houver previsão</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  A mediana é o valor central da distribuição. As faixas mostram onde o realizado caiu no passado em casos comparáveis. A
                  frase &quot;em cerca de 80% dos casos&quot; só aparece quando a cobertura medida sustentar; caso contrário, a página diz
                  quanto a faixa realmente cobriu.
                </p>
              </div>
              <div className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">O que mudou desde a previsão anterior</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Sem previsões publicadas para comparar. Quando houver, esta seção separa o que <strong className="font-medium">mudou na informação</strong> (EAR, ENA, carga, renováveis, térmicas, intercâmbio) do que foi <strong className="font-medium">contribuição do modelo</strong>, que nunca é chamada de causa.
                </p>
              </div>
              <div className="border border-linha bg-superficie p-5">
                <h3 className="font-serif text-lg text-carvao">Por que confiar? O modelo tem acertado?</h3>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Ainda não há previsão publicada com realizado para comparar. Os resultados retrospectivos da pesquisa estão{" "}
                  {mods?.publicacao_resultados.liberada ? "no registro de modelos" : "retidos até a conclusão da revisão da pesquisa e a liberação pelo responsável pela plataforma"}.
                  Toda avaliação futura começa por previsão, realizado e erro, depois erro típico, depois cobertura da faixa, e só então métricas técnicas contra referências simples.
                </p>
              </div>
            </div>
            <div data-nivel="auditar" className="mt-8 border border-linha bg-superficie p-6">
              <h3 className="font-serif text-xl text-carvao">Regras de governança aplicadas</h3>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {prev &&
                  Object.entries(prev.regras).map(([k, v]) => (
                    <div key={k}>
                      <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-carvao">{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-4 text-sm text-carvao-muted">
                Validações automáticas, executadas a cada atualização antes de publicar (validador de governança do código do portal), bloqueiam: publicação de modelo não promovido, uso de dado posterior ao corte, alteração silenciosa de registro publicado, previsão sem versão ou snapshot, faixa não calibrada rotulada como 80%, cenário como previsão e ausência como número.
              </p>
            </div>
          </Capitulo>
        </ModoProfundidade>
      </main>
    </>
  );
}
