import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import type { ReactNode } from "react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function n(v: number, casas = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function dataBr(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export function mesAno(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

/** Figura com pergunta, subtítulo de unidade e universo, fonte e tabela equivalente recolhida. */
export function Figura({ id, titulo, subtitulo, children, tabela, fonte }: Readonly<{ id: string; titulo: string; subtitulo: string; children: ReactNode; tabela: ReactNode; fonte: ReactNode }>) {
  return (
    <figure aria-labelledby={`${id}-titulo`} className="border-t border-linha pt-6">
      <h3 id={`${id}-titulo`} className="font-serif text-xl leading-snug text-carvao">{titulo}</h3>
      <p className="mt-1 text-sm text-carvao-muted">{subtitulo}</p>
      <div className="mt-5">{children}</div>
      <figcaption className="mt-3 text-xs leading-relaxed text-mineral">{fonte}</figcaption>
      <details className="mt-3">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-carvao underline decoration-linha underline-offset-4">Ver a tabela</summary>
        <div className="mt-2 overflow-x-auto">{tabela}</div>
      </details>
    </figure>
  );
}


/**
 * Modelo didático do foco de calor. No painel, a introdução fala "deste painel"; na
 * entrada do observatório, ela recebe outro texto (introducao) e a ligação ao painel.
 */
export function DoSateliteAoFoco({ introducao }: Readonly<{ introducao?: ReactNode }> = {}) {
  const casos = [
    { id: "um", titulo: "Fogo ativo num pixel", texto: "Na passagem do satélite, um pixel de cerca de 1 km com fogo ativo vira 1 foco, mesmo que o fogo ocupe só parte dele.", pixels: [[1, 1]], nuvem: false, focos: 1 },
    { id: "grande", titulo: "Um incêndio grande", texto: "Uma frente de fogo que cobre vários pixels gera vários focos. Foco não é incêndio: um único incêndio pode somar dezenas.", pixels: [[0, 1], [1, 1], [2, 1], [1, 0], [2, 0]], nuvem: false, focos: 5 },
    { id: "invisivel", titulo: "O que fica de fora", texto: "Fogo pequeno, rasteiro sob a copa, sob nuvem ou apagado entre duas passagens do satélite não é detectado: zero focos não prova ausência de fogo.", pixels: [[1, 1]], nuvem: true, focos: 0 },
  ];
  return (
    <ModeloDidatico
      id="didatico"
      titulo="Do satélite ao foco de calor"
      descricao={
        <>
          {introducao ?? (
            <>
              Os números deste painel contam focos: pixels com fogo ativo vistos pelo satélite de referência do INPE. O esquema mostra
              por que foco não é área queimada nem número de incêndios. É uma ilustração, sem escala nem dado real.
            </>
          )}
        </>
      }
      deixaDeFora={[
        "Fogo pequeno, rasteiro sob a copa, sob nuvem ou apagado entre duas passagens do satélite: zero focos não prova ausência de fogo.",
        "Área queimada e número de incêndios: o foco é um pixel com fogo ativo, e um incêndio grande soma vários.",
        "Escala e dado real: é uma ilustração.",
      ]}
    >
        <ol className="grid gap-px border border-linha bg-linha md:grid-cols-3">
          {casos.map((c, i) => (
            <li key={c.id} className="flex flex-col bg-papel p-5">
              <p className="rotulo flex items-baseline gap-2 text-mineral"><span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>{c.titulo}</p>
              <svg viewBox="0 0 120 90" aria-hidden="true" className="mt-4 h-auto w-40">
                {[0, 1, 2].map((cx) => [0, 1].map((cy) => (
                  <rect key={`${cx}-${cy}`} x={10 + cx * 34} y={14 + cy * 34} width="32" height="32" className={c.pixels.some(([px, py]) => px === cx && py === cy) && !c.nuvem ? "fill-obee" : "fill-superficie"} stroke="var(--cor-linha)" />
                )))}
                {c.pixels.map(([px, py]) => (
                  <circle key={`${px}-${py}`} cx={26 + px * 34} cy={30 + py * 34} r="5" className="fill-bronze" />
                ))}
                {c.nuvem && <ellipse cx="60" cy="40" rx="46" ry="20" className="fill-marfim" stroke="var(--cor-mineral-soft)" strokeDasharray="3 3" />}
              </svg>
              <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{c.texto}</p>
              <p className="mt-auto pt-3 text-sm text-carvao"><span className="font-label text-lg tabular-nums">{c.focos}</span> {c.focos === 1 ? "foco" : "focos"}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-mineral">
          Ponto marrom: fogo no terreno. Quadrado escuro: pixel que o satélite registra como foco. Comparar anos exige sempre o mesmo
          satélite: a soma de todos os satélites conta o mesmo fogo várias vezes e muda com a quantidade de satélites em órbita.
        </p>
    </ModeloDidatico>
  );
}
