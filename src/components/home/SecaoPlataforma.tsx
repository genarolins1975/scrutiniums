import Link from "next/link";
import { registroErros } from "@/lib/sobre";
import { DETALHE_RECOLHIDO, IndicadorRecolhido, RESUMO_RECOLHIDO } from "@/components/observatorios/Recolhido";

type Item = { titulo: string; descricao: string; link?: { href: string; rotulo: string } };

/**
 * O sistema de evidência, dito com o alcance que cada recurso tem hoje.
 * Recurso que existe em um só observatório é atribuído a ele; nada é
 * apresentado como comum a todos sem estar em todos.
 */
function itens(): Item[] {
  const nErros = registroErros().erros.length;
  return [
    {
      titulo: "Fonte e data de referência",
      descricao:
        "Órgão, base e período de referência acompanham indicadores, gráficos e tabelas em todos os observatórios.",
    },
    {
      titulo: "Ausência declarada",
      descricao:
        "Recorte sem dado aparece como indisponível, com o motivo. Nunca como zero, nunca preenchido por estimativa silenciosa.",
    },
    {
      titulo: "Natureza de cada número",
      descricao:
        "No Setor Elétrico, cada valor traz o selo observado, calculado, estimado, previsto ou cenário. No Gás Natural, cada indicador traz observado ou calculado, com a fórmula. Nos demais observatórios, a natureza consta da ficha e da proveniência do indicador.",
    },
    {
      titulo: "Previsão só com estado declarado",
      descricao:
        "Os modelos de previsão do PLD aparecem como pesquisa e cada emissão fica em arquivo imutável. Cenários e laboratórios didáticos são rotulados como tal.",
    },
    {
      titulo: "Dados para reutilizar",
      descricao:
        "Com a conta: CSV e Parquet com hash SHA-256 no Setor Elétrico; CSV, XLSX e API em JSON no Crédito; CSV na maior parte dos temas da Eficiência Estatal, nas Contas Estaduais e no Gás Natural; JSON nas Contas Federais.",
    },
    {
      titulo: "Erros corrigidos em público",
      descricao:
        nErros > 0
          ? `O registro público reúne ${nErros} ${nErros === 1 ? "erro identificado" : "erros identificados"}, com descrição, gravidade e correção.`
          : "O registro público de erros reúne cada correção com descrição, gravidade e onde foi corrigida.",
      link: { href: "/sobre/erros", rotulo: "Registro de erros" },
    },
  ];
}

/** O método da plataforma, recolhido no fim da home (achado A9 da banca de 19/10/2026): no HTML, a um clique. */
export function SecaoPlataforma() {
  return (
    <section id="plataforma" aria-labelledby="plataforma-titulo" className="scroll-mt-4 bg-carvao text-marfim">
      <div className="mx-auto max-w-page px-6">
        <details className={DETALHE_RECOLHIDO}>
          <summary className={`${RESUMO_RECOLHIDO} py-8 md:py-10`}>
            <span className="block">
              <span className="rotulo block text-mineral-soft">Método</span>
              <h2
                id="plataforma-titulo"
                className="mt-3 font-serif text-[clamp(1.5rem,3.4vw,2.25rem)] leading-[1.15] text-marfim [text-wrap:balance]"
              >
                Fonte, período e limites, <span className="text-bronze-soft">declarados junto ao número.</span>
              </h2>
            </span>
            <IndicadorRecolhido claro />
          </summary>
          <div className="grid gap-10 pb-16 lg:grid-cols-12 lg:gap-8">
            <div className="lg:sticky lg:top-10 lg:col-span-5 lg:self-start">
              <p className="max-w-md leading-relaxed text-mineral-soft">
                Os observatórios apresentam indicadores, referências e ressalvas. A conclusão fica com quem lê.
              </p>
            </div>

            <ul className="border-t border-linha-escura lg:col-span-7">
              {itens().map((item) => (
                <li key={item.titulo} className="border-b border-linha-escura py-6 md:py-7">
                  <h3 className="font-serif text-lg text-marfim md:text-xl">{item.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mineral-soft md:text-base">{item.descricao}</p>
                  {item.link && (
                    <Link
                      href={item.link.href}
                      className="rotulo mt-3 inline-flex min-h-[44px] items-center gap-2 text-bronze-soft underline decoration-linha-escura underline-offset-8 hover:text-marfim"
                    >
                      {item.link.rotulo} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </section>
  );
}
