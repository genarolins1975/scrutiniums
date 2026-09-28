import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { CartoesPld } from "@/components/energia/CartoesPld";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { BarrasMix } from "@/components/energia/BarrasMix";
import { Sparkline } from "@/components/energia/Sparkline";
import { intensidadeFaixa } from "@/lib/energia/geo";
import { MapaVivo, type CamadaMapa } from "@/components/energia/MapaVivo";
import { SistemaEmUmaTela, type BlocoSistema } from "@/components/energia/SistemaEmUmaTela";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, pct, reais, sinal } from "@/lib/energia/formato";
import { ROTULO_FAIXA_USUAL, sin } from "@/lib/energia/leituras";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";
import { linhaDeDatas } from "@/lib/energia/referencias";
import type { Submercado } from "@/lib/energia/tipos";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Visão geral: como está o sistema elétrico brasileiro hoje",
  description:
    "O sistema elétrico brasileiro em um mapa vivo: PLD dos quatro submercados, reservatórios, afluências, geração por fonte, carga e intercâmbios, com fonte e data em cada número.",
  alternates: { canonical: "/setor-eletrico/visao-geral" },
};

const SMS: Submercado[] = ["N", "NE", "SE", "S"];
const NOME_FONTE: Record<string, string> = { hidraulica: "hidráulica", termica: "térmica", eolica: "eólica", solar: "solar" };

function Secao({ id, numero, rotulo, titulo, children, cta, resumo }: { id: string; numero: string; rotulo: string; titulo: string; children: React.ReactNode; cta?: { href: string; texto: string }; resumo?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-12 md:py-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="rotulo flex items-center gap-3 text-mineral">
            <span className="font-serif text-lg normal-case tracking-normal text-energia">{numero}</span>
            {rotulo}
          </p>
          <h2 id={`${id}-h`} className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
            {titulo}
          </h2>
          {resumo && <p className="mt-3 text-base leading-relaxed text-carvao-muted">{resumo}</p>}
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

  /* ---------- camadas do mapa vivo ---------- */
  const camadas: CamadaMapa[] = [];
  if (integra(pld)) {
    const por = Object.fromEntries(pld.cartoes.map((c) => [c.sm, c]));
    camadas.push({
      id: "preco",
      rotulo: "Preço",
      icone: "preco",
      tom: "preco",
      titulo: `PLD médio de ${dataBR(pld.dia_referencia)} em cada submercado`,
      valores: Object.fromEntries(
        SMS.map((sm) => {
          const c = por[sm];
          return [sm, c ? { valor: `${reais(c.media_dia)}`, sub: c.posicao.percentil !== null ? `percentil ${num(c.posicao.percentil, 1)} desde 2021` : "R$/MWh", intensidade: intensidadeFaixa(c.posicao.percentil) } : { valor: "sem dado", intensidade: null }];
        }),
      ),
      legenda: "Cor: faixa da média do dia entre as médias diárias do submercado desde 2021, em três tons: claro abaixo do 25º percentil, médio entre o 25º e o 75º, escuro acima do 75º. Valores nominais em R$/MWh.",
      referencia: `PLD horário (CCEE), médias calculadas pela Scrutiniums · ${dataBR(pld.dia_referencia)} · diferença entre o maior e o menor submercado no dia: ${reais(pld.amplitude_dia)}/MWh`,
      href: "/setor-eletrico/pld#hoje",
      hrefRotulo: "Ver o PLD hora a hora",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const c = por[sm];
          return [
            sm,
            c
              ? [
                  `Média do dia: ${reais(c.media_dia)}/MWh; faixa horária de ${reais(c.min_hora)} a ${reais(c.max_hora)}.`,
                  c.variacao_dia_anterior ? `Sobre o dia anterior: ${sinal(c.variacao_dia_anterior.abs, 2)} R$/MWh (${sinal(c.variacao_dia_anterior.pct)}%).` : "Sem comparação com o dia anterior.",
                  c.posicao.faixa ? `Na faixa ${c.posicao.faixa} das médias diárias desde 2021 (percentil ${num(c.posicao.percentil, 1)}).` : "Sem posição histórica.",
                ]
              : ["Sem dado."],
          ];
        }),
      ),
    });
  }
  if (integra(hid)) {
    const por = Object.fromEntries(hid.subsistemas.map((s) => [s.sm, s]));
    camadas.push({
      id: "agua",
      rotulo: "Água",
      icone: "agua",
      tom: "agua",
      titulo: `Energia armazenada em ${dataBR(hid.dia_referencia_ear)}, em % da capacidade máxima`,
      valores: Object.fromEntries(
        SMS.map((sm) => {
          const s = por[sm];
          return [sm, s && s.ear.valor !== null ? { valor: pct(s.ear.valor), sub: s.ear.mediana_historica !== null ? `mediana da data ${pct(s.ear.mediana_historica)}` : undefined, intensidade: s.ear.valor / 100 } : { valor: "sem dado", intensidade: null }];
        }),
      ),
      legenda: "Cor: EAR em % da EAR máxima (mais escuro, mais cheio). O valor do SIN, calculado pela plataforma, está na faixa abaixo do mapa.",
      referencia: `EAR diária por subsistema (ONS) · ${dataBR(hid.dia_referencia_ear)} · SIN: ${pct(hidSin?.ear.valor)} da EAR máxima`,
      href: "/setor-eletrico/agua-e-clima",
      hrefRotulo: "Ver reservatórios e afluências",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const s = por[sm];
          return [
            sm,
            s
              ? [
                  `EAR: ${pct(s.ear.valor)} da máxima, ${s.ear.faixa ? ROTULO_FAIXA_USUAL[s.ear.faixa] : "sem faixa"} (faixa usual ${pct(s.ear.p10)} a ${pct(s.ear.p90)}).`,
                  `Em 30 dias: ${sinal(s.ear.variacao_30d_pp)} p.p.`,
                  `ENA de 30 dias: ${pct(s.ena.pct_mlt_30d, 1)} da MLT${s.ena.faixa_30d ? `, ${ROTULO_FAIXA_USUAL[s.ena.faixa_30d]}` : ""}.`,
                ]
              : ["Sem dado."],
          ];
        }),
      ),
    });
  }
  if (integra(ger)) {
    const por = Object.fromEntries(ger.regioes.map((r) => [r.rg, r]));
    camadas.push({
      id: "geracao",
      rotulo: "Geração",
      icone: "geracao",
      tom: "geracao",
      titulo: "Fonte principal de cada região nos últimos 7 dias",
      valores: Object.fromEntries(
        SMS.map((sm) => {
          const m = por[sm]?.["7d"];
          if (!m) return [sm, { valor: "sem dado", intensidade: null }];
          const principal = (Object.entries(m.participacao) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
          return [sm, { valor: `${pct(principal[1], 0)} ${NOME_FONTE[principal[0]]}`, sub: `hidráulica, eólica e solar: ${pct(m.hes, 0)}`, intensidade: m.hes / 100 }];
        }),
      ),
      legenda: "Cor: soma de hidráulica, eólica e solar na geração verificada da região (mais escuro, maior). Não é a participação renovável: a térmica não vem separada por combustível.",
      referencia: `Balanço de Energia nos Subsistemas (ONS) · 7 dias até ${dataBR(ger.dia_referencia)}`,
      href: "/setor-eletrico/geracao",
      hrefRotulo: "Ver a matriz e o fluxo por fonte",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const m = por[sm]?.["7d"];
          return [
            sm,
            m
              ? [
                  `Geração verificada média: ${num(m.total_mwmed, 0)} MWmed.`,
                  `Hidráulica ${pct(m.participacao.hidraulica)}, térmica ${pct(m.participacao.termica)}, eólica ${pct(m.participacao.eolica)}, solar ${pct(m.participacao.solar)}.`,
                ]
              : ["Sem dado."],
          ];
        }),
      ),
    });
  }
  if (integra(carga)) {
    const por = Object.fromEntries(carga.subsistemas.map((s) => [s.sm, s]));
    const total = por.SIN?.dia ?? null;
    camadas.push({
      id: "carga",
      rotulo: "Carga",
      icone: "carga",
      tom: "carga",
      titulo: `Carga de cada subsistema em ${dataBR(carga.dia_referencia)}`,
      valores: Object.fromEntries(
        SMS.map((sm) => {
          const s = por[sm];
          return [sm, s ? { valor: `${num(s.dia / 1000, 1)} GWmed`, sub: total ? `${pct((100 * s.dia) / total, 0)} do SIN` : undefined, intensidade: total ? s.dia / total / 0.6 : null } : { valor: "sem dado", intensidade: null }];
        }),
      ),
      legenda: "Cor: parcela da carga do SIN (mais escuro, maior parcela). 1 GWmed = 1.000 MWmed.",
      referencia: `Carga de Energia Diária (ONS) · ${dataBR(carga.dia_referencia)} · SIN: ${num(total, 0)} MWmed`,
      href: "/setor-eletrico/carga",
      hrefRotulo: "Ver a carga por subsistema",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const s = por[sm];
          return [
            sm,
            s
              ? [
                  `Carga do dia: ${num(s.dia, 0)} MWmed.`,
                  s.ult7?.variacao_pct !== null && s.ult7 ? `Últimos 7 dias: ${sinal(s.ult7.variacao_pct)}% sobre os mesmos dias de ${s.ult7.fim_anterior.slice(0, 4)}.` : "Sem comparação anual homogênea.",
                  `Maior carga em 12 meses: ${num(s.max_12m.valor, 0)} MWmed em ${dataBR(s.max_12m.dia)}.`,
                ]
              : ["Sem dado."],
          ];
        }),
      ),
    });
  }
  if (integra(rede)) {
    const por = Object.fromEntries(rede.liquido_subsistemas.map((l) => [l.sm, l]));
    const maxSaldo = Math.max(1, ...rede.liquido_subsistemas.map((l) => Math.abs(l.dia ?? 0)));
    camadas.push({
      id: "rede",
      rotulo: "Rede",
      icone: "rede",
      tom: "rede",
      titulo: `Para onde a energia fluiu em ${dataBR(rede.dia_referencia)}`,
      valores: Object.fromEntries(
        SMS.map((sm) => {
          const l = por[sm];
          return [sm, l && l.dia !== null ? { valor: `${num(l.dia, 0)} MWmed`, sub: l.dia >= 0 ? "exportou no dia" : "importou no dia", intensidade: Math.abs(l.dia) / maxSaldo } : { valor: "sem dado", intensidade: null }];
        }),
      ),
      fluxos: rede.fronteiras.map((f) => ({ de: f.de, para: f.para, valor: f.fluxo_dia })),
      legenda: "Setas: sentido e fluxo médio verificado em cada fronteira (espessura proporcional ao volume). Cor: saldo do subsistema no balanço do ONS. Limites de intercâmbio não integrados: fluxo alto não prova rede no limite.",
      referencia: `Intercâmbios entre subsistemas (ONS) · ${dataBR(rede.dia_referencia)} · saldos do balanço de energia em ${dataBR(rede.dia_referencia_liquido)}`,
      href: "/setor-eletrico/rede",
      hrefRotulo: "Ver fluxos e diferenças de preço",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const l = por[sm];
          const fr = rede.fronteiras.filter((f) => f.de === sm || f.para === sm);
          return [
            sm,
            [
              l && l.dia !== null ? `Saldo do dia: ${num(l.dia, 0)} MWmed (${l.dia >= 0 ? "exportação" : "importação"} líquida); média de 30 dias ${num(l.media_30d, 0)}.` : "Sem saldo nesta publicação.",
              ...fr.map((f) => (f.fluxo_dia === null ? `${f.nome}: sem dado` : `${f.nome}: ${num(Math.abs(f.fluxo_dia), 0)} MWmed${f.fluxo_dia < 0 ? " no sentido inverso" : ""}.`)),
            ],
          ];
        }),
      ),
    });
  }

  /* ---------- sistema em uma tela ---------- */
  const blocos: BlocoSistema[] = [];
  if (integra(hid) && hidSin && hidSin.ear.valor !== null) {
    blocos.push({
      id: "agua",
      icone: "agua",
      rotulo: "Água",
      valor: pct(hidSin.ear.valor, 0),
      unidade: "da EAR máxima",
      contexto: `${sinal(hidSin.ear.desvio_mediana_pp)} p.p. frente à mediana da data`,
      natureza: "CALCULADO",
      sparkline: hid.serie_ear.slice(-90).map((p) => p.SIN ?? null),
      referencia: hidSin.ear.mediana_historica,
      cor: "var(--serie-hidraulica)",
      href: "/setor-eletrico/agua-e-clima",
      hrefRotulo: "Água e clima",
      detalhe: (
        <>
          Em {dataBR(hidSin.ear.dia)}, os reservatórios do SIN guardavam {pct(hidSin.ear.valor)} da energia armazenável máxima, {ROTULO_FAIXA_USUAL[hidSin.ear.faixa ?? "dentro"]}{" "}
          (faixa usual de {pct(hidSin.ear.p10)} a {pct(hidSin.ear.p90)}, mediana {pct(hidSin.ear.mediana_historica)}). Em 30 dias, {sinal(hidSin.ear.variacao_30d_pp)} p.p. A afluência acumulada em 30 dias foi{" "}
          {pct(hidSin.ena.pct_mlt_30d, 1)} da média de longo termo. A linha tracejada da série é a mediana histórica da data.
        </>
      ),
    });
  }
  if (integra(ger) && gSin?.["7d"]) {
    const m = gSin["7d"];
    blocos.push({
      id: "geracao",
      icone: "geracao",
      rotulo: "Geração",
      valor: pct(m.hes, 0),
      unidade: "hidráulica, eólica e solar",
      contexto: `térmicas com ${pct(ger.termica_contexto.participacao_7d)} em 7 dias (percentil ${num(ger.termica_contexto.percentil, 1)} do último ano)`,
      natureza: "CALCULADO",
      sparkline: ger.serie_sin.slice(-90).map((p) => {
        const t = (p.hidraulica ?? 0) + (p.termica ?? 0) + (p.eolica ?? 0) + (p.solar ?? 0);
        return t > 0 ? (100 * ((p.hidraulica ?? 0) + (p.eolica ?? 0) + (p.solar ?? 0))) / t : null;
      }),
      cor: "var(--serie-eolica)",
      href: "/setor-eletrico/geracao",
      hrefRotulo: "Geração",
      detalhe: (
        <>
          Nos 7 dias até {dataBR(m.fim)}, a geração verificada do SIN foi de {num(m.total_mwmed, 0)} MWmed em média: hidráulica {pct(m.participacao.hidraulica)}, eólica {pct(m.participacao.eolica)}, solar{" "}
          {pct(m.participacao.solar)} e térmica {pct(m.participacao.termica)}. A série mostra a soma de hidráulica, eólica e solar dia a dia; não é a participação renovável, porque a térmica não vem separada por combustível.
        </>
      ),
    });
  }
  if (integra(rede)) {
    const ne = rede.fronteiras.find((f) => f.par === "NE_SE");
    blocos.push({
      id: "transmissao",
      icone: "rede",
      rotulo: "Transmissão",
      valor: ne && ne.fluxo_dia !== null ? num(Math.abs(ne.fluxo_dia), 0) : "sem dado",
      unidade: ne && ne.fluxo_dia !== null ? `MWmed ${ne.fluxo_dia >= 0 ? "NE → SE/CO" : "SE/CO → NE"}` : undefined,
      contexto: `${rede.fronteiras.filter((f) => f.fluxo_dia !== null).length} de 4 fronteiras com fluxo medido em ${dataBR(rede.dia_referencia)}`,
      natureza: "CALCULADO",
      sparkline: rede.serie_fluxos.slice(-90).map((p) => (typeof p.NE_SE === "number" ? p.NE_SE : null)),
      cor: "var(--cor-energia)",
      href: "/setor-eletrico/rede",
      hrefRotulo: "Rede",
      detalhe: (
        <>
          Fluxos médios verificados em {dataBR(rede.dia_referencia)}:{" "}
          {rede.fronteiras
            .map((f) => (f.fluxo_dia === null ? `${f.nome} sem dado` : `${f.fluxo_dia >= 0 ? f.nome : f.nome.split(" → ").reverse().join(" → ")} ${num(Math.abs(f.fluxo_dia), 0)} MWmed`))
            .join("; ")}
          . A série mostra a fronteira Nordeste → Sudeste/Centro-Oeste. Os limites de intercâmbio não estão integrados: a página não afirma que a rede atingiu limite.
        </>
      ),
    });
  }
  if (integra(carga) && cargaSin) {
    blocos.push({
      id: "consumo",
      icone: "carga",
      rotulo: "Consumo",
      valor: num(cargaSin.dia / 1000, 1),
      unidade: "GWmed de carga",
      contexto: cargaSin.ult7?.variacao_pct !== null && cargaSin.ult7 ? `${sinal(cargaSin.ult7.variacao_pct)}% em 7 dias sobre os mesmos dias de ${cargaSin.ult7.fim_anterior.slice(0, 4)}` : "sem comparação anual homogênea",
      natureza: "CALCULADO",
      sparkline: carga.serie.slice(-90).map((p) => p.SIN ?? null),
      cor: "var(--cor-carvao-muted)",
      href: "/setor-eletrico/carga",
      hrefRotulo: "Carga e consumo",
      detalhe: (
        <>
          Em {dataBR(carga.dia_referencia)}, a carga do SIN (soma dos quatro subsistemas) foi de {num(cargaSin.dia, 0)} MWmed. Maior carga diária dos últimos 12 meses: {num(cargaSin.max_12m.valor, 0)} MWmed em{" "}
          {dataBR(cargaSin.max_12m.dia)}. A comparação anual só é feita dentro do mesmo regime metodológico declarado pelo ONS; temperatura, feriados e dias úteis não são ajustados.
        </>
      ),
    });
  }
  if (integra(pld)) {
    const se = pld.cartoes.find((c) => c.sm === "SE");
    if (se) {
      blocos.push({
        id: "preco",
        icone: "preco",
        rotulo: "Preço",
        valor: reais(se.media_dia, 0),
        unidade: "por MWh, SE/CO",
        contexto: se.posicao.percentil !== null ? `percentil ${num(se.posicao.percentil, 1)} das médias diárias desde 2021` : "sem posição histórica",
        natureza: "CALCULADO",
        sparkline: pld.diario.slice(-90).map((p) => p.SE),
        cor: "var(--serie-pld)",
        href: "/setor-eletrico/pld",
        hrefRotulo: "PLD",
        detalhe: (
          <>
            PLD médio de {dataBR(pld.dia_referencia)} no Sudeste/Centro-Oeste: {reais(se.media_dia)}/MWh, com valores horários de {reais(se.min_hora)} a {reais(se.max_hora)}. Diferença entre o maior e o menor submercado no dia:{" "}
            {reais(pld.amplitude_dia)}/MWh. O PLD não é a tarifa do consumidor e não é previsão; a posição histórica não diz para onde o preço vai.
          </>
        ),
      });
    }
  }

  return (
    <>
      <CabecalhoEnergia atual="visao-geral" />
      <MarcaVisita secao="energia:visao-geral" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        {/* pergunta + resposta curta */}
        <header className="pt-10 md:pt-14">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="sistema" tamanho={15} /> Visão geral
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.1] text-carvao">{PAGINAS_MAPA["visao-geral"].pergunta}</h1>
          <div id="sistema" className="mt-6 scroll-mt-24">
            {integra(sintese) && sintese.frases.length ? (
              <ul className="grid gap-x-8 gap-y-3 border-l-2 border-energia pl-5 md:grid-cols-2">
                {sintese.frases.map((f) => (
                  <li key={f.id} className="text-base leading-relaxed text-carvao md:text-lg">
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
            ) : (
              <Indisponivel titulo="Síntese indisponível" motivo="A síntese não foi processada nesta publicação." />
            )}
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mineral">
              <SeloNatureza natureza="CALCULADO" />
              Resposta curta montada por regras, trecho a trecho, com link para a evidência de cada número; cada frase usa a data de referência da sua fonte.{" "}
              <Link href="/setor-eletrico/metodologia#sintese" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                Regras das frases
              </Link>
            </p>
          </div>
          {meta && (
            <p className="mt-3 text-xs text-mineral">
              Dados: {linhaDeDatas()}
              {integra(pld) && pld.coleta_direta
                ? pld.coleta_direta.ok
                  ? " · última coleta direta na CCEE concluída com sucesso."
                  : " · a última tentativa de coleta direta na CCEE falhou; o PLD vem da captura primária mais recente."
                : "."}
            </p>
          )}
        </header>

        {/* visual hero: mapa vivo */}
        <section id="mapa" aria-labelledby="mapa-h" className="scroll-mt-24 pt-10 md:pt-12">
          <h2 id="mapa-h" className="sr-only">
            Mapa vivo do sistema
          </h2>
          {camadas.length ? (
            <div className="border border-linha bg-superficie p-4 md:p-6">
              <MapaVivo camadas={camadas} />
            </div>
          ) : (
            <Indisponivel titulo="Mapa indisponível" motivo="Nenhuma das golds que alimentam o mapa foi gerada nesta publicação." />
          )}
        </section>

        {/* o sistema em uma tela */}
        <section id="sistema-em-uma-tela" aria-labelledby="sistema-em-uma-tela-h" className="scroll-mt-24 pt-10 md:pt-12">
          <p className="rotulo text-mineral">Assinatura do observatório</p>
          <h2 id="sistema-em-uma-tela-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
            O sistema em uma tela
          </h2>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Uma métrica essencial por etapa, da água ao preço. A ordem é um roteiro de leitura, não uma cadeia de causa: toque em um bloco para ver a série recente, a leitura em contexto e o caminho para o módulo.
          </p>
          <div className="mt-6">
            {blocos.length ? <SistemaEmUmaTela blocos={blocos} /> : <Indisponivel titulo="Indicadores indisponíveis" motivo="Nenhuma gold foi gerada nesta publicação." />}
          </div>
        </section>

        <nav aria-label="Nesta página" className="mt-12 border-t border-linha pt-4">
          <p className="rotulo text-mineral">Aprofundar</p>
          <ul className="mt-1 flex flex-wrap gap-x-6 text-sm">
            {[
              ["#preco", "Preço"],
              ["#agua", "Água"],
              ["#geracao", "Geração"],
              ["#consumo", "Carga e consumo"],
              ["#rede", "Rede"],
              ["#observar", "O que observar"],
            ].map(([href, rotulo]) => (
              <li key={href}>
                <a href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bloco 2 */}
        <Secao id="preco" numero="1" rotulo="Preço" titulo="Qual é o preço da energia no mercado de curto prazo, hora a hora, em cada região?" cta={{ href: "/setor-eletrico/pld", texto: "Entender o PLD" }}>
          {integra(pld) ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="preco-painel"
              pergunta={`O PLD de ${dataBR(pld.dia_referencia)} nos quatro submercados`}
              subtitulo="PLD médio diário · R$/MWh nominais"
              porQueImporta={
                <>
                  O <Termo slug="pld">PLD</Termo> é o preço do <Termo slug="mcp">Mercado de Curto Prazo</Termo>, em que a CCEE apura o balanço de
                  energia e o resultado de cada perfil de agente, por hora e submercado. O que isso significa, e o que o PLD não é, está no{" "}
                  <a href="/setor-eletrico/pld#o-que-e" className="text-energia-dark underline underline-offset-4">capítulo 1 do PLD</a>.
                </>
              }
              oQueMudou={<>No Sudeste/Centro-Oeste, {pld.cartoes[0].variacao_dia_anterior ? `${sinal(pld.cartoes[0].variacao_dia_anterior.abs, 2)} R$/MWh sobre o dia anterior` : "sem comparação com o dia anterior"}. Nos últimos 30 dias houve diferença acima de {reais(pld.limiar_diferenca)}/MWh entre submercados em {num(100 * pld.periodos["30d"].diferenca.frac_horas_acima_limiar)}% das horas.</>}
              comoInterpretar={<>A posição usa o percentil da média diária entre todas as médias diárias desde 01/01/2021, em valores nominais. Faixa baixa abaixo do 25º percentil, alta acima do 75º.</>}
              naoConcluir={<>O PLD não é a tarifa do consumidor e não é previsão. Comparações com anos anteriores misturam limites regulatórios diferentes, que não foram auditados nesta fase.</>}
              proveniencia={pld.proveniencia.diario}
              complementares={[
                { rotulo: "Sobre a posição histórica", p: pld.proveniencia.posicao },
                ...(pld.proveniencia.estatisticas ? [{ rotulo: "Sobre as horas com diferença de preço", p: pld.proveniencia.estatisticas }] : []),
              ]}
            >
              <CartoesPld pld={pld} />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="PLD indisponível" motivo={pld?.motivo ?? "Os dados processados do PLD não foram gerados."} />
          )}
        </Secao>

        {/* Bloco 3 */}
        <Secao id="agua" numero="2" rotulo="Água" titulo="Quanta energia temos armazenada e quanta água está chegando?" cta={{ href: "/setor-eletrico/agua-e-clima", texto: "Entender água e reservatórios" }}>
          {integra(hid) && hidSin ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="agua-painel"
              pergunta={`Reservatórios do SIN com ${pct(hidSin.ear.valor)} da capacidade, ${ROTULO_FAIXA_USUAL[hidSin.ear.faixa ?? "dentro"]}`}
              subtitulo="EAR do SIN · % da EAR máxima, com faixa histórica do 10º ao 90º percentil"
              natureza="CALCULADO"
              porQueImporta={<>A <Termo slug="ear">EAR</Termo> mede a energia associada à água guardada nos reservatórios; a <Termo slug="ena">ENA</Termo> mede, em energia, as vazões naturais que chegam a eles. As duas definições são do ONS.</>}
              oQueMudou={<>Em 30 dias, a EAR do SIN variou {sinal(hidSin.ear.variacao_30d_pp)} <Unidade u="p.p." /> A ENA acumulada em 30 dias está em {pct(hidSin.ena.pct_mlt_30d, 1)} da MLT{hidSin.ena.faixa_30d ? `, ${ROTULO_FAIXA_USUAL[hidSin.ena.faixa_30d]}` : ""}.{hid.desvio_principal ? ` Maior desvio frente à mediana da data: ${hid.desvio_principal.nome} (${sinal(hid.desvio_principal.desvio_pp)} p.p.).` : ""}</>}
              comoInterpretar={<>A faixa sombreada mostra, para cada data, onde a EAR esteve em 80% dos anos desde 2001 (10º a 90º percentil). Fora dela, o valor está fora da faixa usual para a data.</>}
              naoConcluir={<>Este painel não relaciona EAR ou ENA ao preço nem calcula quanto da ENA vira armazenamento. A capacidade máxima de armazenamento mudou ao longo do tempo.</>}
              proveniencia={hid.proveniencia.ear_sin}
              complementares={[
                { rotulo: "Sobre a faixa histórica", p: hid.proveniencia.padrao },
                { rotulo: "Sobre a ENA de 30 dias", p: hid.proveniencia.ena30 },
              ]}
            >
              <GraficoLinhas
                titulo="EAR do SIN nos últimos 12 meses e faixa histórica da data"
                dados={earSerie}
                chaveX="d"
                series={[
                  { id: "SIN", rotulo: "EAR do SIN", cor: "var(--serie-hidraulica)", espessura: 2.5 },
                  { id: "p50", rotulo: "Mediana histórica", cor: "var(--serie-referencia)", tracejada: true },
                ]}
                banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil (2001 a ano anterior)" }}
                unidade="%"
                casas={1}
                formatoX="data"
                ensina={{ texto: "EAR: energia associada à água guardada nos reservatórios, em % da capacidade máxima de armazenamento.", fonte: "ONS", href: "/setor-eletrico/aprenda/ear", hrefRotulo: "Entenda EAR" }}
              />
              <ul className="mt-5 grid gap-3 border-t border-linha pt-4 sm:grid-cols-2 lg:grid-cols-4">
                {hid.subsistemas.filter((s) => s.sm !== "SIN").map((s) => (
                  <li key={s.sm} className="text-sm">
                    <p className="rotulo text-mineral">{s.nome}</p>
                    <p className="mt-1 tabular-nums text-carvao">EAR {pct(s.ear.valor)} · mediana {pct(s.ear.mediana_historica)}</p>
                    <p className="text-xs text-mineral">ENA 30 dias: {pct(s.ena.pct_mlt_30d, 1)} da MLT {s.ena.faixa_30d && s.ena.faixa_30d !== "dentro" ? `(${s.ena.faixa_30d} da faixa usual)` : ""}</p>
                  </li>
                ))}
              </ul>
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Hidrologia indisponível" motivo={hid?.motivo ?? "Os dados processados de hidrologia não foram gerados."} />
          )}
        </Secao>

        {/* Bloco 4 */}
        <Secao id="geracao" numero="3" rotulo="Geração" titulo="Como estamos gerando?" cta={{ href: "/setor-eletrico/geracao", texto: "Ver a matriz em detalhe" }}>
          {integra(ger) && gSin ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="geracao-painel"
              pergunta={`Hidráulica, eólica e solar somaram ${pct(gSin["7d"]?.hes)} da geração verificada nos últimos 7 dias`}
              subtitulo="Geração verificada do SIN por fonte · % do total, por janela"
              porQueImporta={<>A composição mostra de onde vem a energia que atende a carga e quanto o sistema recorre às térmicas, as usinas cujo <Termo slug="cvu">Custo Variável Unitário</Termo> entra na programação da operação.</>}
              oQueMudou={<>Térmicas com {pct(ger.termica_contexto.participacao_7d)} nos últimos 7 dias, contra mediana de {pct(ger.termica_contexto.mediana_365d)} nos 12 meses anteriores (percentil {num(ger.termica_contexto.percentil, 1)}).</>}
              comoInterpretar={<>Cada barra soma 100% da geração verificada na janela. Compare a semana atual com a mesma semana dos anos anteriores para separar sazonalidade de mudança.</>}
              naoConcluir={<>&quot;Hidráulica, eólica e solar&quot; não é a participação renovável: o conjunto não separa a térmica por combustível. Os anos comparados são só os posteriores a 29/04/2023, quando o balanço muda de regime (leitura a partir do dado).</>}
              proveniencia={ger.proveniencia.geracao}
              complementares={ger.proveniencia.termica_7d ? [{ rotulo: "Sobre a participação térmica de 7 dias", p: ger.proveniencia.termica_7d }] : []}
            >
              <BarrasMix
                linhas={[
                  { rotulo: `Dia ${dataBR(ger.dia_referencia)}`, mix: gSin.dia },
                  { rotulo: "Últimos 7 dias", mix: gSin["7d"], destaque: true },
                  ...ger.comparacao_anual.slice(0, 3).map((a) => ({ rotulo: `Mesmos 7 dias de ${a.ano}`, mix: a["7d"] })),
                  { rotulo: "Últimos 30 dias", mix: gSin["30d"] },
                  { rotulo: "Últimos 12 meses", mix: gSin["12m"] },
                ]}
                tabela
              />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Geração indisponível" motivo={ger?.motivo ?? "Os dados processados de geração não foram gerados."} />
          )}
        </Secao>

        {/* Bloco 5 */}
        <Secao id="consumo" numero="4" rotulo="Carga e consumo" titulo="Quanto estamos consumindo?" cta={{ href: "/setor-eletrico/carga", texto: "Ver carga por subsistema" }}>
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
              porQueImporta={<>A <Termo slug="carga">carga</Termo> é o lado da demanda no balanço de energia que o ONS publica por subsistema, ao lado da geração por fonte.</>}
              oQueMudou={<>Em {dataBR(carga.dia_referencia)}, {num(cargaSin.dia, 0)} <Unidade u="MWmed" />. Maior carga diária dos últimos 12 meses: {num(cargaSin.max_12m.valor, 0)} MWmed em {dataBR(cargaSin.max_12m.dia)}.</>}
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
                ensina={{ texto: "Carga: energia atendida no sistema interligado, em MWmed (energia do dia dividida por 24 horas).", fonte: "ONS", href: "/setor-eletrico/aprenda/carga", hrefRotulo: "Entenda carga" }}
              />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Carga indisponível" motivo={carga?.motivo ?? "Os dados processados de carga não foram gerados."} />
          )}
        </Secao>

        {/* Bloco 6 */}
        <Secao id="rede" numero="5" rotulo="Rede" titulo="A rede está limitando o sistema?" cta={{ href: "/setor-eletrico/rede", texto: "Ver intercâmbios" }}>
          {integra(rede) && integra(pld) ? (
            <PainelEvidencia
              nivelTitulo={3}
              id="rede-painel"
              pergunta="Para onde a energia está fluindo e se os preços se separaram"
              subtitulo="Intercâmbio médio verificado entre subsistemas · MWmed · e PLD médio diário"
              porQueImporta={<>Mostra o sentido e o volume dos fluxos entre regiões e, ao lado, se os quatro <Termo slug="submercado">submercados</Termo> tiveram PLD igual ou diferente.</>}
              oQueMudou={<>Nos últimos 30 dias da série de PLD, {pld.periodos["30d"].diferenca.horas_acima_limiar} horas tiveram diferença de preço acima de {reais(pld.limiar_diferenca)}/MWh entre submercados; maior diferença de {reais(pld.periodos["30d"].diferenca.maior)}/MWh.</>}
              comoInterpretar={<>A camada Rede do mapa acima mostra sentido e volume do fluxo médio do dia; a tabela abaixo traz os mesmos valores com o programado. A diferença de preço é observada, não explicada aqui: a regra de formação do preço por submercado está na documentação da CCEE, com conferência pendente nesta fase.</>}
              naoConcluir={<>Os limites de intercâmbio não estão integrados: fluxo alto não prova rede no limite, e esta página não identifica qual linha restringiu a transferência.</>}
              proveniencia={rede.proveniencia.fluxo}
              complementares={[
                { rotulo: "Sobre o PLD médio", p: pld.proveniencia.diario },
                ...(pld.proveniencia.estatisticas ? [{ rotulo: "Sobre as horas com diferença de preço", p: pld.proveniencia.estatisticas }] : []),
              ]}
            >
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {rede.fronteiras.map((f) => {
                  const v = f.fluxo_dia;
                  const nome = v !== null && v < 0 ? f.nome.split(" → ").reverse().join(" → ") : f.nome;
                  return (
                    <li key={f.par} className="border border-linha p-4">
                      <p className="rotulo text-mineral">{nome}</p>
                      <p className="mt-2 font-serif text-2xl tabular-nums text-carvao">{v === null ? "sem dado" : num(Math.abs(v), 0)}</p>
                      <p className="text-xs text-mineral">MWmed em {dataBR(rede.dia_referencia)}</p>
                      <div className="mt-2">
                        <Sparkline valores={rede.serie_fluxos.slice(-90).map((p) => (typeof p[f.par] === "number" ? (p[f.par] as number) : null))} cor="var(--cor-energia)" zeroNoEixo largura={200} altura={32} rotulo={`Intercâmbio ${f.nome} nos últimos 90 dias`} />
                      </div>
                      <p className="mt-1 text-xs text-mineral">{f.dias_com_diferenca_30d} de {f.n_dias_pld_30d} dias com PLD diferente entre as pontas</p>
                    </li>
                  );
                })}
              </ul>
              <TabelaDados
                titulo="Intercâmbio médio por fronteira"
                colunas={["Fronteira", "Fluxo do dia (MWmed)", "Programado (MWmed)", "Média 30 dias (MWmed)"]}
                linhas={rede.fronteiras.map((f) => [f.nome, f.fluxo_dia, f.programado_dia, f.fluxo_media_30d])}
              />
            </PainelEvidencia>
          ) : (
            <Indisponivel titulo="Rede indisponível" motivo={rede?.motivo ?? "Os dados processados de rede não foram gerados."} />
          )}
        </Secao>

        {/* Bloco 7 */}
        <Secao id="observar" numero="6" rotulo="O que observar" titulo="O que observar nas próximas semanas" resumo="Regras explícitas avaliadas sobre os dados mais recentes. Nenhum item é previsão: cada um descreve uma condição medida ou um evento publicado.">
          {integra(sintese) ? (
            <div className="border border-linha bg-superficie">
              <p className="border-b border-linha px-6 py-4 text-sm text-carvao-muted">
                {sintese.observar.filter((o) => o.ativo && o.tipo !== "evento").length} de {sintese.observar.filter((o) => o.tipo !== "evento").length} regras estão ativas
                {sintese.observar.some((o) => o.tipo === "evento") ? ", e a lista inclui eventos conhecidos, como a publicação semanal do CMO" : ""}.
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
            <Indisponivel titulo="Regras indisponíveis" motivo="A síntese não foi processada." />
          )}
        </Secao>
      </main>
    </>
  );
}
