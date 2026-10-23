import Link from "next/link";
import { PaginaPainel } from "@/components/painel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { anosDaMedida, MEDIDA } from "@/lib/eficiencia/consulta";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";
import { dataBr } from "@/lib/eficiencia/formato";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { CAMINHO_METODOS, DEFINICAO_TEMA, NAO_MOSTRA, ROTA_BASE, href, type Tema } from "@/lib/eficiencia/visao";
import { CaminhoCompararEducacao, ExploradorTema, FaixaTemaEducacao, ProvedorEducacao, SeletorCapitalTema } from "./ExploradorTema";

/** O que cada tema não permite concluir, com as palavras do aviso de leitura das referências (avisoDoGrupo) e da definição das medidas. */
const LIMITE: Record<Tema, string> = {
  gastos: "eficiência nem qualidade: menor gasto não demonstra eficiência, gasto maior não demonstra qualidade, e a despesa por matrícula é razão orçamentária, não custo do aluno.",
  atendimento: "qualidade nem cobertura da demanda: uma rede maior ou turmas menores não demonstram, por si, mais ou menos qualidade, e uma matrícula não é uma pessoa.",
  resultados: "o efeito da gestão municipal: o resultado reflete também o perfil socioeconômico dos estudantes e a trajetória de cada rede.",
};

const UNIDADE: Record<Tema, string> = {
  gastos: "reais correntes ou de 2025",
  atendimento: "matrículas e alunos por turma",
  resultados: "%, Ideb de 0 a 10 e pontos na escala Saeb",
};

/**
 * A página de um tema da Educação nas capitais (Gastos, Atendimento, Resultados) no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026), no mesmo modelo dos temas da Saúde nas capitais: a abertura sai do servidor (a pergunta do tema, a frase de abertura, o
 * recorte, o limite e a capital opcional como primeira ação); a família de medidas, os controles, as figuras, o detalhe e as referências
 * seguem o recorte da URL no ExploradorTema. A base vai ao navegador uma vez, pelo ProvedorEducacao. O layout do painel já abre o <main>.
 */
export function PaginaTemaEducacao({ tema }: { tema: Tema }) {
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
  const dados = dadosPainelTema(g, tema);
  const def = DEFINICAO_TEMA[tema];
  // só as fichas do tema vão ao navegador (antes ia o contexto de todas as fichas do painel)
  const todos = contextos(g);
  const ctx = Object.fromEntries(dados.fichas.filter((f) => todos[f.id]).map((f) => [f.id, todos[f.id]]));
  const anos = Array.from(new Set(def.medidas.flatMap((m) => anosDaMedida(dados, m)))).sort();
  // as fontes citadas pelas fichas das medidas do tema, na ordem das medidas e sem repetição
  const fontes = Array.from(new Set(def.medidas.flatMap((m) => dados.fichas.find((f) => f.id === MEDIDA[m].indicador)?.fontes ?? []).map((id) => dados.fontes[id]?.instituicao ?? id)));
  const link = "text-obee-dark underline underline-offset-4";
  return (
    <ProvedorEducacao dados={dados}>
      <PaginaPainel
        rota={`${ROTA_BASE}/${tema}`}
        principal={false}
        idioma="pt"
        abertura={{
          grupo: TEMAS_EFICIENCIA.educacao.nome,
          acento: "obee",
          titulo: def.pergunta,
          lead: def.abertura,
          acao: <SeletorCapitalTema tema={tema} />,
          recorte: {
            periodo: `${anos[0]} a ${anos[anos.length - 1]}, o período de cada medida ao lado dela`,
            universo: `${dados.capitais.length} capitais estaduais, educação municipal`,
            unidade: UNIDADE[tema],
            fonte: fontes.join(", "),
          },
          limite: LIMITE[tema],
          fontesDatasSiglas: (
            <>
              <p>Dados capturados até {dataBr(g.meta.dados_capturados_ate)}. Fontes, fichas de cada indicador, conferências e trilhas de reconstrução em <Link href={href(CAMINHO_METODOS)} className={link}>Fontes e metodologia</Link>.</p>
              <p>{NAO_MOSTRA[tema]}</p>
            </>
          ),
        }}
        faixaNumeros={<FaixaTemaEducacao tema={tema} />}
        navegacaoLocal={<CaminhoCompararEducacao tema={tema} />}
        figuras={<ExploradorTema tema={tema} contextos={ctx} />}
        metodo={
          <>
            <p>
              {def.pergunta} {def.abertura}
            </p>
            <p>
              Medida, ano, etapa, capital, valores (nominais ou reais de 2025), disciplina, grupo de comparação, ordem e escala ficam no endereço da página: o link copiado reabre o mesmo recorte. Cada medida tem a ficha, a trilha de
              fonte e a reconstrução em{" "}
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
