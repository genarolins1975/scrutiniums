import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPainel, type NumeroProps } from "@/components/painel";
import { FigurasPanoramaSaude, SeletorCapitalSaude } from "@/components/eficiencia/saude/PanoramaSaude";
import { AtalhoCompararSaude, PerguntasSaude } from "@/components/eficiencia/saude/PerguntasSaude";
import { ModeloSaude } from "@/components/eficiencia/saude/ModeloSaude";
import { ReguasSaude } from "@/components/eficiencia/saude/ReguasSaude";
import { modeloSaude, naoPublicados, numeroSusUniao, perguntasSaude } from "@/components/eficiencia/saude/entradaSaude";
import { ProvedorSaude } from "@/components/eficiencia/saude/ExploradorSaude";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { GRUPOS, OPCOES_PANORAMA } from "@/lib/eficiencia/saude/molde";
import { SIGLAS_POR_TEMA } from "@/components/eficiencia/saude/AvisosSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { IndiceSaude, anosDaMedida, comparar, populacaoDoUniverso } from "@/lib/eficiencia/saude/consulta";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";
import { MEDIDAS_SAUDE, ROTULO_PERIODO, type MedidaSaudeId } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_METODOS, ROTA_SAUDE, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { dataBr, decimal, percentual } from "@/lib/eficiencia/formato";
import { TEMAS_EFICIENCIA } from "@/lib/eficiencia/temas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Saúde nas capitais", "/eficiencia-estatal/saude-capitais"),
  description: "Recursos aplicados pelo município, estrutura e atenção primária registradas e resultados observados entre os moradores das 26 capitais estaduais, com referências e limites de cada número.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais" },
};

/** Medidas da faixa lidas da mesma comparação que as réguas desenham, com a referência do Brasil na nota quando a fonte a traz. */
const NA_FAIXA: { id: MedidaSaudeId; formato: "reais" | "decimal" | "percentual" }[] = [
  { id: "despesa_hab", formato: "reais" },
  { id: "cobertura_aps", formato: "percentual" },
  { id: "icsap_taxa", formato: "decimal" },
];

/** As medidas que deixam a primeira leitura e seguem inteiras no recolhido "Outras medidas do panorama". */
const OUTRAS_MEDIDAS: MedidaSaudeId[] = ["asps_pct", "ubs_10mil", "esf_10mil", "icsap_part"];

/**
 * Panorama: a entrada do módulo, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), reorganizada pela checklist da
 * página de entrada (direção do coordenador de 24/11/2026, mock "01 · Saúde"): abertura com a pergunta do leitor e a capital opcional
 * (?cap=); quatro números (gasto por morador, parcela do SUS da União, cobertura da atenção primária e internações evitáveis) com a
 * ressalva única; o modelo didático do caminho do dinheiro; as réguas das 26 capitais e a evolução em reais de 2025; as demais
 * medidas recolhidas; as perguntas para começar; e o método, com o que o painel ainda não mede. O layout do módulo já abre o <main>.
 */
export default function PaginaPanoramaSaude() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  const dados = dadosSaude(g, "panorama");
  const ix = new IndiceSaude(dados);
  const modelo = modeloSaude(g);
  const perguntas = perguntasSaude(g, modelo);
  const fonteDe = (id: string) => {
    const ficha = dados.fichas.find((f) => f.id === id)!;
    return dados.fontes[ficha.fontes[0]]?.nome ?? ficha.fontes[0];
  };
  // a faixa lê os mesmos resumos que as réguas desenham (comparar, com as opções fixas do panorama): nenhum número é calculado à parte
  const medida = ({ id, formato }: (typeof NA_FAIXA)[number]): NumeroProps => {
    const m = MEDIDAS_SAUDE[id];
    const anos = anosDaMedida(ix, m, OPCOES_PANORAMA);
    const ano = anos[anos.length - 1];
    const comp = m.componente("nominal", "ripsa");
    const c = comparar(ix, m, ano, OPCOES_PANORAMA, "todas", null, "alfabetica");
    const brasil = ix.externas(m.indicador, comp, ano).find((e) => e.comparabilidade === "direta" && e.tipo !== "normativa");
    // em reais, o símbolo já vem no valor: a unidade ao lado diz o resto
    const unidade = formato === "reais" ? "por morador por ano, reais correntes" : m.unidade("nominal");
    const base = { rotulo: m.rotulo, formato, unidade, periodo: ROTULO_PERIODO[m.periodo](ano), recorte: "mediana das capitais", fonte: fonteDe(m.indicador), natureza: "CALCULADO" as const };
    const med = c.ref?.mediana ?? null;
    const nota = [`${c.ref?.n ?? 0} de ${c.noGrupo} capitais na comparação.`, brasil ? `${brasil.rotulo}: ${m.formata(brasil.valor)}.` : null].filter(Boolean).join(" ");
    return med === null ? { ...base, valor: null, motivoAusencia: "Nenhuma capital tem valor comparável neste período." } : { ...base, valor: med, valorTexto: m.formata(med), nota };
  };
  const sus = numeroSusUniao(modelo);
  const baseSus = { rotulo: "Parcela da despesa vinda do SUS da União", formato: "percentual" as const, unidade: "da despesa em saúde empenhada", periodo: `Exercício ${sus.ano}`, fonte: "SIOPS, despesa por fonte de recursos", natureza: "CALCULADO" as const };
  const numeroSus: NumeroProps =
    sus.valor === null
      ? { ...baseSus, valor: null, motivoAusencia: sus.motivo }
      : {
          ...baseSus,
          recorte: sus.escopo.toLowerCase(),
          valor: sus.valor,
          valorTexto: percentual(sus.valor, 1),
          nota: `Transferências fundo a fundo do Ministério da Saúde, sobre a despesa empenhada (não a liquidada da DCA).${sus.ressalva ? ` ${sus.ressalva}` : ""}`,
        };
  const numeros: NumeroProps[] = [medida(NA_FAIXA[0]), numeroSus, medida(NA_FAIXA[1]), medida(NA_FAIXA[2])];
  const anos = Array.from(new Set(GRUPOS.flatMap((x) => x.medidas).flatMap((id) => anosDaMedida(ix, MEDIDAS_SAUDE[id], OPCOES_PANORAMA)))).sort();
  const anoPop = anos[anos.length - 1];
  const pop = populacaoDoUniverso(ix, anoPop);
  const moradores = pop.capitais === pop.universo ? `${decimal(pop.soma / 1e6, 1)} milhões de moradores em ${anoPop}` : `população de ${pop.capitais} delas publicada para ${anoPop}`;
  const ausentes = naoPublicados(g);
  const contextos = contextosSaude(g);
  const link = "text-obee-dark underline underline-offset-4";
  return (
    // a base vai ao navegador uma vez, pelo provedor; as ilhas de cliente a leem dele (ver ProvedorSaude)
    <ProvedorSaude dados={dados}>
      <PaginaPainel
        rota={ROTA_SAUDE}
        principal={false}
        idioma="pt"
        abertura={{
          grupo: TEMAS_EFICIENCIA.saude.contexto,
          acento: "obee",
          titulo: "Quanto a sua capital gasta com saúde, e o que se observa?",
          lead: `${dados.capitais.length} capitais, ${moradores}: o dinheiro que a prefeitura aplica, a atenção primária registrada e as internações que o posto de saúde poderia ter evitado.`,
          acao: <SeletorCapitalSaude />,
          recorte: {
            periodo: `${anos[0]} a ${anos[anos.length - 1]}, o ano de cada medida ao lado dela`,
            universo: `${dados.capitais.length} capitais estaduais, sem o Distrito Federal`,
            unidade: "reais, percentuais e taxas por habitante",
            fonte: "Siconfi, SIOPS, CNES, Relatório APS e RIPSA",
          },
          limite: "que o resultado seja causado só pela prefeitura, nem que a rede registrada funcione de fato ou atenda só os moradores.",
          fontesDatasSiglas: (
            <>
              <p>
                {dados.capitais.length} capitais estaduais; o Distrito Federal fica fora porque a saúde distrital reúne competências de estado e de município (motivo completo em{" "}
                <Link href={hrefSaude(CAMINHO_METODOS)} className={link}>
                  Dados e métodos
                </Link>
                ). Dados capturados até {dataBr(dados.meta.dados_capturados_ate)}. Moradores em {anoPop}: soma da população residente do IBGE nas {pop.capitais} capitais com valor.
              </p>
              <p>As siglas estão em &quot;Siglas desta página&quot;, logo antes do método.</p>
            </>
          ),
        }}
        numeros={numeros}
        notaNumeros="Gastar mais não é, por si, melhor nem pior. A despesa é só a da prefeitura, a cobertura é capacidade registrada e a internação evitável indica associação, não causa. Cada número tem o seu ano e o seu universo; os quatro não se somam nem formam uma nota."
        navegacaoLocal={<AtalhoCompararSaude />}
        figuras={
          <>
            <ModeloSaude modelo={modelo} />
            <ReguasSaude contextos={contextos} />
            <Recolhido
              id="outras-medidas"
              titulo="Outras medidas do panorama"
              resumo="Percentual aplicado em ASPS, UBS e equipes por 10 mil habitantes e a parcela evitável das internações: menor, mediana e maior."
              nivelTitulo={2}
            >
              <div className="space-y-12 pb-6">
                <FigurasPanoramaSaude contextos={contextos} medidas={OUTRAS_MEDIDAS} />
              </div>
            </Recolhido>
            <PerguntasSaude itens={perguntas} />
          </>
        }
        notas={{ id: "siglas-panorama-saude", titulo: "Siglas desta página", itens: SIGLAS_POR_TEMA.panorama.map(([s, t]) => ({ termo: s, definicao: t })) }}
        metodo={
          <>
            {GRUPOS.map((x) => (
              <p key={x.id}>
                <span className="font-medium text-carvao">{x.titulo}.</span> {x.pergunta} Permite mostrar: {x.mostra} Não permite presumir: {x.naoPresume}
              </p>
            ))}
            <p>
              Valores nominais e população do Ministério da Saúde no denominador; as visões de cada tema trocam para reais de 2025 e para a população do IBGE. A parcela do SUS da União e o primeiro elo do modelo vêm do SIOPS (despesa
              empenhada, por fonte); o segundo elo, da DCA (despesa liquidada, por subfunção). A evolução em reais de 2025 soma só as capitais com valor comparável em todos os exercícios. Cada medida tem a trilha de fonte e de reconstrução em{" "}
              <Link href={hrefSaude(CAMINHO_METODOS)} className={link}>
                Dados e métodos
              </Link>
              .
            </p>
            <div id="ainda-nao-mede">
              <p className="font-medium text-carvao">O que este painel ainda não mede</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {ausentes.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-carvao">{a.nome}:</span> {a.motivos[0]}
                  </li>
                ))}
                <li>
                  <span className="font-medium text-carvao">Filas e tempo de espera:</span> não há base nacional aberta por município; volume de atendimento não substitui acesso no tempo certo.
                </li>
              </ul>
              <p className="mt-2">
                Internações e óbitos por doenças ligadas à falta de saneamento, por município de residência, estão no observatório de Saneamento:{" "}
                <Link href="/saneamento/saude-ambiente" className={link}>
                  Saúde e ambiente
                </Link>
                .
              </p>
            </div>
          </>
        }
      />
    </ProvedorSaude>
  );
}
