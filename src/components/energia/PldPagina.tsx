import { LegendaDeSiglas } from "@/components/energia/CabecalhoModulo";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { PldLinkPainel } from "@/components/energia/PldLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { carimbo } from "@/lib/energia/formato";
import { PAINEIS_PLD, ROTA_PLD, rotaPainel, type PainelPld } from "@/lib/energia/pld";
import type { Controle, FonteTextual } from "@/lib/energia/tipos-pld";

/**
 * Peças de servidor das páginas do PLD (um painel por página: /setor-eletrico/pld
 * com o P008 e os capítulos de conceito, situação atual e previsão; /cmo-e-formacao
 * para o P009; /limites para o P010; /historico para o P011; /diferencas-regionais
 * para o P012): navegação entre os painéis, recorte (período, universo e unidade),
 * avisos de ausência e defasagem, rodapé com downloads, link compartilhável e
 * próxima pergunta, blocos dos modos Analisar e Auditar, passagens normativas
 * citadas e os controles automáticos da construção.
 */

/** Navegação entre os painéis do PLD; o atual leva aria-current. */
export function PldNavegacao({ atual }: { atual: PainelPld }) {
  return (
    <nav aria-label="Painéis do PLD" className="pb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {PAINEIS_PLD.map((p) => (
          <li key={p.id}>
            <Link
              href={p.id === "p008" ? `${rotaPainel(p.id)}#p008` : rotaPainel(p.id)}
              aria-current={p.id === atual ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center border px-3 ${
                p.id === atual ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              {p.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function PldIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Painel do PLD indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold de detalhe do PLD (public/energia/gold/pld_detalhe.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_PLD} className="text-energia-dark underline underline-offset-4">
            Voltar ao PLD
          </Link>
        </p>
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function PldRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function PldAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function PldSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {downloads.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <PldLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={proximo.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {proximo.pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function PldAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function PldAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Passagem normativa ou técnica conferida no documento baixado: dispositivo, texto literal e origem. */
export function PldPassagem({ p, compacta = false }: { p: FonteTextual; compacta?: boolean }) {
  return (
    <blockquote className="border-l-2 border-energia pl-3 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
      <p>“{p.texto}”</p>
      <footer className="mt-1 text-xs text-carvao-muted">
        {compacta ? (p.dispositivo ?? p.origem) : p.origem}
        {p.url && !compacta ? (
          <>
            {" "}
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
              documento
            </a>
          </>
        ) : null}
        {p.capturado_em && !compacta ? `; captura de ${carimbo(p.capturado_em)}` : ""}
      </footer>
    </blockquote>
  );
}

const ROTULO_RESULTADO: Record<Controle["resultado"], string> = { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" };
const GLIFO_RESULTADO: Record<Controle["resultado"], string> = { aprovado: "●", ressalva: "◐", reprovado: "○" };

/** Controles automáticos executados na construção da gold, com o resultado em palavra e glifo (nunca só cor). */
export function PldControles({ controles }: { controles: Controle[] }) {
  if (!controles.length) return <p className="text-sm text-carvao-muted">Nenhum controle publicado para este painel.</p>;
  return (
    <ul className="space-y-2 text-sm text-carvao-muted">
      {controles.map((c) => (
        <li key={c.nome} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-carvao">
            <span aria-hidden="true">{GLIFO_RESULTADO[c.resultado]}</span> {c.nome}
          </span>
          : {ROTULO_RESULTADO[c.resultado]}. {c.detalhe}
        </li>
      ))}
    </ul>
  );
}

/** Abertura de cada página de painel: rótulo do módulo, pergunta como título e síntese curta. */
export function PldCabecalho({ titulo, children, referencia, siglas }: { titulo: string; children?: ReactNode; referencia?: ReactNode; siglas?: readonly string[] }) {
  return (
    <header className="pb-6 pt-10 md:pt-14">
      <p className="rotulo text-mineral">Preço de Liquidação das Diferenças</p>
      <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] text-carvao">{titulo}</h1>
      {children && <div className="mt-4 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">{children}</div>}
      {referencia && <p className="mt-4 text-xs text-mineral">{referencia}</p>}
      <LegendaDeSiglas siglas={siglas} />
    </header>
  );
}
