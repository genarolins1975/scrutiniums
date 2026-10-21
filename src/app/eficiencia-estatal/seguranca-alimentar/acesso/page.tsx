import Link from "next/link";
import type { Metadata } from "next";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { ConsultaMunicipalAlimentar } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { IpcaAlimentos } from "@/components/eficiencia/alimentar/IpcaAlimentos";
import { FonteDaMedida, PnaeAtendimento, SecaoComplementar } from "@/components/eficiencia/alimentar/Complementos";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Acesso e atendimento alimentar" };

const LACUNAS: [string, string][] = [
  ["Alimentação escolar", "Integrados: alunos e escolas registrados no PNAE, acima. Ainda faltam dias letivos com alimentação efetivamente oferecida e refeições servidas; repasse e registro não comprovam entrega."],
  ["Refeições públicas", "População: pessoas elegíveis conforme o programa. Medir atendidos e barreiras de preço, distância e horário; capacidade não equivale a pessoas únicas. Sem base de atendimento integrada."],
  ["Auxílio alimentar", "População: famílias elegíveis conforme o programa. Medir atendimento e espera até a entrega, com protocolo para eliminar duplicidades entre modalidades. Sem base de atendimento integrada."],
];

export default function Acesso() {
  const c = dadosComplementares();
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <>
      <p className="rotulo text-obee">Acesso e atendimento</p>
      <h1 className="mt-3 font-serif text-4xl">A ação existe. Quem consegue recebê-la?</h1>
      <p className="mt-5 max-w-prose2 text-base leading-relaxed">
        Dois caminhos de acesso aos alimentos têm dado nesta página: a alimentação escolar, pelos alunos registrados no PNAE, e o preço da comida, pela inflação dos alimentos no IPCA. A MUNIC informa ainda se houve ações municipais de promoção do acesso em 2023; existência de ação não informa cobertura efetiva, demanda não atendida ou pessoas únicas.
      </p>
      <nav aria-label="Nesta página" className="mt-5 flex flex-wrap gap-x-5 text-sm">
        <a href="#escolar" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Alimentação escolar</a>
        <a href="#precos" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Preço dos alimentos</a>
        <a href="#lacunas" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">O que ainda falta medir</a>
      </nav>

      <SecaoComplementar
        id="escolar"
        pergunta="Quantos alunos estão cobertos pela alimentação escolar?"
        contexto={<p>O Programa Nacional de Alimentação Escolar (PNAE) transfere recursos federais a prefeituras e secretarias estaduais de educação para as refeições dos alunos da rede pública. O FNDE registra, para cada entidade executora, os alunos e as escolas atendidos pelo programa em cada exercício.</p>}
      >
        <PnaeAtendimento c={c} />
        <ConsultaMunicipalAlimentar tema="acesso" ufs={ufs} />
      </SecaoComplementar>

      <SecaoComplementar
        id="precos"
        pergunta="A comida ficou mais cara?"
        contexto={
          <p>
            O IPCA mede a variação dos preços ao consumidor. A alimentação no domicílio reúne os alimentos comprados para comer em casa. Para a inflação por cidade e por grupo de despesa, veja o painel{" "}
            <Link href="/custo-de-vida" className="text-obee-dark underline underline-offset-2">Custo de vida</Link>.
          </p>
        }
      >
        <IpcaAlimentos pontos={c.ipca} />
        <FonteDaMedida c={c} fonteId="ibge-ipca-7060" ficha="san.ipca.alimentacao" periodo="janeiro de 2023 a setembro de 2026" unidade="% de variação" csv="ipca-alimentacao.csv"
          ressalva="Variações publicadas pelo IBGE, Brasil, sem recálculo. Mede quanto os preços mudaram, não quanto custa uma cesta em reais nem se a renda das famílias acompanha: o poder de compra não está integrado." />
      </SecaoComplementar>

      <section id="lacunas" aria-labelledby="lacunas-titulo" className="mt-12 border-t border-linha pt-8">
        <h2 id="lacunas-titulo" className="font-serif text-3xl">O que ainda falta medir</h2>
        <div className="mt-6 grid gap-7 md:grid-cols-3">
          {LACUNAS.map(([t, p]) => (
            <section key={t} className="border-t border-linha pt-5">
              <h3 className="font-serif text-2xl">{t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{p}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm">Não se estima um escore a partir das ações declaradas nem dos alunos registrados.</p>
        <Link href="/eficiencia-estatal/seguranca-alimentar/dados" className="mt-5 inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">Consultar ações declaradas na base municipal →</Link>
      </section>
    </>
  );
}
