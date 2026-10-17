import Link from "next/link";
import type { ReactNode } from "react";
import { jmpPaises, meta, ods } from "@/lib/saneamento/gold";
import { data, mesPorExtenso, numero } from "@/lib/saneamento/formato";
import { mediana } from "@/lib/saneamento/internacional";
import { FONTE_ODS, REFERENCIAS, formatar, natureza, posicao, tetoRegua, type ReferenciaMundial } from "@/lib/saneamento/mundo";
import { ROTA } from "@/lib/saneamento/capitulos";
import type { PontoOds, SerieOds } from "@/lib/saneamento/tipos";
import { Indisponivel } from "./Editorial";

/**
 * Referência mundial de um indicador, ao lado do capítulo que mede algo parecido no Brasil. Mostra o Brasil, o
 * mundo e a América Latina e Caribe no mesmo ano, a posição do Brasil entre os países com valor nesse ano e uma
 * régua com todos eles. A cor marca identidade (Brasil, mundo, região), nunca juízo; a nota de comparabilidade
 * fica visível, fora de tooltip. Tudo no servidor.
 */

export type Marcador = { rotulo: string; valor: number; tipo: "brasil" | "mundo" | "alc" | "mediana" };

const COR: Record<Marcador["tipo"], string> = {
  brasil: "bg-obee",
  mundo: "bg-carvao",
  alc: "bg-bronze",
  mediana: "bg-carvao",
};

/** Posição horizontal em % e alinhamento do rótulo curto, que não sai da régua perto das bordas. */
function lugar(v: number, teto: number) {
  const x = Math.max(0, Math.min(100, (v / teto) * 100));
  const alinha = x < 20 ? "translate-x-0" : x > 80 ? "-translate-x-full" : "-translate-x-1/2";
  return { x, alinha };
}

/**
 * Régua horizontal: cada país com valor é um traço fino (a densidade aparece pela sobreposição), o Brasil é o
 * traço largo com rótulo curto acima. Mundo e região são traços de cor própria, nomeados na legenda abaixo, em
 * fluxo normal: rótulo longo posicionado sobre a régua sairia da tela no celular. Valores acima do teto ficam na
 * borda direita e são contados na legenda da figura; nenhum some.
 */
export function ReguaMundial({
  valores,
  marcadores,
  teto,
  casas,
  sufixo,
}: {
  valores: number[];
  marcadores: Marcador[];
  teto: number;
  casas: number;
  sufixo: string;
}) {
  const passo = [1, 2, 5, 10, 25, 20, 50, 100, 250, 500, 1000].find((p) => teto / p <= 6) ?? teto;
  const marcas = Array.from({ length: Math.floor(teto / passo) + 1 }, (_, i) => i * passo);
  const brasil = marcadores.find((m) => m.tipo === "brasil");
  const abaixo = marcadores.filter((m) => m.tipo !== "brasil");
  const rotulo = (m: Marcador) => `${m.rotulo} ${numero(m.valor, casas)}${sufixo}`;
  return (
    <div aria-hidden="true" className="mt-5 select-none text-xs">
      <div className="relative h-5">
        {brasil && (
          <span
            className={`absolute bottom-0 whitespace-nowrap font-medium text-obee-dark ${lugar(brasil.valor, teto).alinha}`}
            style={{ left: `${lugar(brasil.valor, teto).x}%` }}
          >
            {rotulo(brasil)}
          </span>
        )}
      </div>
      <div className="relative mt-1 h-8 overflow-x-clip border-b border-carvao">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 32" preserveAspectRatio="none">
          <path
            d={valores.map((v) => `M${(lugar(v, teto).x * 10).toFixed(1)} 4V32`).join("")}
            className="stroke-obee-neutro"
            strokeWidth={1}
            strokeOpacity={0.6}
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
        </svg>
        {abaixo.map((m) => (
          <span key={m.tipo} className={`absolute bottom-0 top-0 w-0.5 -translate-x-1/2 ${COR[m.tipo]}`} style={{ left: `${lugar(m.valor, teto).x}%` }} />
        ))}
        {brasil && <span className="absolute bottom-0 top-0 w-1 -translate-x-1/2 bg-obee" style={{ left: `${lugar(brasil.valor, teto).x}%` }} />}
      </div>
      <div className="relative h-5 text-carvao-muted">
        {marcas.map((t) => (
          <span key={t} className={`absolute top-1 tabular-nums ${lugar(t, teto).alinha}`} style={{ left: `${lugar(t, teto).x}%` }}>
            {numero(t, 0)}
            {sufixo}
          </span>
        ))}
      </div>
      {abaixo.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {abaixo.map((m) => (
            <li key={m.tipo} className={`inline-flex items-center gap-1.5 ${m.tipo === "alc" ? "text-bronze-dark" : "text-carvao"}`}>
              <span className={`inline-block h-3 w-0.5 ${COR[m.tipo]}`} />
              {rotulo(m)}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5 text-carvao-muted">
            <span className="inline-block h-3 w-px bg-obee-neutro" />
            demais países
          </li>
        </ul>
      )}
    </div>
  );
}

function Valor({ titulo, p, referencia, cor }: { titulo: string; p: PontoOds | null; referencia: ReferenciaMundial; cor: string }) {
  return (
    <div className="border-b border-linha py-3">
      <dt className={`text-sm ${cor}`}>{titulo}</dt>
      <dd className="mt-1 font-serif text-[1.6rem] leading-none tabular-nums text-carvao">{p ? formatar(referencia, p.valor) : "não publicado"}</dd>
      <dd className="mt-1 text-xs text-carvao-muted">{p ? `${p.ano}${natureza(p) ? `, ${natureza(p)}` : ""}` : "a base não traz este valor no ano comparado"}</dd>
    </div>
  );
}

/** Frase de posição, neutra: quantos países têm valor maior, igual ou menor que o do Brasil, na precisão exibida. */
export function frasePosicao(s: SerieOds, ref: ReferenciaMundial): string | null {
  const p = posicao(s, ref.casas);
  if (!p) return null;
  const iguais = p.igual - 1;
  return `Dos ${p.comValor} países e territórios com valor em ${s.ano_comparado}, ${p.maior} têm valor maior que o do Brasil, ${p.menor} têm valor menor${
    iguais > 0 ? ` e ${iguais} têm o mesmo valor, na precisão exibida` : ""
  }. A contagem só ordena valores; não classifica países.`;
}

export function FonteOds({ series }: { series: SerieOds[] }) {
  const m = meta();
  const ss = series.filter(Boolean);
  if (ss.length === 0) return null;
  const fontesBr = [...new Set(ss.flatMap((s) => s.fonte_brasil.map((f) => f.trim().replace(/\.+$/, ""))))];
  const descricao = ss.map((s) => `${s.codigo} (indicador ${s.indicador})`).join(" e ");
  return (
    <p className="mt-3 text-xs leading-relaxed text-carvao-muted">
      <span className="rotulo mr-1.5 text-mineral">Fonte</span>
      {FONTE_ODS}, {ss.length > 1 ? "séries" : "série"} {descricao}, edição {[...new Set(ss.map((s) => s.edicao))].join(", ")}, consulta em{" "}
      {data(m?.ods?.capturado_em?.slice(0, 10))}.
      {fontesBr.length > 0 && <> Fonte do valor do Brasil, como a base registra: {fontesBr.join("; ")}.</>} Nomes de países pelo IBGE.{" "}
      <a className="text-obee-dark underline underline-offset-2" href="/saneamento/gold/ods_paises.csv">
        Baixar os países (CSV)
      </a>
      .
    </p>
  );
}

/**
 * Figura completa de uma série: valores, régua e legenda com posição, comparabilidade e fonte. `titulo` é a
 * pergunta curta da figura; `extra` acrescenta uma nota específica do capítulo.
 */
export function FiguraOds({ codigo, titulo, extra, semRegua = false }: { codigo: string; titulo?: string; extra?: ReactNode; semRegua?: boolean }) {
  const s = ods()?.series[codigo];
  const ref = REFERENCIAS[codigo];
  if (!s || !ref) {
    return (
      <Indisponivel titulo="Referência mundial indisponível nesta edição">
        A série {codigo} da base global dos ODS não está na gold; o capítulo segue com os dados brasileiros.
      </Indisponivel>
    );
  }
  const teto = tetoRegua(s, ref);
  const acima = s.paises.filter((p) => p.valor > teto).length;
  const marcadores: Marcador[] = [];
  if (s.brasil?.valor != null) marcadores.push({ rotulo: "Brasil", valor: s.brasil.valor, tipo: "brasil" });
  if (s.mundo?.valor != null) marcadores.push({ rotulo: "Mundo", valor: s.mundo.valor, tipo: "mundo" });
  if (s.alc?.valor != null) marcadores.push({ rotulo: "América Latina e Caribe", valor: s.alc.valor, tipo: "alc" });
  const frase = frasePosicao(s, ref);
  const idTitulo = `ods-${codigo}`;
  return (
    <figure aria-labelledby={idTitulo} className="max-w-4xl">
      <p className="rotulo text-mineral">No mundo · ODS {s.indicador}</p>
      <h3 id={idTitulo} className="mt-2 font-serif text-xl leading-snug text-carvao">
        {titulo ?? ref.rotulo}, {s.ano_comparado}
      </h3>
      <p className="mt-1 text-sm text-carvao-muted">
        {titulo && titulo !== ref.rotulo ? `${ref.rotulo}, em ${ref.unidade}` : `Em ${ref.unidade}`}. Brasil, mundo e América Latina e Caribe no mesmo ano.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 border-t border-carvao sm:grid-cols-3">
        <Valor titulo="Brasil" p={s.brasil} referencia={ref} cor="text-obee-dark" />
        <Valor titulo="Mundo" p={s.mundo} referencia={ref} cor="text-carvao" />
        <Valor titulo="América Latina e Caribe" p={s.alc} referencia={ref} cor="text-bronze-dark" />
      </dl>
      {!semRegua && s.paises.length > 0 && (
        <ReguaMundial valores={s.paises.map((p) => p.valor)} marcadores={marcadores} teto={teto} casas={ref.casas} sufixo={ref.sufixo} />
      )}
      <figcaption className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {!semRegua && s.paises.length > 0 && (
          <span className="block">
            Cada traço fino é um país ou território com valor em {s.ano_comparado}.
            {acima > 0 && ` ${acima} ${acima === 1 ? "tem valor acima" : "têm valor acima"} de ${numero(teto, 0)}${ref.sufixo} e ${acima === 1 ? "fica" : "ficam"} na borda direita.`}{" "}
            {frase}
          </span>
        )}
        <span className="mt-2 block border-l-2 border-linha pl-3">
          <span className="font-medium text-carvao">Não é a mesma medida do capítulo.</span> {ref.comparabilidade}
          {extra && <> {extra}</>}
        </span>
      </figcaption>
      <FonteOds series={[s]} />
    </figure>
  );
}

const CAMPOS_JMP = {
  disponivel: { servico: "agua", rotulo: "Água disponível quando necessária", nota: "Pergunta do JMP sobre ter água em quantidade suficiente quando necessária, nas pesquisas domiciliares e registros de cada país. Não é a contagem de paralisações e racionamentos declarada ao SINISA." },
  sem_contaminacao: { servico: "agua", rotulo: "Água livre de contaminação fecal e química prioritária", nota: "Componente de qualidade do JMP, estimado com testes de água das pesquisas e dos reguladores de cada país. Não é o resultado das análises do SISAGUA, que mede amostras do controle e da vigilância." },
  rede_tratada: { servico: "esgoto", rotulo: "População ligada à rede de esgoto com tratamento", nota: "População cujo esgoto vai pela rede até tratamento, na estimativa do JMP. É parcela de pessoas, não de volume: não se compara direto ao IES2003 nem ao IES2004." },
} as const;

/**
 * Componente do JMP (OMS e UNICEF) ao lado do capítulo: Brasil contra a mediana dos países com estimativa e a mediana
 * da América Latina e Caribe, sem ponderar pela população, como na página Brasil no mundo. O arquivo do JMP não traz
 * agregado mundial desses componentes.
 */
export function FiguraJmp({ campo }: { campo: keyof typeof CAMPOS_JMP }) {
  const c = CAMPOS_JMP[campo];
  const j = jmpPaises();
  const mj = meta()?.jmp;
  const valor = (p: (typeof j.paises)[number]) => {
    const bloco = c.servico === "agua" ? p.agua?.t : p.esgoto?.t;
    return (bloco as Record<string, number | null | undefined> | undefined)?.[campo] ?? null;
  };
  const comValor = j.paises.map((p) => ({ p, v: valor(p) })).filter((x): x is { p: (typeof j.paises)[number]; v: number } => x.v != null);
  const br = comValor.find((x) => x.p.iso3 === "BRA")?.v ?? null;
  const ano = j.paises[0]?.ano;
  if (br == null || comValor.length === 0 || ano == null) {
    return (
      <Indisponivel titulo="Referência mundial indisponível nesta edição">
        O componente {c.rotulo.toLowerCase()} não tem estimativa do JMP para o Brasil nesta edição.
      </Indisponivel>
    );
  }
  const med = mediana(comValor.map((x) => x.v));
  const alcs = comValor.filter((x) => x.p.regiao_ods === "Latin America and the Caribbean").map((x) => x.v);
  const medAlc = mediana(alcs);
  const maior = comValor.filter((x) => Math.round(x.v * 10) > Math.round(br * 10)).length;
  const menor = comValor.filter((x) => Math.round(x.v * 10) < Math.round(br * 10)).length;
  const marcadores: Marcador[] = [{ rotulo: "Brasil", valor: br, tipo: "brasil" }];
  if (med != null) marcadores.push({ rotulo: "Mediana dos países", valor: med, tipo: "mundo" });
  if (medAlc != null) marcadores.push({ rotulo: "Mediana da América Latina e Caribe", valor: medAlc, tipo: "alc" });
  const id = `jmp-${campo}`;
  return (
    <figure aria-labelledby={id} className="max-w-4xl">
      <p className="rotulo text-mineral">No mundo · JMP, OMS e UNICEF</p>
      <h3 id={id} className="mt-2 font-serif text-xl leading-snug text-carvao">
        {c.rotulo}, {ano}
      </h3>
      <p className="mt-1 text-sm text-carvao-muted">% da população. Brasil e medianas dos países com estimativa, sem ponderar pela população.</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 border-t border-carvao sm:grid-cols-3">
        <div className="border-b border-linha py-3">
          <dt className="text-sm text-obee-dark">Brasil</dt>
          <dd className="mt-1 font-serif text-[1.6rem] leading-none tabular-nums text-carvao">{numero(br, 1)}%</dd>
        </div>
        <div className="border-b border-linha py-3">
          <dt className="text-sm text-carvao">Mediana dos países</dt>
          <dd className="mt-1 font-serif text-[1.6rem] leading-none tabular-nums text-carvao">{med == null ? "sem valor" : `${numero(med, 1)}%`}</dd>
          <dd className="mt-1 text-xs text-carvao-muted">{comValor.length} países e territórios</dd>
        </div>
        <div className="border-b border-linha py-3">
          <dt className="text-sm text-bronze-dark">Mediana da América Latina e Caribe</dt>
          <dd className="mt-1 font-serif text-[1.6rem] leading-none tabular-nums text-carvao">{medAlc == null ? "sem valor" : `${numero(medAlc, 1)}%`}</dd>
          <dd className="mt-1 text-xs text-carvao-muted">{alcs.length} países e territórios</dd>
        </div>
      </dl>
      <ReguaMundial valores={comValor.map((x) => x.v)} marcadores={marcadores} teto={100} casas={1} sufixo="%" />
      <figcaption className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        <span className="block">
          Cada traço fino é um país ou território com estimativa em {ano}. {maior} têm valor maior que o do Brasil e {menor} têm valor menor, ao
          décimo de ponto. A contagem só ordena valores; não classifica países.
        </span>
        <span className="mt-2 block border-l-2 border-linha pl-3">
          <span className="font-medium text-carvao">Não é a mesma medida do capítulo.</span> {c.nota}
        </span>
      </figcaption>
      <p className="mt-3 text-xs leading-relaxed text-carvao-muted">
        <span className="rotulo mr-1.5 text-mineral">Fonte</span>
        JMP (OMS e UNICEF), base de domicílios, edição de {mesPorExtenso(mj?.edicao_mes)}, capturada em{" "}
        {data(mj?.capturado_em?.slice(0, 10))}.{" "}
        <a className="text-obee-dark underline underline-offset-2" href="/saneamento/gold/jmp_paises.csv">
          Baixar os países (CSV)
        </a>
        .
      </p>
    </figure>
  );
}

/**
 * Diferença entre áreas urbanas e rurais no Brasil, no mundo e na América Latina e Caribe, pela mesma série do
 * JMP na base dos ODS. Ausência de estimativa aparece escrita, nunca como zero; a diferença só existe com os dois.
 */
export function TabelaUrbanoRural({ codigos }: { codigos: string[] }) {
  const g = ods();
  const linhas = codigos
    .map((c) => ({ s: g?.series[c], ref: REFERENCIAS[c] }))
    .filter((x): x is { s: SerieOds; ref: ReferenciaMundial } => !!x.s?.recortes && !!x.ref);
  if (linhas.length === 0) {
    return <Indisponivel titulo="Referência mundial indisponível nesta edição">As séries urbana e rural da base dos ODS não estão na gold.</Indisponivel>;
  }
  const areas = [
    { id: "brasil", rotulo: "Brasil" },
    { id: "mundo", rotulo: "Mundo" },
    { id: "alc", rotulo: "América Latina e Caribe" },
  ] as const;
  const fmt = (v: number | null | undefined) => (v == null ? "sem estimativa" : `${numero(v, 1)}%`);
  return (
    <figure className="max-w-4xl">
      <p className="rotulo text-mineral">No mundo · ODS 6.1.1 e 6.2.1, por situação</p>
      <h3 className="mt-2 font-serif text-xl leading-snug text-carvao">Serviço gerenciado com segurança nas áreas urbanas e rurais</h3>
      <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Tabela: urbano e rural no Brasil e no mundo (rolável)">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">População com serviço gerenciado com segurança, áreas urbanas e rurais, Brasil, mundo e América Latina e Caribe</caption>
          <thead>
            <tr className="border-b border-carvao text-left text-xs text-carvao-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Serviço</th>
              <th scope="col" className="py-2 pr-4 font-medium">Área</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Urbana</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Rural</th>
              <th scope="col" className="py-2 text-right font-medium">Diferença (p.p.)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.flatMap(({ s, ref }) =>
              areas.map((a, i) => {
                const u = s.recortes?.URBAN?.[a.id]?.valor ?? null;
                const r = s.recortes?.RURAL?.[a.id]?.valor ?? null;
                return (
                  <tr key={`${s.codigo}-${a.id}`} className="border-b border-linha">
                    {i === 0 && (
                      <th scope="row" rowSpan={areas.length} className="py-2 pr-4 text-left align-top font-normal text-carvao">
                        {primeiraMaiuscula(ref.rotulo.replace("População que usa ", ""))}, {s.ano_comparado}
                      </th>
                    )}
                    <td className={`py-2 pr-4 ${a.id === "brasil" ? "text-obee-dark" : a.id === "alc" ? "text-bronze-dark" : "text-carvao"}`}>{a.rotulo}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmt(u)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmt(r)}</td>
                    <td className="py-2 text-right tabular-nums">{u == null || r == null ? "sem cálculo" : numero(u - r, 1)}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Diferença em pontos percentuais, urbana menos rural, calculada pelo Observatório sobre os valores publicados.{" "}
        <span className="font-medium text-carvao">Não é a mesma medida do capítulo:</span> o JMP usa a classificação urbana e rural de cada país e
        mede serviço gerenciado com segurança; o capítulo usa as categorias do Censo 2022.
      </figcaption>
      <FonteOds series={linhas.map((l) => l.s)} />
    </figure>
  );
}

const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Faixa da página de entrada: três séries com o Brasil, o mundo e a América Latina e Caribe, cada uma com sua
 * régua compacta e o link para o capítulo que mede o assunto no Brasil.
 */
export function FaixaMundo({ itens }: { itens: { codigo: string; titulo: string; href: string }[] }) {
  const g = ods();
  const validos = itens
    .map((i) => ({ ...i, s: g?.series[i.codigo], ref: REFERENCIAS[i.codigo] }))
    .filter((x): x is typeof x & { s: SerieOds; ref: ReferenciaMundial } => !!x.s && !!x.ref);
  if (validos.length === 0) return null;
  const m = meta();
  return (
    <div>
      <ul className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-3">
        {validos.map(({ codigo, titulo, href, s, ref }) => {
          const marcadores: Marcador[] = [];
          if (s.brasil?.valor != null) marcadores.push({ rotulo: "Brasil", valor: s.brasil.valor, tipo: "brasil" });
          if (s.mundo?.valor != null) marcadores.push({ rotulo: "Mundo", valor: s.mundo.valor, tipo: "mundo" });
          if (s.alc?.valor != null) marcadores.push({ rotulo: "Am. Latina e Caribe", valor: s.alc.valor, tipo: "alc" });
          return (
            <li key={codigo} className="border-t border-carvao pt-4">
              <p className="rotulo text-mineral">ODS {s.indicador} · {s.ano_comparado}</p>
              <p className="mt-2 font-serif text-lg leading-snug text-carvao">{titulo}</p>
              <p className="mt-2 text-sm text-carvao-muted">
                Brasil <span className="tabular-nums text-carvao">{formatar(ref, s.brasil?.valor)}</span> · mundo{" "}
                <span className="tabular-nums text-carvao">{formatar(ref, s.mundo?.valor)}</span> · América Latina e Caribe{" "}
                <span className="tabular-nums text-carvao">{formatar(ref, s.alc?.valor)}</span>
              </p>
              <ReguaMundial valores={s.paises.map((p) => p.valor)} marcadores={marcadores} teto={tetoRegua(s, ref)} casas={ref.casas} sufixo={ref.sufixo} />
              <p className="mt-2 text-xs text-carvao-muted">
                {s.paises.length} países com valor; cada traço fino é um deles.{" "}
                <Link className="text-obee-dark underline underline-offset-2" href={href}>
                  Ver no capítulo
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        <span className="rotulo mr-1.5 text-mineral">Fonte</span>
        {FONTE_ODS}, edição {validos[0].s.edicao}, consulta em {data(m?.ods?.capturado_em?.slice(0, 10))}; séries do JMP (OMS e UNICEF) e da OMS. Medidas
        internacionais, com definição própria: não são as do Censo nem as do SINISA e não se somam a elas.
      </p>
    </div>
  );
}

const CAPITULO_ROTULO: Record<string, string> = {
  acesso: "1 · Sem atendimento",
  esgoto: "4 · Destino do esgoto",
  financiamento: "10 · De onde vem o dinheiro",
  planejamento: "11 · Metas e planos",
  "saude-ambiente": "13 · Saúde e ambiente",
  resiliencia: "14 · Secas e eventos extremos",
};

/** Todas as séries dos ODS da gold, com Brasil, mundo e região no ano comparado e o capítulo que traz a régua. */
export function TabelaOds() {
  const g = ods();
  const series = Object.values(g?.series ?? {}).filter((s) => REFERENCIAS[s.codigo]);
  if (series.length === 0) {
    return <Indisponivel titulo="Referências mundiais indisponíveis nesta edição">A gold dos ODS não foi encontrada.</Indisponivel>;
  }
  return (
    <div>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Indicadores dos ODS: Brasil, mundo e América Latina e Caribe (rolável)">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <caption className="sr-only">Indicadores dos ODS para o Brasil, o mundo e a América Latina e Caribe, no ano mais recente com valor do Brasil</caption>
          <thead>
            <tr className="border-b border-carvao text-left">
              <th scope="col" className="py-2 pr-4 font-medium">Indicador</th>
              <th scope="col" className="py-2 pr-4 font-medium">Ano</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Brasil</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Mundo</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">América Latina e Caribe</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Países com valor</th>
              <th scope="col" className="py-2 font-medium">No capítulo</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => {
              const ref = REFERENCIAS[s.codigo];
              return (
                <tr key={s.codigo} className="border-b border-linha align-top">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <span className="block text-carvao">{ref.rotulo}</span>
                    <span className="block text-xs text-carvao-muted">
                      ODS {s.indicador} · {s.codigo} · {ref.unidade}
                    </span>
                  </th>
                  <td className="py-2 pr-4 tabular-nums">{s.ano_comparado}</td>
                  <td className="py-2 pr-4 text-right">
                    <span className="block tabular-nums text-carvao">{formatar(ref, s.brasil?.valor)}</span>
                    {natureza(s.brasil) && <span className="block text-xs text-carvao-muted">{natureza(s.brasil)}</span>}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s.mundo ? formatar(ref, s.mundo.valor) : "não publicado"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s.alc ? formatar(ref, s.alc.valor) : "não publicado"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s.paises.length}</td>
                  <td className="py-2">
                    <Link className="text-obee-dark underline underline-offset-2" href={`${ROTA}/${ref.capitulo}#mundo`}>
                      {CAPITULO_ROTULO[ref.capitulo] ?? ref.capitulo}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Ano: o mais recente em que o Brasil tem valor na série; mundo e região são do mesmo ano. Mundo e região são agregados publicados pela ONU,
        ponderados por ela. &quot;Não publicado&quot;: a base não traz o agregado nesse ano. A natureza do valor do Brasil (dado do país, estimativa,
        modelado) é a que a base registra.
      </p>
      <FonteOds series={series} />
    </div>
  );
}

/** Seção-padrão de capítulo: pergunta, texto curto, figuras e o link para a página Brasil no mundo. */
export function MundoNoCapitulo({ children, texto }: { children: ReactNode; texto?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-12">
      {texto && <p className="max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">{texto}</p>}
      {children}
      <p className="text-sm">
        <Link className="text-obee-dark underline underline-offset-2" href={`${ROTA}/internacional`}>
          Brasil no mundo: todos os indicadores, países e a conciliação com o Censo e o SINISA
        </Link>
      </p>
    </div>
  );
}
