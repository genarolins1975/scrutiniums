import type { Metadata } from "next";
import Link from "next/link";
import { ComparadorSaude, FaixaCompararSaude, TabelaCompletaSaude } from "@/components/eficiencia/saude/ComparadorSaude";
import { ProvedorSaude } from "@/components/eficiencia/saude/ExploradorSaude";
import { PERIMETRO_DO_TEMA, SIGLAS_POR_TEMA } from "@/components/eficiencia/saude/AvisosSaude";
import { PaginaPainel } from "@/components/painel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, ROTA_SAUDE, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { dataBr } from "@/lib/eficiencia/formato";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Comparar capitais em Saúde",
  description: "Compare duas capitais na mesma medida de Saúde e no mesmo período, veja a distribuição das 26 e baixe a tabela completa com as referências e as ressalvas.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/comparar" },
};

/**
 * Comparar capitais em Saúde no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a abertura sai do servidor (a pergunta que
 * vinha sob o título, encurtada para os 60 caracteres do H1, a frase da página, o recorte e o limite); a faixa das capitais escolhidas, as
 * figuras e a tabela completa seguem o recorte da URL em três ilhas de cliente, com a base uma vez só no ProvedorSaude. O layout do módulo
 * já abre o <main>.
 */
export default function PaginaComparar() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  const dados = dadosSaude(g, "comparar");
  const todos = contextosSaude(g);
  // só as fichas desta página levam o contexto ao navegador
  const ctx = Object.fromEntries(dados.fichas.filter((f) => todos[f.id]).map((f) => [f.id, todos[f.id]]));
  const fontes = Array.from(new Set(dados.fichas.flatMap((f) => f.fontes).map((id) => (dados.fontes[id]?.nome ?? id).split(", ")[0])));
  const link = "text-obee-dark underline underline-offset-4";
  return (
    // a base vai ao navegador uma vez, pelo provedor; as três ilhas de cliente a leem dele
    <ProvedorSaude dados={dados}>
      <PaginaPainel
        rota={`${ROTA_SAUDE}${CAMINHO_COMPARAR}`}
        principal={false}
        idioma="pt"
        abertura={{
          grupo: TEMAS_EFICIENCIA.saude.nome,
          acento: "obee",
          titulo: "Como cada capital se situa na mesma medida e período?",
          lead: "Compare duas capitais na mesma medida de Saúde e no mesmo período, veja a distribuição das 26 e baixe a tabela completa com as referências e as ressalvas.",
          recorte: {
            periodo: "o período escolhido de cada medida, o mesmo para as duas capitais",
            universo: `${dados.capitais.length} capitais estaduais, sem o Distrito Federal`,
            unidade: "a unidade de cada medida",
            fonte: fontes.join(", "),
          },
          limite: "classificação nem causa: a diferença entre duas capitais é descritiva, e cada medida tem o seu perímetro (gasto do município, cadastro no território ou internações dos moradores).",
          fontesDatasSiglas: (
            <>
              <p>
                Perímetros: {(["gastos", "rede", "resultados"] as const).map((t) => `${PERIMETRO_DO_TEMA[t].rotulo.toLowerCase()} (${PERIMETRO_DO_TEMA[t].texto})`).join("; ")}.{" "}
                <a href={`${hrefSaude(CAMINHO_METODOS)}#perimetros`} className={link}>
                  Os três perímetros
                </a>
                .
              </p>
              <p>Dados capturados até {dataBr(dados.meta.dados_capturados_ate)}. As siglas estão em &quot;Siglas desta página&quot;, logo antes do método.</p>
            </>
          ),
        }}
        faixaNumeros={<FaixaCompararSaude />}
        figuras={<ComparadorSaude contextos={ctx} />}
        tabelas={<TabelaCompletaSaude />}
        notas={{ id: "siglas-comparar", titulo: "Siglas desta página", itens: SIGLAS_POR_TEMA.comparar.map(([s, d]) => ({ termo: s, definicao: d })) }}
        metodo={
          <>
            <p>Nada muda de competência entre uma capital e outra; a diferença é descritiva, sem classificação.</p>
            <p>
              Medida, período, capitais A e B, valores (nominais ou reais de 2025), população do denominador e ordem da tabela ficam no endereço da página: o link copiado reabre o mesmo recorte. Cada medida tem a ficha, a trilha de
              fonte e a reconstrução em{" "}
              <Link href={hrefSaude(CAMINHO_METODOS)} className={link}>
                Dados e métodos
              </Link>
              .
            </p>
          </>
        }
      />
    </ProvedorSaude>
  );
}
