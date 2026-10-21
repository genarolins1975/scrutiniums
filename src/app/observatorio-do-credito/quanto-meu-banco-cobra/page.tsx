import type { Metadata } from "next";
import Link from "next/link";
import { AberturaCredito, AvisoCet, CascaCredito, Natureza, SecaoCredito } from "@/components/credito/Blocos";
import { FaixaDistribuicao } from "@/components/credito/FaixaDistribuicao";
import { SeletorJuros } from "@/components/credito/SeletorJuros";
import { goldJuros, hrefConsulta, opcoesSeletor, resolverConsulta, rotuloModalidade, ROTULO_SEGMENTO, type ParametrosConsulta } from "@/lib/credito/juros";
import { contagem, dataBr, diaBrasilia, diasDesde, janela, num, taxa } from "@/lib/credito/formato";
import { PAINEL_JUROS, paginaCredito } from "@/lib/credito/navegacao";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

/**
 * "Quanto meu banco cobra?" (Onda 2 da banca de 19/10/2026, consulta pessoal do Crédito). Lê no servidor a gold
 * juros.json (BCB txjuros) e mostra, para o segmento, a modalidade e a instituição escolhidos na URL, a taxa publicada,
 * a mediana e a distribuição entre as instituições, a posição e a distância da mediana, com janela, fonte e o aviso de
 * que taxa não é CET. Sem julgamento: nenhuma taxa é chamada de cara ou barata.
 *
 * Rota com conta (não consta de src/lib/rotasPublicas.ts). Dinâmica: o recorte vem de ?seg=&mod=&banco=.
 */
export const dynamic = "force-dynamic";

const pagina = paginaCredito("quanto-meu-banco-cobra");

export const metadata: Metadata = {
  title: tituloNaColecao(`${pagina.titulo} Taxas de juros por banco e modalidade`, pagina.href),
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
  robots: { index: false },
};

/** "19ª" para posições: ordinal masculino abreviado não serve a "posição" (feminino). */
const ordinal = (n: number) => `${n.toLocaleString("pt-BR")}ª`;

function Medida({ rotulo, valor, detalhe, natureza }: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; natureza: "observado" | "calculado" }) {
  return (
    <div className="border-t border-carvao pt-3">
      <dt className="text-sm text-carvao-muted">{rotulo}</dt>
      <dd className="mt-1">
        <span className="block font-label text-[1.7rem] leading-tight tabular-nums text-carvao">{valor}</span>
        {detalhe && <span className="mt-1 block text-sm leading-snug text-carvao-muted">{detalhe}</span>}
        <span className="mt-2 block">
          <Natureza tipo={natureza} />
        </span>
      </dd>
    </div>
  );
}

export default function QuantoMeuBancoCobraPage({ searchParams = {} }: { searchParams?: ParametrosConsulta }) {
  const gold = goldJuros();
  if (!gold) {
    return (
      <CascaCredito atual="quanto-meu-banco-cobra">
        <AberturaCredito titulo={pagina.titulo}>
          <p>
            A publicação das taxas de juros por instituição não está disponível nesta versão do site. Nenhum número é mostrado no lugar dela.
          </p>
        </AberturaCredito>
      </CascaCredito>
    );
  }
  const opcoes = opcoesSeletor(gold);
  const c = resolverConsulta(gold, searchParams);
  const m = c.modalidade;
  const s = m.stats;
  const nomeMod = rotuloModalidade(m.modalidade);
  const atraso = diasDesde(m.janela.fim, gold.gerado_em);
  const processado = diaBrasilia(gold.gerado_em);
  const fonte = (
    <>
      Fonte: Banco Central do Brasil, taxas de juros por instituição financeira e modalidade (txjuros, portal de dados abertos Olinda). Janela de
      referência desta modalidade: {janela(m.janela)}. Publicação processada em {processado}.
    </>
  );
  const hrefSimulador = hrefConsulta("/observatorio-do-credito/simulador-da-parcela", c.segmento, c.slug, c.banco?.cnpj8);

  return (
    <CascaCredito atual="quanto-meu-banco-cobra">
      <AberturaCredito titulo={pagina.titulo} fonte={<>Dados até a semana de {janela(gold.modalidades.reduce((a, b) => (b.janela.fim > a.janela.fim ? b : a)).janela)}, a janela mais recente da publicação; cada modalidade traz a sua.</>}>
        <p>
          Escolha o tipo de crédito e a instituição. A página mostra a taxa média de juros que a instituição informou ao Banco Central nessa modalidade, ao
          lado das taxas das demais instituições que informaram a mesma modalidade na mesma semana.
        </p>
      </AberturaCredito>

      <section aria-label="Escolha da consulta" className="border border-linha bg-superficie p-4 md:p-5">
        <SeletorJuros
          base={pagina.href}
          opcoes={opcoes}
          seg={c.segmento}
          mod={c.slug}
          banco={c.banco?.cnpj8 ?? ""}
        />
      </section>

      {c.ignorados.length > 0 && (
        <p role="status" className="mt-4 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm text-carvao">
          O endereço pedia {c.ignorados.join(", ")} que não consta da publicação atual. A página mostra o recorte padrão no lugar.
        </p>
      )}

      <section aria-labelledby="resultado-titulo" className="pt-10">
        <p className="rotulo text-mineral">{ROTULO_SEGMENTO[c.segmento]}</p>
        <h2 id="resultado-titulo" className="mt-2 font-serif text-[clamp(1.5rem,3.2vw,2.1rem)] leading-tight text-carvao">
          {c.banco ? <>{c.banco.nome} em {nomeMod.toLowerCase()}</> : <>{nomeMod}: as {contagem(s.n, "instituição", "instituições")}</>}
        </h2>
        <p className="mt-2 text-sm text-carvao-muted">
          Taxas médias de juros em % ao ano, semana de {janela(m.janela)}. {contagem(s.n, "instituição informou", "instituições informaram")} esta modalidade nessa janela.
        </p>

        {atraso !== null && atraso > 45 && (
          <p className="mt-4 max-w-prose2 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm leading-relaxed text-carvao" data-janela-antiga="">
            A janela mais recente desta modalidade com instituições suficientes terminou em {dataBr(m.janela.fim)}, {atraso} dias antes desta
            publicação. As semanas seguintes chegaram ao Banco Central com poucas instituições e ficam de fora até completar; por isso o número é mais antigo que
            o das demais modalidades.
          </p>
        )}

        {c.banco && c.linha && c.posicao && c.distanciaPp !== null && (
          <dl className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            <Medida
              rotulo={`Taxa de ${c.banco.nome}`}
              valor={taxa(c.linha.taxa_aa, "aa")}
              detalhe={<>equivale a {taxa(c.linha.taxa_am, "am")}, como publicado</>}
              natureza="observado"
            />
            <Medida
              rotulo={`Mediana das ${s.n} instituições`}
              valor={taxa(s.mediana, "aa")}
              detalhe="metade das instituições informou taxa menor e metade, maior"
              natureza="observado"
            />
            <Medida
              rotulo="Distância da mediana"
              valor={
                Math.abs(c.distanciaPp) < 0.005 ? (
                  "igual à mediana"
                ) : (
                  <>
                    {num(Math.abs(c.distanciaPp))} p.p. {c.distanciaPp < 0 ? "abaixo" : "acima"}
                  </>
                )
              }
              detalhe={
                c.distanciaPct !== null && Math.abs(c.distanciaPp) >= 0.005 ? (
                  <>
                    pontos percentuais ao ano; a taxa é {num(Math.abs(c.distanciaPct), 1)}% {c.distanciaPct < 0 ? "menor" : "maior"} que a mediana
                  </>
                ) : (
                  "pontos percentuais ao ano"
                )
              }
              natureza="calculado"
            />
            <Medida
              rotulo="Posição entre as instituições"
              valor={<>{ordinal(c.posicao.posicao)} de {c.posicao.n}</>}
              detalhe={
                <>
                  da menor para a maior taxa: {contagem(c.posicao.menores, "instituição informou", "instituições informaram")} taxa menor e{" "}
                  {c.posicao.maiores.toLocaleString("pt-BR")}, maior
                  {c.posicao.iguais > 0 ? <>; {contagem(c.posicao.iguais, "outra tem", "outras têm")} a mesma taxa</> : null}
                </>
              }
              natureza="calculado"
            />
          </dl>
        )}

        {c.banco && !c.linha && (
          <div className="mt-8 max-w-prose2 border border-linha bg-superficie p-5" data-ausencia="">
            <p className="font-medium text-carvao">
              {c.banco.nome} não aparece na publicação do Banco Central para {nomeMod.toLowerCase()} na semana de {janela(m.janela)}.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
              Ausência não é taxa zero, e a página não estima um valor no lugar. A instituição não informou taxa nessa modalidade e nessa janela, o que pode
              acontecer quando ela não oferece o produto ou não contratou operações na semana. Abaixo, a distribuição das {s.n} instituições que informaram.
            </p>
            {c.outrasDoBanco.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-carvao">{c.banco.nome} informou taxa nestas modalidades:</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.outrasDoBanco.map((o) => {
                    const href = hrefConsulta(pagina.href, o.segmento, o.slug, c.banco?.cnpj8);
                    return (
                      <li key={`${o.segmento}:${o.slug}`}>
                        <Link href={href} prefetch={prefetchDoLink(href)} className="inline-flex min-h-[44px] items-center border border-linha px-3 text-sm text-carvao underline-offset-4 hover:border-bronze hover:underline">
                          {o.rotulo} {o.segmento === "pj" ? "· empresas" : "· pessoa física"}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {!c.banco && (
          <dl className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            <Medida rotulo={`Mediana das ${s.n} instituições`} valor={taxa(s.mediana, "aa")} detalhe="metade das instituições informou taxa menor e metade, maior" natureza="observado" />
            <Medida rotulo="Metade central das instituições" valor={<>{num(s.p25)}% a {num(s.p75)}%</>} detalhe="ao ano, do primeiro ao terceiro quartil" natureza="observado" />
            <Medida rotulo="Menor e maior taxa informadas" valor={<>{num(s.min)}% e {num(s.max)}%</>} detalhe="ao ano, nos extremos da distribuição" natureza="observado" />
          </dl>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <h3 className="text-base font-medium text-carvao">Como as {s.n} instituições se distribuem</h3>
            <p className="mt-1 text-sm text-carvao-muted">Taxa média de juros de cada instituição, % ao ano, semana de {janela(m.janela)}. Eixo a partir de zero.</p>
            <div className="mt-5">
              <FaixaDistribuicao stats={s} taxas={m.ranking.map((r) => r.taxa_aa)} destaque={c.linha?.taxa_aa ?? null} nomeDestaque={c.banco?.nome} />
            </div>
          </div>
          <dl className="grid gap-x-8 gap-y-3 self-start border-t border-linha pt-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["Menor taxa", s.min],
              ["1º quartil", s.p25],
              ["Mediana", s.mediana],
              ["3º quartil", s.p75],
              ["Maior taxa", s.max],
            ].map(([r, v]) => (
              <div key={r as string} className="flex items-baseline justify-between gap-3">
                <dt className="text-carvao-muted">{r}</dt>
                <dd className="tabular-nums text-carvao">{num(v as number)}% ao ano</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-carvao-muted">Instituições</dt>
              <dd className="tabular-nums text-carvao">{s.n}</dd>
            </div>
          </dl>
        </div>

        <AvisoCet className="mt-10 max-w-prose2" />

        <p className="mt-6 max-w-prose2 text-sm leading-relaxed text-mineral">{fonte}</p>

        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          <Link href={hrefSimulador} prefetch={prefetchDoLink(hrefSimulador)} className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao hover:bg-marfim">
            Calcular a parcela com {c.linha ? "esta taxa" : "a mediana"}
          </Link>
          <Link href={PAINEL_JUROS} prefetch={prefetchDoLink(PAINEL_JUROS)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
            Histórico e as 20 modalidades no painel de juros
          </Link>
        </p>
      </section>

      <SecaoCredito id="como-ler" titulo="Como ler estes números">
        <details className="max-w-prose2 border-t border-linha pt-3 text-sm leading-relaxed text-carvao-muted">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">O que a taxa mede e o que ela não permite concluir</summary>
          <div className="mt-3 space-y-3">
            <p>
              <strong className="font-medium text-carvao">Taxa média da instituição.</strong> É a média das taxas de juros das operações que a instituição
              contratou na semana, ponderada pelo valor de cada operação, em % ao ano e % ao mês, como o Banco Central divulga. Não é a taxa de um contrato
              específico: a de cada cliente varia com o prazo, as garantias e o perfil de quem toma o crédito.
            </p>
            <p>
              <strong className="font-medium text-carvao">Mediana entre instituições.</strong> Ordenadas as taxas das instituições que informaram a modalidade,
              a mediana é a do meio. Cada instituição pesa igual, grande ou pequena. Por isso ela difere da taxa média da modalidade nas séries do Banco
              Central, em que cada operação pesa pelo valor e os grandes bancos dominam.
            </p>
            <p>
              <strong className="font-medium text-carvao">Janela.</strong> O Banco Central publica as taxas por semanas de cinco dias úteis. A página usa a
              semana mais recente em que a modalidade reuniu instituições suficientes; semanas recentes chegam incompletas e entram quando completam. Cada
              modalidade tem a sua janela, informada junto do número.
            </p>
            <p>
              <strong className="font-medium text-carvao">Posição e distância.</strong> A posição ordena as instituições da menor para a maior taxa na
              janela. A distância da mediana é a diferença em pontos percentuais ao ano. Nenhuma das duas diz se a taxa é adequada ao seu caso, e a ordem
              muda de uma semana para outra.
            </p>
            <p>
              <strong className="font-medium text-carvao">Ausência.</strong> Instituição sem taxa na modalidade aparece como ausente, nunca como zero.
            </p>
          </div>
        </details>
        <p className="mt-6 text-sm text-carvao-muted">
          O método completo, com os conceitos do arquivo de juros, está em{" "}
          <Link href="/observatorio-do-credito/metodologia" prefetch={prefetchDoLink("/observatorio-do-credito/metodologia")} className="text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
            Metodologia e fontes do Crédito
          </Link>
          .
        </p>
      </SecaoCredito>
    </CascaCredito>
  );
}
