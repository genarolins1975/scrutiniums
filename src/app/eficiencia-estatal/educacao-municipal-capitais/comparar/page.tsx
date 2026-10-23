import type { Metadata } from "next";
import Link from "next/link";
import { ComparadorCapitais, TabelaComparativaPainel } from "@/components/eficiencia/ComparadorCapitais";
import { ProvedorEducacao } from "@/components/eficiencia/ExploradorTema";
import { PaginaPainel } from "@/components/painel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";
import { dataBr } from "@/lib/eficiencia/formato";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, ROTA_BASE, href } from "@/lib/eficiencia/visao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Comparar capitais",
  description: "As 26 capitais estaduais numa escala comum, com destaque de poucas cidades, tabela completa e referências do grupo.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/comparar" },
};

/**
 * Comparar capitais no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a abertura sai do servidor (a pergunta, a frase de
 * antes, o recorte e o limite que fechava a página); a figura da comparação e a tabela completa das capitais são duas ilhas de cliente que
 * seguem o recorte da URL, com a base uma vez só no ProvedorEducacao. O layout do painel já abre o <main>.
 */
export default function PaginaComparar() {
  const g = goldEducacao();
  if (!g) {
    return (
      <Indisponivel
        titulo="Painel indisponível"
        motivo="A base do painel não foi encontrada nesta publicação. Nenhum número é exibido no lugar."
        faltante={["public/eficiencia/gold/educacao_capitais.json"]}
      />
    );
  }
  const dados = dadosPainelTema(g, "comparar");
  const todos = contextos(g);
  const ctx = Object.fromEntries(dados.fichas.filter((f) => todos[f.id]).map((f) => [f.id, todos[f.id]]));
  const fontes = Array.from(new Set(dados.fichas.flatMap((f) => f.fontes).map((id) => dados.fontes[id]?.instituicao ?? id)));
  const link = "text-obee-dark underline underline-offset-4";
  return (
    <ProvedorEducacao dados={dados}>
      <PaginaPainel
        rota={`${ROTA_BASE}${CAMINHO_COMPARAR}`}
        principal={false}
        idioma="pt"
        abertura={{
          grupo: TEMAS_EFICIENCIA.educacao.nome,
          acento: "obee",
          titulo: "Como cada capital se situa na mesma medida?",
          lead: "As 26 capitais numa escala comum. Destaque até 5 sem perder o conjunto; ordene por valor se quiser.",
          recorte: {
            periodo: `o ano escolhido de cada medida; dados capturados até ${dataBr(g.meta.dados_capturados_ate)}`,
            universo: `${dados.capitais.length} capitais estaduais, educação municipal`,
            unidade: "a unidade de cada medida",
            fonte: fontes.join(", "),
          },
          limite: "classificação de eficiência: a ordem por valor é escolha de quem lê, média e mediana descrevem o grupo e não são meta, e menor gasto não demonstra eficiência nem gasto maior demonstra qualidade.",
          fontesDatasSiglas: (
            <p>
              Dados capturados até {dataBr(g.meta.dados_capturados_ate)}. Fichas de cada indicador, conferências e trilhas de reconstrução em <Link href={href(CAMINHO_METODOS)} className={link}>Fontes e metodologia</Link>.
            </p>
          ),
        }}
        figuras={<ComparadorCapitais contextos={ctx} />}
        tabelas={<TabelaComparativaPainel />}
        metodo={
          <>
            <p>Ordem por valor é escolha de quem lê e não é classificação de eficiência. Média e mediana descrevem o grupo e não são meta; menor gasto não demonstra eficiência e gasto maior não demonstra qualidade.</p>
            <p>
              Medida, ano, etapa, valores, disciplina, grupo, destaques, colunas e ordem ficam no endereço da página: o link copiado reabre o mesmo recorte. Fichas, conferências e reconstrução em{" "}
              <Link href={href(CAMINHO_METODOS)} className={link}>
                Fontes e metodologia
              </Link>
              .
            </p>
          </>
        }
      />
    </ProvedorEducacao>
  );
}
