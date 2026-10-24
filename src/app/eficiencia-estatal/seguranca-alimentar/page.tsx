import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { naturezaDaFicha, numerosComplementares } from "@/components/eficiencia/alimentar/Complementos";
import { MetodoAlimentar, siglasAlimentar } from "@/components/eficiencia/alimentar/PainelAlimentar";
import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: tituloNaColecao("Segurança alimentar", "/eficiencia-estatal/seguranca-alimentar"),
  description: "Situação alimentar dos domicílios por estado, risco estimado entre famílias do Cadastro Único por município, alimentação escolar, compras da agricultura familiar, preço dos alimentos e atuação pública municipal, com fontes oficiais e critérios de avaliação dos serviços.",
  alternates: { canonical: "/eficiencia-estatal/seguranca-alimentar" },
};

const ROTA = "/eficiencia-estatal/seguranca-alimentar";

const PERGUNTAS: [string, string, string][] = [
  ["necessidades", "Quais famílias enfrentam restrição alimentar?", "Quem passa fome no Brasil, por sexo, cor ou raça, escolaridade e trabalho da pessoa responsável, renda e moradores; EBIA nas regiões e nos 27 estados, urbano e rural, 2023 e 2024; risco estimado entre famílias do Cadastro Único em cada município, janeiro de 2025."],
  ["acesso", "Quem consegue receber a ação pública?", "Alunos e escolas da alimentação escolar desde 2009 e por município em 2025; inflação dos alimentos até setembro de 2026; ações declaradas na MUNIC."],
  ["qualidade", "A entrega cumpre o compromisso?", "Acompanhamento do estado nutricional na atenção primária em 2025; critérios e dados que ainda faltam para continuidade, espera e conformidade."],
  ["recursos", "Que recursos e estrutura existem?", "Repasses federais da alimentação escolar, compras do PAA à agricultura familiar de 2023 a 2025 e estrutura municipal declarada."],
  ["dados", "Quais são os registros de cada município?", "Dez variáveis da MUNIC, filtros por estado e município e base completa."],
  ["metodos", "De onde vêm os dados e como seriam os escores?", "Fichas de cada medida, fontes com hash, o que não foi integrado e por quê."],
];

/**
 * Panorama da Segurança alimentar no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os quatro números de
 * universos diferentes (domicílios, famílias cadastradas, alunos registrados e preços), cada um com a natureza que a gold declara, as
 * seis perguntas do tema como navegação e o método com a ficha de cada número. A proposta de escores do capítulo segue logo depois do
 * painel, como na Saúde e em Trabalho e renda, no <main> do layout.
 */
export default function PanoramaAlimentar() {
  const g = dadosAlimentares();
  const c = dadosComplementares();
  const n = numerosComplementares(c);
  const br = g.needs.find((r) => r.territory === "Brasil" && r.year === 2024)!;
  const numeros: NumeroProps[] = [
    { rotulo: "Domicílios com insegurança alimentar", valor: br.insecure, formato: "percentual", casas: 1, unidade: "%", periodo: "2024", recorte: "Brasil", fonte: "IBGE, PNAD Contínua", natureza: "OBSERVADO" },
    { rotulo: "Famílias do Cadastro Único em risco estimado de insegurança alimentar grave", valor: n.cadinsan.bruto, valorTexto: n.cadinsan.valor, unidade: "de famílias", periodo: "janeiro de 2025", recorte: "Brasil", fonte: "MDS, CadINSAN", natureza: naturezaDaFicha(c, "san.cadinsan.risco") },
    { rotulo: "Alunos registrados na alimentação escolar pública", valor: n.pnae.bruto, valorTexto: n.pnae.valor, unidade: "de alunos", periodo: "2025", recorte: "Brasil", fonte: "FNDE, PNAE", natureza: naturezaDaFicha(c, "san.pnae.alunos") },
    n.ipca.bruto === null
      ? { rotulo: "Inflação da alimentação no domicílio", valor: null, motivoAusencia: "O IBGE não publicou a variação do último mês da série.", unidade: "%", periodo: n.ipca.periodo, recorte: "Brasil", fonte: "IBGE, IPCA", natureza: "OBSERVADO" }
      : { rotulo: "Inflação da alimentação no domicílio", valor: n.ipca.bruto, valorTexto: n.ipca.valor, unidade: "", periodo: n.ipca.periodo, recorte: "Brasil", fonte: "IBGE, IPCA", natureza: naturezaDaFicha(c, "san.ipca.alimentacao") },
  ];
  return (
    <>
      <PaginaPainel
        rota={ROTA}
        principal={false}
        idioma="pt"
        abertura={{
          grupo: TEMAS_EFICIENCIA.alimentacao.nome,
          acento: "obee",
          titulo: "Alimentação adequada, com acesso e continuidade.",
          lead: "A pesquisa domiciliar mostra a situação das famílias; o Cadastro Único estima o risco em cada município. Alimentação escolar, compras públicas e preços mostram por onde a comida chega.",
          recorte: { periodo: "entre 2023 e setembro de 2026, conforme a medida", universo: "Brasil, domicílios, famílias cadastradas, alunos e preços", fonte: "IBGE; MDS; FNDE" },
          limite: "a qualidade do atendimento. A avaliação do serviço exige saber quem recebeu, quando recebeu e se a entrega cumpriu os parâmetros; número de equipamentos, alunos registrados ou valor repassado não comprova qualidade do atendimento.",
          fontesDatasSiglas: siglasAlimentar(c, [["EBIA", "Escala Brasileira de Insegurança Alimentar"], ["CadINSAN", "estimativa de risco de insegurança alimentar grave no Cadastro Único, do MDS"], ["PNAE", "Programa Nacional de Alimentação Escolar"], ["PAA", "Programa de Aquisição de Alimentos"], ["IPCA", "Índice Nacional de Preços ao Consumidor Amplo"], ["MUNIC", "Pesquisa de Informações Básicas Municipais, do IBGE"]]),
        }}
        numeros={numeros}
        notaNumeros="Os quatro números têm universos diferentes: domicílios, famílias cadastradas, alunos registrados e preços. Não se somam nem se comparam entre si. Cada medida tem seu período de referência, entre 2023 e setembro de 2026, e não descreve a situação atual. Ausência não é zero. Crescimento do número de beneficiários pode refletir maior necessidade."
        navegacaoLocal={
          <nav aria-labelledby="perguntas-alimentar" className="mt-8">
            <h2 id="perguntas-alimentar" className="t-h2 text-carvao">Que pergunta você quer responder?</h2>
            <ul className="mt-2 grid gap-x-12 md:grid-cols-2">
              {PERGUNTAS.map(([rota, p, texto]) => (
                <li key={rota} className="border-b border-linha py-4">
                  <h3 className="t-h3">
                    <Link href={`${ROTA}/${rota}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                      {p} <span aria-hidden="true">→</span>
                    </Link>
                  </h3>
                  <p className="t-meta mt-1 text-carvao-muted">{texto}</p>
                </li>
              ))}
            </ul>
          </nav>
        }
        metodo={<MetodoAlimentar c={c} g={g} pnad fichas={["san.cadinsan.risco", "san.pnae.alunos", "san.ipca.alimentacao"]} />}
      />
      <EscoresServicos capitulo="food" />
    </>
  );
}
