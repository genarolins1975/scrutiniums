import type { ReactNode } from "react";
import { Siglas } from "../Siglas";

/** Avisos e apoios de leitura do módulo Saúde: capitais fora da comparação agrupadas por motivo, siglas por extenso e o perímetro de cada tema. */

type ItemFora = { nome: string; uf: string; status: string; motivo: string };

/**
 * Capitais fora da comparação, agrupadas pelo mesmo estado e motivo: o motivo aparece uma vez, com a lista de capitais, em vez de se repetir
 * 26 vezes. Nenhuma capital some sem explicação, e o texto completo abre por clique ou teclado.
 */
export function ForaDaComparacaoSaude({ itens }: { itens: ItemFora[] }) {
  if (!itens.length) return null;
  const grupos = new Map<string, { status: string; motivo: string; capitais: string[] }>();
  for (const x of itens) {
    const chave = `${x.status}|${x.motivo}`;
    const g = grupos.get(chave) ?? { status: x.status, motivo: x.motivo || "Sem valor para este recorte.", capitais: [] };
    g.capitais.push(`${x.nome} (${x.uf})`);
    grupos.set(chave, g);
  }
  return (
    <div id="fora-da-comparacao" className="scroll-mt-24 border-t border-linha pt-4" role="note">
      <p className="rotulo text-mineral">{itens.length === 1 ? "1 capital fora desta comparação" : `${itens.length} capitais fora desta comparação`}</p>
      <ul className="mt-2 space-y-3 text-sm leading-snug text-obee-tinta">
        {Array.from(grupos.values()).map((g) => {
          const corte = g.motivo.length > 190 ? g.motivo.search(/\.\s/) : -1;
          const inicio = corte > 0 ? g.motivo.slice(0, corte + 1) : g.motivo;
          const resto = corte > 0 ? g.motivo.slice(corte + 1).trim() : "";
          return (
            <li key={`${g.status}|${g.motivo}`}>
              <span className="font-semibold">{g.capitais.join(", ")}</span>
              <span className="text-carvao-muted"> · {g.status}</span>
              <br />
              <Siglas texto={inicio} />
              {resto && (
                <details className="mt-0.5">
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver o motivo completo</summary>
                  <p className="text-carvao-muted"><Siglas texto={resto} /></p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Aviso único e visível sobre o período escolhido (base populacional, regra de cálculo); nunca fragmentado em blocos recolhidos. */
export function AvisoDoPeriodo({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p className="mt-3 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-snug text-obee-tinta" role="note">
      {texto}
    </p>
  );
}

const SIGLAS_POR_TEMA: Record<string, [string, string][]> = {
  gastos: [
    ["DCA", "Declaração de Contas Anuais, enviada pelo município ao Tesouro Nacional"],
    ["ASPS", "ações e serviços públicos de saúde, base do mínimo de 15% da LC 141/2012"],
    ["SIOPS", "Sistema de Informações sobre Orçamentos Públicos em Saúde"],
    ["RREO", "Relatório Resumido da Execução Orçamentária"],
    ["MSC", "Matriz de Saldos Contábeis"],
    ["IPCA", "Índice Nacional de Preços ao Consumidor Amplo, usado nos reais de 2025"],
  ],
  rede: [
    ["UBS", "unidade básica de saúde (postos e centros de saúde)"],
    ["CNES", "Cadastro Nacional de Estabelecimentos de Saúde"],
    ["APS", "atenção primária à saúde"],
    ["eSF", "equipe de Saúde da Família"],
    ["eAP", "equipe de Atenção Primária"],
  ],
  resultados: [
    ["ICSAP", "internações por condições sensíveis à atenção primária"],
    ["AIH", "autorização de internação hospitalar, a unidade contada"],
    ["SIH", "Sistema de Informações Hospitalares do SUS"],
    ["RIPSA", "Rede Interagencial de Informações para a Saúde"],
    ["ANS", "Agência Nacional de Saúde Suplementar"],
    ["SUS", "Sistema Único de Saúde"],
  ],
  comparar: [
    ["ASPS", "ações e serviços públicos de saúde"],
    ["UBS", "unidade básica de saúde"],
    ["eSF", "equipe de Saúde da Família"],
    ["eAP", "equipe de Atenção Primária"],
    ["ICSAP", "internações por condições sensíveis à atenção primária"],
    ["APS", "atenção primária à saúde"],
  ],
};

/** Siglas da página por extenso, à vista (a expansão por passar o mouse não serve ao toque nem ao teclado). */
export function GlossarioDaPagina({ tema }: { tema: keyof typeof SIGLAS_POR_TEMA }) {
  const itens = SIGLAS_POR_TEMA[tema];
  return (
    <div className="mt-4 text-sm leading-snug text-carvao-muted">
      <p className="rotulo text-carvao-muted">Siglas desta página</p>
      <dl className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-1">
        {itens.map(([s, t]) => (
          <div key={s} className="flex gap-1.5">
            <dt className="font-semibold text-obee-tinta">{s}</dt>
            <dd>{t}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const PERIMETRO_DO_TEMA: Record<"gastos" | "rede" | "resultados", { rotulo: string; texto: string }> = {
  gastos: { rotulo: "Recursos executados pelo município", texto: "despesa que a prefeitura executa; não é o gasto de União e estado no território" },
  rede: { rotulo: "Serviços localizados no território", texto: "cadastro de estabelecimentos e equipes situados na capital; não prova funcionamento nem acesso" },
  resultados: { rotulo: "População residente", texto: "internações dos moradores, onde quer que ocorram; não é produção da prefeitura" },
};

export function EtiquetaDePerimetro({ tema, href }: { tema: keyof typeof PERIMETRO_DO_TEMA; href: string }): ReactNode {
  const p = PERIMETRO_DO_TEMA[tema];
  return (
    <p className="mt-3 text-sm leading-snug text-carvao-muted">
      <span className="rotulo text-mineral">Perímetro</span> <span className="font-semibold text-obee-tinta">{p.rotulo}</span>: {p.texto}.{" "}
      <a href={href} className="whitespace-nowrap text-obee-dark underline underline-offset-4">Os três perímetros</a>
    </p>
  );
}

export function AjudaMoeda() {
  return (
    <p className="mt-1.5 text-xs leading-snug text-carvao-muted">
      Reais de 2025: cada exercício corrigido pelo IPCA (média anual) para o poder de compra de 2025; em 2025 os dois valores coincidem. Para comparar anos, use reais de 2025.
    </p>
  );
}

export function AjudaDenominador({ iguais, total, ano }: { iguais: number; total: number; ano: number }) {
  return (
    <p className="mt-1.5 text-xs leading-snug text-carvao-muted">
      {total > 0 && iguais === total
        ? `Em ${ano} as duas populações coincidem nas ${total} capitais, e as duas taxas são iguais.`
        : iguais > 0
          ? `Em ${ano} as duas populações coincidem em ${iguais} de ${total} capitais.`
          : "A população do Ministério da Saúde é a do próprio indicador; a do IBGE é a do exercício usada nas demais medidas por habitante."}
    </p>
  );
}
