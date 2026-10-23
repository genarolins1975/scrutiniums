import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { dadosComplementares, int } from "@/lib/eficiencia/alimentar/complementos";
import { reaisExtenso } from "@/lib/eficiencia/formato";
import { ConsultaMunicipalAlimentar } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { FiguraPnaeRepasses, PaaEstados, anosPnae, naturezaDaFicha } from "@/components/eficiencia/alimentar/Complementos";
import { MetodoAlimentar, NavegacaoAlimentar, siglasAlimentar } from "@/components/eficiencia/alimentar/PainelAlimentar";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Recursos e estrutura de segurança alimentar" };

const ROTA = "/eficiencia-estatal/seguranca-alimentar/recursos";

const MUNIC: [string, string][] = [
  ["Gestão e participação", "Órgão gestor e existência de conselho são informações institucionais. Não demonstram funcionamento efetivo, participação ou resolução de demandas."],
  ["Equipamentos", "Responsabilidade municipal pode incluir parcerias. Quantidade não mede pessoas atendidas, conformidade nutricional ou continuidade real da operação."],
  ["Orçamento", "A variável pergunta sobre destinação de orçamento em 2023. Não informa valor gasto, execução financeira ou custo por atendimento."],
];

/**
 * Recursos e estrutura no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os números do Brasil (repasses do
 * PNAE em 2025, agricultores fornecedores e valor pago pelo PAA no último ano), o índice da página, a figura dos repasses com a tabela por
 * estado, as tabelas do PAA e a consulta por município, à vista como antes, e a estrutura municipal declarada no glossário do ponto de uso.
 */
export default function Recursos() {
  const c = dadosComplementares();
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const pnae = c.pnae.linhas.find((l) => l.territorio === "BR" && l.rede === "todas" && l.ano === 2025)!;
  const anoPaa = Object.keys(c.paa).sort().at(-1)!;
  const paa = c.paa[anoPaa].brasil;
  const cobPaa = `Soma dos ${int(paa.fornecedores.municipios_com_dado)} de ${int(paa.municipios_universo)} municípios com o campo preenchido.`;
  const numeros: NumeroProps[] = [
    pnae.repasse === null
      ? { rotulo: "Repasses federais do PNAE", valor: null, motivoAusencia: "Nenhuma entidade executora tem valor de repasse informado em 2025.", unidade: "R$ nominais", periodo: "2025", recorte: "Brasil", fonte: "FNDE, PNAE", natureza: naturezaDaFicha(c, "san.pnae.repasses") }
      : { rotulo: "Repasses federais do PNAE", valor: pnae.repasse, valorTexto: reaisExtenso(pnae.repasse), unidade: "nominais", periodo: "2025", recorte: "Brasil", fonte: "FNDE, PNAE", natureza: naturezaDaFicha(c, "san.pnae.repasses"), nota: `Em ${int(pnae.entidades_com_repasse)} de ${int(pnae.entidades)} entidades executoras com valor informado.` },
    paa.fornecedores.soma === null
      ? { rotulo: "Agricultores familiares fornecedores do PAA", valor: null, motivoAusencia: "Sem dado no extrato do MDS para o ano.", unidade: "agricultores", periodo: anoPaa, recorte: "Brasil", fonte: "MDS, PAA", natureza: naturezaDaFicha(c, "san.paa.fornecedores") }
      : { rotulo: "Agricultores familiares fornecedores do PAA", valor: paa.fornecedores.soma, formato: "inteiro", unidade: "agricultores", periodo: anoPaa, recorte: "Brasil", fonte: "MDS, PAA", natureza: naturezaDaFicha(c, "san.paa.fornecedores"), nota: cobPaa },
    paa.pagamentos.soma === null
      ? { rotulo: "Valor pago aos fornecedores do PAA", valor: null, motivoAusencia: "Sem dado no extrato do MDS para o ano.", unidade: "R$ nominais", periodo: anoPaa, recorte: "Brasil", fonte: "MDS, PAA", natureza: naturezaDaFicha(c, "san.paa.pagamentos") }
      : { rotulo: "Valor pago aos fornecedores do PAA", valor: paa.pagamentos.soma, valorTexto: reaisExtenso(paa.pagamentos.soma), unidade: "nominais", periodo: anoPaa, recorte: "Brasil", fonte: "MDS, PAA", natureza: naturezaDaFicha(c, "san.paa.pagamentos"), nota: cobPaa },
  ];
  return (
    <PaginaPainel
      rota={ROTA}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.alimentacao.nome,
        acento: "obee",
        titulo: "A capacidade instalada no território.",
        lead: "Dinheiro federal para a alimentação escolar, compras públicas de alimentos da agricultura familiar e a estrutura municipal declarada.",
        recorte: { periodo: `${anosPnae(c)[0]} a ${anosPnae(c).at(-1)}, em curso (PNAE); ${Object.keys(c.paa).sort()[0]} a ${anoPaa} (PAA); 2023 (MUNIC)`, universo: "Brasil, estados e municípios", unidade: "R$ nominais e agricultores fornecedores", fonte: "FNDE, PNAE; MDS, PAA; IBGE, MUNIC" },
        limite: "que a comida chegou a quem precisa. São recursos e condições de oferta, usados como contexto: nenhum deles mede, sozinho, a comida que chegou a quem precisa.",
        fontesDatasSiglas: siglasAlimentar(c, [["PNAE", "Programa Nacional de Alimentação Escolar"], ["FNDE", "Fundo Nacional de Desenvolvimento da Educação"], ["PAA", "Programa de Aquisição de Alimentos"], ["MDS", "Ministério do Desenvolvimento e Assistência Social"], ["MUNIC", "Pesquisa de Informações Básicas Municipais, do IBGE"]]),
      }}
      numeros={numeros}
      notaNumeros="Valores nominais, sem correção pela inflação. Transferência federal e valor pago aos agricultores não são a despesa total com alimentação nem a quantidade de alimentos entregue."
      navegacaoLocal={<NavegacaoAlimentar itens={[["#pnae-repasses", "Repasses da alimentação escolar"], ["#paa", "Compras da agricultura familiar"], ["#municipio", "No seu município"], ["#estrutura", "Estrutura municipal declarada"]]} />}
      figuras={
        <FiguraPnaeRepasses
          c={c}
          contexto={<p>O FNDE transfere recursos do PNAE a cada prefeitura e secretaria estadual de educação, calculados pelo número de alunos e pela etapa de ensino. Prefeituras e estados completam com recursos próprios, que não aparecem aqui.</p>}
        />
      }
      tabelas={
        <>
          <PaaEstados
            c={c}
            id="paa"
            titulo="Quanto o poder público compra da agricultura familiar para doar?"
            contexto={<p>No Programa de Aquisição de Alimentos (PAA), o poder público compra alimentos de agricultores familiares e os doa a pessoas em insegurança alimentar e a entidades da rede socioassistencial. Os registros do MDS contam os agricultores que forneceram e o valor pago a eles em cada ano.</p>}
          />
          <ConsultaMunicipalAlimentar tema="recursos" ufs={ufs} />
        </>
      }
      notas={{
        id: "estrutura",
        titulo: "Estrutura municipal declarada",
        itens: MUNIC.map(([t, p]) => ({ termo: t, definicao: p })),
        nota: (
          <>
            A MUNIC inclui órgão gestor, conselho, destinação orçamentária e existência e quantidade de restaurantes populares e cozinhas comunitárias sob responsabilidade municipal. São dados declarados pela gestão, usados como contexto. Essas variáveis, os repasses e as compras não geram pontos automáticos no escore de serviço.{" "}
            <Link href="/eficiencia-estatal/seguranca-alimentar/dados" className="inline-flex min-h-[44px] items-center text-obee-dark underline">Explorar registros de equipamentos e gestão →</Link>
          </>
        ),
      }}
      metodo={<MetodoAlimentar c={c} fichas={["san.pnae.repasses", "san.paa.fornecedores", "san.paa.pagamentos"]} />}
    />
  );
}
