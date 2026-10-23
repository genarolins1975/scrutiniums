import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { CaminhosSaude, FigurasPanoramaSaude, SeletorCapitalSaude } from "@/components/eficiencia/saude/PanoramaSaude";
import { ProvedorSaude } from "@/components/eficiencia/saude/ExploradorSaude";
import { GRUPOS, OPCOES_PANORAMA } from "@/lib/eficiencia/saude/molde";
import { SIGLAS_POR_TEMA } from "@/components/eficiencia/saude/AvisosSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { IndiceSaude, anosDaMedida, comparar } from "@/lib/eficiencia/saude/consulta";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";
import { MEDIDAS_SAUDE, ROTULO_PERIODO, type MedidaSaudeId } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_METODOS, ROTA_SAUDE, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { dataBr } from "@/lib/eficiencia/formato";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Saúde nas capitais", "/eficiencia-estatal/saude-capitais"),
  description: "Recursos aplicados pelo município, estrutura e atenção primária registradas e resultados observados entre os moradores das 26 capitais estaduais, com referências e limites de cada número.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais" },
};

/** Um número por perímetro na faixa: a mediana das capitais na medida principal de cada um, com o formato da medida. */
const NA_FAIXA: { id: MedidaSaudeId; formato: "reais" | "decimal" | "percentual" }[] = [
  { id: "despesa_hab", formato: "reais" },
  { id: "cobertura_aps", formato: "percentual" },
  { id: "icsap_taxa", formato: "decimal" },
];

/**
 * Panorama: a entrada do módulo, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). Nenhuma capital vem selecionada; a
 * abertura traz a pergunta, os três perímetros e a capital opcional (?cap=), a faixa traz a mediana das capitais num número de cada
 * perímetro, e as figuras trazem cada medida com menor valor, mediana e maior valor. O layout do módulo já abre o <main>.
 */
export default function PaginaPanoramaSaude() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  const dados = dadosSaude(g, "panorama");
  const ix = new IndiceSaude(dados);
  // a faixa lê os mesmos resumos que as figuras desenham (comparar, com as opções fixas do panorama): nenhum número é calculado à parte
  const numeros: NumeroProps[] = NA_FAIXA.map(({ id, formato }) => {
    const m = MEDIDAS_SAUDE[id];
    const anos = anosDaMedida(ix, m, OPCOES_PANORAMA);
    const ano = anos[anos.length - 1];
    const c = comparar(ix, m, ano, OPCOES_PANORAMA, "todas", null, "alfabetica");
    const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
    const fonte = dados.fontes[ficha.fontes[0]]?.nome ?? ficha.fontes[0];
    // em reais, o símbolo já vem no valor: a unidade ao lado diz o resto ("por habitante por ano, reais correntes")
    const unidade = formato === "reais" ? "por habitante por ano, reais correntes" : m.unidade("nominal");
    const base = { rotulo: m.rotulo, formato, unidade, periodo: ROTULO_PERIODO[m.periodo](ano), recorte: "mediana das capitais", fonte, natureza: "CALCULADO" as const };
    const med = c.ref?.mediana ?? null;
    return med === null
      ? { ...base, valor: null, motivoAusencia: "Nenhuma capital tem valor comparável neste período." }
      : { ...base, valor: med, valorTexto: m.formata(med), nota: `${c.ref!.n} de ${c.noGrupo} capitais na comparação.` };
  });
  const anos = Array.from(new Set(GRUPOS.flatMap((x) => x.medidas).flatMap((id) => anosDaMedida(ix, MEDIDAS_SAUDE[id], OPCOES_PANORAMA)))).sort();
  return (
    // a base vai ao navegador uma vez, pelo provedor; as três ilhas de cliente a leem dele (ver ProvedorSaude)
    <ProvedorSaude dados={dados}>
    <PaginaPainel
      rota={ROTA_SAUDE}
      principal={false}
      idioma="pt"
      abertura={{
        grupo: TEMAS_EFICIENCIA.saude.nome,
        acento: "obee",
        titulo: "Quanto se aplica em Saúde e o que se observa nas capitais?",
        lead: "Quanto as capitais aplicam em Saúde, que estrutura e atendimento são registrados e quais resultados são observados entre seus moradores, em três perímetros diferentes.",
        acao: <SeletorCapitalSaude />,
        recorte: {
          periodo: `${anos[0]} a ${anos[anos.length - 1]}, o ano de cada medida ao lado dela`,
          universo: `${dados.capitais.length} capitais estaduais, sem o Distrito Federal`,
          unidade: "reais, percentuais e taxas por habitante",
          fonte: "Siconfi, SIOPS, CNES, Relatório APS e RIPSA",
        },
        limite: "que o resultado seja causado exclusivamente pela gestão municipal, nem que a rede registrada pertença à prefeitura ou funcione de fato.",
        fontesDatasSiglas: (
          <>
            <p>
              {dados.capitais.length} capitais estaduais; o Distrito Federal fica fora porque a saúde distrital reúne competências de estado e de município (motivo completo em{" "}
              <Link href={hrefSaude(CAMINHO_METODOS)} className="text-obee-dark underline underline-offset-4">Dados e métodos</Link>). Dados capturados até {dataBr(dados.meta.dados_capturados_ate)}.
            </p>
            <p>As siglas estão em &quot;Siglas desta página&quot;, logo antes do método.</p>
          </>
        ),
      }}
      numeros={numeros}
      notaNumeros="Três perímetros diferentes: o que o município executa, o que está registrado no território e o que se observa entre os moradores. Os números não se somam nem formam uma nota."
      navegacaoLocal={<CaminhosSaude />}
      figuras={<FigurasPanoramaSaude contextos={contextosSaude(g)} />}
      notas={{ id: "siglas-panorama-saude", titulo: "Siglas desta página", itens: SIGLAS_POR_TEMA.panorama.map(([s, t]) => ({ termo: s, definicao: t })) }}
      metodo={
        <>
          {GRUPOS.map((x, k) => (
            <p key={x.id}>
              <span className="font-medium text-carvao">
                Perímetro {k + 1} de 3, {x.titulo}.
              </span>{" "}
              {x.pergunta} Permite mostrar: {x.mostra} Não permite presumir: {x.naoPresume}
            </p>
          ))}
          <p>
            Valores nominais e população do Ministério da Saúde no denominador; as visões de cada tema trocam para reais de 2025 e para a população do IBGE. Cada medida tem a trilha de fonte e de
            reconstrução em <Link href={hrefSaude(CAMINHO_METODOS)} className="text-obee-dark underline underline-offset-4">Dados e métodos</Link>.
          </p>
        </>
      }
    />
    </ProvedorSaude>
  );
}
