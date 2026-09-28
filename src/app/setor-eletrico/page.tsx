import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { CartoesPld } from "@/components/energia/CartoesPld";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { BarrasMix } from "@/components/energia/BarrasMix";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, pct, reais, sinal } from "@/lib/energia/formato";
import { ROTULO_FAIXA_USUAL, sin } from "@/lib/energia/leituras";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Observatório Brasileiro do Setor Elétrico · Scrutiniums" },
  description:
    "O que está acontecendo no sistema elétrico brasileiro: PLD dos quatro submercados, reservatórios, afluências, geração por fonte, carga e intercâmbios, com fonte e data em cada número.",
  alternates: { canonical: "/setor-eletrico" },
};

function Secao({ id, numero, rotulo, titulo, children, cta }: { id: string; numero: string; rotulo: string; titulo: string; children: React.ReactNode; cta?: { href: string; texto: string } }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-12 md:py-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rotulo flex items-center gap-3 text-mineral">
            <span className="font-serif text-lg normal-case tracking-normal text-energia">{numero}</span>
            {rotulo}
          </p>
          <h2 id={`${id}-h`} className="mt-2 max-w-3xl font-serif text-2xl leading-snug text-carvao md:text-3xl">
            {titulo}
          </h2>
        </div>
        {cta && (
          <Link href={cta.href} className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim">
            {cta.texto} <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function VisaoGeralEnergia() {
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const carga = gold.carga();
  const rede = gold.rede();
  const sintese = gold.sintese();
  const meta = gold.meta();

  const hidSin = integra(hid) ? sin(hid.subsistemas) : undefined;
  const cargaSin = integra(carga) ? sin(carga.subsistemas) : undefined;
  const gSin = integra(ger) ? ger.regioes.find((r) => r.rg === "SIN") : undefined;

  // EAR do SIN nos últimos 365 dias contra a faixa histórica da data
  const bandas = integra(hid) ? new Map(hid.bandas_ear.map((b) => [b.md as string, b])) : new Map();
  const earSerie = integra(hid)
    ? hid.serie_ear.slice(-365).map((p) => {
        const md = p.d.slice(5, 10) === "02-29" ? "02-28" : p.d.slice(5, 10);
        const b = bandas.get(md) as Record<string, number | null> | undefined;
        return { d: p.d, SIN: p.SIN ?? null, p10: b?.SIN_p10 ?? null, p50: b?.SIN_p50 ?? null, p90: b?.SIN_p90 ?? null };
      })
    : [];
  const cargaSerie = integra(carga) ? carga.serie.slice(-365).map((p) => ({ d: p.d, SIN: p.SIN ?? null })) : [];

  return (
    <>
      <CabecalhoEnergia atual="visao-geral" />
      <MarcaVisita secao="energia:visao-geral" />
      <main className="mx-auto max-w-page px-6">
        <div className="pb-4 pt-10 md:pt-14">
          <p className="rotulo text-mineral">Visão geral</p>
          <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.1] text-carvao">
            O que está acontecendo no sistema elétrico brasileiro?
          </h1>
          <p className="mt-4 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
            Água, geração, consumo, rede e preço, lidos a partir dos dados abertos do ONS e da CCEE. Cada número leva à
            sua fonte; o que ainda não está integrado aparece como ausência, nunca como estimativa.
          </p>
          {meta && (
            <p className="mt-4 text-xs text-mineral">
              Operação (ONS) até {integra(hid) ? dataBR(hid.dia_referencia_ear) : "sem dado"} · PLD (CCEE) até{" "}
              {integra(pld) ? dataBR(pld.dia_referencia) : "sem dado"}
              {integra(pld) && pld.coleta_direta
                ? pld.coleta_direta.ok
                  ? " · última coleta direta na CCEE bem-sucedida."
                  : " · a última tentativa de coleta direta na CCEE falhou; o PLD vem da captura primária mais recente."
                : "."}
            </p>
          )}
        </div>

        {/* Bloco 1 */}
        <Secao id="sistema" numero="1" rotulo="O sistema em 60 segundos" titulo="Síntese montada por regras, trecho a trecho verificável">
          {integra(sintese) && sintese.frases.length ? (
            <div className="border border-linha bg-superficie p-6 md:p-8">
              <ul className="space-y-4">
                {sintese.frases.map((f) => (
                  <li key={f.id} className="font-serif text-lg leading-relaxed text-carvao md:text-xl">
                    {f.trechos.map((t, i) =>
                      t.href ? (
                        <Link key={i} href={t.href} className="underline decoration-energia/50 underline-offset-4 hover:decoration-energia" title={`Evidência: ${t.evidencia}`}>
                          {t.texto}
                        </Link>
                      ) : (
                        <span key={i}>{t.texto}</span>
                      ),
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex flex-wrap items-center gap-2 border-t border-linha pt-4 text-xs text-mineral">
                <SeloNatureza natureza="CALCULADO" /> {sintese.nota} Cada frase usa a data de referência da sua fonte.{" "}
                <Link href="/setor-eletrico/metodologia#sintese" className="text-energia-dark underline underline-offset-4">Regras das frases</Link>
              </p>
            </div>
          ) : (
            <Indisponivel titulo="Síntese indisponível" motivo="A gold de síntese não foi gerada nesta publicação." />
          )}
        </Secao>

        {/* Bloco 2 */}
        <Secao id="preco" numero="2" rotulo="Preço" titulo="Quanto custa a energia, hora a hora, em cada região?" cta={{ href: "/setor-eletrico/pld", texto: "Entender o PLD" }}>
          {integra(pld) ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="preco-painel"
              pergunta={`O PLD de ${dataBR(pld.dia_referencia)} nos quatro submercados`}
              subtitulo="PLD médio diário · R$/MWh nominais"
              porQueImporta={<>O <Termo slug="pld">PLD</Termo> é calculado pela CCEE para cada hora e submercado, com base no custo marginal de operação: o custo de atender uma unidade adicional de carga, segundo o ONS.</>}
              oQueMudou={<>No Sudeste/Centro-Oeste, {pld.cartoes[0].variacao_dia_anterior ? `${sinal(pld.cartoes[0].variacao_dia_anterior.abs, 2)} R$/MWh sobre o dia anterior` : "sem comparação com o dia anterior"}. Nos últimos 30 dias houve diferença acima de R$ 1/MWh entre submercados em {num(100 * pld.periodos["30d"].diferenca.frac_horas_acima_limiar)}% das horas.</>}
              comoInterpretar={<>A posição usa o percentil da média diária entre todas as médias diárias desde 01/01/2021, em valores nominais. Faixa baixa abaixo do 25º percentil, alta acima do 75º.</>}
              naoConcluir={<>O PLD não é a tarifa do consumidor e não é previsão. Comparações com anos anteriores misturam limites regulatórios diferentes, que não foram auditados nesta fase.</>}
              proveniencia={pld.proveniencia.diario}
            >
              <CartoesPld pld={pld} />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="PLD indisponível" motivo={pld?.motivo ?? "A gold do PLD não foi gerada."} />
          )}
        </Secao>

        {/* Bloco 3 */}
        <Secao id="agua" numero="3" rotulo="Água" titulo="Quanta energia temos armazenada e quanta água está chegando?" cta={{ href: "/setor-eletrico/agua-e-clima", texto: "Entender água e reservatórios" }}>
          {integra(hid) && hidSin ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="agua-painel"
              pergunta={`Reservatórios do SIN com ${pct(hidSin.ear.valor)} da capacidade, ${ROTULO_FAIXA_USUAL[hidSin.ear.faixa ?? "dentro"]}`}
              subtitulo="EAR do SIN · % da EAR máxima, com faixa histórica do 10º ao 90º percentil"
              natureza="CALCULADO"
              porQueImporta={<>A <Termo slug="ear">EAR</Termo> é o estoque de energia em forma de água. A <Termo slug="ena">ENA</Termo> é o que chega para repor esse estoque. Juntas, dizem quanto o sistema depende de outras fontes nas próximas semanas.</>}
              oQueMudou={<>Em 30 dias, a EAR do SIN variou {sinal(hidSin.ear.variacao_30d_pp)} p.p. A ENA acumulada em 30 dias está em {pct(hidSin.ena.pct_mlt_30d, 0)} da MLT{hidSin.ena.faixa_30d ? `, ${ROTULO_FAIXA_USUAL[hidSin.ena.faixa_30d]}` : ""}.{hid.desvio_principal ? ` Maior desvio frente à mediana da data: ${hid.desvio_principal.nome} (${sinal(hid.desvio_principal.desvio_pp)} p.p.).` : ""}</>}
              comoInterpretar={<>A faixa sombreada mostra, para cada data, onde a EAR esteve em 80% dos anos desde 2001 (10º a 90º percentil). Fora dela, a situação é incomum para a época.</>}
              naoConcluir={<>Reservatório alto não garante preço baixo, e ENA alta em um subsistema não se transfere integralmente aos demais. A capacidade máxima mudou ao longo do tempo.</>}
              proveniencia={hid.proveniencia.ear_sin}
            >
              <GraficoLinhas
                titulo="EAR do SIN nos últimos 12 meses e faixa histórica da data"
                dados={earSerie}
                chaveX="d"
                series={[
                  { id: "SIN", rotulo: "EAR do SIN", cor: "var(--cor-energia)", espessura: 2.5 },
                  { id: "p50", rotulo: "Mediana histórica", cor: "var(--serie-referencia)", tracejada: true },
                ]}
                banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil (2001 a ano anterior)" }}
                unidade="%"
                casas={1}
                formatoX="data"
              />
              <ul className="mt-5 grid gap-3 border-t border-linha pt-4 sm:grid-cols-2 lg:grid-cols-4">
                {hid.subsistemas.filter((s) => s.sm !== "SIN").map((s) => (
                  <li key={s.sm} className="text-sm">
                    <p className="rotulo text-mineral">{s.nome}</p>
                    <p className="mt-1 tabular-nums text-carvao">EAR {pct(s.ear.valor)} · mediana {pct(s.ear.mediana_historica)}</p>
                    <p className="text-xs text-mineral">ENA 30 dias: {pct(s.ena.pct_mlt_30d, 0)} da MLT {s.ena.faixa_30d && s.ena.faixa_30d !== "dentro" ? `(${s.ena.faixa_30d} da faixa usual)` : ""}</p>
                  </li>
                ))}
              </ul>
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Hidrologia indisponível" motivo={hid?.motivo ?? "A gold de hidrologia não foi gerada."} />
          )}
        </Secao>

        {/* Bloco 4 */}
        <Secao id="geracao" numero="4" rotulo="Geração" titulo="Como estamos gerando?" cta={{ href: "/setor-eletrico/geracao", texto: "Ver a matriz em detalhe" }}>
          {integra(ger) && gSin ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="geracao-painel"
              pergunta={`Hidráulica, eólica e solar somaram ${pct(gSin["7d"]?.hes)} da geração verificada nos últimos 7 dias`}
              subtitulo="Geração verificada do SIN por fonte · % do total, por janela"
              porQueImporta={<>A composição mostra de onde vem a energia que atende a carga e quanto o sistema recorre às térmicas, as usinas cujo <Termo slug="cvu">Custo Variável Unitário</Termo> entra na programação da operação.</>}
              oQueMudou={<>Térmicas com {pct(ger.termica_contexto.participacao_7d)} nos últimos 7 dias, contra mediana de {pct(ger.termica_contexto.mediana_365d)} nos 12 meses anteriores (percentil {num(ger.termica_contexto.percentil, 1)}).</>}
              comoInterpretar={<>Cada barra soma 100% da geração verificada na janela. Compare a semana atual com a mesma semana dos anos anteriores para separar sazonalidade de mudança.</>}
              naoConcluir={<>&quot;Hidráulica, eólica e solar&quot; não é a participação renovável: a térmica do balanço inclui biomassa e outras fontes que o conjunto não separa. A micro e minigeração distribuída não está no balanço.</>}
              proveniencia={ger.proveniencia.geracao}
            >
              <BarrasMix
                linhas={[
                  { rotulo: `Dia ${dataBR(ger.dia_referencia)}`, mix: gSin.dia },
                  { rotulo: "Últimos 7 dias", mix: gSin["7d"], destaque: true },
                  ...ger.comparacao_anual.slice(0, 3).map((a) => ({ rotulo: `Mesmos 7 dias de ${a.ano}`, mix: a["7d"] })),
                  { rotulo: "Últimos 30 dias", mix: gSin["30d"] },
                  { rotulo: "Últimos 12 meses", mix: gSin["12m"] },
                ]}
              />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Geração indisponível" motivo={ger?.motivo ?? "A gold de geração não foi gerada."} />
          )}
        </Secao>

        {/* Bloco 5 */}
        <Secao id="consumo" numero="5" rotulo="Carga e consumo" titulo="Quanto estamos consumindo?" cta={{ href: "/setor-eletrico/carga", texto: "Ver carga por subsistema" }}>
          {integra(carga) && cargaSin ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="carga-painel"
              pergunta={
                cargaSin.ult7?.variacao_pct !== null && cargaSin.ult7
                  ? `A carga do SIN ficou ${num(Math.abs(cargaSin.ult7.variacao_pct ?? 0))}% ${(cargaSin.ult7.variacao_pct ?? 0) >= 0 ? "acima" : "abaixo"} da mesma semana do ano passado`
                  : "Carga do SIN nos últimos 12 meses"
              }
              subtitulo="Carga de energia diária do SIN · MWmed"
              natureza="CALCULADO"
              porQueImporta={<>Mais <Termo slug="carga">carga</Termo> exige mais geração. Picos de consumo pressionam as fontes de custo mais alto.</>}
              oQueMudou={<>Em {dataBR(carga.dia_referencia)}, {num(cargaSin.dia, 0)} MWmed. Maior carga diária dos últimos 12 meses: {num(cargaSin.max_12m.valor, 0)} MWmed em {dataBR(cargaSin.max_12m.dia)}.</>}
              comoInterpretar={<>A comparação anual só é feita quando os dois períodos estão no mesmo regime metodológico do ONS (a estimativa de MMGD entrou na carga em 29/04/2023).</>}
              naoConcluir={<>Temperatura, feriados e dias úteis afetam a carga e não são ajustados. Variação de carga não mede atividade econômica por si.</>}
              proveniencia={carga.proveniencia.sin}
            >
              <GraficoLinhas
                titulo="Carga diária do SIN nos últimos 12 meses"
                dados={cargaSerie}
                chaveX="d"
                series={[{ id: "SIN", rotulo: "Carga do SIN", cor: "var(--cor-energia)" }]}
                unidade="MWmed"
                casas={0}
              />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Carga indisponível" motivo={carga?.motivo ?? "A gold de carga não foi gerada."} />
          )}
        </Secao>

        {/* Bloco 6 */}
        <Secao id="rede" numero="6" rotulo="Rede" titulo="A rede está limitando o sistema?" cta={{ href: "/setor-eletrico/rede", texto: "Ver intercâmbios" }}>
          {integra(rede) && integra(pld) ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="rede-painel"
              pergunta="Para onde a energia está fluindo e se os preços se separaram"
              subtitulo="Intercâmbio médio verificado entre subsistemas · MWmed · e PLD médio diário"
              porQueImporta={<>Quando a transferência entre regiões encontra limite, os <Termo slug="submercado">submercados</Termo> podem ter preços diferentes mesmo com energia sobrando em um deles.</>}
              oQueMudou={<>Nos últimos 30 dias da série de PLD, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença de preço acima de R$ 1/MWh entre submercados; maior diferença de {reais(pld.periodos["30d"].diferenca.maior)}/MWh.</>}
              comoInterpretar={<>Preços iguais nos quatro submercados são compatíveis com transferência sem restrição relevante no cálculo do preço; preços diferentes mostram que os submercados se separaram. O detalhamento da regra está na documentação da CCEE, com conferência pendente nesta fase.</>}
              naoConcluir={<>Os limites de intercâmbio não estão integrados: fluxo alto não prova rede no limite, e esta página não identifica qual linha restringiu a transferência.</>}
              proveniencia={rede.proveniencia.fluxo}
            >
              <MapaSubmercados
                fluxos={rede.fronteiras.map((f) => ({ de: f.de, para: f.para, fluxo: f.fluxo_dia }))}
                precos={Object.fromEntries(pld.cartoes.map((c) => [c.sm, c.media_dia]))}
                diaFluxo={dataBR(rede.dia_referencia)}
                diaPreco={dataBR(pld.dia_referencia)}
              />
              <TabelaDados
                titulo="Intercâmbio médio por fronteira"
                colunas={["Fronteira", "Fluxo do dia (MWmed)", "Programado (MWmed)", "Média 30 dias (MWmed)"]}
                linhas={rede.fronteiras.map((f) => [f.nome, f.fluxo_dia, f.programado_dia, f.fluxo_media_30d])}
              />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Rede indisponível" motivo={rede?.motivo ?? "A gold de rede não foi gerada."} />
          )}
        </Secao>

        {/* Bloco 7 */}
        <Secao id="observar" numero="7" rotulo="O que observar" titulo="O que observar nas próximas semanas">
          {integra(sintese) ? (
            <div className="border border-linha bg-superficie">
              <p className="border-b border-linha px-6 py-4 text-sm text-carvao-muted">
                Regras explícitas avaliadas sobre os dados mais recentes. {sintese.observar.filter((o) => o.ativo).length} de{" "}
                {sintese.observar.length} estão ativas. Nenhuma é previsão: cada uma descreve uma condição medida.
              </p>
              <ul>
                {sintese.observar.map((o) => (
                  <li key={o.id} className="grid gap-2 border-b border-linha px-6 py-4 last:border-b-0 md:grid-cols-[9rem_1fr]">
                    <p className={`rotulo flex items-center gap-2 ${o.ativo ? "text-carvao" : "text-mineral"}`}>
                      <span aria-hidden="true">{o.ativo ? "◉" : "○"}</span>
                      {o.ativo ? (o.tipo === "evento" ? "Evento" : "Ativa") : "Inativa"}
                    </p>
                    <div>
                      <p className={`font-medium ${o.ativo ? "text-carvao" : "text-carvao-muted"}`}>
                        <Link href={o.href} className="underline-offset-4 hover:underline">{o.titulo}</Link>
                      </p>
                      <p className="mt-1 text-sm text-carvao-muted">{o.evidencia}</p>
                      <p className="mt-1 text-xs text-mineral">Regra: {o.condicao}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Indisponivel titulo="Regras indisponíveis" motivo="A gold de síntese não foi gerada." />
          )}
        </Secao>
      </main>
    </>
  );
}
