import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Como o sistema funciona, em duas camadas que não se misturam:
 *  1. fluxo físico da água e do esgoto (setas cheias), do manancial ao corpo receptor, desenhado
 *     como ilustração conceitual (sem escala) e descrito, etapa por etapa, nas listas ordenadas;
 *  2. relações institucionais e financeiras (setas tracejadas), entre titular,
 *     prestador, regulador, ANA, usuário e financiadores.
 * Cada etapa indica o capítulo que a mede. A ilustração tem duas composições: horizontal em
 * tela larga e vertical no celular, para o texto não encolher até ficar ilegível.
 */

type Icone = "rio" | "eta" | "reservatorio" | "casa" | "coleta" | "elevatoria" | "ete";
type Etapa = { nome: string; curto: string; mede: string; capitulos: number[]; icone: Icone };

const AGUA: Etapa[] = [
  { nome: "Manancial", curto: "Manancial", mede: "Rio, represa ou aquífero; secas e interrupções por baixa disponibilidade", capitulos: [14], icone: "rio" },
  { nome: "Captação e tratamento", curto: "Captação e tratamento", mede: "Estações de tratamento de água e volumes produzidos", capitulos: [3], icone: "eta" },
  { nome: "Reservação e distribuição", curto: "Reservação e distribuição", mede: "Rede, perdas na distribuição, paralisações e racionamento", capitulos: [3, 8], icone: "reservatorio" },
  { nome: "Domicílio", curto: "Domicílio", mede: "Ligação, uso como fonte principal, consumo e conta", capitulos: [1, 5, 6], icone: "casa" },
];
const ESGOTO: Etapa[] = [
  { nome: "Coleta", curto: "Coleta", mede: "Rede coletora e ligações possíveis ainda não feitas", capitulos: [1, 4], icone: "coleta" },
  { nome: "Transporte", curto: "Transporte e elevatória", mede: "Coletores, interceptores e estações elevatórias", capitulos: [4], icone: "elevatoria" },
  { nome: "Tratamento", curto: "Tratamento (ETE)", mede: "Estações de tratamento de esgoto, capacidade e volume tratado", capitulos: [4], icone: "ete" },
  { nome: "Destino", curto: "Corpo receptor", mede: "Corpo receptor e qualidade da água após o lançamento", capitulos: [13], icone: "rio" },
];

const AZ = "var(--cor-obee)";
const AZ_FUNDO = "var(--cor-obee-fundo)";
const BR = "var(--cor-bronze)";
const BR_FUNDO = "var(--cor-marfim)";
const TINTA = "var(--cor-carvao)";
const SUAVE = "var(--cor-carvao-muted)";

/** Formas de cada etapa, centradas na origem, dentro de cerca de 72 × 52. */
const FORMAS: Record<Icone, ReactNode> = {
  rio: (
    <>
      <rect x={-32} y={-24} width={64} height={48} rx={8} fill={AZ_FUNDO} />
      {[-10, 2, 14].map((dy) => (
        <path key={dy} d={`M-24 ${dy} q6 -5 12 0 t12 0 t12 0 t12 0`} fill="none" stroke={AZ} strokeWidth={1.5} />
      ))}
    </>
  ),
  eta: (
    <>
      <rect x={-36} y={-22} width={72} height={44} rx={3} fill="var(--cor-superficie)" stroke={AZ} strokeWidth={2} />
      <line x1={-36} y1={-12} x2={36} y2={-12} stroke={AZ} strokeWidth={1} />
      <circle cx={-14} cy={4} r={9} fill={AZ_FUNDO} stroke={AZ} strokeWidth={1.5} />
      <circle cx={14} cy={4} r={9} fill={AZ_FUNDO} stroke={AZ} strokeWidth={1.5} />
    </>
  ),
  reservatorio: (
    <>
      <path d="M-18 -16 v24 h36 v-24" fill="var(--cor-superficie)" stroke={AZ} strokeWidth={2} />
      <ellipse cx={0} cy={-16} rx={18} ry={6} fill={AZ_FUNDO} stroke={AZ} strokeWidth={2} />
      <line x1={-13} y1={8} x2={-18} y2={26} stroke={AZ} strokeWidth={2} />
      <line x1={13} y1={8} x2={18} y2={26} stroke={AZ} strokeWidth={2} />
    </>
  ),
  casa: (
    <>
      <polygon points="-28,26 -28,-4 0,-26 28,-4 28,26" fill="var(--cor-superficie)" stroke={TINTA} strokeWidth={2} strokeLinejoin="round" />
      <rect x={-6} y={8} width={12} height={18} fill={TINTA} />
    </>
  ),
  coleta: (
    <>
      <line x1={-34} y1={12} x2={34} y2={12} stroke={BR} strokeWidth={4} />
      <circle cx={0} cy={-6} r={11} fill="var(--cor-superficie)" stroke={BR} strokeWidth={2} />
      <path d="M-7 -6 h14 M0 -13 v14" stroke={BR} strokeWidth={1.5} />
    </>
  ),
  elevatoria: (
    <>
      <rect x={-26} y={-22} width={52} height={44} rx={3} fill="var(--cor-superficie)" stroke={BR} strokeWidth={2} />
      <circle cx={0} cy={0} r={10} fill={BR_FUNDO} stroke={BR} strokeWidth={1.5} />
      <path d="M-4 -6 L7 0 L-4 6 Z" fill={BR} />
    </>
  ),
  ete: (
    <>
      {[-17, 17].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={0} r={15} fill={BR_FUNDO} stroke={BR} strokeWidth={2} />
          <path d={`M${cx - 10} 0 h20 M${cx} -10 v20`} stroke={BR} strokeWidth={1} />
          <circle cx={cx} cy={0} r={3} fill={BR} />
        </g>
      ))}
    </>
  ),
};

function Forma({ icone, x, y, s = 1 }: { icone: Icone; x: number; y: number; s?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{FORMAS[icone]}</g>;
}

const capTexto = (ns: number[]) => `Capítulo${ns.length > 1 ? "s" : ""} ${ns.length > 1 ? `${ns.slice(0, -1).join(", ")} e ${ns[ns.length - 1]}` : ns[0]}`;

function Seta({ x, y, dir, cor }: { x: number; y: number; dir: "dir" | "esq" | "baixo"; cor: string }) {
  const d =
    dir === "dir" ? `M${x - 6} ${y - 5} L${x + 4} ${y} L${x - 6} ${y + 5} Z` : dir === "esq" ? `M${x + 6} ${y - 5} L${x - 4} ${y} L${x + 6} ${y + 5} Z` : `M${x - 5} ${y - 6} L${x} ${y + 4} L${x + 5} ${y - 6} Z`;
  return <path d={d} fill={cor} />;
}

const DESCRICAO =
  "Ilustração conceitual, sem escala: a água sai do manancial, passa pela captação e pelo tratamento, é reservada e distribuída até o domicílio; o esgoto do domicílio é coletado, transportado, tratado na estação de tratamento de esgoto e lançado de volta no rio, a jusante.";

/** Composição horizontal (tela larga): água na faixa de cima, esgoto na de baixo, o rio fechando o ciclo à esquerda. */
function CicloLargo() {
  const topo = [AGUA[1], AGUA[2], AGUA[3]];
  const xTopo = [300, 560, 860];
  const base = [ESGOTO[0], ESGOTO[1], ESGOTO[2]];
  const xBase = [760, 560, 300];
  const yA = 90;
  const yE = 250;
  return (
    <svg viewBox="0 0 1120 330" className="hidden w-full lg:block" role="img" aria-label={DESCRICAO}>
      <rect x={20} y={58} width={70} height={214} rx={10} fill={AZ_FUNDO} />
      {[78, 100, 122, 210, 232, 254].map((y) => (
        <path key={y} d={`M31 ${y} q6 -5 12 0 t12 0 t12 0 t12 0`} fill="none" stroke={AZ} strokeWidth={1.5} />
      ))}
      <line x1={55} y1={140} x2={55} y2={186} stroke={AZ} strokeWidth={1.5} />
      <Seta x={55} y={188} dir="baixo" cor={AZ} />
      <text x={64} y={168} fontSize={12} fill={SUAVE}>
        rio abaixo
      </text>

      <line x1={90} y1={yA} x2={834} y2={yA} stroke={AZ} strokeWidth={4} />
      {[180, 440, 720].map((x) => (
        <Seta key={x} x={x} y={yA} dir="dir" cor={AZ} />
      ))}
      <text x={177} y={yA - 10} textAnchor="middle" fontSize={12} fill={AZ}>
        água bruta
      </text>
      <text x={440} y={yA - 10} textAnchor="middle" fontSize={12} fill={AZ}>
        água tratada
      </text>

      <line x1={880} y1={yA + 16} x2={880} y2={yE} stroke={BR} strokeWidth={4} />
      <Seta x={880} y={180} dir="baixo" cor={BR} />
      <line x1={880} y1={yE} x2={283} y2={yE} stroke={BR} strokeWidth={4} />
      <line x1={283} y1={yE} x2={90} y2={yE} stroke={BR} strokeWidth={4} strokeDasharray="8 6" />
      {[820, 660, 430, 180].map((x) => (
        <Seta key={x} x={x} y={yE} dir="esq" cor={BR} />
      ))}
      <text x={660} y={yE - 12} textAnchor="middle" fontSize={12} fill={BR}>
        esgoto
      </text>
      <text x={180} y={yE - 12} textAnchor="middle" fontSize={12} fill={BR}>
        efluente tratado
      </text>

      {topo.map((e, i) => (
        <Forma key={e.nome} icone={e.icone} x={xTopo[i]} y={e.icone === "casa" ? yA - 6 : yA} />
      ))}
      {base.map((e, i) => (
        // a forma da coleta tem o próprio trecho de rede 12 abaixo do centro: sobe 12 para coincidir com o cano principal
        <Forma key={e.nome} icone={e.icone} x={xBase[i]} y={e.icone === "coleta" ? yE - 12 : yE} />
      ))}

      {[{ e: AGUA[0], n: 1, x: 20, y: 24, ancora: "start" as const }, ...topo.map((e, i) => ({ e, n: i + 2, x: xTopo[i], y: 24, ancora: "middle" as const }))].map(({ e, n, x, y, ancora }) => (
        <g key={n}>
          <text x={x} y={y} textAnchor={ancora} fontSize={15} fill={TINTA}>
            <tspan fontWeight={600} fill={AZ}>
              {n}
            </tspan>{" "}
            {e.curto}
          </text>
          <text x={x} y={y + 17} textAnchor={ancora} fontSize={12} fill={SUAVE}>
            {capTexto(e.capitulos)}
          </text>
        </g>
      ))}
      {[...base.map((e, i) => ({ e, n: i + 5, x: xBase[i], ancora: "middle" as const })), { e: ESGOTO[3], n: 8, x: 20, ancora: "start" as const }].map(({ e, n, x, ancora }) => (
        <g key={n}>
          <text x={x} y={300} textAnchor={ancora} fontSize={15} fill={TINTA}>
            <tspan fontWeight={600} fill={BR}>
              {n}
            </tspan>{" "}
            {e.curto}
          </text>
          <text x={x} y={317} textAnchor={ancora} fontSize={12} fill={SUAVE}>
            {capTexto(e.capitulos)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Composição vertical (celular): as oito etapas em sequência, com o cano mudando de água para esgoto no domicílio. */
function CicloEstreito() {
  const etapas = [...AGUA, ...ESGOTO];
  const y = (i: number) => 46 + i * 88;
  return (
    <svg viewBox={`0 0 340 ${y(7) + 46}`} className="w-full max-w-sm lg:hidden" role="img" aria-label={DESCRICAO}>
      <line x1={50} y1={y(0)} x2={50} y2={y(3)} stroke={AZ} strokeWidth={4} />
      <line x1={50} y1={y(3)} x2={50} y2={y(6)} stroke={BR} strokeWidth={4} />
      <line x1={50} y1={y(6)} x2={50} y2={y(7)} stroke={BR} strokeWidth={4} strokeDasharray="8 6" />
      {etapas.slice(0, -1).map((e, i) => (
        <Seta key={e.nome} x={50} y={y(i) + 46} dir="baixo" cor={i < 3 ? AZ : BR} />
      ))}
      {etapas.map((e, i) => (
        <g key={`${e.nome}-${i}`}>
          <Forma icone={e.icone} x={50} y={y(i)} s={0.85} />
          <text x={100} y={y(i) - 2} fontSize={16} fill={TINTA}>
            <tspan fontWeight={600} fill={i < 4 ? AZ : BR}>
              {i + 1}
            </tspan>{" "}
            {e.curto}
          </text>
          <text x={100} y={y(i) + 17} fontSize={13} fill={SUAVE}>
            {capTexto(e.capitulos)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Ilustração do ciclo físico, com legenda que a marca como conceitual. */
export function IlustracaoCiclo() {
  return (
    <figure className="border border-dashed border-mineral bg-papel p-4 md:p-6">
      <CicloLargo />
      <CicloEstreito />
      <figcaption className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Ilustração conceitual, sem escala e sem dado. Em azul, o caminho da água; em bronze, o do esgoto, com o trecho tracejado para o efluente
        tratado que volta ao rio. Os números correspondem às etapas descritas abaixo, com o capítulo que mede cada uma.
      </figcaption>
    </figure>
  );
}

const RELACOES: { de: string; para: string; o_que: string; capitulos: number[] }[] = [
  { de: "Titular (município ou estrutura regional)", para: "Prestador", o_que: "presta diretamente ou delega por contrato, com metas", capitulos: [7, 12] },
  { de: "Entidade reguladora", para: "Prestador", o_que: "autoriza a tarifa, verifica metas e fiscaliza", capitulos: [5, 12] },
  { de: "ANA", para: "Entidade reguladora", o_que: "edita normas de referência; não fixa tarifas locais", capitulos: [5, 11] },
  { de: "Usuário", para: "Prestador", o_que: "paga a conta segundo a estrutura tarifária autorizada", capitulos: [5, 6] },
  { de: "Orçamento e financiadores", para: "Prestador", o_que: "transferem ou emprestam recursos para investimento", capitulos: [9, 10] },
  { de: "Plano de saneamento", para: "Contrato e regulação", o_que: "fixa diagnóstico, metas e prioridades do território", capitulos: [11] },
];

function Capitulos({ ns }: { ns: number[] }) {
  return (
    <span className="mt-2 block text-xs text-carvao-muted">
      Capítulo{ns.length > 1 ? "s" : ""}{" "}
      {ns.map((n, i) => (
        <span key={n}>
          {i > 0 && (i === ns.length - 1 ? " e " : ", ")}
          <span className="tabular-nums text-obee-dark">{n}</span>
        </span>
      ))}
    </span>
  );
}

function Fluxo({ titulo, etapas, inicio }: { titulo: string; etapas: Etapa[]; inicio: number }) {
  return (
    <div>
      <p className="rotulo text-mineral">{titulo}</p>
      <ol className="mt-3 grid grid-cols-1 gap-0 lg:grid-cols-4" start={inicio}>
        {etapas.map((e, i) => (
          <li key={e.nome} className="relative flex lg:block">
            <div className="flex-1 border-l-2 border-obee py-3 pl-4 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pr-6 lg:pt-4">
              <span className="font-label text-xs tabular-nums text-mineral">{String(inicio + i).padStart(2, "0")}</span>
              <span className="mt-1 block font-serif text-lg leading-snug text-carvao">{e.nome}</span>
              <span className="mt-1 block text-sm leading-snug text-carvao-muted">{e.mede}</span>
              <Capitulos ns={e.capitulos} />
            </div>
            {i < etapas.length - 1 && (
              <span aria-hidden="true" className="absolute -bottom-2 left-[-7px] text-obee lg:-top-[0.85rem] lg:bottom-auto lg:left-auto lg:right-2">
                <span className="lg:hidden">▾</span>
                <span className="hidden lg:inline">▸</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DiagramaSistema() {
  return (
    <div>
      <IlustracaoCiclo />
      <div className="mt-8 grid gap-8">
        <Fluxo titulo="Fluxo físico da água · seta cheia" etapas={AGUA} inicio={1} />
        <Fluxo titulo="Fluxo físico do esgoto · seta cheia" etapas={ESGOTO} inicio={5} />
      </div>
      <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Fora da rede, há soluções individuais: poço, cisterna, fossa séptica. Elas contam como atendimento adequado só quando a entidade
        reguladora as prevê (NR ANA 8/2024) e aparecem separadas no capítulo 1.
      </p>
      <div className="mt-10">
        <p className="rotulo text-mineral">Relações institucionais e financeiras · seta tracejada</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {RELACOES.map((r) => (
            <li key={r.de + r.para} className="border-t border-dashed border-mineral py-3">
              <span className="block text-sm text-carvao">
                <span className="font-medium">{r.de}</span> <span aria-hidden="true" className="text-mineral">⇢</span>
                <span className="sr-only"> para </span> <span className="font-medium">{r.para}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug text-carvao-muted">{r.o_que}</span>
              <Capitulos ns={r.capitulos} />
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-sm text-carvao-muted">
        Saneamento básico também inclui manejo de resíduos sólidos e drenagem urbana. Este observatório trata água e esgoto; os dois outros
        componentes têm indicadores regionais do SINISA no{" "}
        <Link href="/eficiencia-estatal/saneamento/residuos" className="text-obee-dark underline underline-offset-2">
          Observatório de Eficiência Estatal
        </Link>
        .
      </p>
    </div>
  );
}
