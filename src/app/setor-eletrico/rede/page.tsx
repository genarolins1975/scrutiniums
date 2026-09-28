import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { Conferido } from "@/components/evidencia/Conferido";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaBrasil } from "@/components/energia/MapaBrasil";
import { AbasVisoes } from "@/components/energia/AbasVisoes";
import { MetricaHero } from "@/components/energia/MetricaHero";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, pct, reais, rotuloRegra } from "@/lib/energia/formato";
import { textoAmplitude, textoFluxos30d } from "@/lib/energia/resumos";
import type { Submercado } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Rede: como a energia circula pelo Brasil",
  description:
    "Fluxos verificados entre os subsistemas (ONS) no mapa, com espessura proporcional ao volume; intercâmbio líquido de cada região; diferença de PLD entre as pontas de cada fronteira (CCEE); e o que falta para dizer se a rede está no limite.",
  alternates: { canonical: "/setor-eletrico/rede" },
};

const NOME_CURTO: Record<string, string> = { SE: "o Sudeste/Centro-Oeste", S: "o Sul", NE: "o Nordeste", N: "o Norte" };
const SMS: Submercado[] = ["N", "NE", "SE", "S"];

export default function RedePage() {
  const r = gold.rede();
  const pld = gold.pld();
  const ger = gold.geracao();
  if (!integra(r)) {
    return (
      <>
        <CabecalhoEnergia atual="rede" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Dados de rede indisponíveis" motivo={r?.motivo ?? "Os dados processados de rede não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }
  const seriesFluxo = r.fronteiras.map((f, i) => ({
    id: f.par,
    rotulo: f.nome,
    sigla: `${f.de}→${f.para}`,
    cor: ["var(--serie-sm-n)", "var(--serie-sm-se)", "var(--serie-sm-ne)", "var(--serie-sm-s)"][i],
  }));
  const maior = [...r.fronteiras].filter((f) => f.fluxo_dia !== null).sort((a, b) => Math.abs(b.fluxo_dia as number) - Math.abs(a.fluxo_dia as number))[0];
  const porSaldo = Object.fromEntries(r.liquido_subsistemas.map((l) => [l.sm, l]));
  const maxSaldo = Math.max(1, ...r.liquido_subsistemas.map((l) => Math.abs(l.dia ?? 0)));
  const ne7 = integra(ger) ? ger.regioes.find((x) => x.rg === "NE")?.["7d"] : undefined;
  const neSe = r.fronteiras.find((f) => f.par === "NE_SE");

  const mapa = (
    <MapaBrasil
      titulo={`Fluxos entre subsistemas em ${dataBR(r.dia_referencia)} e saldo de cada região`}
      tom="rede"
      valores={Object.fromEntries(SMS.map((sm) => { const l = porSaldo[sm]; return [sm, l && l.dia !== null ? { valor: `${num(l.dia, 0)} MWmed`, sub: l.dia >= 0 ? "exportou no dia" : "importou no dia", intensidade: Math.abs(l.dia) / maxSaldo } : { valor: "sem dado", intensidade: null }]; }))}
      fluxos={r.fronteiras.map((f) => ({ de: f.de, para: f.para, valor: f.fluxo_dia }))}
      legenda={`Setas: sentido e fluxo médio verificado em cada fronteira monitorada pelo ONS (espessura proporcional ao volume; tracejado em movimento no sentido do fluxo). Cor da região: saldo do subsistema no balanço de energia de ${dataBR(r.dia_referencia_liquido)}. Fluxo é conceito agregado: cada fronteira reúne várias linhas de transmissão.`}
      lista="lado"
      detalhes={Object.fromEntries(
        SMS.map((sm) => {
          const l = porSaldo[sm];
          const fr = r.fronteiras.filter((f) => f.de === sm || f.para === sm);
          return [
            sm,
            <ul key={sm} className="space-y-1">
              {l && l.dia !== null ? <li>Saldo do dia: {num(l.dia, 0)} MWmed ({l.dia >= 0 ? "exportação" : "importação"} líquida); média de 30 dias {num(l.media_30d, 0)}.</li> : <li>Sem saldo nesta publicação.</li>}
              {fr.map((f) => (
                <li key={f.par}>
                  {f.nome}: {f.fluxo_dia === null ? "sem dado" : `${num(Math.abs(f.fluxo_dia), 0)} MWmed${f.fluxo_dia < 0 ? " no sentido inverso" : ""}`}; PLD diferente entre as pontas em {f.dias_com_diferenca_30d} de {f.n_dias_pld_30d} dias.
                </li>
              ))}
            </ul>,
          ];
        }),
      )}
    />
  );
  const fluxosMultiplos = (
    <div className="grid gap-3 sm:grid-cols-2">
      {r.fronteiras.map((f, i) => (
        <div key={f.par} className="min-w-0 border border-linha p-3">
          <p className="rotulo text-mineral">{f.nome}</p>
          <p className="text-xs text-carvao-muted">
            {f.fluxo_dia === null ? "sem dado no dia" : `${num(Math.abs(f.fluxo_dia), 0)} MWmed em ${dataBR(r.dia_referencia)}${f.fluxo_dia < 0 ? ", sentido inverso" : ""}`} · média de 30 dias {num(f.fluxo_media_30d, 0)}
            {f.fluxo_media_30d_anterior != null ? ` (antes ${num(f.fluxo_media_30d_anterior, 0)})` : ""}
          </p>
          <GraficoLinhas titulo={`Intercâmbio médio diário ${f.nome}, último ano`} dados={r.serie_fluxos.map((p) => ({ d: p.d, v: typeof p[f.par] === "number" ? (p[f.par] as number) : null }))} chaveX="d" series={[{ id: "v", rotulo: f.nome, sigla: `${f.de}→${f.para}`, cor: seriesFluxo[i].cor }]} unidade="MWmed" casas={0} altura={160} zeroNoEixo rotulosDiretos={false} />
          <p className="mt-1 text-[0.7rem] text-mineral">Positivo no sentido do nome; negativo, sentido inverso. Zero é a linha de base.</p>
        </div>
      ))}
    </div>
  );
  const historico = (
    <div>
      <GraficoLinhas titulo="Intercâmbio médio diário por fronteira, último ano" dados={r.serie_fluxos} chaveX="d" series={seriesFluxo} unidade="MWmed" casas={0} zeroNoEixo ensina={{ texto: "Intercâmbio: soma dos fluxos de potência ativa nas linhas de transmissão de fronteira entre subsistemas, em MWmed; positivo no sentido indicado.", fonte: "ONS", href: "/setor-eletrico/aprenda/intercambio", hrefRotulo: "Entenda intercâmbio" }} />
      <p className="mt-2 text-xs text-mineral">{textoFluxos30d(r)}</p>
    </div>
  );

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo rotulo="Rede" titulo="A rede está limitando o sistema?" referencia={<>Intercâmbios (ONS) até {dataBR(r.dia_referencia)} · PLD (CCEE) até {dataBR(r.ultimo_dia_pld)}</>}>
          Resposta curta: ainda não é possível dizer. Esta página mostra para onde a energia está fluindo entre as regiões e se os preços se separaram, mas
          não afirma que a rede atingiu limite: os limites de intercâmbio ainda não estão integrados, e essa é a primeira informação que falta para responder à pergunta do título.
          Fluxos em <Unidade u="MWmed" />.
        </CabecalhoModulo>

        {/* resposta curta em números */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-linha bg-superficie p-5">
            <MetricaHero
              icone="intercambio"
              rotulo={`Maior fluxo do dia · ${dataBR(r.dia_referencia)}`}
              valor={maior ? num(Math.abs(maior.fluxo_dia as number), 0) : "–"}
              unidade="MWmed"
              natureza="CALCULADO"
              variacao={maior ? ((maior.fluxo_dia as number) >= 0 ? maior.nome : maior.nome.split(" → ").reverse().join(" → ")) : undefined}
              sparkline={maior ? r.serie_fluxos.slice(-90).map((p) => (typeof p[maior.par] === "number" ? Math.abs(p[maior.par] as number) : null)) : undefined}
              cor="var(--cor-energia)"
              contexto={maior ? <>Média de 30 dias: {num(Math.abs(maior.fluxo_media_30d ?? 0), 0)} MWmed. A linha mostra os últimos 90 dias.</> : undefined}
              tamanho="medio"
            />
          </div>
          <div className="border border-linha bg-superficie p-5">
            <MetricaHero
              icone="preco"
              rotulo={`Preços separados · ${r.resumo_amplitude ? dataBR(r.resumo_amplitude.dia) : dataBR(r.ultimo_dia_pld)}`}
              valor={r.resumo_amplitude ? reais(r.resumo_amplitude.valor) : "–"}
              unidade="/MWh de diferença"
              natureza="CALCULADO"
              variacao={r.resumo_amplitude?.media_30d != null ? `média de 30 dias ${reais(r.resumo_amplitude.media_30d)}/MWh` : undefined}
              sparkline={r.serie_amplitude_pld.slice(-90).map((a) => a.amplitude)}
              cor="var(--serie-pld)"
              contexto={<>Diferença entre o maior e o menor PLD médio diário dos quatro submercados; zero significa preços iguais.</>}
              tamanho="medio"
            />
          </div>
          <div className="border border-dashed border-mineral bg-papel p-5">
            <p className="rotulo flex items-center gap-2 text-carvao">
              <IconeSetor tipo="rede" tamanho={15} /> Limites de intercâmbio
            </p>
            <p className="mt-3 font-serif text-2xl text-carvao">não integrados</p>
            <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{r.regras.limites}</p>
            <p className="mt-2 text-xs text-mineral">Os conjuntos de limites e restrições estão catalogados em Dados; sem eles, fluxo alto não prova rede no limite.</p>
          </div>
        </div>

        {/* hero: mapa com alternância */}
        <section id="mapa" aria-labelledby="mapa-h" className="scroll-mt-24 pt-10">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="rede" tamanho={15} /> Visual principal
          </p>
          <h2 id="mapa-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
            Como a energia circula pelo Brasil?
          </h2>
          <div className="mt-5 border border-linha bg-superficie p-4 md:p-6">
            <AbasVisoes
              abas={[
                { id: "mapa", rotulo: "Mapa", conteudo: mapa },
                { id: "fluxos", rotulo: "Fluxos por fronteira", conteudo: fluxosMultiplos },
                { id: "historico", rotulo: "Histórico", conteudo: historico },
              ]}
            />
          </div>
        </section>

        <ModoProfundidade>
          <Bloco id="fluxos">
            <PainelEvidencia
              id="fluxos-dia"
              pergunta={`Fluxos entre subsistemas em ${dataBR(r.dia_referencia)}`}
              subtitulo="Intercâmbio médio verificado por fronteira · MWmed · e PLD médio diário por submercado"
              porQueImporta={<>O <Termo slug="intercambio">intercâmbio</Termo> mostra quais regiões exportam e quais importam energia. Ao lado do PLD, mostra se os <Termo slug="submercado">submercados</Termo> tiveram preço igual ou diferente no mesmo dia; a razão de uma diferença não é identificada aqui.</>}
              oQueMudou={
                <>
                  Nos últimos 30 dias:{" "}
                  {r.fronteiras
                    .map((f) => {
                      const [a, b] = [NOME_CURTO[f.de] ?? f.de, NOME_CURTO[f.para] ?? f.para];
                      const n = f.dias_sentido_canonico_30d;
                      return n >= 15 ? `${a} enviou energia para ${b} em ${n} de 30 dias` : `${b} enviou energia para ${a} em ${30 - n} de 30 dias`;
                    })
                    .join("; ")}
                  .
                </>
              }
              comoInterpretar={<>No mapa acima, a seta aponta o sentido do fluxo médio do dia e a espessura é proporcional ao volume. A tabela traz o fluxo do dia, o programado pelo ONS, a média de 30 dias e os dias com PLD diferente entre as pontas.</>}
              naoConcluir={<>Sem os limites de transferência, fluxo alto não prova congestionamento, e a página não identifica qual linha ou equipamento restringiu a transferência.</>}
              proveniencia={r.proveniencia.fluxo}
              complementares={[
                ...(integra(pld) ? [{ rotulo: "Sobre o PLD médio", p: pld.proveniencia.diario }] : []),
                { rotulo: "Sobre a diferença de preço por fronteira", p: r.proveniencia.diferenca },
              ]}
            >
              <TabelaDados
                titulo="Intercâmbio por fronteira"
                colunas={["Fronteira", "Fluxo do dia (MWmed)", "Programado do dia (MWmed)", "Média 30 dias (MWmed)", `Dias com diferença de PLD médio acima de ${reais(r.limiar_diferenca_dia ?? 1, 2)}/MWh (30 dias até ${dataBR(r.dia_referencia)})`]}
                linhas={r.fronteiras.map((f) => [f.nome, f.fluxo_dia, f.programado_dia, f.fluxo_media_30d, `${f.dias_com_diferenca_30d} de ${f.n_dias_pld_30d}`])}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="restricoes">
            <section aria-labelledby="restricoes-h" className="border border-linha bg-superficie">
              <header className="px-5 pt-6 md:px-8">
                <h2 id="restricoes-h" className="font-serif text-xl leading-snug text-carvao md:text-2xl">
                  Onde estaria o gargalo, se houvesse um?
                </h2>
                <p className="mt-2 text-sm text-mineral">Leitura usual do setor, apresentada como esquema; o que o dado já mostra e o que ainda falta para conferir</p>
              </header>
              <div className="px-5 py-6 md:px-8">
                <ol className="grid gap-3 md:grid-cols-4">
                  {[
                    {
                      t: "Energia abundante numa região",
                      esquema: "Uma região gera mais do que consome.",
                      dado: ne7 && porSaldo.NE?.dia !== null && porSaldo.NE ? `Nordeste, 7 dias: eólica ${pct(ne7.participacao.eolica)} da geração; saldo de ${num(porSaldo.NE.dia as number, 0)} MWmed em ${dataBR(r.dia_referencia_liquido)} (${(porSaldo.NE.dia as number) >= 0 ? "exportação" : "importação"} líquida).` : "Sem dado de geração e saldo nesta publicação.",
                      ok: true,
                    },
                    {
                      t: "Capacidade de transferência finita",
                      esquema: "As linhas de fronteira têm um limite de transferência.",
                      dado: "Limites de intercâmbio não integrados: a plataforma não sabe, para cada dia, quanto faltou para o teto.",
                      ok: false,
                    },
                    {
                      t: "Intercâmbio medido",
                      esquema: "O que efetivamente circulou entre as regiões.",
                      dado: neSe && neSe.fluxo_dia !== null ? `Nordeste → Sudeste/Centro-Oeste: ${num(Math.abs(neSe.fluxo_dia), 0)} MWmed em ${dataBR(r.dia_referencia)}; média de 30 dias ${num(Math.abs(neSe.fluxo_media_30d ?? 0), 0)}.` : "Sem fluxo medido nesta publicação.",
                      ok: true,
                    },
                    {
                      t: "Possível diferença de preço",
                      esquema: "Se a transferência não basta, os preços das pontas podem se separar.",
                      dado: neSe ? `PLD diferente entre Nordeste e Sudeste/Centro-Oeste em ${neSe.dias_com_diferenca_30d} de ${neSe.n_dias_pld_30d} dias; no dia comum mais recente, diferença de ${reais(neSe.diferenca_preco_ultimo_dia_comum?.valor ?? null)}/MWh.` : "Sem PLD comum nesta publicação.",
                      ok: true,
                    },
                  ].map((p, i) => (
                    <li key={p.t} className="relative flex flex-col border border-linha bg-papel p-4">
                      <span className="rotulo text-mineral">Passo {i + 1}</span>
                      <span className="mt-1 font-medium leading-snug text-carvao">{p.t}</span>
                      <span className="mt-2 text-xs italic leading-relaxed text-carvao-muted">{p.esquema}</span>
                      <span className="mt-3 border-t border-linha pt-2 text-sm leading-relaxed text-carvao">{p.dado}</span>
                      <span className="mt-2 text-xs">{p.ok ? <span className="rotulo !text-[0.62rem] text-carvao-muted">dado integrado</span> : <span className="rotulo !text-[0.62rem] text-aviso">○ dado ausente</span>}</span>
                      {i < 3 && <span aria-hidden="true" className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-mineral md:block">→</span>}
                    </li>
                  ))}
                </ol>
                <ul className="mt-4 space-y-1 text-xs text-mineral">
                  <li className="flex flex-wrap items-center gap-2">Definições de intercâmbio (ONS) e de PLD por submercado (CCEE): <Conferido ok /></li>
                  <li className="flex flex-wrap items-center gap-2">Mecanismo de separação de preços por limite de transferência: <Conferido ok={false} /></li>
                </ul>
                <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-mineral">
                  O esquema não afirma que uma diferença observada veio de um limite atingido: sem os limites e sem as restrições operativas integradas, a plataforma mostra os passos 1, 3 e 4 com dado e declara o passo 2 como ausente.
                </p>
              </div>
            </section>
          </Bloco>

          <Bloco id="saldos">
            <PainelEvidencia
              id="liquido"
              pergunta="Quais regiões exportam e quais importam energia?"
              subtitulo={`Intercâmbio líquido por subsistema · MWmed · balanço de energia do ONS em ${dataBR(r.dia_referencia_liquido)}`}
              natureza="CALCULADO"
              porQueImporta={<>O balanço de energia do ONS traz, para cada subsistema, carga, geração por fonte e intercâmbio líquido. Positivo significa exportação líquida no dia; o sinal foi conferido contra os fluxos por fronteira.</>}
              oQueMudou={<>{r.liquido_subsistemas.map((l) => `${l.nome}: ${num(l.dia, 0)} MWmed no dia, média de 30 dias ${num(l.media_30d, 0)}`).join("; ")}.</>}
              comoInterpretar={
                <>
                  Além dos quatro subsistemas, o balanço do ONS publica um valor de intercâmbio para o <Termo slug="sin">SIN</Termo> inteiro. O que ele representa não foi conferido na documentação do ONS; a plataforma apenas compara esse valor com a soma dos quatro saldos.{" "}
                  {r.balanco_sin
                    ? `Em ${dataBR(r.balanco_sin.dia)}, a soma dos quatro saldos foi ${num(r.balanco_sin.soma_saldos, 0)} MWmed e o intercâmbio do SIN no mesmo balanço, ${num(r.balanco_sin.intercambio_sin, 0)} MWmed. Nos 365 dias até essa data, a média diária do intercâmbio do SIN passou de 1 MWmed em módulo em ${r.balanco_sin.dias_sin_nao_nulo_365} dias; nesses dias, os saldos não somam zero. `
                    : ""}
                  O dia do balanço pode diferir do dia dos fluxos por fronteira, porque são conjuntos distintos.
                </>
              }
              naoConcluir={<>O saldo não diz por que a região exporta ou importa, nem se as linhas estavam no limite: os limites de intercâmbio não estão integrados.</>}
              proveniencia={r.proveniencia.saldos ?? r.proveniencia.fluxo}
            >
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {r.liquido_subsistemas.map((l) => (
                  <li key={l.sm} className="border border-linha p-4">
                    <p className="rotulo text-mineral">{l.nome}</p>
                    <p className="mt-2 font-serif text-2xl tabular-nums text-carvao">{num(l.dia, 0)}</p>
                    <p className="text-xs text-mineral">MWmed · {l.dia === null ? "sem dado" : l.dia >= 0 ? "exportador no dia" : "importador no dia"}</p>
                    <p className="mt-1 text-xs text-carvao-muted">média de 30 dias: {num(l.media_30d, 0)} MWmed</p>
                  </li>
                ))}
              </ul>
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <PainelEvidencia
              id="amplitude-rede"
              pergunta="Em que dias os preços dos submercados se separaram?"
              subtitulo="Diferença entre o maior e o menor PLD médio diário · R$/MWh · último ano"
              porQueImporta={<>Picos marcam dias em que os PLDs médios dos submercados ficaram mais distantes entre si.</>}
              oQueMudou={<>{textoAmplitude(r.resumo_amplitude)}</>}
              comoInterpretar={<>Zero significa médias diárias iguais nos quatro submercados; diferenças de poucas horas podem sumir na média diária.</>}
              naoConcluir={<>A série não diz qual fronteira separou os preços nem se um limite foi atingido.</>}
              proveniencia={r.proveniencia.amplitude}
              complementares={integra(pld) ? [{ rotulo: "Sobre o PLD médio diário", p: pld.proveniencia.diario }] : []}
            >
              <GraficoLinhas
                titulo="Diferença diária entre o maior e o menor PLD"
                dados={r.serie_amplitude_pld}
                chaveX="d"
                series={[{ id: "amplitude", rotulo: "Diferença máx.−mín.", cor: "var(--serie-pld)" }]}
                unidade="R$/MWh"
                casas={2}
                zeroNoEixo
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="auditar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Regras e downloads</h2>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(r.regras).map(([k, v]) => (
                  <div key={k}>
                    <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 space-y-1 text-sm">
                {r.downloads.map((d) => (
                  <li key={d.url}><a href={d.url} download className="text-energia-dark underline underline-offset-4">{d.rotulo}</a></li>
                ))}
              </ul>
            </div>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
