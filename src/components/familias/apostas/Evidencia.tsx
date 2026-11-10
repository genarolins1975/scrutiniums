import type { ReactNode } from "react";
import type { Cadeia, DefNivel, Estudo, Marco, Nivel } from "@/lib/familias/apostas";

/**
 * Peças do contrato de evidência dos painéis "Apostas e crédito das famílias" e "Golpes e fraudes" (Observatório das Famílias): o grau
 * de evidência de A a E ao lado de cada número, a cadeia com o grau de cada elo, a nota que fica sempre à vista, a biblioteca de
 * estudos e a linha do tempo. Sem estado: tudo sai no HTML do servidor. O grau é sempre letra e texto, nunca só cor.
 */

export const LINK = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

export function LinkFonte({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <a href={href} rel="noopener noreferrer" className={LINK}>
      {children}
    </a>
  );
}

/** "A · Dado administrativo oficial": a forma em texto, para célula de tabela e frase. */
export function grauTexto(nivel: Nivel | string, niveis: readonly DefNivel[]): string {
  const def = niveis.find((n) => n.nivel === nivel);
  return def ? `${def.nivel} · ${def.rotulo}` : String(nivel);
}

/** Selo do grau de evidência: a letra numa caixa e o rótulo ao lado. */
export function Grau({ nivel, niveis, curto = false }: Readonly<{ nivel: Nivel | string; niveis: readonly DefNivel[]; curto?: boolean }>) {
  const def = niveis.find((n) => n.nivel === nivel);
  return (
    <span className="inline-flex items-baseline gap-1.5 align-baseline text-xs text-carvao-muted" data-grau-evidencia={nivel}>
      <span className="inline-flex h-5 min-w-5 items-center justify-center border border-carvao px-1 font-medium leading-none text-carvao">{nivel}</span>
      {curto ? <span className="sr-only">{def?.rotulo ?? "grau de evidência"}</span> : <span>{def?.rotulo ?? "grau de evidência"}</span>}
    </span>
  );
}

/** A escala de A a E, com o que cada grau quer dizer. Fica junto dos números de abertura. */
export function LegendaGraus({ niveis }: Readonly<{ niveis: readonly DefNivel[] }>) {
  return (
    <div data-legenda-graus="">
      <p className="rotulo text-mineral">Grau de evidência de cada número</p>
      <dl className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {niveis.map((n) => (
          <div key={n.nivel} className="flex min-w-0 gap-2">
            <dt className="shrink-0">
              <span className="inline-flex h-5 min-w-5 items-center justify-center border border-carvao px-1 text-xs font-medium leading-none text-carvao">{n.nivel}</span>
            </dt>
            <dd className="t-meta min-w-0 text-carvao-muted">
              <span className="font-medium text-carvao">{n.rotulo}.</span> {n.descricao}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ressalva material, sempre à vista, com o mesmo filete do "não permite concluir" do kit. */
export function Nota({ rotulo, children }: Readonly<{ rotulo?: string; children: ReactNode }>) {
  return (
    <p className="t-meta max-w-prose2 border-l border-carvao pl-4 text-carvao" data-nota-evidencia="">
      {rotulo && <span className="font-medium">{rotulo} </span>}
      {children}
    </p>
  );
}

export function Texto({ children, suave = false }: Readonly<{ children: ReactNode; suave?: boolean }>) {
  return <p className={`t-meta max-w-prose2 ${suave ? "text-carvao-muted" : "text-carvao"}`}>{children}</p>;
}

export function Subtitulo({ children, id }: Readonly<{ children: ReactNode; id?: string }>) {
  return (
    <h3 id={id} className="t-h3 scroll-mt-28 text-carvao">
      {children}
    </h3>
  );
}

/** Corpo de um capítulo recolhível: blocos com o mesmo ritmo vertical. */
export function Corpo({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="space-y-6">{children}</div>;
}

/**
 * A cadeia plausível entre o tema e o crédito: os nós na ordem, a seta entre eles e, em cada nó, o grau de evidência do elo que chega
 * até ele, escrito por extenso. A seta é a ordem do raciocínio, não uma relação de causa medida.
 */
export function CadeiaElos({ cadeia, rotulo }: Readonly<{ cadeia: Cadeia; rotulo: string }>) {
  return (
    <ol aria-label={rotulo} className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch" data-cadeia="">
      {cadeia.nos.map((n, i) => (
        <li key={`${n.nome}-${i}`} className="flex min-w-0 items-stretch gap-2 md:max-w-[13rem] md:flex-1">
          <div className="min-w-0 flex-1 border border-linha bg-superficie px-3 py-2">
            <p className="text-sm font-medium text-carvao">{n.nome}</p>
            <p className="mt-1 text-xs leading-snug text-carvao-muted">{n.grau.split(" (")[0]}</p>
          </div>
          {i < cadeia.nos.length - 1 && (
            <span aria-hidden="true" className="hidden self-center text-mineral md:inline">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function BibliotecaEstudos({ estudos, niveis }: Readonly<{ estudos: readonly Estudo[]; niveis: readonly DefNivel[] }>) {
  return (
    <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2" data-estudos="">
      {estudos.map((e) => (
        <li key={e.id} className="min-w-0 border-t border-linha pt-4">
          <h3 className="text-base font-medium leading-snug text-carvao">
            <LinkFonte href={e.url}>{e.titulo}</LinkFonte>
          </h3>
          <p className="mt-1">
            <Grau nivel={e.nivel} niveis={niveis} />
          </p>
          <p className="t-meta mt-2 text-carvao-muted">
            {e.autores} ({e.ano}) · {e.veiculo} · <span className="font-medium text-carvao">{e.tipo}</span> · {e.pais} · {e.periodo}
          </p>
          <p className="t-meta mt-2 text-carvao-muted">
            <span className="font-medium text-carvao">Base:</span> {e.base} · <span className="font-medium text-carvao">Desenho:</span> {e.desenho}
          </p>
          <p className="t-meta mt-2 text-carvao">{e.resultado}</p>
          <p className="t-meta mt-2 text-carvao-muted">
            <span className="font-medium text-carvao">Limitações:</span> {e.limitacoes}
          </p>
          <p className="t-meta mt-1 text-carvao-muted">
            <span className="font-medium text-carvao">Aplicabilidade ao Brasil:</span> {e.aplicabilidade}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function LinhaDoTempo({ marcos }: Readonly<{ marcos: readonly Marco[] }>) {
  return (
    <ol className="max-w-prose2 space-y-4 border-l border-linha pl-4" data-linha-do-tempo="">
      {marcos.map((t, i) => (
        <li key={`${t.data}-${i}`}>
          <p className="text-xs tabular-nums text-mineral">
            {t.data}
            {t.parcial && <span className="ml-2 border border-carvao px-1 text-carvao">Parcialmente confirmado</span>}
          </p>
          <p className="mt-0.5 text-sm font-medium text-carvao">
            <LinkFonte href={t.url}>{t.ato}</LinkFonte>
          </p>
          <p className="t-meta mt-0.5 text-carvao-muted">{t.resumo}</p>
        </li>
      ))}
    </ol>
  );
}

/** Lista simples de frases da base (ações, salvaguardas, limitações). */
export function Lista({ itens }: Readonly<{ itens: readonly ReactNode[] }>) {
  return (
    <ul className="t-meta max-w-prose2 list-disc space-y-1.5 pl-5 text-carvao">
      {itens.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
