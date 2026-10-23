import Link from "next/link";
import { PaginaPainel } from "@/components/painel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { IndiceSaude, anosDaMedida } from "@/lib/eficiencia/saude/consulta";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";
import { MEDIDAS_SAUDE, TEMAS_SAUDE, type TemaSaude } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_METODOS, CAMINHO_TEMA, ROTA_SAUDE, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { dataBr } from "@/lib/eficiencia/formato";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { PERIMETRO_DO_TEMA, SIGLAS_POR_TEMA } from "./AvisosSaude";
import { CaminhoCompararSaude, ExploradorSaude, FaixaTemaSaude, ProvedorSaude } from "./ExploradorSaude";
import { TITULO_TEMA } from "@/lib/eficiencia/saude/molde";

/** O que cada tema não permite concluir, com as palavras do perímetro do tema (PERIMETRO_DO_TEMA e os blocos de detalhe). */
const LIMITE: Record<TemaSaude, string> = {
  gastos: "o gasto total com saúde no território, porque despesas da União e do estado e serviços privados e filantrópicos pagos por outras fontes não entram.",
  rede: "funcionamento, acesso ou vaga, porque o módulo mostra cadastro e capacidade registrada, não atendimento efetivo.",
  resultados: "que a prefeitura produziu o resultado, porque são internações dos moradores, onde quer que ocorram, e a taxa também depende de leitos, critérios de internação e registro.",
};

const UNIDADE: Record<TemaSaude, string> = {
  gastos: "reais e % da receita",
  rede: "estabelecimentos e equipes por 10 mil habitantes, % da população",
  resultados: "internações por 100 mil habitantes e % das internações",
};

/**
 * A página de um tema da Saúde nas capitais (Gastos, Rede e atenção primária, Atendimento e resultados) no molde de painel (Iniciativa 1
 * do parecer de UX de 23/10/2026): a abertura sai do servidor (pergunta, perímetro, recorte e limite); a faixa, os controles, as figuras e
 * os detalhes seguem o recorte da URL no ExploradorSaude. O layout do módulo já abre o <main>. Um só modelo para os três temas.
 */
export function PaginaTemaSaude({ tema }: { tema: TemaSaude }) {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  const dados = dadosSaude(g, tema);
  const ix = new IndiceSaude(dados);
  const def = TEMAS_SAUDE[tema];
  const anos = Array.from(new Set(def.medidas.flatMap((id) => anosDaMedida(ix, MEDIDAS_SAUDE[id], { moeda: "nominal", denominador: "ripsa" })))).sort();
  // as fontes citadas pelas fichas das medidas do tema, na ordem das medidas e sem repetição
  const fontes = Array.from(new Set(def.medidas.flatMap((id) => dados.fichas.find((f) => f.id === MEDIDAS_SAUDE[id].indicador)?.fontes ?? []).map((id) => (dados.fontes[id]?.nome ?? id).split(", ")[0])));
  const t = TITULO_TEMA[tema];
  const p = PERIMETRO_DO_TEMA[tema];
  const link = "text-obee-dark underline underline-offset-4";
  return (
    // a base vai ao navegador uma vez, pelo provedor; as três ilhas de cliente a leem dele (ver ProvedorSaude)
    <ProvedorSaude dados={dados}>
    <PaginaPainel
      rota={`${ROTA_SAUDE}${CAMINHO_TEMA[tema]}`}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.saude.nome,
        acento: "obee",
        titulo: t.h1,
        lead: t.lead,
        recorte: {
          periodo: `${anos[0]} a ${anos[anos.length - 1]}, o período de cada medida ao lado dela`,
          universo: `${dados.capitais.length} capitais estaduais, sem o Distrito Federal`,
          unidade: UNIDADE[tema],
          fonte: fontes.join(", "),
        },
        limite: LIMITE[tema],
        fontesDatasSiglas: (
          <>
            <p>
              <span className="font-medium">Perímetro: {p.rotulo}.</span> {p.texto.charAt(0).toUpperCase() + p.texto.slice(1)}.{" "}
              <a href={`${hrefSaude(CAMINHO_METODOS)}#perimetros`} className={link}>
                Os três perímetros
              </a>
              .
            </p>
            <p>Dados capturados até {dataBr(dados.meta.dados_capturados_ate)}. As siglas estão em &quot;Siglas desta página&quot;, logo antes do método.</p>
          </>
        ),
      }}
      faixaNumeros={<FaixaTemaSaude tema={tema} />}
      navegacaoLocal={<CaminhoCompararSaude tema={tema} />}
      figuras={<ExploradorSaude tema={tema} contextos={contextosSaude(g)} />}
      notas={{ id: `siglas-${tema}`, titulo: "Siglas desta página", itens: SIGLAS_POR_TEMA[tema].map(([s, d]) => ({ termo: s, definicao: d })) }}
      metodo={
        <>
          <p>
            {t.pergunta} Perímetro: {p.rotulo.toLowerCase()}, {p.texto}.
          </p>
          <p>
            Medida, período, capital, valores (nominais ou reais de 2025), população do denominador, grupo de comparação e ordem ficam no endereço da página: o link copiado reabre o mesmo
            recorte. Cada medida tem a ficha, a trilha de fonte e a reconstrução em{" "}
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
