import Link from "next/link";
import { ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";

const RECURSOS = [
  {
    escopo: "Crédito",
    titulo: "Resumo diário",
    href: "/resumo",
    descricao: "O crédito no Brasil hoje: diagnóstico, o que piorou e o que melhorou, com RSS e envio por e-mail.",
  },
  {
    escopo: "Crédito",
    titulo: "Central de alertas",
    href: "/observatorio/alerts",
    descricao: "Sinais por família de monitoramento, cada um com universo, regra de persistência e feed RSS público.",
  },
  {
    escopo: "Crédito",
    titulo: "O crédito em números",
    href: "/dados",
    descricao: "Indicadores com definição, limitações, citação pronta e código para incorporar.",
  },
  {
    escopo: "Crédito",
    titulo: "API pública",
    href: "/dados/api",
    descricao: "Os arquivos publicados do Observatório em JSON, com contrato versionado, para quem está conectado.",
  },
  {
    escopo: "Setor Elétrico",
    titulo: "Catálogo de dados",
    href: "/setor-eletrico/dados",
    descricao: "Conjuntos com licença, arquivos e citação, e manifesto SHA-256 para reproduzir os números.",
  },
  {
    escopo: "Setor Elétrico",
    titulo: "Aprenda",
    href: "/setor-eletrico/aprenda",
    descricao: "Verbetes com fonte oficial e trilhas de leitura sobre os conceitos do setor.",
  },
  {
    escopo: "Contas Públicas Federais",
    titulo: "Dados e cobertura",
    href: "/contas-publicas/dados",
    descricao: "Matriz de cobertura, catálogo de indicadores pesquisável e downloads em JSON.",
  },
  {
    escopo: "Saneamento",
    titulo: "Método, fontes e conferências",
    href: "/saneamento/metodologia",
    descricao: "Fontes com data e SHA-256, matriz de viabilidade por pergunta, conferências entre bases e limitações.",
  },
  {
    escopo: "Gás Natural",
    titulo: "Dados e downloads",
    href: "/gas-natural/dados",
    descricao: "Cada fonte com data de captura e SHA-256 do original, cada indicador com fórmula, e as séries em CSV.",
  },
  {
    escopo: "Gás Natural",
    titulo: "Método e glossário",
    href: "/gas-natural/metodologia",
    descricao: "Regras de cálculo, validações que retêm a publicação e o que separa gás natural, GLP, GNL e GNV.",
  },
  {
    escopo: "Plataforma",
    titulo: "Para a imprensa",
    href: "/imprensa",
    descricao: "Números sobre apostas online e fraudes financeiras com o documento original e o grau de evidência.",
  },
  {
    escopo: "Plataforma",
    titulo: "Sobre a Scrutiniums",
    href: "/sobre",
    descricao: "Quem mantém a plataforma, política de correção e como citar.",
  },
];

/**
 * Serviços e superfícies de reutilização que existem hoje, cada um com o
 * observatório a que pertence. Nada é apresentado como recurso de todos.
 */
export function SecaoRecursos() {
  return (
    <section aria-labelledby="recursos-titulo" className="bg-papel">
      <div className="mx-auto max-w-page px-6 py-20 md:py-28">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="rotulo text-mineral">Acompanhar e reutilizar</p>
            <h2
              id="recursos-titulo"
              className="mt-6 font-serif text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.12] text-carvao [text-wrap:balance]"
            >
              Para acompanhar, citar e reproduzir
            </h2>
          </div>
          <p className="max-w-prose2 leading-relaxed text-carvao-muted lg:col-span-5 lg:self-end">
            Resumos, alertas, catálogos e arquivos disponíveis com a conta gratuita. Cada recurso indica o
            observatório a que pertence.
          </p>
        </div>

        <ul className="mt-12 grid border-t border-linha sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <li key={r.href} className="border-b border-linha">
              <Link href={r.href} prefetch={prefetchDoLink(r.href)} className="group flex h-full min-h-[44px] flex-col py-6">
                <span className="rotulo flex items-center justify-between gap-2 text-mineral">
                  {r.escopo}
                  {!ehRotaPublica(r.href) && <span className="normal-case tracking-normal">com conta</span>}
                </span>
                <span className="mt-2 flex items-baseline justify-between gap-3 font-serif text-xl leading-snug text-carvao transition-colors group-hover:text-bronze-dark">
                  {r.titulo}
                  <span aria-hidden="true" className="font-sans text-sm text-mineral transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
                <span className="mt-2 text-sm leading-relaxed text-mineral">{r.descricao}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
