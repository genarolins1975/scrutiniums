import type { Metadata } from "next";
import Link from "next/link";
import { dadosAlimentares, fmtAlimentar } from "@/lib/eficiencia/alimentar/dados";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { numerosComplementares } from "@/components/eficiencia/alimentar/Complementos";
import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: tituloNaColecao("Segurança alimentar", "/eficiencia-estatal/seguranca-alimentar"),
  description: "Situação alimentar dos domicílios por estado, risco estimado entre famílias do Cadastro Único por município, alimentação escolar, compras da agricultura familiar, preço dos alimentos e atuação pública municipal, com fontes oficiais e critérios de avaliação dos serviços.",
  alternates: { canonical: "/eficiencia-estatal/seguranca-alimentar" },
};

const PERGUNTAS: [string, string, string][] = [
  ["necessidades", "Quais famílias enfrentam restrição alimentar?", "Quem passa fome no Brasil, por sexo, cor ou raça, escolaridade e trabalho da pessoa responsável, renda e moradores; EBIA nas regiões e nos 27 estados, urbano e rural, 2023 e 2024; risco estimado entre famílias do Cadastro Único em cada município, janeiro de 2025."],
  ["acesso", "Quem consegue receber a ação pública?", "Alunos e escolas da alimentação escolar desde 2009 e por município em 2025; inflação dos alimentos até setembro de 2026; ações declaradas na MUNIC."],
  ["qualidade", "A entrega cumpre o compromisso?", "Acompanhamento do estado nutricional na atenção primária em 2025; critérios e dados que ainda faltam para continuidade, espera e conformidade."],
  ["recursos", "Que recursos e estrutura existem?", "Repasses federais da alimentação escolar, compras do PAA à agricultura familiar de 2023 a 2025 e estrutura municipal declarada."],
  ["dados", "Quais são os registros de cada município?", "Dez variáveis da MUNIC, filtros por estado e município e base completa."],
  ["metodos", "De onde vêm os dados e como seriam os escores?", "Fichas de cada medida, fontes com hash, o que não foi integrado e por quê."],
];

export default function PanoramaAlimentar() {
  const g = dadosAlimentares();
  const c = dadosComplementares();
  const n = numerosComplementares(c);
  const br = g.needs.find((r) => r.territory === "Brasil" && r.year === 2024)!;
  const numeros: [string, string, string][] = [
    [fmtAlimentar(br.insecure) + "%", "dos domicílios com insegurança alimentar", "Brasil · 2024 · IBGE, PNAD Contínua"],
    [n.cadinsan.valor, "de famílias do Cadastro Único em risco estimado de insegurança alimentar grave", n.cadinsan.nota],
    [n.pnae.valor, "de alunos registrados na alimentação escolar pública", n.pnae.nota],
    [n.ipca.valor, "de inflação da alimentação no domicílio", n.ipca.nota],
  ];
  return (
    <>
      <p className="rotulo text-obee">Segurança alimentar · Estado e cidadão</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight md:text-5xl">Alimentação adequada,<br />com acesso e continuidade.</h1>
      <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">
        A pesquisa domiciliar mostra a situação das famílias; o Cadastro Único estima o risco em cada município. Alimentação escolar, compras públicas e preços mostram por onde a comida chega. A avaliação do serviço exige saber quem recebeu, quando recebeu e se a entrega cumpriu os parâmetros.
      </p>
      <dl className="mt-8 grid gap-6 border-y border-linha py-6 sm:grid-cols-2 lg:grid-cols-4">
        {numeros.map(([v, nome, nota]) => (
          <div key={nome}>
            <dd className="font-serif text-4xl tabular-nums">{v}</dd>
            <dt className="mt-2 text-sm">{nome}</dt>
            <dd className="mt-1 text-xs text-carvao-muted">{nota}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Os quatro números têm universos diferentes: domicílios, famílias cadastradas, alunos registrados e preços. Não se somam nem se comparam entre si.
      </p>
      <EscoresServicos capitulo="food" />
      <section>
        <h2 className="font-serif text-3xl">Que pergunta você quer responder?</h2>
        <div className="mt-5 grid gap-x-8 md:grid-cols-2">
          {PERGUNTAS.map(([rota, p, texto]) => (
            <Link key={rota} href={`/eficiencia-estatal/seguranca-alimentar/${rota}`} className="block border-b border-linha py-5">
              <h3 className="font-serif text-xl">{p} <span aria-hidden="true">→</span></h3>
              <p className="mt-2 text-sm text-carvao-muted">{texto}</p>
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-8 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Cada medida tem seu período de referência, entre 2023 e setembro de 2026, e não descreve a situação atual. Ausência não é zero. Crescimento do número de beneficiários pode refletir maior necessidade; número de equipamentos, alunos registrados ou valor repassado não comprova qualidade do atendimento.
      </p>
    </>
  );
}
