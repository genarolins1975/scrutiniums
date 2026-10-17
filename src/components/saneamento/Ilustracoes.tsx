import Link from "next/link";
import type { ReactNode } from "react";
import { ROTA } from "@/lib/saneamento/capitulos";
import { jmpPaises, meta } from "@/lib/saneamento/gold";
import { data, inteiro, mesPorExtenso, numero, reaisCompacto } from "@/lib/saneamento/formato";
import { razaoPct } from "@/lib/saneamento/municipios";
import type { EstimativaJmp } from "@/lib/saneamento/tipos";

/**
 * Figuras didáticas do Observatório do Saneamento. Cada uma diz o que é na própria moldura:
 *  - ilustração conceitual (sem dado e sem escala), em moldura tracejada, como no Setor Elétrico;
 *  - ilustração com dado (o desenho explica, os números vêm da gold);
 *  - figura com dado.
 * Nada aqui é decoração: cada figura explica um mecanismo que o capítulo mede. Tudo no servidor.
 */

type Tipo = "ilustracao" | "ilustracao-dado" | "dado";
const ROTULO_TIPO: Record<Tipo, string> = {
  ilustracao: "Ilustração conceitual · sem dado e sem escala",
  "ilustracao-dado": "Ilustração conceitual com dados",
  dado: "Figura com dados",
};

export function FiguraDidatica({ id, tipo, titulo, children, legenda }: { id: string; tipo: Tipo; titulo: string; children: ReactNode; legenda: ReactNode }) {
  return (
    <figure aria-labelledby={`${id}-titulo`} className={tipo === "dado" ? "max-w-5xl" : "max-w-5xl border border-dashed border-mineral bg-papel p-4 md:p-6"}>
      <p className="rotulo text-mineral">{ROTULO_TIPO[tipo]}</p>
      <h3 id={`${id}-titulo`} className="mt-2 font-serif text-xl leading-snug text-carvao [text-wrap:balance]">
        {titulo}
      </h3>
      <div className="mt-5">{children}</div>
      <figcaption className="mt-5 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{legenda}</figcaption>
    </figure>
  );
}

const capLink = (slug: string, rotulo: string) => (
  <Link className="text-obee-dark underline underline-offset-2" href={`${ROTA}/${slug}`}>
    {rotulo}
  </Link>
);

// ---------------------------------------------------------------------------
// Escada de serviço do JMP
// ---------------------------------------------------------------------------

/**
 * Cores da escada: dois tons de petróleo para os degraus de pelo menos básico (o limiar do ODS 1.4.1) e três de
 * bronze para os abaixo dele. Conferidas com o validador de paleta da skill de visualização sobre o papel
 * (#faf8f2): separação entre vizinhos ΔE 14,1 para daltonismo e 17,4 para visão normal. O bronze claro fica
 * abaixo de 3:1 contra o papel: por isso cada segmento tem rótulo, borda e a tabela equivalente.
 */
const ESCADA = [
  { id: "gerenciada", agua: "Gerenciada com segurança", esgoto: "Gerenciado com segurança", legenda: "Gerenciado com segurança", cor: "#0a4a56", texto: "#ffffff" },
  { id: "basica_so", agua: "Básica", esgoto: "Básico", legenda: "Básico", cor: "#5e98a3", texto: "#1a1d21" },
  { id: "limitada", agua: "Limitada", esgoto: "Limitado", legenda: "Limitado", cor: "#d6b892", texto: "#1a1d21" },
  { id: "nao_melhorada", agua: "Não melhorada", esgoto: "Não melhorado", legenda: "Não melhorado", cor: "#a87a50", texto: "#1a1d21" },
  { id: "ruim", agua: "Água superficial", esgoto: "Defecação a céu aberto", legenda: "Água superficial ou defecação a céu aberto", cor: "#6e4a2e", texto: "#ffffff" },
] as const;
type Degrau = (typeof ESCADA)[number]["id"];

function degraus(e: EstimativaJmp, servico: "agua" | "esgoto"): Record<Degrau, number | null> {
  const t = e[servico]?.t;
  const g = t?.gerenciada ?? null;
  const b = t?.basica ?? null;
  return {
    gerenciada: g,
    basica_so: b == null ? null : g == null ? b : Math.max(0, b - g),
    limitada: t?.limitada ?? null,
    nao_melhorada: t?.nao_melhorada ?? null,
    ruim: t?.ruim ?? null,
  };
}

const pctFmt = (v: number | null) => (v == null ? "sem estimativa" : `${numero(v, 1)}%`);

/** Escada de serviço do JMP para o Brasil: como a população se distribui entre os degraus em três anos da série. */
export function EscadaJmp() {
  const { brasil } = jmpPaises();
  const m = meta()?.jmp;
  const ultimo = brasil.at(-1)?.ano;
  const anos = [2000, 2012, ultimo].filter((a, i, l): a is number => a != null && l.indexOf(a) === i);
  const serie = anos.map((a) => brasil.find((b) => b.ano === a)).filter((b): b is EstimativaJmp => !!b);
  if (serie.length === 0) return null;
  const servicos = [
    { id: "agua" as const, rotulo: "Água" },
    { id: "esgoto" as const, rotulo: "Esgotamento" },
  ];
  return (
    <FiguraDidatica
      id="escada-jmp"
      tipo="dado"
      titulo="A escada de serviço do JMP no Brasil"
      legenda={
        <>
          Percentual da população em cada degrau, com as definições do JMP descritas na tabela acima. Os degraus somam cerca de 100% em cada ano;
          o petróleo marca os degraus de pelo menos básico e o bronze, os abaixo dele. Sem estimativa não é zero: em {ultimo}, o JMP não publica a
          parcela de água superficial do Brasil. Fonte: JMP (OMS e UNICEF), base de domicílios, edição de {mesPorExtenso(m?.edicao_mes)}, capturada em{" "}
          {data(m?.capturado_em?.slice(0, 10))}.
        </>
      }
    >
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao">
        {ESCADA.map((d) => (
          <li key={d.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 border border-carvao/30" style={{ background: d.cor }} />
            {d.legenda}
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-8 md:grid-cols-2">
        {servicos.map((s) => (
          <div key={s.id}>
            <p className="text-sm font-medium text-carvao">{s.rotulo}</p>
            <ul className="mt-3 space-y-3">
              {serie.map((e) => {
                const d = degraus(e, s.id);
                const desc = ESCADA.map((x) => `${s.id === "agua" ? x.agua : x.esgoto}: ${pctFmt(d[x.id])}`).join("; ");
                return (
                  <li key={e.ano} className="grid grid-cols-[3rem_1fr] items-center gap-3">
                    <span className="text-sm tabular-nums text-carvao-muted">{e.ano}</span>
                    <div role="img" aria-label={`${s.rotulo}, ${e.ano}: ${desc}`} className="flex h-8 w-full gap-[2px] bg-papel">
                      {ESCADA.map((x) => {
                        const v = d[x.id];
                        if (v == null || v <= 0) return null;
                        return (
                          <div
                            key={x.id}
                            title={`${s.id === "agua" ? x.agua : x.esgoto}: ${pctFmt(v)}`}
                            className="flex h-full items-center justify-center overflow-hidden text-xs tabular-nums"
                            style={{ width: `${v}%`, background: x.cor, color: x.texto }}
                          >
                            {v >= 7 ? `${numero(v, 0)}%` : ""}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <details className="mt-5">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-obee-dark underline underline-offset-4">Dados da figura</summary>
        <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label="Escada de serviço do JMP no Brasil, tabela (rolável)">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Percentual da população do Brasil em cada degrau da escada do JMP</caption>
            <thead>
              <tr className="border-b border-carvao text-left text-xs text-carvao-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Serviço e ano</th>
                {ESCADA.map((x) => (
                  <th key={x.id} scope="col" className="py-2 pr-4 text-right font-medium">
                    {x.legenda}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servicos.flatMap((s) =>
                serie.map((e) => {
                  const d = degraus(e, s.id);
                  return (
                    <tr key={`${s.id}-${e.ano}`} className="border-b border-linha">
                      <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                        {s.rotulo}, {e.ano}
                      </th>
                      {ESCADA.map((x) => (
                        <td key={x.id} className="py-1.5 pr-4 text-right tabular-nums">
                          {pctFmt(d[x.id])}
                        </td>
                      ))}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </FiguraDidatica>
  );
}

// ---------------------------------------------------------------------------
// Níveis de tratamento de esgoto
// ---------------------------------------------------------------------------

const AZ = "var(--cor-obee)";
const AZ_FUNDO = "var(--cor-obee-fundo)";
const BR = "var(--cor-bronze)";
const BR_FUNDO = "var(--cor-marfim)";
const TINTA = "var(--cor-carvao)";

const FORMAS_NIVEL: Record<string, ReactNode> = {
  "Preliminar/acondicionamento": (
    <>
      <rect x={-30} y={-16} width={60} height={32} rx={2} fill={BR_FUNDO} stroke={BR} strokeWidth={2} />
      {[-18, -12, -6, 0, 6, 12, 18].map((x) => (
        <line key={x} x1={x} y1={-16} x2={x} y2={16} stroke={TINTA} strokeWidth={1.2} />
      ))}
    </>
  ),
  Primário: (
    <>
      <circle cx={0} cy={0} r={17} fill={BR_FUNDO} stroke={BR} strokeWidth={2} />
      <circle cx={0} cy={0} r={4} fill={BR} />
      <line x1={0} y1={0} x2={12} y2={-12} stroke={BR} strokeWidth={1.5} />
    </>
  ),
  Secundário: (
    <>
      <rect x={-30} y={-16} width={60} height={32} rx={2} fill={BR_FUNDO} stroke={BR} strokeWidth={2} />
      {[
        [-18, 6],
        [-10, -4],
        [-2, 8],
        [6, -6],
        [14, 4],
        [20, -8],
        [-20, -8],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={2.6} fill="none" stroke={BR} strokeWidth={1.2} />
      ))}
    </>
  ),
  Terciário: (
    <>
      <rect x={-30} y={-16} width={60} height={32} rx={2} fill={AZ_FUNDO} stroke={AZ} strokeWidth={2} />
      {[-8, 0, 8].map((y) => (
        <line key={y} x1={-24} y1={y} x2={24} y2={y} stroke={AZ} strokeWidth={1.2} strokeDasharray="3 3" />
      ))}
    </>
  ),
};

const NIVEIS = [
  { id: "Preliminar/acondicionamento", nome: "Preliminar", faz: "Grades e caixas de areia retiram sólidos grosseiros e areia, que danificariam as etapas seguintes." },
  { id: "Primário", nome: "Primário", faz: "Decantadores separam os sólidos que assentam e, com eles, parte da matéria orgânica." },
  { id: "Secundário", nome: "Secundário", faz: "Microrganismos consomem a matéria orgânica dissolvida, em lagoas, reatores anaeróbios ou lodos ativados." },
  { id: "Terciário", nome: "Terciário", faz: "Remove nutrientes, como nitrogênio e fósforo, ou organismos causadores de doenças, conforme o projeto." },
];

/**
 * O que cada nível de tratamento faz, com as estações em operação que o declaram ao SINISA. O desenho é
 * conceitual; as contagens são do cadastro de estações.
 */
export function NiveisTratamento({ contagem, emOperacao, semNivel }: { contagem: Record<string, number>; emOperacao: number; semNivel: number }) {
  return (
    <FiguraDidatica
      id="niveis-tratamento"
      tipo="ilustracao-dado"
      titulo="O que cada nível de tratamento faz, e quantas estações declaram cada um"
      legenda={
        <>
          Cada nível vai além do anterior no que remove, mas nem toda estação passa por todas as etapas físicas: lagoas e reatores anaeróbios, por
          exemplo, dispensam o decantador primário. O cadastro registra só o nível declarado pelo prestador. {inteiro(semNivel)} das {inteiro(emOperacao)}{" "}
          estações em operação ({numero(razaoPct(semNivel, emOperacao), 1)}%) não informam o nível e ficam fora das barras. Descrição didática dos níveis
          segundo a literatura técnica de tratamento de esgotos (por exemplo, von Sperling, Introdução à qualidade das águas e ao tratamento de esgotos,
          DESA/UFMG); contagens do SINISA 2025, ano de referência 2024, planilha de estações de tratamento de esgoto.
        </>
      }
    >
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-4 md:gap-4">
        {NIVEIS.map((n, i) => {
          const v = contagem[n.id] ?? 0;
          const pct = razaoPct(v, emOperacao) ?? 0;
          return (
            <li key={n.id} className="relative border-t-2 border-bronze pt-3">
              {i > 0 && (
                <span aria-hidden="true" className="absolute -left-3 -top-3.5 hidden text-bronze md:inline">
                  ▸
                </span>
              )}
              <svg viewBox="-36 -20 72 40" className="h-10 w-[4.5rem]" aria-hidden="true">
                {FORMAS_NIVEL[n.id]}
              </svg>
              <p className="mt-2 font-serif text-lg text-carvao">
                <span className="mr-1.5 font-label text-xs tabular-nums text-mineral">{i + 1}</span>
                {n.nome}
              </p>
              <p className="mt-1 text-sm leading-snug text-carvao-muted">{n.faz}</p>
              <p className="mt-3 text-sm text-carvao">
                <span className="font-serif text-2xl tabular-nums">{inteiro(v)}</span> estações em operação
              </p>
              <div className="mt-1 h-2 w-full bg-linha/50" aria-hidden="true">
                <div className="h-full bg-obee" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <p className="mt-1 text-xs tabular-nums text-carvao-muted">{numero(pct, 1)}% das {inteiro(emOperacao)} em operação</p>
            </li>
          );
        })}
      </ol>
    </FiguraDidatica>
  );
}

// ---------------------------------------------------------------------------
// Diagrama F: caminhos de transmissão fecal e oral
// ---------------------------------------------------------------------------

const CAMINHOS = [
  { nome: "Água", nota: "de beber ou de uso doméstico" },
  { nome: "Solo e plantações", nota: "fezes no chão, na lavoura e nas enchentes" },
  { nome: "Moscas", nota: "pousam nas fezes e nos alimentos" },
  { nome: "Mãos", nota: "depois de usar o banheiro ou trocar fraldas" },
];

function Barreira({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="border-y-2 border-obee bg-obee-fundo px-3 py-3 text-sm leading-snug lg:border-x-2 lg:border-y-0 lg:py-4">
      <p className="rotulo text-obee-dark">{titulo}</p>
      <p className="mt-1 text-carvao">{children}</p>
    </div>
  );
}

/** Diagrama F (Wagner e Lanoix, OMS, 1958), simplificado: por onde as fezes chegam à boca de outra pessoa e onde água, esgoto e higiene interrompem. */
export function DiagramaF() {
  return (
    <FiguraDidatica
      id="diagrama-f"
      tipo="ilustracao"
      titulo="Por onde as doenças ligadas às fezes chegam a outra pessoa, e onde o saneamento as interrompe"
      legenda={
        <>
          Simplificação do diagrama F, de Wagner e Lanoix (Organização Mundial da Saúde, Monografia 39, 1958), na forma difundida pelo WEDC, da
          Universidade de Loughborough. Mostra caminhos possíveis, não a frequência de cada um. Vale para as infecções intestinais; a leptospirose
          (urina de roedores, contato com água de enchente) e a esquistossomose (larvas na água que atravessam a pele) seguem outros caminhos, também
          ligados a esgoto e drenagem.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_minmax(9rem,0.8fr)_1.6fr_minmax(9rem,0.8fr)_1fr] lg:items-stretch lg:gap-0">
        <div className="flex flex-col justify-center border border-bronze bg-marfim p-4 lg:mr-3">
          <p className="font-serif text-lg text-carvao">Fezes</p>
          <p className="mt-1 text-sm text-carvao-muted">de uma pessoa ou animal infectado</p>
        </div>
        <Barreira titulo="Barreira primária">
          Banheiro e esgoto coletado e tratado ({capLink("acesso", "capítulo 1")} e {capLink("esgoto", "capítulo 4")}); lavar as mãos depois de usar o
          banheiro.
        </Barreira>
        <div className="grid gap-2 lg:mx-3">
          <ul className="grid grid-cols-2 gap-2">
            {CAMINHOS.map((c) => (
              <li key={c.nome} className="border border-linha bg-superficie p-2.5">
                <p className="text-sm font-medium text-carvao">{c.nome}</p>
                <p className="text-xs leading-snug text-carvao-muted">{c.nota}</p>
              </li>
            ))}
          </ul>
          <div className="border border-linha bg-superficie p-2.5">
            <p className="text-sm font-medium text-carvao">Alimentos</p>
            <p className="text-xs leading-snug text-carvao-muted">contaminados por qualquer dos quatro caminhos acima</p>
          </div>
        </div>
        <Barreira titulo="Barreira secundária">
          Água tratada e monitorada ({capLink("continuidade", "capítulo 3")}); lavar as mãos antes de comer e de cozinhar; lavar e cozinhar os
          alimentos; controlar moscas.
        </Barreira>
        <div className="flex flex-col justify-center border border-carvao bg-superficie p-4 lg:ml-3">
          <p className="font-serif text-lg text-carvao">Boca de outra pessoa</p>
          <p className="mt-1 text-sm text-carvao-muted">infecções intestinais, como as diarreias</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-carvao-muted lg:hidden">Leitura de cima para baixo: das fezes à boca de outra pessoa.</p>
      <p className="mt-3 hidden text-xs text-carvao-muted lg:block">Leitura da esquerda para a direita: das fezes à boca de outra pessoa.</p>
    </FiguraDidatica>
  );
}

// ---------------------------------------------------------------------------
// Balanço hídrico (IWA)
// ---------------------------------------------------------------------------

type Celula = { texto: string; nota?: string; tom: "entrada" | "uso" | "perda" | "receita" | "naoReceita"; lg: string; ml?: string };

const TOM: Record<Celula["tom"], string> = {
  entrada: "bg-superficie border-l-4 border-carvao",
  uso: "bg-obee-fundo border-l-4 border-obee",
  perda: "bg-marfim border-l-4 border-bronze",
  receita: "bg-superficie border-l-4 border-obee",
  naoReceita: "bg-superficie border-l-4 border-bronze",
};

/** Ordem do DOM = ordem de leitura no celular (recuada por nível); no desktop, a grade monta a tabela da IWA. */
const BALANCO: Celula[] = [
  { texto: "Volume que entra no sistema", nota: "produzido mais importado", tom: "entrada", lg: "lg:col-start-1 lg:row-start-1 lg:row-span-4" },
  { texto: "Consumo autorizado", tom: "uso", lg: "lg:col-start-2 lg:row-start-1 lg:row-span-2", ml: "ml-4" },
  { texto: "Faturado", tom: "uso", lg: "lg:col-start-3 lg:row-start-1", ml: "ml-8" },
  { texto: "Medido ou estimado, vira conta de água", tom: "uso", lg: "lg:col-start-4 lg:row-start-1", ml: "ml-12" },
  { texto: "Não faturado", tom: "uso", lg: "lg:col-start-3 lg:row-start-2", ml: "ml-8" },
  { texto: "Uso pelo próprio prestador, combate a incêndio e outros usos autorizados sem cobrança", tom: "uso", lg: "lg:col-start-4 lg:row-start-2", ml: "ml-12" },
  { texto: "Perdas de água", tom: "perda", lg: "lg:col-start-2 lg:row-start-3 lg:row-span-2", ml: "ml-4" },
  { texto: "Perdas aparentes", tom: "perda", lg: "lg:col-start-3 lg:row-start-3", ml: "ml-8" },
  { texto: "Ligações clandestinas e erros de medição: a água chega ao usuário, mas não é cobrada", tom: "perda", lg: "lg:col-start-4 lg:row-start-3", ml: "ml-12" },
  { texto: "Perdas reais", tom: "perda", lg: "lg:col-start-3 lg:row-start-4", ml: "ml-8" },
  { texto: "Vazamentos em adutoras, redes e ramais e extravasamento de reservatórios: a água se perde no caminho", tom: "perda", lg: "lg:col-start-4 lg:row-start-4", ml: "ml-12" },
  { texto: "Água faturada", nota: "gera receita", tom: "receita", lg: "lg:col-start-5 lg:row-start-1" },
  { texto: "Água não faturada", nota: "não gera receita: soma do consumo não faturado e das perdas", tom: "naoReceita", lg: "lg:col-start-5 lg:row-start-2 lg:row-span-3" },
];

/** Balanço hídrico padrão da IWA, com as perdas totais do Brasil declaradas ao SINISA. */
export function BalancoHidrico({ perdasBrasil }: { perdasBrasil: number | null }) {
  return (
    <FiguraDidatica
      id="balanco-hidrico"
      tipo="ilustracao-dado"
      titulo="Para onde vai a água que entra no sistema"
      legenda={
        <>
          Balanço hídrico padrão da International Water Association (Alegre e outros, Performance Indicators for Water Supply Services, IWA
          Publishing, 2000), simplificado. As caixas mostram categorias, não proporções. O SINISA não separa perdas aparentes de reais: o indicador
          IAG2013 mede as perdas totais na distribuição, pela fórmula (volume produzido + importado − exportado − consumido − autorizado não
          faturado) ÷ (produzido + importado). No Brasil, em 2024, o consolidado oficial é{" "}
          <span className="font-medium text-carvao">{perdasBrasil == null ? "sem dado" : `${numero(perdasBrasil, 1)}%`}</span> (SINISA 2025, ano de
          referência 2024). Perda aparente não é água desperdiçada no caminho, e perda real não aparece na conta de ninguém.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-[2px] text-sm lg:grid-cols-[1.1fr_1fr_0.9fr_1.8fr_1fr] lg:grid-rows-4">
        {BALANCO.map((c) => (
          <div key={c.texto} className={`${TOM[c.tom]} ${c.ml ?? ""} ${c.lg} p-3 lg:ml-0`}>
            <p className={c.tom === "entrada" || c.texto.length < 30 ? "font-medium text-carvao" : "text-carvao"}>{c.texto}</p>
            {c.nota && <p className="text-xs text-carvao-muted">{c.nota}</p>}
          </div>
        ))}
      </div>
    </FiguraDidatica>
  );
}

// ---------------------------------------------------------------------------
// Tarifas, tributos e transferências (OCDE)
// ---------------------------------------------------------------------------

/**
 * De onde vem, no fim, o dinheiro do saneamento: tarifas, tributos e transferências (os "3Ts" da OCDE), com o
 * financiamento como adiantamento a ser pago por eles. Abaixo, as três origens que o SINISA pede, com os valores
 * declarados de 2024 e a correspondência possível.
 */
export function TresTs({ proprios, onerosos, naoOnerosos }: { proprios: number; onerosos: number; naoOnerosos: number }) {
  const total = proprios + onerosos + naoOnerosos;
  const fontes = [
    { nome: "Tarifas", quem: "Quem usa o serviço paga a conta." },
    { nome: "Tributos", quem: "O contribuinte paga, pelo orçamento público." },
    { nome: "Transferências", quem: "Outros governos, organismos e doadores." },
  ];
  const sinisa = [
    { nome: "Recursos próprios", v: proprios, liga: "Em geral, receita de tarifas. O SINISA não separa aporte do controlador." },
    { nome: "Onerosos", v: onerosos, liga: "Empréstimos e financiamentos: adiantam o dinheiro, pago depois com tarifas ou orçamento." },
    { nome: "Não onerosos", v: naoOnerosos, liga: "Transferências e doações: tributos de outro ente ou transferências externas, sem separação." },
  ];
  return (
    <FiguraDidatica
      id="tres-ts"
      tipo="ilustracao-dado"
      titulo="Quem paga o investimento, no fim"
      legenda={
        <>
          A divisão em tarifas, tributos e transferências é a da OCDE (Managing Water for All, 2009), que não recomenda uma proporção entre as três:
          pede que cada uma seja medida. Os valores são o investimento de 2024 declarado por prestadores e Estados ao SINISA, em reais correntes; a
          ligação entre as origens do SINISA e as três fontes é aproximação do Observatório, porque o SINISA não as separa assim.
        </>
      }
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fontes.map((f) => (
          <li key={f.nome} className="border-t-2 border-carvao pt-3">
            <p className="font-serif text-lg text-carvao">{f.nome}</p>
            <p className="mt-1 text-sm text-carvao-muted">{f.quem}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 border border-dashed border-mineral bg-superficie p-3 text-sm text-carvao">
        <span className="font-medium">Financiamento</span> (empréstimos, debêntures) não é uma quarta fonte: adianta o dinheiro da obra e é pago
        depois, com tarifas, tributos ou transferências.
      </div>
      <p className="rotulo mt-6 text-mineral">No SINISA 2024, de {reaisCompacto(total)} com origem declarada</p>
      <ul className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-3">
        {sinisa.map((s) => (
          <li key={s.nome} className="border-t border-linha py-3">
            <p className="text-sm text-carvao-muted">{s.nome}</p>
            <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">{reaisCompacto(s.v)}</p>
            <p className="text-xs tabular-nums text-carvao-muted">{numero(razaoPct(s.v, total), 1)}% do total</p>
            <div className="mt-2 h-2 w-full bg-linha/50" aria-hidden="true">
              <div className="h-full bg-obee" style={{ width: `${Math.min(100, razaoPct(s.v, total) ?? 0)}%` }} />
            </div>
            <p className="mt-2 text-sm leading-snug text-carvao">{s.liga}</p>
          </li>
        ))}
      </ul>
    </FiguraDidatica>
  );
}

