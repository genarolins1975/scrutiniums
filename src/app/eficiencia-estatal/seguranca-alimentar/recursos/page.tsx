import type { Metadata } from "next";
import Link from "next/link";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { ConsultaMunicipalAlimentar } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { PaaEstados, PnaeRepasses, SecaoComplementar } from "@/components/eficiencia/alimentar/Complementos";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Recursos e estrutura de segurança alimentar" };

const MUNIC: [string, string][] = [
  ["Gestão e participação", "Órgão gestor e existência de conselho são informações institucionais. Não demonstram funcionamento efetivo, participação ou resolução de demandas."],
  ["Equipamentos", "Responsabilidade municipal pode incluir parcerias. Quantidade não mede pessoas atendidas, conformidade nutricional ou continuidade real da operação."],
  ["Orçamento", "A variável pergunta sobre destinação de orçamento em 2023. Não informa valor gasto, execução financeira ou custo por atendimento."],
];

export default function Recursos() {
  const c = dadosComplementares();
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <>
      <p className="rotulo text-obee">Recursos e estrutura</p>
      <h1 className="mt-3 font-serif text-4xl">A capacidade instalada no território.</h1>
      <p className="mt-5 max-w-prose2 text-base leading-relaxed">
        Dinheiro federal para a alimentação escolar, compras públicas de alimentos da agricultura familiar e a estrutura municipal declarada. São recursos e condições de oferta, usados como contexto: nenhum deles mede, sozinho, a comida que chegou a quem precisa.
      </p>
      <nav aria-label="Nesta página" className="mt-5 flex flex-wrap gap-x-5 text-sm">
        <a href="#pnae-repasses" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Repasses da alimentação escolar</a>
        <a href="#paa" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Compras da agricultura familiar</a>
        <a href="#municipio" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">No seu município</a>
        <a href="#estrutura" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Estrutura municipal declarada</a>
      </nav>

      <SecaoComplementar
        id="pnae-repasses"
        pergunta="Quanto o governo federal repassa para a alimentação escolar?"
        contexto={<p>O FNDE transfere recursos do PNAE a cada prefeitura e secretaria estadual de educação, calculados pelo número de alunos e pela etapa de ensino. Prefeituras e estados completam com recursos próprios, que não aparecem aqui.</p>}
      >
        <PnaeRepasses c={c} />
      </SecaoComplementar>

      <SecaoComplementar
        id="paa"
        pergunta="Quanto o poder público compra da agricultura familiar para doar?"
        contexto={<p>No Programa de Aquisição de Alimentos (PAA), o poder público compra alimentos de agricultores familiares e os doa a pessoas em insegurança alimentar e a entidades da rede socioassistencial. Os registros do MDS contam os agricultores que forneceram e o valor pago a eles em cada ano.</p>}
      >
        <PaaEstados c={c} />
      </SecaoComplementar>

      <section id="municipio" aria-label="Recursos no seu município">
        <ConsultaMunicipalAlimentar tema="recursos" ufs={ufs} />
      </section>

      <section id="estrutura" aria-labelledby="estrutura-titulo" className="mt-12 border-t border-linha pt-8">
        <h2 id="estrutura-titulo" className="font-serif text-3xl">Estrutura municipal declarada</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed">A MUNIC inclui órgão gestor, conselho, destinação orçamentária e existência e quantidade de restaurantes populares e cozinhas comunitárias sob responsabilidade municipal. São dados declarados pela gestão, usados como contexto.</p>
        <div className="mt-6 grid gap-7 md:grid-cols-3">
          {MUNIC.map(([t, p]) => (
            <section key={t} className="border-t border-linha pt-5">
              <h3 className="font-serif text-2xl">{t}</h3>
              <p className="mt-3 text-sm leading-relaxed">{p}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm">Essas variáveis, os repasses e as compras não geram pontos automáticos no escore de serviço.</p>
        <Link href="/eficiencia-estatal/seguranca-alimentar/dados" className="mt-5 inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">Explorar registros de equipamentos e gestão →</Link>
      </section>
    </>
  );
}
