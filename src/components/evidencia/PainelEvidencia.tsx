import { fonteLegivel } from "@/lib/energia/bastidor";
import type { ReactNode } from "react";
import type { Natureza, Proveniencia } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { provenienciaLegivel } from "@/lib/energia/mercado";

/**
 * Regra editorial da plataforma incorporada ao design system: toda
 * visualização relevante responde, nesta ordem, O que estou vendo? Por que
 * importa? O que mudou? Como interpretar? O que NÃO posso concluir? Qual é a
 * fonte? Os seis campos são obrigatórios no tipo: um painel sem "o que não
 * posso concluir" não compila.
 *
 * Apresentação (redesenho): o painel é uma seção com linha fina em cima, sem cartão. A pergunta, o subtítulo com os selos e a figura
 * vêm primeiro; "O que mudou" (a frase factual), "Como interpretar" (a regra de leitura) e "O que não é possível concluir" (a ressalva
 * que evita a leitura errada) ficam junto ao dado, sempre à vista e em três colunas; "Por que isso importa" fica num bloco recolhível
 * (no HTML do servidor), aberto em Analisar e Auditar. Os seis campos continuam obrigatórios no tipo: o que muda é a quantidade de
 * texto aberto ao mesmo tempo e a ausência de cartão.
 */
export type RegraEditorial = {
  /** O que estou vendo: pergunta ou conclusão no título. */
  pergunta: string;
  /** Indicador · unidade (subtítulo técnico). */
  subtitulo: string;
  porQueImporta: ReactNode;
  oQueMudou: ReactNode;
  comoInterpretar: ReactNode;
  naoConcluir: ReactNode;
  proveniencia: Proveniencia;
};

/** Outro número do mesmo painel com natureza ou transformação própria (padrão
 * histórico, média de janela, saldo de outro conjunto): selo e gaveta próprios. */
export type ProvenienciaComplementar = { rotulo: string; p: Proveniencia };

export function PainelEvidencia({
  id,
  natureza,
  children,
  nivel,
  extraFonte,
  complementares: complementaresBrutos = [],
  nivelTitulo = 2,
  proveniencia: provenienciaBruta,
  naoConcluirNoCorpo = false,
  ...restante
}: RegraEditorial & {
  id: string;
  natureza?: Natureza;
  children: ReactNode;
  /** Modo mínimo em que o painel aparece (ver ModoProfundidade). */
  nivel?: "entender" | "analisar" | "auditar";
  extraFonte?: ReactNode;
  complementares?: ProvenienciaComplementar[];
  /** 2 em páginas de módulo (logo abaixo do h1); 3 dentro de seções que já têm h2. */
  nivelTitulo?: 2 | 3;
  /**
   * Painel composto, com várias figuras em sequência: o corpo renderiza as notas ("O que mudou" e "O que não é possível concluir") logo
   * depois da figura principal, com <NotasDoPainel>, para ficarem junto ao dado a que se referem. Os textos continuam obrigatórios em
   * `oQueMudou` e `naoConcluir`, e a página os passa aos dois lugares.
   */
  naoConcluirNoCorpo?: boolean;
}) {
  // datas ISO soltas nos textos que o pipeline escreve saem na forma da página (dd/mm/aaaa)
  const r = { ...restante, proveniencia: provenienciaLegivel(provenienciaBruta) };
  const complementares = complementaresBrutos.map((c) => ({ ...c, p: provenienciaLegivel(c.p) }));
  const nat = natureza ?? r.proveniencia.natureza;
  // um selo por natureza presente no painel (principal e complementares), sem repetir
  const selos = Array.from(new Set<Natureza>([nat, ...complementares.map((c) => c.p.natureza)]));
  // todas as fontes do painel (principal e complementares), agrupadas por órgão e data de referência: "ONS, EAR Diário por Subsistema; por REE
  // (referência até 29/09/2026)" em vez de repetir o órgão e a data em cada conjunto
  const grupos: { orgao: string; ate: string; conjuntos: string[] }[] = [];
  for (const p of [r.proveniencia, ...complementares.map((c) => c.p)]) {
    const orgao = fonteLegivel(p.fonte.orgao);
    const nome = fonteLegivel(`${p.fonte.orgao}, ${p.fonte.dataset}`);
    const conjunto = nome.startsWith(`${orgao}, `) ? nome.slice(orgao.length + 2) : nome;
    const ate = p.periodo_referencia.fim;
    const g = grupos.find((x) => x.orgao === orgao && x.ate === ate);
    if (!g) grupos.push({ orgao, ate, conjuntos: [conjunto] });
    else if (!g.conjuntos.includes(conjunto)) g.conjuntos.push(conjunto);
  }
  const textoFontes = `${grupos.length === 1 ? "Fonte" : "Fontes"}: ${grupos.map((g) => `${g.orgao}, ${g.conjuntos.join("; ")} (referência até ${fim(g.ate)})`).join("; ")}. `;
  const Titulo = nivelTitulo === 3 ? "h3" : "h2";
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} data-nivel={nivel} data-painel-evidencia="" className="scroll-mt-28 border-t border-linha pt-6">
      <header>
        <Titulo id={`${id}-titulo`} className={`${nivelTitulo === 3 ? "ed-h3 text-[1.375rem]" : "ed-h2"} font-serif text-carvao`}>
          {r.pergunta}
        </Titulo>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-carvao-muted">
          <span>{r.subtitulo}</span>
          {selos.map((n) => (
            <SeloNatureza key={n} natureza={n} />
          ))}
        </p>
      </header>
      <div className="mt-5">{children}</div>
      {!naoConcluirNoCorpo && <NotasDoPainel oQueMudou={r.oQueMudou} comoInterpretar={r.comoInterpretar} naoConcluir={r.naoConcluir} nome={r.pergunta} />}
      <DetalheDoNivel resumo="Por que isso importa" abreEm="analisar" className="mt-1" dados={{ "data-por-que-importa": "" }}>
        <div className="max-w-prose2 border-t border-linha pb-2 pt-3 text-sm leading-relaxed text-carvao-muted">{r.porQueImporta}</div>
      </DetalheDoNivel>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-linha pt-3">
        <p className="text-xs leading-relaxed text-carvao-muted">
          {textoFontes}
          {extraFonte}
        </p>
        <div className="flex flex-wrap items-center gap-x-5">
          {r.proveniencia.download && (
            <a href={r.proveniencia.download} download className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
              Baixar CSV da série completa
            </a>
          )}
          <SobreEsteDado p={r.proveniencia} />
        </div>
        {complementares.length > 0 && (
          <ul className="flex w-full flex-wrap items-center gap-x-5 gap-y-0 text-sm">
            {complementares.map((c) => (
              <li key={c.rotulo}>
                <SobreEsteDado p={c.p} rotulo={c.rotulo} />
              </li>
            ))}
          </ul>
        )}
      </footer>
    </section>
  );
}

/**
 * Notas do painel, sempre à vista e junto da figura: "O que mudou" (a frase factual do dado, com a comparação no período), "Como
 * interpretar" (a regra de leitura, com as definições no ponto de uso) e "O que não é possível concluir" (a ressalva essencial que
 * evita a leitura errada). Em três colunas a partir de 768 px. "Por que isso importa" fica em bloco recolhível, porque a abertura da
 * página já traz a razão da medida.
 *
 * `nome` (a pergunta do painel) entra no fim do nome acessível de cada nota: com dois painéis na mesma página, as seis notas não repetem
 * o mesmo nome de região e o leitor de tela distingue de que painel cada uma fala (axe `landmark-unique`). O texto visível não muda.
 */
export function NotasDoPainel({
  oQueMudou,
  comoInterpretar,
  naoConcluir,
  nome,
}: {
  oQueMudou: ReactNode;
  comoInterpretar: ReactNode;
  naoConcluir: ReactNode;
  nome?: string;
}) {
  const sufixo = nome ? `: ${nome}` : "";
  return (
    <div data-notas-painel="" className="grid gap-x-8 gap-y-4 md:grid-cols-3">
      <aside aria-label={`O que mudou${sufixo}`} data-que-mudou="" className="border-l-2 border-linha pl-4">
        <p className="rotulo text-mineral">O que mudou</p>
        <div className="mt-1 text-sm leading-relaxed text-carvao-muted">{oQueMudou}</div>
      </aside>
      <aside aria-label={`Como interpretar${sufixo}`} data-como-interpretar="" className="border-l-2 border-linha pl-4">
        <p className="rotulo text-mineral">Como interpretar</p>
        <div className="mt-1 text-sm leading-relaxed text-carvao-muted">{comoInterpretar}</div>
      </aside>
      <aside aria-label={`O que não é possível concluir${sufixo}`} data-ressalva="" className="border-l-2 border-energia-soft pl-4">
        <p className="rotulo text-mineral">O que não é possível concluir</p>
        <div className="mt-1 text-sm leading-relaxed text-carvao-muted">{naoConcluir}</div>
      </aside>
    </div>
  );
}

function fim(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (d === undefined) return m === undefined ? a : `${m}/${a}`;
  return iso.length > 10 ? `${d}/${m}/${a} ${iso.slice(11, 16)}` : `${d}/${m}/${a}`;
}
