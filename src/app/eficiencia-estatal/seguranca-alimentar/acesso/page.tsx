import Link from "next/link";
import type { Metadata } from "next";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { competencia, dadosComplementares, int, milhoes } from "@/lib/eficiencia/alimentar/complementos";
import { ConsultaMunicipalAlimentar } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { IpcaAlimentos } from "@/components/eficiencia/alimentar/IpcaAlimentos";
import { FiguraPnaeAtendimento, FonteDaMedida, anosPnae, naturezaDaFicha, numerosComplementares, provenienciaAlimentar } from "@/components/eficiencia/alimentar/Complementos";
import { MetodoAlimentar, NavegacaoAlimentar, siglasAlimentar } from "@/components/eficiencia/alimentar/PainelAlimentar";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Acesso e atendimento alimentar" };

const ROTA = "/eficiencia-estatal/seguranca-alimentar/acesso";

const LACUNAS: [string, string][] = [
  ["Alimentação escolar", "Integrados: alunos e escolas registrados no PNAE, acima. Ainda faltam dias letivos com alimentação efetivamente oferecida e refeições servidas; repasse e registro não comprovam entrega."],
  ["Refeições públicas", "População: pessoas elegíveis conforme o programa. Medir atendidos e barreiras de preço, distância e horário; capacidade não equivale a pessoas únicas. Sem base de atendimento integrada."],
  ["Auxílio alimentar", "População: famílias elegíveis conforme o programa. Medir atendimento e espera até a entrega, com protocolo para eliminar duplicidades entre modalidades. Sem base de atendimento integrada."],
];

/**
 * Acesso e atendimento alimentar no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os números do Brasil
 * (alunos e escolas do PNAE em 2025 e a inflação da alimentação no domicílio em 12 meses), o índice da página, as figuras da alimentação
 * escolar (com a tabela por estado e a consulta por município logo depois) e do preço dos alimentos, e o que ainda falta medir no glossário
 * do ponto de uso. O layout da Segurança alimentar já abre o <main>: o molde entra como <div>.
 */
export default function Acesso() {
  const c = dadosComplementares();
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const n = numerosComplementares(c);
  // competências publicadas do IPCA (AAAAMM), para o período da ficha e da abertura
  const ipca = [...new Set(c.ipca.map((p) => p.periodo))].sort();
  const pnae2025 = c.pnae.linhas.find((l) => l.territorio === "BR" && l.rede === "todas" && l.ano === 2025)!;
  const pnaeNat = naturezaDaFicha(c, "san.pnae.alunos");
  const numeros: NumeroProps[] = [
    { rotulo: "Alunos registrados na alimentação escolar pública", valor: pnae2025.alunos, valorTexto: milhoes(pnae2025.alunos), unidade: "de alunos", periodo: "2025", recorte: "Brasil, redes municipais e estaduais", fonte: "FNDE, PNAE", natureza: pnaeNat, nota: "Aluno registrado não comprova refeição servida nem pessoa única." },
    { rotulo: "Escolas registradas no PNAE", valor: pnae2025.escolas, formato: "inteiro", unidade: "escolas", periodo: "2025", recorte: "Brasil", fonte: "FNDE, PNAE", natureza: naturezaDaFicha(c, "san.pnae.escolas"), nota: `Nas ${int(pnae2025.entidades)} entidades executoras.` },
    n.ipca.bruto === null
      ? { rotulo: "Inflação da alimentação no domicílio", valor: null, motivoAusencia: "O IBGE não publicou a variação do último mês da série.", unidade: "%", periodo: n.ipca.periodo, recorte: "Brasil", fonte: "IBGE, IPCA", natureza: "OBSERVADO" }
      : { rotulo: "Inflação da alimentação no domicílio", valor: n.ipca.bruto, valorTexto: n.ipca.valor, unidade: "", periodo: n.ipca.periodo, recorte: "Brasil", fonte: "IBGE, IPCA", natureza: naturezaDaFicha(c, "san.ipca.alimentacao") },
  ];
  return (
    <PaginaPainel
      rota={ROTA}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.alimentacao.nome,
        acento: "obee",
        titulo: "A ação existe. Quem consegue recebê-la?",
        lead: "Dois caminhos de acesso aos alimentos têm dado nesta página: a alimentação escolar, pelos alunos registrados no PNAE, e o preço da comida, pela inflação dos alimentos no IPCA.",
        recorte: { periodo: `${anosPnae(c)[0]} a ${anosPnae(c).at(-1)}, em curso (PNAE); ${competencia(ipca[0], true)} a ${competencia(ipca.at(-1)!, true)} (IPCA)`, universo: "Brasil, estados e municípios", unidade: "alunos, escolas e % de variação", fonte: "FNDE, PNAE; IBGE, IPCA" },
        limite: "que a ação chegou a quem precisa. A MUNIC informa ainda se houve ações municipais de promoção do acesso em 2023; existência de ação não informa cobertura efetiva, demanda não atendida ou pessoas únicas.",
        fontesDatasSiglas: siglasAlimentar(c, [["PNAE", "Programa Nacional de Alimentação Escolar"], ["FNDE", "Fundo Nacional de Desenvolvimento da Educação"], ["IPCA", "Índice Nacional de Preços ao Consumidor Amplo"], ["MUNIC", "Pesquisa de Informações Básicas Municipais, do IBGE"]]),
      }}
      numeros={numeros}
      notaNumeros="Os números têm universos diferentes, alunos registrados e preços; não se somam nem se comparam entre si."
      navegacaoLocal={<NavegacaoAlimentar itens={[["#escolar", "Alimentação escolar"], ["#precos", "Preço dos alimentos"], ["#lacunas", "O que ainda falta medir"]]} />}
      figuras={
        <>
          <FiguraPnaeAtendimento
            c={c}
            contexto={<p>O Programa Nacional de Alimentação Escolar (PNAE) transfere recursos federais a prefeituras e secretarias estaduais de educação para as refeições dos alunos da rede pública. O FNDE registra, para cada entidade executora, os alunos e as escolas atendidos pelo programa em cada exercício.</p>}
            depois={<ConsultaMunicipalAlimentar tema="acesso" ufs={ufs} />}
          />
          <IpcaAlimentos
            pontos={c.ipca}
            rota={ROTA}
            proveniencia={provenienciaAlimentar(c, "san.ipca.alimentacao", { inicio: `${ipca[0].slice(0, 4)}-${ipca[0].slice(4, 6)}`, fim: `${ipca.at(-1)!.slice(0, 4)}-${ipca.at(-1)!.slice(4, 6)}` })}
            contexto={
              <p>
                O IPCA mede a variação dos preços ao consumidor. A alimentação no domicílio reúne os alimentos comprados para comer em casa. Para a inflação por cidade e por grupo de despesa, veja o painel{" "}
                <Link href="/custo-de-vida" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">Custo de vida</Link>.
              </p>
            }
            complemento={
              <>
                <FonteDaMedida c={c} fonteId="ibge-ipca-7060" ficha="san.ipca.alimentacao" periodo="janeiro de 2023 a setembro de 2026" unidade="% de variação" csv="ipca-alimentacao.csv"
                  ressalva="Variações publicadas pelo IBGE, Brasil, sem recálculo. Mede quanto os preços mudaram, não quanto custa uma cesta em reais nem se a renda das famílias acompanha: o poder de compra não está integrado." />
              </>
            }
          />
        </>
      }
      notas={{
        id: "lacunas",
        titulo: "O que ainda falta medir",
        itens: LACUNAS.map(([t, p]) => ({ termo: t, definicao: p })),
        nota: (
          <>
            Não se estima um escore a partir das ações declaradas nem dos alunos registrados.{" "}
            <Link href="/eficiencia-estatal/seguranca-alimentar/dados" className="inline-flex min-h-[44px] items-center text-obee-dark underline">Consultar ações declaradas na base municipal →</Link>
          </>
        ),
      }}
      metodo={<MetodoAlimentar c={c} fichas={["san.pnae.alunos", "san.pnae.escolas", "san.ipca.alimentacao"]} />}
    />
  );
}
