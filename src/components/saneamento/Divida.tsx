"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { numero } from "@/lib/saneamento/formato";

/**
 * Peças interativas do capítulo 7.1 (dívida e alavancagem). O laboratório é modelo didático: parte dos valores
 * publicados de uma companhia, mas o limite e o investimento são hipóteses do leitor. A série lê só a gold.
 * Controles nativos com rótulo visível, valor escrito ao lado e alvo de 44 px; nenhuma informação depende só de cor.
 */

const bi = (v: number) => `R$ ${numero(v, 1).replace(/^-/, "−")} bi`;
const x = (v: number | null) => (v == null || !Number.isFinite(v) ? "sem leitura" : `${numero(v, 1).replace(/^-/, "−")} vezes`);

export type Preset = { id: string; nome: string; periodo: string; ebitda: number; dl: number };

function Controle({
  rotulo,
  valor,
  texto,
  min,
  max,
  passo,
  onMudar,
  ajuda,
}: {
  rotulo: string;
  valor: number;
  texto: string;
  min: number;
  max: number;
  passo: number;
  onMudar: (v: number) => void;
  ajuda?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm text-carvao">
        <span>{rotulo}</span>
        <span className="shrink-0 font-medium tabular-nums">{texto}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={texto}
        onChange={(e) => onMudar(Number(e.target.value))}
        className="block min-h-[44px] w-full accent-obee"
      />
      {ajuda && <p className="text-xs leading-relaxed text-carvao-muted">{ajuda}</p>}
    </div>
  );
}

/** Investimento, limite e parte financiada com dívida de partida: hipóteses do modelo, não dados de companhia. */
const HIPOTESES = { limite: 3.5, investimento: 5, parteDivida: 70 };

/** Conta do laboratório, em R$ bilhões: espaço até o teto, dívida nova e quanto dela teria de vir de fora da dívida. */
export function calcularAlavancagem({ ebitda, dl, limite, investimento, parte }: { ebitda: number; dl: number; limite: number; investimento: number; parte: number }) {
  const hoje = ebitda > 0 ? dl / ebitda : null;
  const teto = limite * ebitda;
  const espaco = teto - dl;
  const nova = (investimento * parte) / 100;
  const depois = ebitda > 0 ? (dl + nova) / ebitda : null;
  const proprio = Math.max(0, nova - Math.max(0, espaco));
  // já acima do teto antes do contrato: nem o contrato inteiro fora da dívida devolve a companhia ao limite
  const excesso = Math.max(0, -espaco);
  return { hoje, teto, espaco, nova, depois, proprio, excesso };
}

export function fraseAlavancagem(r: ReturnType<typeof calcularAlavancagem>, limite: number): string {
  if (r.nova === 0) return "Sem dívida nova, a alavancagem não muda.";
  if (r.depois != null && r.depois <= limite + 1e-9) return `A dívida nova cabe no limite escolhido: a alavancagem iria a ${x(r.depois)}.`;
  if (r.excesso > 0)
    return `A dívida de hoje já passa do limite escolhido em ${bi(r.excesso)}. Mesmo com os ${bi(r.nova)} do contrato vindos todos de capital próprio, de sócios ou de outra estrutura de financiamento, a alavancagem ficaria em ${x(r.hoje)}: voltar ao limite pediria reduzir a dívida atual nesse valor ou aumentar o EBITDA.`;
  return `Para ficar no limite escolhido, ${bi(r.proprio)} dos ${bi(r.nova)} teriam de vir de capital próprio, de sócios ou de outra estrutura de financiamento, e não de dívida da companhia.`;
}

export function LabAlavancagem({ presets }: { presets: Preset[] }) {
  const inicial = presets[0];
  const [origem, setOrigem] = useState(inicial?.id ?? "livre");
  const [ebitda, setEbitda] = useState(inicial ? Math.round(inicial.ebitda * 10) / 10 : 2);
  const [dl, setDl] = useState(inicial ? Math.round(inicial.dl * 10) / 10 : 5);
  const [limite, setLimite] = useState(HIPOTESES.limite);
  const [investimento, setInvestimento] = useState(HIPOTESES.investimento);
  const [parte, setParte] = useState(HIPOTESES.parteDivida);
  const idOrigem = useId();

  const escolher = (id: string) => {
    setOrigem(id);
    const p = presets.find((q) => q.id === id);
    if (p) {
      setEbitda(Math.round(p.ebitda * 10) / 10);
      setDl(Math.round(p.dl * 10) / 10);
    }
  };
  const p = presets.find((q) => q.id === origem);

  const r = useMemo(() => calcularAlavancagem({ ebitda, dl, limite, investimento, parte }), [ebitda, dl, limite, investimento, parte]);

  // escala fixa da barra: o maior entre o teto e a dívida depois do contrato, com folga
  const escala = Math.max(r.teto, dl + r.nova, 1) * 1.08;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / escala) * 100))}%`;

  return (
    <section aria-labelledby="lab-alavancagem-t" className="space-y-6 border border-linha bg-superficie p-4 sm:p-6" data-laboratorio="alavancagem">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="lab-alavancagem-t" className="font-serif text-xl text-carvao">
          Cabe mais um contrato?
        </h3>
        <span className="rotulo border border-dashed border-mineral px-2 py-0.5 text-xs text-carvao-muted">Modelo didático</span>
      </div>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Parta da dívida e do EBITDA publicados por uma companhia, escolha um limite de alavancagem e um investimento novo e veja quanto dele
        caberia em dívida sem passar do limite.
      </p>

      <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-1">
            <label htmlFor={idOrigem} className="text-sm text-carvao">
              Ponto de partida
            </label>
            <select
              id={idOrigem}
              value={origem}
              onChange={(e) => escolher(e.target.value)}
              className="block min-h-[44px] w-full border border-linha bg-papel px-3 text-sm text-carvao"
            >
              {presets.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}, {q.periodo}
                </option>
              ))}
              <option value="livre">Valores escolhidos por mim</option>
            </select>
            <p className="text-xs leading-relaxed text-carvao-muted">
              {p
                ? `Dívida líquida e EBITDA dos 12 meses publicados pela companhia (${p.periodo}). Mexer nos dois controles abaixo troca para valores livres.`
                : "Valores livres: não representam nenhuma companhia."}
            </p>
          </div>
          <Controle
            rotulo="EBITDA dos últimos 12 meses"
            valor={ebitda}
            texto={bi(ebitda)}
            min={0.1}
            max={Math.max(20, Math.ceil((p?.ebitda ?? 0) + 1))}
            passo={0.1}
            onMudar={(v) => {
              setEbitda(v);
              setOrigem("livre");
            }}
          />
          <Controle
            rotulo="Dívida líquida hoje"
            valor={dl}
            texto={bi(dl)}
            min={-5}
            max={Math.max(60, Math.ceil((p?.dl ?? 0) + 1))}
            passo={0.1}
            onMudar={(v) => {
              setDl(v);
              setOrigem("livre");
            }}
            ajuda="Negativa quando o caixa é maior que a dívida."
          />
          <Controle
            rotulo="Limite de alavancagem (hipótese)"
            valor={limite}
            texto={`${numero(limite, 2)} vezes`}
            min={1}
            max={7}
            passo={0.25}
            onMudar={setLimite}
            ajuda="Cada contrato de financiamento ou escritura de debênture fixa o próprio limite e a própria definição de dívida e de EBITDA; estão nas notas explicativas. O valor inicial é só um ponto de partida."
          />
          <Controle
            rotulo="Investimento do contrato novo (hipótese)"
            valor={investimento}
            texto={bi(investimento)}
            min={0}
            max={40}
            passo={0.5}
            onMudar={setInvestimento}
            ajuda="Outorga e obras dos primeiros anos de uma concessão hipotética."
          />
          <Controle
            rotulo="Parte paga com dívida nova (hipótese)"
            valor={parte}
            texto={`${numero(parte, 0)}%`}
            min={0}
            max={100}
            passo={5}
            onMudar={setParte}
          />
        </div>

        {/* no celular o resultado vem antes dos controles, para ser visto enquanto se mexe neles */}
        <div className="order-first space-y-5 lg:order-none" aria-live="polite">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-carvao pt-4">
            <div>
              <dt className="text-xs text-carvao-muted">Dívida líquida sobre EBITDA hoje</dt>
              <dd className="mt-1 font-serif text-[1.6rem] leading-none tabular-nums text-carvao">{x(r.hoje)}</dd>
            </div>
            <div>
              <dt className="text-xs text-carvao-muted">Depois do contrato, sem EBITDA novo</dt>
              <dd className="mt-1 font-serif text-[1.6rem] leading-none tabular-nums text-carvao">{x(r.depois)}</dd>
            </div>
            <div>
              <dt className="text-xs text-carvao-muted">{r.espaco >= 0 ? "Espaço para dívida nova até o limite" : "Acima do limite já hoje"}</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums text-carvao">{bi(Math.abs(r.espaco))}</dd>
            </div>
            <div>
              <dt className="text-xs text-carvao-muted">Dívida nova pedida pelo contrato</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums text-carvao">{bi(r.nova)}</dd>
            </div>
          </dl>

          <figure>
            <div className="relative h-10 w-full bg-papel" role="img" aria-label={`Dívida líquida de ${bi(dl)}, dívida nova de ${bi(r.nova)} e limite de ${bi(r.teto)}`}>
              {dl > 0 && <div className="absolute inset-y-0 left-0 bg-carvao" style={{ width: pct(dl) }} />}
              <div
                className="absolute inset-y-0 bg-obee transition-[left,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                style={{ left: pct(Math.max(0, dl)), width: pct(r.nova) }}
              />
              <div className="absolute -bottom-1 -top-1 w-0.5 bg-aviso" style={{ left: pct(r.teto) }} />
            </div>
            <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-4 bg-carvao" /> Dívida líquida hoje
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-4 bg-obee" /> Dívida nova do contrato
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-aviso" /> Limite: {numero(limite, 2)} × EBITDA = {bi(r.teto)}
              </span>
            </figcaption>
          </figure>

          <p className="text-sm leading-relaxed text-carvao">{fraseAlavancagem(r, limite)}</p>
          <p className="text-xs leading-relaxed text-carvao-muted">
            O modelo deixa de fora: o EBITDA que o contrato novo vai gerar (chega aos poucos, depois das obras), prazo e custo da dívida, garantias,
            dívida tomada pela própria concessionária sem recurso à controladora e as definições de cada contrato, que muitas vezes incluem
            arrendamentos ou ajustam o EBITDA.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ série por companhia */

export type PontoSerie = {
  x: string;
  dl_ebitda: number | null;
  dl_pl: number | null;
  parcela_cp: number | null;
  divida_bruta: number | null;
  caixa: number | null;
  divida_liquida: number | null;
};

export type SerieCompanhia = {
  id: string;
  nome: string;
  papel: string;
  anual: PontoSerie[];
  trimestral: PontoSerie[];
  notas: string[];
};

const MEDIDAS = [
  { id: "dl_ebitda", rotulo: "Dívida líquida sobre EBITDA", unidade: "vezes", casas: 1 },
  { id: "valores", rotulo: "Dívida, caixa e dívida líquida", unidade: "R$ bi", casas: 1 },
  { id: "parcela_cp", rotulo: "Parte que vence em até 12 meses", unidade: "%", casas: 1 },
  { id: "dl_pl", rotulo: "Dívida líquida sobre patrimônio líquido", unidade: "vezes", casas: 2 },
] as const;
type IdMedida = (typeof MEDIDAS)[number]["id"];

export function SerieDivida({ companhias }: { companhias: SerieCompanhia[] }) {
  const [id, setId] = useState(companhias[0]?.id ?? "");
  const [medida, setMedida] = useState<IdMedida>("dl_ebitda");
  const [frequencia, setFrequencia] = useState<"anual" | "trimestral">("anual");
  const idSel = useId();
  const c = companhias.find((q) => q.id === id) ?? companhias[0];
  if (!c) return null;
  const m = MEDIDAS.find((q) => q.id === medida)!;
  const dados = frequencia === "anual" ? c.anual : c.trimestral;
  const series =
    medida === "valores"
      ? [
          { id: "divida_bruta", rotulo: "Dívida bruta", cor: "var(--cor-carvao)" },
          { id: "caixa", rotulo: "Caixa e aplicações", cor: "var(--escala-seq-3)", tracejada: true },
          { id: "divida_liquida", rotulo: "Dívida líquida", cor: "var(--cor-obee)" },
        ]
      : [{ id: medida, rotulo: m.rotulo, cor: "var(--cor-obee)" }];

  return (
    <div className="space-y-5" data-serie-divida="">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="space-y-1">
          <label htmlFor={idSel} className="text-sm text-carvao">
            Companhia
          </label>
          <select
            id={idSel}
            value={c.id}
            onChange={(e) => setId(e.target.value)}
            className="block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao"
          >
            {companhias.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome} ({q.papel.toLowerCase()})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Escolha
            rotulo="Medida"
            nome="medida-divida"
            valor={medida}
            onMudar={setMedida}
            opcoes={MEDIDAS.map((q) => [q.id, q.rotulo] as const)}
          />
          <Escolha
            rotulo="Frequência"
            nome="frequencia-divida"
            valor={frequencia}
            onMudar={setFrequencia}
            opcoes={[
              ["anual", "Anual (DFP)"],
              ["trimestral", "Trimestral (ITR)"],
            ] as const}
          />
        </div>
      </div>
      <GraficoLinhas
        key={`${c.id}-${medida}-${frequencia}`}
        titulo={`${c.nome}: ${m.rotulo.charAt(0).toLowerCase()}${m.rotulo.slice(1)} (${frequencia === "anual" ? "fim de cada ano" : "fim de cada trimestre"})`}
        nomesNoTitulo={[c.nome]}
        dados={dados}
        chaveX="x"
        formatoX={frequencia === "anual" ? "texto" : "data"}
        series={series}
        unidade={m.unidade}
        casas={m.casas}
        zeroNoEixo
      />
      {c.notas.length > 0 && (
        <ul className="max-w-prose2 space-y-1 text-xs leading-relaxed text-carvao-muted">
          {c.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Escolha<T extends string>({
  rotulo,
  nome,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  nome: string;
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  onMudar: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm text-carvao">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([id, rot]) => (
          <label
            key={id}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm transition-colors duration-150 ${
              valor === id ? "border-obee bg-obee-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted [@media(hover:hover)]:hover:text-carvao"
            }`}
          >
            <input type="radio" name={nome} value={id} checked={valor === id} onChange={() => onMudar(id)} className="accent-obee" />
            {rot}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
