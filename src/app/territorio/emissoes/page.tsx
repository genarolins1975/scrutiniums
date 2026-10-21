import type { Metadata } from "next";
import Link from "next/link";
import { NOME_SETOR, SETORES, lerEmissoes, mt } from "@/lib/territorio/emissoes";
import { Figura, dataBr, n } from "@/components/territorio/Queimadas";
import { CincoSetores, SerieSetores, TabelaCategorias, TabelaSerieEmissoes } from "@/components/territorio/Emissoes";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Emissões de gases de efeito estufa",
  description: "Emissões de gases de efeito estufa do Brasil pelo inventário oficial do MCTI, de 1990 ao último ano publicado, por setor e categoria, com 2005 como referência da meta climática.",
};

/**
 * Painel de emissões do Observatório do Território e Clima, pelo inventário oficial do
 * MCTI (SIRENE): total líquido e sem uso da terra, os cinco setores, as maiores fontes e
 * remoções, a variação desde 2005 (referência da NDC) e o método, com a defasagem do
 * inventário declarada junto aos números.
 */
export default function PaginaEmissoes() {
  const g = lerEmissoes();
  const ultimo = g.anos[g.anos.length - 1];
  const ref = g.anos.find((a) => a.ano === g.derivados.anoReferenciaNdc)!;
  const d = g.derivados;
  const maior = [...SETORES].sort((a, b) => ultimo.setores[b] - ultimo.setores[a])[0];
  const pico = g.anos.reduce((a, b) => (b.totalLiquido > a.totalLiquido ? b : a));
  const sinal = (v: number) => `${v > 0 ? "+" : "−"}${n(Math.abs(v), 1)}%`;

  const numeros = [
    { rotulo: `Emissões líquidas do Brasil em ${ultimo.ano}`, valor: n(mt(ultimo.totalLiquido), 0), unidade: "Mt CO2e", periodo: `${sinal(d.variacaoDesde2005Pct.totalLiquido)} sobre ${ref.ano}`, nota: "Milhões de toneladas de CO2 equivalente, já descontadas as remoções por florestas e vegetação." },
    { rotulo: `Sem uso da terra e florestas, em ${ultimo.ano}`, valor: n(mt(ultimo.totalSemLulucf), 0), unidade: "Mt CO2e", periodo: `${sinal(d.variacaoDesde2005Pct.totalSemLulucf)} sobre ${ref.ano}`, nota: "Energia, indústria, agropecuária e resíduos somados: a parte que não depende do desmatamento." },
    { rotulo: `Setor com maior parte do total em ${ultimo.ano}`, valor: NOME_SETOR[maior], unidade: "", periodo: `${n(d.participacaoUltimoAnoPct[maior], 1)}% das emissões líquidas`, nota: "Saldo entre desmatamento e conversão de vegetação, de um lado, e remoções, de outro." },
    { rotulo: "Ano de maior emissão líquida na série", valor: String(pico.ano), unidade: "", periodo: `${n(mt(pico.totalLiquido), 0)} Mt CO2e`, nota: `Puxado pelo uso da terra e florestas (${n(mt(pico.setores.lulucf), 0)} Mt naquele ano), que caiu nos anos seguintes.` },
  ];

  return (
    <main className="bg-papel">
      <section aria-labelledby="emissoes-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/territorio" className="underline decoration-linha underline-offset-4 hover:text-carvao">Território e Clima</Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">Emissões</span>
          </nav>
          <RotuloContexto rota="/territorio/emissoes" className="mt-8 flex flex-wrap items-center gap-x-3 text-mineral" marca={<span aria-hidden="true" className="h-[3px] w-8 bg-obee" />} />
          <h1 id="emissoes-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            Quanto o Brasil emite de gases de efeito estufa?
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
            As emissões do país de {g.anoInicial} a {g.anoFinal} pelo inventário oficial do governo, por setor e categoria, com {ref.ano}, o ano de
            referência da meta climática brasileira, como comparação.
          </p>
          <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {numeros.map((x) => (
              <div key={x.rotulo} className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">{x.rotulo}</dt>
                <dd className="mt-2">
                  <span className={`font-label leading-none tabular-nums text-carvao ${x.valor.length > 10 ? "text-[1.35rem]" : "text-[2rem]"}`}>{x.valor}</span>{" "}
                  {x.unidade && <span className="text-sm text-carvao-muted">{x.unidade}</span>}
                </dd>
                <dd className="mt-2 text-xs leading-relaxed text-mineral">{x.periodo}</dd>
                <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{x.nota}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            O inventário oficial vai até {g.anoFinal} ({g.edicao}). Anos mais recentes só existem em estimativas da sociedade civil, como o SEEG, que
            aparece no <Link href="/agronegocio/ambiente" className="underline decoration-linha underline-offset-4">painel de desmatamento e emissões</Link> e
            não se mistura com esta série.
          </p>
        </div>
      </section>

      <section aria-labelledby="serie-emissoes" className="mx-auto max-w-page px-6 py-12 md:py-14">
        <h2 id="serie-emissoes" className="sr-only">Como as emissões variaram</h2>
        <Figura
          id="serie-setores"
          titulo={`As emissões de cada ano, de ${g.anoInicial} a ${g.anoFinal}`}
          subtitulo={`Emissões líquidas, milhões de toneladas de CO2 equivalente (${g.metrica}), por setor. ${ref.ano} em destaque: é a referência da meta climática.`}
          fonte={<>{g.fonte.nome}, {g.edicao}. Capturado em {dataBr(g.capturadoEm)}. Cada edição recalcula a série inteira desde {g.anoInicial}.</>}
          tabela={<TabelaSerieEmissoes g={g} />}
        >
          <SerieSetores g={g} />
        </Figura>
      </section>

      <CincoSetores g={g} />

      <section aria-labelledby="categorias-emissoes" className="mx-auto max-w-page px-6 py-12 md:py-14">
        <h2 id="categorias-emissoes" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Dentro dos setores</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          As categorias do inventário em {g.anoFinal}. Campo e pastagem e agricultura aparecem no uso da terra; o metano da digestão do gado
          (fermentação entérica), na agropecuária; a queima de combustíveis, na energia.
        </p>
        <div className="mt-6"><TabelaCategorias g={g} /></div>
        <p className="mt-4 text-xs leading-relaxed text-mineral">{g.fonte.nome}, {g.edicao}. Categorias de primeiro nível do IPCC, em Mt CO2e ({g.metrica}).</p>
      </section>

      <section aria-labelledby="metodo-emissoes" className="mx-auto max-w-page px-6 pb-12">
        <details className="border-t border-linha pt-4">
          <summary id="metodo-emissoes" className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e ressalvas</summary>
          <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <p>
              Fonte: {g.fonte.nome} (<a href={g.fonte.pagina} className="underline decoration-linha underline-offset-4">página do SIRENE</a>). {g.fonte.natureza} {g.fonte.licenca}
            </p>
            <p>
              Unidade: {g.unidade}, métrica {g.metrica}. O total líquido pelas métricas alternativas publicadas pela fonte em {g.anoFinal}:{" "}
              {Object.values(g.metricasAlternativas).map((m) => `${m.nome}, ${n(mt(m.totalLiquido[String(g.anoFinal)]), 0)} Mt`).join("; ")}.
            </p>
            <ul className="list-disc space-y-2 pl-5">{g.ressalvas.map((r) => <li key={r}>{r}</li>)}</ul>
            <p>
              Diferença para o SEEG: as duas fontes usam a mesma métrica, mas dados de atividade e regras diferentes para o uso da terra. Na consulta de
              18/10/2026, o total líquido do SEEG ficava 1,8% acima do inventário em 2022 e 5,1% abaixo em 2005. As séries não se somam nem se emendam.
            </p>
            <p>
              Captura em {dataBr(g.capturadoEm)}; {g.originais.length} planilhas oficiais, cada uma com sha256 e tamanho registrados. Os setores somam o total
              e cada planilha setorial confere com o total Brasil antes da publicação.
            </p>
            <p>
              <a href="/territorio/gold/emissoes.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Baixar os dados deste painel (JSON)</a>
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}
