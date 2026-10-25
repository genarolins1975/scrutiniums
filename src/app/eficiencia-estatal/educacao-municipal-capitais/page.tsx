import { LaboratoriosCapitais } from "@/components/eficiencia/LaboratoriosCapitais";
import type { Metadata } from "next";
import Link from "next/link";
import { statSync } from "node:fs";
import { join } from "node:path";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { PanoramaInterativo, SeletorCapitalPanorama } from "@/components/eficiencia/PanoramaInterativo";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Indice, formata } from "@/lib/eficiencia/consulta";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import { dataBr, decimal } from "@/lib/eficiencia/formato";
import { montaPanorama } from "@/lib/eficiencia/panorama";
import type { FonteFicha } from "@/lib/eficiencia/proveniencia";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, ROTA_BASE as ROTA_EDUCACAO_CAPITAIS, href } from "@/lib/eficiencia/visao";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Educação nas capitais", "/eficiencia-estatal/educacao-municipal-capitais"),
  description: "Recursos, atendimento e resultados da educação municipal nas 26 capitais estaduais, com referências para entender cada número.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais" },
};

const ARQUIVO_GOLD = "/eficiencia/gold/educacao_capitais.json";

/** Unidade ao lado do número da faixa (em reais, o símbolo já vem no valor). */
const UNIDADE_FAIXA: Record<string, string> = { despesa_hab: "por habitante, reais correntes", atu: "alunos por turma", ideb: "índice de 0 a 10" };

/** Tamanho do arquivo de dados completo, para quem decide baixar saber o que vem (lido na geração da página). */
function tamanhoDoArquivo(): string {
  try {
    return `${decimal(statSync(join(process.cwd(), "public", ARQUIVO_GOLD)).size / 1_000_000, 1)} MB`;
  } catch {
    return "tamanho não verificado";
  }
}

/**
 * Panorama: a entrada padrão, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). Nenhuma capital vem selecionada; a
 * abertura traz a pergunta, o recorte, o limite e a capital opcional (?cap=), a faixa traz a mediana das capitais nos três capítulos, e
 * as figuras trazem os capítulos de Recursos, Atendimento e Resultados. O layout do painel já abre o <main>.
 */
export default function PaginaPanorama() {
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
  const dados = dadosPainel(g);
  const capitulos = montaPanorama(dados, new Indice(dados));
  const ctx = contextos(g);
  const usados = new Set(capitulos.flatMap((c) => c.medidas.map((m) => m.indicador)));
  const fichas = Object.fromEntries(dados.fichas.filter((f) => usados.has(f.id)).map((f) => [f.id, { ficha: f, ctx: ctx[f.id] }]));
  const fontes: Record<string, FonteFicha> = Object.fromEntries(
    Object.entries(dados.fontes).map(([id, f]) => [id, { nome: `${f.instituicao}, ${f.conjunto}`, orgao: f.instituicao, conjunto: f.conjunto, url: f.pagina, capturado_em: f.capturado_em }]),
  );
  const capitais = dados.capitais.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf }));
  // a faixa: a mediana das capitais na medida que abre cada capítulo (a mesma que a figura desenha), com o formato do painel
  const numeros: NumeroProps[] = capitulos.map((c) => {
    const r = c.id === "gastos" ? (c.medidas.find((m) => m.medida === "despesa_hab") ?? c.medidas[0]) : c.medidas[0];
    const ficha = dados.fichas.find((f) => f.id === r.indicador);
    const fonte = ficha ? (dados.fontes[ficha.fontes[0]]?.instituicao ?? ficha.fontes[0]) : "OBEE";
    const base = { rotulo: ficha?.nome ?? r.rotulo, unidade: UNIDADE_FAIXA[r.medida] ?? r.eixo, periodo: String(r.ano), recorte: "mediana das capitais", fonte, natureza: "CALCULADO" as const };
    const med = r.referencia?.mediana ?? null;
    return med === null
      ? { ...base, valor: null, motivoAusencia: "Nenhuma capital tem dado comparável para esta medida neste período." }
      : { ...base, valor: med, valorTexto: formata(r.medida, med), formato: r.medida.startsWith("despesa") ? ("reais" as const) : ("decimal" as const), nota: r.contexto };
  });
  const baixar = { href: ARQUIVO_GOLD, detalhe: `arquivo JSON com todas as observações do painel, ${tamanhoDoArquivo()}` };
  const link = "text-obee-dark underline underline-offset-[3px]";
  return (
    <PaginaPainel
      rota={ROTA_EDUCACAO_CAPITAIS}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.educacao.nome,
        acento: "obee",
        titulo: "Quanto se gasta, quem é atendido e com que resultados?",
        // painel canônico da eficiência nas capitais; o Ideb e as matrículas de todos os municípios ficam no painel da coleção (20/10/2026)
        lead: (
          <>
            Recursos, atendimento e resultados da educação municipal nas capitais estaduais. Para os demais municípios, o Ideb, a aprendizagem, a aprovação e as matrículas da escola pública estão em{" "}
            <Link href="/educacao-municipal" className={link}>
              Educação nos municípios
            </Link>
            .
          </>
        ),
        acao: <SeletorCapitalPanorama capitais={capitais} />,
        recorte: {
          periodo: `dados capturados até ${dataBr(g.meta.dados_capturados_ate)}, anos de referência indicados em cada indicador`,
          universo: `${g.universo.capitais.length} capitais estaduais, educação municipal`,
          unidade: "reais, alunos por turma e Ideb",
          fonte: "Siconfi, Censo Escolar e Ideb",
        },
        limite: "causalidade entre gasto e resultado, porque gasto e resultados têm universos e períodos próprios.",
      }}
      numeros={numeros}
      notaNumeros="Cada número tem o seu ano e o seu universo; os três não se somam nem formam uma nota."
      navegacaoLocal={
        <p className="mt-6">
          <Link href={href(CAMINHO_COMPARAR)} className="inline-flex min-h-[44px] items-center text-[0.9375rem] text-obee-dark underline underline-offset-4">
            Comparar capitais <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </p>
      }
      figuras={<><PanoramaInterativo capitulos={capitulos} capitais={capitais} fichas={fichas} fontes={fontes} /><LaboratoriosCapitais dados={dados} contextos={ctx} /></>}
      metodo={
        <>
          <p>Gasto e resultados têm universos e períodos próprios. A leitura conjunta não demonstra causalidade.</p>
          <p>
            <a href={baixar.href} download className={link}>
              Baixar dados ({baixar.detalhe})
            </a>
            . <Link href={href(CAMINHO_METODOS)} className={link}>Fontes e metodologia</Link> trazem a ficha de cada indicador, as conferências e as trilhas de reconstrução.
          </p>
        </>
      }
    />
  );
}
