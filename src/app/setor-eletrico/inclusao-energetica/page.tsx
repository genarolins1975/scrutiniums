import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { InclusaoIsolados, InclusaoLpt, InclusaoMapaPnad, InclusaoRegioesPnad } from "@/components/energia/InclusaoAcesso";
import { InclusaoCoberturaUf, InclusaoMunicipiosCobertura, InclusaoSerieCobertura } from "@/components/energia/InclusaoCobertura";
import { InclusaoLinkPainel } from "@/components/energia/InclusaoLinkPainel";
import { InclusaoClassesPof, InclusaoUfsPof } from "@/components/energia/InclusaoOrcamento";
import { InclusaoMapaTsee, InclusaoSerieTsee } from "@/components/energia/InclusaoTarifaSocial";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num, pct, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_DISTRIBUIDORAS,
  COLUNAS_MESES_CDE,
  COLUNAS_SERIE_TSEE,
  codigoUf,
  colunasLpt,
  dadosMediaCde,
  inteiro,
  linhasDistribuidoras,
  linhasHistogramaMunicipios,
  linhasLptAnual,
  linhasMesesCde,
  linhasTabelaSerieTsee,
  marcosEventos,
  mes,
  mudancaAcesso,
  mudancaCobertura,
  mudancaOrcamento,
  mudancaTarifaSocial,
  orcamentoBase,
  reaisGrandes,
  respostaAcesso,
  respostaCobertura,
  respostaOrcamento,
  respostaTarifaSocial,
  ufsAtingidasPorAusencia,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Inclusão energética: Tarifa Social, cobertura, orçamento e acesso",
  description:
    "Tarifa Social por distribuidora, UF e mês (ANEEL, SCS e Beneficiários da CDE), cobertura potencial contra o Cadastro Único (proxy declarada), peso da energia no orçamento por classe de rendimento (POF 2017-2018) e acesso à energia, sistemas isolados e Luz para Todos.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica" },
};

const ROTA = "/setor-eletrico/inclusao-energetica";
const FONTE_SCS = "ANEEL, SCS: Sistema de Controle de Subvenções e Programas Sociais";
const FONTE_CDE = "ANEEL, Beneficiários da CDE";
const FONTE_COB = "ANEEL, Beneficiários da CDE; MDS, Cadastro Único (MI Social)";
const FONTE_POF = "IBGE, POF 2017-2018 (microdados e tabela 6715)";
const FONTE_PNAD = "IBGE, PNAD Contínua anual (tabelas 6731, 6737 e 6738)";
const FONTE_PASI = "EPE, PASI (Localização Geográfica por ciclo)";
const FONTE_LPT = "MME, Luz para Todos (dados abertos)";

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
function Recorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Rodapé de cada painel: link compartilhável, downloads e a próxima pergunta (seção 7.2, itens 9 e 10). */
function Seguir({ ancora, href, pergunta, downloads }: { ancora: string; href: string; pergunta: string; downloads: { rotulo: string; url: string }[] }) {
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {downloads.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <InclusaoLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          {href.startsWith("#") ? (
            <a href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              {pergunta}
            </a>
          ) : (
            <Link href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              {pergunta}
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}

function Auditoria({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="auditar" className="space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

function Analise({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 className="font-serif text-lg text-carvao">{children}</h3>;
}

const ROTULO_REGRA: Record<string, string> = {
  mes_completo: "Mês completo do SCS",
  residencial_inconsistente: "Total residencial inconsistente",
  incorporacao: "Incorporação de distribuidora",
  maiores_diferencas: "Corte da conferência SCS e CDE",
  desconto_liquido: "Desconto líquido",
  despacho_vigente: "Despacho vigente",
  mes_mapa: "Mês do mapa",
  mes_cde_sem_original: "Mês da CDE sem original guardado",
  municipio_valido: "Município válido",
};

const COLUNAS_INCORPORACOES: ColunaTabela[] = [
  { id: "mes", rotulo: "Mês da ruptura", tipo: "texto" },
  { id: "sucessora", rotulo: "Sucessora", tipo: "texto" },
  { id: "incorporadas", rotulo: "Incorporadas", tipo: "texto" },
  { id: "total", rotulo: "UC residenciais das incorporadas", tipo: "numero", casas: 0 },
  { id: "salto", rotulo: "Salto da sucessora", tipo: "numero", casas: 0 },
];

const COLUNAS_CONFERENCIA: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "grupo", rotulo: "Grupo", tipo: "texto", categorica: true },
  { id: "uc_scs", rotulo: "UC no SCS", tipo: "numero", casas: 0 },
  { id: "faturas_cde", rotulo: "Faturas na CDE", tipo: "numero", casas: 0 },
  { id: "diferenca_pct", rotulo: "Diferença", tipo: "percentual", casas: 2 },
  { id: "dmr", rotulo: "DMR (SCS)", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "desconto", rotulo: "Desconto (CDE)", tipo: "numero", unidade: "R$", casas: 2 },
];

const COLUNAS_ANTIGA: ColunaTabela[] = [
  { id: "m", rotulo: "Trimestre", tipo: "texto" },
  { id: "antiga", rotulo: "UC baixa renda (série antiga)", tipo: "numero", casas: 0 },
  { id: "scs", rotulo: "UC com Tarifa Social (SCS)", tipo: "numero", casas: 0 },
  { id: "dif", rotulo: "Diferença", tipo: "percentual", casas: 2 },
  { id: "repete", rotulo: "Repete o trimestre", tipo: "texto" },
];

const COLUNAS_CONF_POF: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe de rendimento", tipo: "texto" },
  { id: "energia_sidra", rotulo: "Energia, tabela 6715", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "energia_micro", rotulo: "Energia, microdados", tipo: "numero", unidade: "R$", casas: 4 },
  { id: "distribuicao_sidra", rotulo: "Distribuição, tabela 6715", tipo: "percentual", casas: 1 },
  { id: "razao_medias_micro", rotulo: "Razão de médias, microdados", tipo: "percentual", casas: 4 },
  { id: "cv_ibge", rotulo: "CV publicado", tipo: "percentual", casas: 1 },
  { id: "cv_micro", rotulo: "CV refeito", tipo: "percentual", casas: 2 },
];

const COLUNAS_SENS: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe de rendimento", tipo: "texto" },
  { id: "media", rotulo: "Média das participações na renda", tipo: "percentual", casas: 2 },
  { id: "mediana", rotulo: "Mediana", tipo: "percentual", casas: 2 },
  { id: "sem", rotulo: "Média sem famílias com energia acima da renda", tipo: "percentual", casas: 2 },
  { id: "n", rotulo: "Famílias da amostra com energia acima da renda", tipo: "numero", casas: 0 },
  { id: "peso", rotulo: "Peso dessas famílias", tipo: "percentual", casas: 3 },
  { id: "tres", rotulo: "Três maiores parcelas da média", tipo: "numero", unidade: "p.p.", casas: 3 },
];

const COLUNAS_CICLOS: ColunaTabela[] = [
  { id: "ciclo", rotulo: "Ciclo do PASI", tipo: "texto" },
  { id: "localidades", rotulo: "Localidades", tipo: "numero", casas: 0 },
  { id: "populacao", rotulo: "População informada", tipo: "numero", unidade: "pessoas", casas: 0 },
  { id: "sem_pop", rotulo: "Sem população informada", tipo: "numero", casas: 0 },
  { id: "previsao", rotulo: "Com previsão de interligação", tipo: "numero", casas: 0 },
  { id: "sairam", rotulo: "Saíram da lista", tipo: "numero", casas: 0 },
];

const COLUNAS_MUN_LPT: ColunaTabela[] = [
  { id: "municipio", rotulo: "Município", tipo: "texto" },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "cod", rotulo: "Código IBGE (6 dígitos)", tipo: "texto" },
  { id: "domicilios", rotulo: "Domicílios atendidos desde jan/2023", tipo: "numero", casas: 0 },
];

const ROTULO_FONTE_RECURSO: Record<string, string> = { cde: "CDE", rgr: "RGR", caixa_outras: "Caixa ou outras", agente_executor: "Agente executor" };

export default function InclusaoEnergeticaPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="inclusao-energetica" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel
            titulo="Inclusão energética indisponível nesta publicação"
            motivo={
              (g as { motivo?: string } | null)?.motivo ??
              "A gold do módulo Inclusão energética (public/energia/gold/inclusao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
            }
          />
        </main>
      </>
    );
  }

  const t = g.tarifa_social;
  const c = g.cobertura;
  const o = g.orcamento;
  const a = g.acesso;
  const k = t.kpis;
  const serie = t.serie_mensal;
  const mesMapa = t.mes_mapa ?? t.mes_referencia;
  const cdeMapa = t.cde_meses.find((m) => m.mes === t.mes_mapa) ?? null;
  const cdeComValor = t.cde_meses.filter((m) => m.original_no_bronze);
  const conf = t.conferencia_scs_cde;
  const antiga = t.serie_antiga;
  const custeio = t.custeio_cde;
  const atingidas = ufsAtingidasPorAusencia(t.cde_meses, t.distribuidoras);
  const marcosScs = marcosEventos(t.eventos, serie[0]?.m ?? "", serie.at(-1)?.m ?? "");
  const marcosCde = marcosEventos(t.eventos, cdeComValor[0]?.mes ?? "", cdeComValor.at(-1)?.mes ?? "");
  const ultimoScs = g.referencias.scs_ultimo_mes_no_arquivo;
  const geracaoScs = t.diagnostico_scs?.data_geracao.at(-1) ?? null;
  const pofTotal = o.linhas.find((l) => l.territorio === "BR" && l.classe === "7999");
  const si = a.sistemas_isolados;
  const lpt = a.universalizacao.luz_para_todos;
  const brPnad = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
  const dist = c.distribuicao_municipal;
  const ufsComFaturas = t.ufs.length;
  const municipiosComFaturas = t.ufs.reduce((s, u) => s + u.municipios_com_faturas, 0);

  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));

  const linhasConferencia = conf
    ? [
        ...conf.maiores_diferencas.map((d) => ({ ...d, grupo: `${inteiro(conf.uc_minima_maiores_diferencas)} UC ou mais` })),
        ...conf.diferencas_distribuidoras_pequenas.map((d) => ({ ...d, grupo: `menos de ${inteiro(conf.uc_minima_maiores_diferencas)} UC` })),
      ].map((d) => ({
        id: d.cnpj,
        sigla: d.sigla ?? `CNPJ ${d.cnpj}`,
        grupo: d.grupo,
        uc_scs: d.uc_scs,
        faturas_cde: d.faturas_cde,
        diferenca_pct: d.diferenca_pct,
        dmr: d.dmr_scs_reais,
        desconto: d.desconto_cde_reais,
      }))
    : [];

  const recursosCols: ColunaTabela[] = lpt
    ? [
        { id: "nome", rotulo: "UF", tipo: "texto" },
        { id: "contratos", rotulo: "Contratos", tipo: "numero", casas: 0 },
        ...Array.from(new Set(lpt.recursos_por_uf.flatMap((r) => Object.keys(r).filter((x) => x.endsWith("_reais")))))
          .sort()
          .map((id): ColunaTabela => {
            const m = /^(.*)_(contratado|pago)_reais$/.exec(id);
            const rot = m ? `${ROTULO_FONTE_RECURSO[m[1]] ?? m[1]}, ${m[2]}` : id;
            return { id, rotulo: rot, tipo: "numero", unidade: "R$", casas: 2 };
          }),
      ]
    : [];

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Inclusão energética"
          titulo="Quem tem acesso adequado e para quem a energia pesa mais?"
          referencia={
            <>
              SCS da ANEEL até {mes(ultimoScs)} (arquivo gerado pela fonte em {dataBR(geracaoScs)}; último mês completo {mes(t.mes_referencia)}); Beneficiários da CDE até{" "}
              {mes(g.referencias.cde_mes_mais_recente)} (último mês completo {mes(mesMapa)}); Cadastro Único de {mes(c.brasil?.mes)}; POF 2017-2018; PNAD Contínua {a.ano_referencia}; PASI
              ciclo {si?.ciclo ?? "sem dado"}; Luz para Todos até {mes(lpt?.ultimo_mes)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quatro perguntas, cada uma com a sua fonte e a sua unidade: quanto a Tarifa Social alcança, quem pode estar ficando de fora, para quem a conta pesa mais no orçamento e quem
          ainda não tem acesso adequado. Os números são agregados: nenhum beneficiário individual aparece aqui.
        </CabecalhoModulo>

        <section aria-labelledby="unidades" className="pb-6">
          <h2 id="unidades" className="sr-only">
            Cinco unidades que não se somam
          </h2>
          <ul className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Unidade consumidora (UC)", "O ponto de ligação com conta própria. É a unidade do SCS, em que a distribuidora pede o reembolso do desconto."],
              ["Fatura", "Cada conta emitida com desconto no mês. É a unidade dos arquivos de Beneficiários da CDE; uma UC pode ter mais de uma fatura no arquivo."],
              ["Família", "A unidade do Cadastro Único e da POF. Uma família pode não ser titular da conta de luz da casa em que mora."],
              ["Domicílio", "A unidade da PNAD Contínua e do Luz para Todos: a moradia, com ou sem ligação à rede."],
              ["Pessoa", "A população das localidades isoladas, informada pelas distribuidoras ao PASI."],
            ].map(([n, d]) => (
              <li key={n} className="bg-superficie p-4">
                <p className="rotulo text-mineral">{n}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-carvao">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Números de destaque" className="grid gap-4 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Numero
            rotulo="UC com Tarifa Social"
            natureza="OBSERVADO"
            evidencia={k.uc_tsee.evidencia}
            formato="num"
            casas={0}
            unidade="UC"
            nota={`${t.distribuidoras.length} distribuidoras; último mês completo do SCS.`}
            endereco={`${ROTA}#p059`}
          />
          <Numero
            rotulo="Faturas por 100 famílias elegíveis pela renda (proxy)"
            natureza="CALCULADO"
            evidencia={c.brasil?.evidencia ?? null}
            formato="num"
            casas={1}
            unidade="por 100 famílias"
            motivoAusencia="Sem cruzamento entre faturas e Cadastro Único nesta publicação."
            nota="Proxy, não taxa de cobertura: fatura não é família."
            endereco={`${ROTA}#p060`}
          />
          <Numero
            rotulo="Energia na despesa total das famílias (razão de médias)"
            natureza="ESTIMADO"
            evidencia={o.evidencias.razao_medias_brasil}
            formato="pct"
            casas={1}
            nota={`POF ${o.referencia.replace(/^POF /, "")}; estatística histórica, sem atualização modelada.`}
            endereco={`${ROTA}#p061`}
          />
          <Numero
            rotulo="Domicílios sem energia elétrica de nenhuma fonte"
            natureza="ESTIMADO"
            evidencia={a.evidencia_sem_energia}
            formato="num"
            casas={0}
            unidade="mil domicílios"
            motivoAusencia="Sem estimativa da PNAD nesta publicação."
            nota="Diferença entre duas estimativas do IBGE; sem erro-padrão publicado."
            endereco={`${ROTA}#p062`}
          />
        </section>

        <nav aria-label="Perguntas desta página" className="pb-4">
          <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["#tarifa-social", t.pergunta],
              ["#cobertura", c.pergunta],
              ["#orcamento", o.pergunta],
              ["#acesso", a.pergunta],
            ].map(([href, rot], i) => (
              <li key={href}>
                <a href={href} className="flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 py-2 text-carvao hover:border-energia">
                  <span className="rotulo text-mineral">{i + 1}</span>
                  {rot}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <ModoProfundidade>
          {/* ---------------- P059 ---------------- */}
          <Bloco id="tarifa-social">
            <PainelEvidencia
              id="p059"
              pergunta={t.pergunta}
              subtitulo="UC com Tarifa Social (SCS) e faturas com desconto (Beneficiários da CDE) · UC, faturas e R$ correntes"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  A Tarifa Social de Energia Elétrica dá desconto na conta da subclasse residencial baixa renda, custeado pela Conta de Desenvolvimento Energético (CDE). Saber quantas
                  unidades recebem, onde e com que desconto é o ponto de partida para discutir o alcance do benefício.
                </>
              }
              oQueMudou={mudancaTarifaSocial(t)}
              comoInterpretar={
                <>
                  O SCS conta UC no pedido de reembolso de cada distribuidora (despacho vigente, cinco faixas de consumo somadas, DMR lida uma vez por mês). Depois do fim do SCS, a
                  evolução vem dos arquivos mensais da CDE, que contam faturas: as duas séries ficam em gráficos separados e não se emendam. Mês em que falta distribuidora esperada
                  fica em linha tracejada, fora da comparação. A participação é razão de somas das mesmas distribuidoras.
                </>
              }
              naoConcluir={
                <>
                  Não se conclui número de famílias nem de pessoas beneficiadas: UC e fatura são unidades da conta. A DMR é a receita que a distribuidora deixa de cobrar, não o desconto
                  de cada família. A queda num mês incompleto não é queda de beneficiários. Diferenças entre UF não têm causa atribuída aqui.
                </>
              }
              proveniencia={t.proveniencia.scs}
              complementares={[
                { rotulo: "Participação nas UC residenciais", p: t.proveniencia.participacao },
                { rotulo: "Faturas e desconto (CDE)", p: t.proveniencia.cde },
                ...(t.proveniencia.custeio ? [{ rotulo: "Custeio anual da CDE", p: t.proveniencia.custeio }] : []),
                ...(t.proveniencia.antiga ? [{ rotulo: "Série antiga (descontinuada)", p: t.proveniencia.antiga }] : []),
              ]}
            >
              <div className="space-y-6">
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p059">
                  {respostaTarifaSocial(t)}
                </p>
                <Recorte
                  periodo={
                    <>
                      SCS de {mes(serie[0]?.m)} a {mes(serie.at(-1)?.m)} (referência {mes(t.mes_referencia)}); CDE de {mes(cdeComValor[0]?.mes)} a {mes(cdeComValor.at(-1)?.mes)} (mapa em{" "}
                      {mes(mesMapa)})
                    </>
                  }
                  universo={
                    <>
                      {t.distribuidoras.length} distribuidoras no SCS; {ufsComFaturas} UF e {inteiro(municipiosComFaturas)} municípios com faturas no mês do mapa
                    </>
                  }
                  unidade="UC (SCS); faturas (CDE); R$ correntes"
                />
                <p className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">
                  Fonte defasada, declarada: o SCS publicado em {dataBR(geracaoScs)} termina em {mes(ultimoScs)}, e o último mês com todas as distribuidoras é {mes(t.mes_referencia)}. Para
                  os meses seguintes, os arquivos de Beneficiários da CDE vão até {mes(g.referencias.cde_mes_mais_recente)}, mas só {mes(mesMapa)} tem todas as distribuidoras entre os
                  mais recentes.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Numero rotulo="UC com Tarifa Social" natureza="OBSERVADO" evidencia={k.uc_tsee.evidencia} casas={0} unidade="UC" tamanho="medio" endereco={`${ROTA}#p059`} />
                  <Numero
                    rotulo="Das UC residenciais"
                    natureza="CALCULADO"
                    evidencia={k.participacao_pct.evidencia}
                    formato="pct"
                    casas={1}
                    tamanho="medio"
                    nota={
                      k.variacao_12m_pct.valor !== null
                        ? `UC com Tarifa Social ${k.variacao_12m_pct.valor >= 0 ? "cresceram" : "caíram"} ${pct(Math.abs(k.variacao_12m_pct.valor), 1)} desde ${mes(k.variacao_12m_pct.mes_base)}${k.variacao_12m_pct.comparavel ? "" : " (mês base incompleto)"}.`
                        : undefined
                    }
                    endereco={`${ROTA}#p059`}
                  />
                  <Numero
                    rotulo="DMR do mês"
                    natureza="OBSERVADO"
                    evidencia={k.dmr_mes_reais.evidencia}
                    formato="reais"
                    casas={0}
                    unidade="R$"
                    tamanho="medio"
                    nota={`${reais(k.dmr_por_uc_reais.valor)} por UC; ${num(k.kwh_por_uc.valor, 1)} kWh por UC no mês.`}
                    endereco={`${ROTA}#p059`}
                  />
                  <Numero
                    rotulo="Faturas com desconto (CDE)"
                    natureza="CALCULADO"
                    evidencia={k.faturas_cde_mapa?.evidencia ?? null}
                    casas={0}
                    unidade="faturas"
                    tamanho="medio"
                    motivoAusencia="Nenhum arquivo da CDE com todas as distribuidoras."
                    nota={cdeMapa ? `${reais(cdeMapa.desconto_medio_por_fatura_reais)} de desconto médio por fatura.` : undefined}
                    endereco={`${ROTA}#p059`}
                  />
                </div>

                <Subtitulo>Como o número de UC com Tarifa Social evoluiu?</Subtitulo>
                <InclusaoSerieTsee serie={serie} marcos={marcosScs} />

                <Subtitulo>Depois do SCS: o que os arquivos da CDE mostram mês a mês?</Subtitulo>
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                  Desconto médio por fatura (desconto das faturas ÷ faturas, calculado no pipeline). Meses com cobertura abaixo de 99,5% das UC do SCS ficam tracejados; os arquivos
                  sondados sem o original guardado aparecem só na tabela, com a cobertura.
                </p>
                <GraficoLinhas
                  titulo={`Desconto médio por fatura com Tarifa Social, ${mes(cdeComValor[0]?.mes)} a ${mes(cdeComValor.at(-1)?.mes)} (Beneficiários da CDE)`}
                  dados={dadosMediaCde(t.cde_meses)}
                  chaveX="m"
                  formatoX="mes"
                  series={[
                    { id: "completo", rotulo: "Mês completo", sigla: "Completo", cor: "var(--cor-energia)" },
                    { id: "incompleto", rotulo: "Mês incompleto (fora da comparação)", sigla: "Incompleto", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="R$ por fatura"
                  casas={2}
                  zeroNoEixo
                  marcos={marcosCde}
                  altura={280}
                />
                <TabelaInterativa
                  titulo="Arquivos mensais de Beneficiários da CDE: cobertura, faturas e desconto"
                  colunas={COLUNAS_MESES_CDE}
                  linhas={linhasMesesCde(t.cde_meses)}
                  chaveLinha="id"
                  colunaRotulo="mes"
                  fonte={FONTE_CDE}
                  versao={g.referencias.cde_mes_mais_recente ?? mesMapa}
                  nomeArquivo="inclusao-cde-meses"
                  tamanhoPagina={25}
                  nota={t.regras.mes_cde_sem_original}
                />

                <Subtitulo>Onde: faturas com desconto por UF</Subtitulo>
                <InclusaoMapaTsee ufs={t.ufs} mesMapa={mesMapa} serieUfUrl={t.serie_cde_uf_json} atingidas={atingidas} marcos={marcosCde} fonte={FONTE_CDE} />

                <Analise titulo={`Distribuidoras em ${mes(t.mes_referencia)}: UC, participação, DMR e conferência com a CDE`}>
                  <TabelaInterativa
                    titulo={`Tarifa Social por distribuidora, ${mes(t.mes_referencia)} (SCS)`}
                    colunas={COLUNAS_DISTRIBUIDORAS}
                    linhas={linhasDistribuidoras(t.distribuidoras)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={FONTE_SCS}
                    versao={t.mes_referencia}
                    nomeArquivo="inclusao-tarifa-social-distribuidoras"
                    chaveUrl="ts.dist"
                    ordemInicial={{ coluna: "uc_tsee", direcao: "desc" }}
                    dicaBusca="Sigla, CNPJ ou UF"
                    nota="Participação nula quando o total residencial do mês é inconsistente (regra no modo Auditar). Faturas contra UC: diferença do arquivo da CDE do mesmo mês."
                  />
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-carvao">Modalidades em {mes(t.modalidades_referencia.mes)}</p>
                      <div className="tabela-scroll">
                        <table className="w-full text-sm">
                          <caption className="sr-only">UC com Tarifa Social por modalidade</caption>
                          <thead>
                            <tr className="border-b border-linha text-left text-mineral">
                              <th scope="col" className="py-2 pr-4 font-normal">
                                Modalidade
                              </th>
                              <th scope="col" className="py-2 text-right font-normal">
                                UC
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              [
                                ["baixa_renda", "Baixa renda (Cadastro Único)"],
                                ["bpc", "Benefício de Prestação Continuada"],
                                ["quilombola", "Quilombola"],
                                ["indigena", "Indígena"],
                                ["multifamiliar", "Multifamiliar"],
                              ] as const
                            ).map(([id, rot]) => (
                              <tr key={id} className="border-b border-linha">
                                <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                                  {rot}
                                </th>
                                <td className="py-2 text-right tabular-nums text-carvao">{t.modalidades_referencia[id] === null ? "sem dado" : inteiro(t.modalidades_referencia[id])}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <GraficoBarras
                      titulo={`UC com Tarifa Social por faixa de consumo: ${mes(t.faixas_consumo.mes_anterior)} e ${mes(t.faixas_consumo.mes)}`}
                      dados={t.faixas_consumo.linhas.map((l) => ({
                        id: l.faixa,
                        rotulo: l.rotulo,
                        atual: l.pct_das_uc_tsee,
                        anterior: t.faixas_consumo.linhas_anterior.find((x) => x.faixa === l.faixa)?.pct_das_uc_tsee ?? null,
                      }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[
                        { id: "anterior", rotulo: mes(t.faixas_consumo.mes_anterior), cor: "var(--serie-referencia)" },
                        { id: "atual", rotulo: mes(t.faixas_consumo.mes), cor: "var(--cor-energia)" },
                      ]}
                      unidade="% das UC com Tarifa Social"
                      casas={1}
                      altura={280}
                    />
                  </div>
                  {custeio && (
                    <GraficoBarras
                      titulo={`Valor anual da CDE para a Tarifa Social, ${custeio.linhas[0]?.ano ?? ""} a ${custeio.linhas.at(-1)?.ano ?? ""} (R$ bilhões correntes)`}
                      dados={custeio.linhas.map((l) => ({
                        id: l.ano,
                        rotulo: l.ano === custeio.ano_corrente ? `${l.ano} (ano em curso)` : l.ano,
                        valor: l.tarifa_social_reais === null ? null : l.tarifa_social_reais / 1e9,
                      }))}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "valor", rotulo: "Tarifa Social na CDE", cor: "var(--cor-energia)" }]}
                      unidade="R$ bilhões"
                      casas={2}
                      altura={280}
                    />
                  )}
                  {custeio && (
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      {custeio.proveniencia.limitacoes.join(" ")} Em {custeio.linhas.at(-1)?.ano}, a Tarifa Social é {pct(custeio.linhas.at(-1)?.tarifa_social_pct_despesa, 1)} da despesa da
                      CDE ({reaisGrandes(custeio.linhas.at(-1)?.tarifa_social_reais)}).
                    </p>
                  )}
                  <TabelaInterativa
                    titulo="Série mensal nacional do SCS, todos os meses publicados na gold"
                    colunas={COLUNAS_SERIE_TSEE}
                    linhas={linhasTabelaSerieTsee(serie)}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={FONTE_SCS}
                    versao={t.mes_referencia}
                    nomeArquivo="inclusao-tarifa-social-mensal"
                    chaveUrl="ts.mes"
                    ordemInicial={{ coluna: "m", direcao: "desc" }}
                    dicaBusca="Mês (AAAA-MM)"
                  />
                </Analise>

                <Auditoria titulo="Regras, conferências e a série antiga">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {Object.entries(t.regras).map(([id, txt]) => (
                      <div key={id}>
                        <dt className="font-medium text-carvao">{ROTULO_REGRA[id] ?? id}</dt>
                        <dd className="mt-0.5 text-carvao-muted">{txt}</dd>
                      </div>
                    ))}
                  </dl>
                  {conf && (
                    <>
                      <p className="text-sm text-carvao-muted">
                        Conferência SCS e CDE em {mes(conf.mes)}, mesmas {conf.distribuidoras_comparadas} distribuidoras: {inteiro(conf.uc_scs)} UC e {inteiro(conf.faturas_cde)} faturas (
                        {pct(conf.diferenca_pct, 2)}); {reaisGrandes(conf.dmr_scs_reais)} de DMR e {reaisGrandes(conf.desconto_cde_reais)} de desconto ({pct(conf.diferenca_valor_pct, 2)});{" "}
                        {conf.distribuidoras_ate_2pct} distribuidoras dentro de 2%. Tolerância: {conf.tolerancia}
                        {conf.so_na_cde.length ? ` Só na CDE: ${conf.so_na_cde.join(", ")}.` : ""}
                        {conf.so_no_scs.length ? ` Só no SCS: ${conf.so_no_scs.join(", ")}.` : ""}
                      </p>
                      <TabelaInterativa
                        titulo={`Maiores diferenças entre UC do SCS e faturas da CDE, ${mes(conf.mes)}`}
                        colunas={COLUNAS_CONFERENCIA}
                        linhas={linhasConferencia}
                        chaveLinha="id"
                        colunaRotulo="sigla"
                        fonte={`${FONTE_SCS}; ${FONTE_CDE}`}
                        versao={conf.mes}
                        nomeArquivo="inclusao-conferencia-scs-cde"
                        ordemInicial={{ coluna: "diferenca_pct", direcao: "desc" }}
                      />
                    </>
                  )}
                  {t.incorporacoes.length > 0 && (
                    <TabelaInterativa
                      titulo="Incorporações detectadas no SCS (não são inconsistência)"
                      colunas={COLUNAS_INCORPORACOES}
                      linhas={t.incorporacoes.map((i) => ({
                        id: `${i.mes_ruptura}|${i.sucessora}`,
                        mes: i.mes_ruptura,
                        sucessora: i.sigla_sucessora ?? i.sucessora,
                        incorporadas: i.siglas_incorporadas.map((s, j) => s ?? i.incorporadas[j]).join(", "),
                        total: i.total_incorporadas,
                        salto: i.salto_sucessora,
                      }))}
                      chaveLinha="id"
                      colunaRotulo="mes"
                      fonte={FONTE_SCS}
                      versao={t.mes_referencia}
                      nomeArquivo="inclusao-incorporacoes-scs"
                    />
                  )}
                  {t.siglas_de_outra_fonte.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      Siglas tomadas de outra fonte: {t.siglas_de_outra_fonte.map((s) => `CNPJ ${s.cnpj} exibido como ${s.sigla} (${s.origem})`).join("; ")}.
                    </p>
                  )}
                  {t.diagnostico_scs && (
                    <p className="text-sm text-carvao-muted">
                      Arquivo do SCS: {inteiro(t.diagnostico_scs.linhas)} linhas, {inteiro(t.diagnostico_scs.pares)} pares distribuidora e competência;{" "}
                      {inteiro(t.diagnostico_scs.pares_com_mais_de_um_despacho)} pares em mais de um despacho, {t.diagnostico_scs.pares_com_despachos_divergentes} com valores divergentes;{" "}
                      {t.diagnostico_scs.pares_com_faixas_incompletas} com faixas incompletas.
                    </p>
                  )}
                  {antiga && (
                    <>
                      <p className="text-sm text-carvao-muted">
                        Série antiga descontinuada: o portal a intitula &ldquo;{antiga.titulo_no_portal}&rdquo;. Teste do recurso em {carimbo(antiga.teste_do_recurso.testado_em)}: HTTP{" "}
                        {antiga.teste_do_recurso.status_http}, {antiga.teste_do_recurso.conclusao}. Cópia usada: <span className="break-all">{antiga.copia_usada}</span>. Ela entra só como
                        histórico identificado, nunca como fonte atual.
                      </p>
                      <TabelaInterativa
                        titulo="Série antiga da ANEEL contra o SCS nos trimestres comuns"
                        colunas={COLUNAS_ANTIGA}
                        linhas={antiga.comparacao_scs.map((x) => ({
                          id: x.m,
                          m: x.m,
                          antiga: x.uc_baixa_renda_antiga,
                          scs: x.uc_tsee_scs,
                          dif: x.diferenca_pct,
                          repete: x.repete_trimestre ?? "",
                        }))}
                        chaveLinha="id"
                        colunaRotulo="m"
                        fonte="ANEEL, Tarifa Social de Energia Elétrica: Beneficiários (descontinuado)"
                        versao={antiga.comparacao_scs.at(-1)?.m ?? ""}
                        nomeArquivo="inclusao-serie-antiga-contra-scs"
                        nota="Trimestre que repete a contagem de outro no arquivo original fica marcado e fora da estatística de concordância."
                      />
                    </>
                  )}
                </Auditoria>

                <Seguir
                  ancora="p059"
                  href="#cobertura"
                  pergunta="Quantas famílias elegíveis pela renda o benefício pode não estar alcançando?"
                  downloads={downloads([
                    "/energia/series/inclusao_tsee_mensal.csv",
                    "/energia/series/inclusao_tsee_distribuidoras.csv",
                    "/energia/series/inclusao_cde_mensal_uf.csv",
                    "/energia/series/inclusao_tsee_antiga.csv",
                    "/energia/series/inclusao_cde_custeio.csv",
                  ])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P060 ---------------- */}
          <Bloco id="cobertura">
            <PainelEvidencia
              id="p060"
              pergunta={c.pergunta}
              subtitulo="Faturas com Tarifa Social por 100 famílias do Cadastro Único com renda por pessoa até ½ salário mínimo · proxy"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Comparar quem recebe o desconto com quem tem direito pelo critério de renda mostra onde o benefício pode não estar chegando. Como as bases públicas contam coisas
                  diferentes, a comparação só pode ser uma proxy, e é publicada como tal.
                </>
              }
              oQueMudou={mudancaCobertura(c)}
              comoInterpretar={
                <>
                  Razão = 100 × faturas com desconto ÷ famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês. O denominador com cadastro atualizado
                  segue o requisito da concessão; com todas as cadastradas, a razão cai. As duas formam uma faixa de sensibilidade à definição do denominador, não um intervalo
                  estatístico. {c.faixa_de_sensibilidade}
                </>
              }
              naoConcluir={
                <>
                  Não é a proporção de famílias elegíveis atendidas e não diz quantas famílias estão fora: fatura não é família, a família pode não ser titular da conta, o numerador
                  inclui quem recebe pelo BPC ou por equipamento médico (por isso a razão passa de 100 em alguns municípios) e famílias sem ligação à rede contam só no denominador.
                </>
              }
              proveniencia={c.proveniencia.cobertura}
            >
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 border border-carvao px-3 py-1 text-sm text-carvao">
                  <span className="rotulo">Proxy</span>
                  <span>medida indireta, com denominador elegível só pelo critério de renda</span>
                </p>
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p060">
                  {respostaCobertura(c)}
                </p>
                <Recorte
                  periodo={
                    <>
                      Mapa e UF em {mes(c.brasil?.mes)}; série nacional de {c.serie_mensal_meses} meses até {mes(c.serie_mensal_ultimo?.m)}
                    </>
                  }
                  universo={
                    <>
                      {c.ufs.length} UF; {dist ? `${inteiro(dist.municipios)} municípios na distribuição (${dist.base_pequena_excluidos} fora por base pequena)` : "municípios sem dado"}
                    </>
                  }
                  unidade="faturas (ou UC na série do SCS) por 100 famílias"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    rotulo="Por 100 famílias com cadastro atualizado"
                    natureza="CALCULADO"
                    evidencia={c.brasil?.evidencia ?? null}
                    casas={1}
                    unidade="faturas por 100 famílias"
                    tamanho="medio"
                    motivoAusencia="Sem cruzamento nesta publicação."
                    endereco={`${ROTA}#p060`}
                  />
                  <Numero
                    rotulo="Por 100 famílias cadastradas (todas)"
                    natureza="CALCULADO"
                    valor={c.brasil?.razao_cadastradas_pct ?? null}
                    casas={1}
                    unidade="faturas por 100 famílias"
                    periodo={mes(c.brasil?.mes)}
                    tamanho="medio"
                    nota={`Mesmo numerador; denominador com ${inteiro(c.brasil?.familias_cadastradas)} famílias em vez de ${inteiro(c.brasil?.familias_atualizadas)}. Prova no CSV de municípios.`}
                  />
                </div>
                <InclusaoCoberturaUf ufs={c.ufs} mes={c.brasil?.mes ?? mesMapa} fonte={FONTE_COB} />

                {dist && (
                  <>
                    <Subtitulo>Como a razão se distribui entre os municípios?</Subtitulo>
                    <GraficoBarras
                      titulo={`Municípios por faixa de faturas por 100 famílias atualizadas, ${mes(c.brasil?.mes)}`}
                      dados={linhasHistogramaMunicipios(dist)}
                      chaveCategoria="id"
                      chaveRotulo="faixa"
                      series={[{ id: "municipios", rotulo: "Municípios", cor: "var(--cor-energia)" }]}
                      unidade="municípios"
                      casas={0}
                      rotulosValor
                      altura={280}
                    />
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      Faixas de larguras diferentes (a primeira vai de {num(dist.histograma[0]?.de, 0)} a {num(dist.histograma[0]?.ate, 0)}). Quantis: P10 {num(dist.quantis.p10, 1)}, P25 {num(dist.quantis.p25, 1)}, mediana {num(dist.quantis.p50, 1)}, P75{" "}
                      {num(dist.quantis.p75, 1)}, P90 {num(dist.quantis.p90, 1)}. {inteiro(dist.base_pequena_excluidos)} municípios ficam fora por base pequena; {inteiro(dist.acima_de_100)}{" "}
                      passam de 100.
                    </p>
                  </>
                )}

                <Analise titulo="A razão ao longo do tempo (numerador do SCS, meses completos)">
                  <InclusaoSerieCobertura url={c.serie_mensal_json} unidade="UC por 100 famílias" />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Série com UC do SCS no numerador; o ponto de {mes(c.brasil?.mes)} acima usa faturas da CDE. Meses incompletos do SCS ficam fora da série.
                  </p>
                </Analise>

                <Analise titulo="Por município">
                  <InclusaoMunicipiosCobertura csvUrl="/energia/series/inclusao_municipios.csv" mes={c.brasil?.mes ?? mesMapa} fonte={FONTE_COB} />
                </Analise>

                <Auditoria titulo="Regra de elegibilidade e por que a medida é proxy">
                  <p className="text-sm text-carvao-muted">
                    Conferida em {dataBR(c.regra_elegibilidade.consultado_em)} na página da ANEEL (
                    <a href={c.regra_elegibilidade.fonte} className="break-all text-energia-dark underline underline-offset-4">
                      {c.regra_elegibilidade.fonte}
                    </a>
                    ). Base legal: {c.regra_elegibilidade.base_legal}
                  </p>
                  <ul className="space-y-1 text-sm text-carvao">
                    {c.regra_elegibilidade.criterios.map((cr) => (
                      <li key={cr.id}>
                        <strong className="font-medium">Critério {cr.id}</strong> ({cr.no_denominador ? "no denominador" : "fora do denominador"}): {cr.texto}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">Requisitos: {c.regra_elegibilidade.requisitos.join(" ")}</p>
                  <p className="text-sm text-carvao-muted">Vigência: {c.regra_elegibilidade.vigencia}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {c.regra_elegibilidade.por_que_proxy.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </Auditoria>

                <Seguir
                  ancora="p060"
                  href="#orcamento"
                  pergunta="Para quem a conta de luz pesa mais no orçamento?"
                  downloads={downloads(["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cobertura_mensal.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P061 ---------------- */}
          <Bloco id="orcamento">
            <PainelEvidencia
              id="p061"
              pergunta={o.pergunta}
              subtitulo="Energia elétrica na despesa total e na renda das famílias, por classe de rendimento · POF 2017-2018 · %"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  O mesmo valor de conta pesa diferente conforme a renda. A POF é a única pesquisa oficial que mede a despesa das famílias com energia elétrica junto com a despesa total e a
                  renda, com plano amostral que permite estimar a precisão.
                </>
              }
              oQueMudou={mudancaOrcamento(o)}
              comoInterpretar={
                <>
                  Razão de médias é a despesa média com energia dividida pela despesa média total (a &ldquo;distribuição&rdquo; que o IBGE publica). Média das participações calcula a
                  participação em cada família e tira a média ponderada. As duas respondem a perguntas diferentes e aparecem lado a lado; a mediana mostra a família típica. Precisão pelo
                  plano amostral (estrato e unidade primária): CV de 15% a 30% pede cautela, acima de 30% o valor é suprimido.
                </>
              }
              naoConcluir={
                <>
                  Não representa 2026: os preços e a Tarifa Social mudaram desde 2018, e nenhuma atualização modelada é publicada. Não existe recorte municipal: a amostra não permite.
                  Os limiares de {o.limiares_pct.map((x) => pct(x, 0)).join(", ")} não definem pobreza energética; são sensibilidade.
                </>
              }
              proveniencia={o.proveniencia.microdados}
              complementares={[{ rotulo: "Tabela 6715 (SIDRA)", p: o.proveniencia.sidra }]}
            >
              <div className="space-y-6">
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p061">
                  {respostaOrcamento(o)}
                </p>
                <Recorte
                  periodo="jul/2017 a jul/2018 (valores em R$ de 15/01/2018)"
                  universo={
                    <>
                      {inteiro(pofTotal?.n_amostra)} famílias na amostra, que representam {inteiro(pofTotal?.familias)} famílias; Brasil e grandes regiões por classe; UF só no total
                    </>
                  }
                  unidade="% da despesa total ou da renda; R$ por família e mês"
                />
                <p className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">
                  Estatística histórica: a POF mais recente publicada pelo IBGE é a de 2017-2018. O painel mostra o que ela mediu e não projeta o resultado para hoje.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Numero
                    rotulo="Razão de médias, todas as famílias"
                    natureza="ESTIMADO"
                    evidencia={o.evidencias.razao_medias_brasil}
                    formato="pct"
                    casas={1}
                    tamanho="medio"
                    endereco={`${ROTA}#p061`}
                  />
                  <Numero
                    rotulo="Média das participações na despesa, todas as famílias"
                    natureza="ESTIMADO"
                    evidencia={o.evidencias.media_razoes_desp_brasil}
                    formato="pct"
                    casas={1}
                    tamanho="medio"
                    endereco={`${ROTA}#p061`}
                  />
                  <Numero
                    rotulo={`Média das participações na renda, ${o.classes[1]?.rotulo.toLowerCase() ?? "classe mais baixa"}`}
                    natureza="ESTIMADO"
                    evidencia={o.evidencias.media_razoes_renda_classe_baixa}
                    formato="pct"
                    casas={1}
                    tamanho="medio"
                    nota={
                      o.classes[1] && o.sensibilidade_media_razoes_renda[o.classes[1].codigo]
                        ? `Mediana ${pct(o.sensibilidade_media_razoes_renda[o.classes[1].codigo].mediana_renda_pct, 2)}: a média é sensível a poucas famílias.`
                        : undefined
                    }
                    endereco={`${ROTA}#p061`}
                  />
                </div>
                <InclusaoClassesPof orc={orcamentoBase(o, (l) => !codigoUf(l.territorio))} fonte={FONTE_POF} />

                <Analise titulo="Por UF, só no total das famílias">
                  <InclusaoUfsPof orc={orcamentoBase(o, (l) => !!codigoUf(l.territorio))} fonte={FONTE_POF} />
                </Analise>

                <Auditoria titulo="Conferência com a tabela 6715 e sensibilidade da média na renda">
                  <p className="text-sm text-carvao-muted">
                    {o.conferencia.comparacoes} comparações entre os microdados refeitos e a tabela 6715: despesa média com energia dentro de {num(o.conferencia.energia_max_diferenca_reais, 3)}{" "}
                    real em {o.conferencia.energia_ate_1_centavo}; distribuição dentro de {num(o.conferencia.distribuicao_max_diferenca_pp, 3)} ponto percentual em{" "}
                    {o.conferencia.distribuicao_ate_arredondamento}; CV a até {num(o.conferencia.cv_max_diferenca_pp, 2)} ponto. Tolerâncias: {o.conferencia.tolerancias.medias};{" "}
                    {o.conferencia.tolerancias.distribuicao}; {o.conferencia.tolerancias.cv}.
                  </p>
                  <TabelaInterativa
                    titulo="Brasil por classe: tabela 6715 e microdados"
                    colunas={COLUNAS_CONF_POF}
                    linhas={o.conferencia.comparacoes_brasil.map((x) => ({
                      id: x.classe,
                      classe: o.classes.find((cl) => cl.codigo === x.classe)?.rotulo ?? x.classe,
                      energia_sidra: x.energia_sidra,
                      energia_micro: x.energia_micro,
                      distribuicao_sidra: x.distribuicao_sidra,
                      razao_medias_micro: x.razao_medias_micro,
                      cv_ibge: x.cv_ibge,
                      cv_micro: x.cv_micro,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte={FONTE_POF}
                    versao={o.referencia}
                    nomeArquivo="inclusao-pof-conferencia-6715"
                  />
                  <TabelaInterativa
                    titulo="Média das participações na renda: mediana e sensibilidade, Brasil"
                    colunas={COLUNAS_SENS}
                    linhas={o.classes
                      .filter((cl) => o.sensibilidade_media_razoes_renda[cl.codigo])
                      .map((cl) => {
                        const s = o.sensibilidade_media_razoes_renda[cl.codigo];
                        return {
                          id: cl.codigo,
                          classe: cl.rotulo,
                          media: s.media_razoes_renda_pct,
                          mediana: s.mediana_renda_pct,
                          sem: s.media_sem_energia_acima_da_renda_pct,
                          n: s.familias_amostra_energia_acima_da_renda,
                          peso: s.peso_energia_acima_da_renda_pct,
                          tres: s.tres_maiores_contribuicoes_pp,
                        };
                      })}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte={FONTE_POF}
                    versao={o.referencia}
                    nomeArquivo="inclusao-pof-sensibilidade-renda"
                  />
                  {o.diagnostico_microdados && (
                    <p className="text-sm text-carvao-muted">
                      Microdados: {inteiro(o.diagnostico_microdados.familias)} famílias;{" "}
                      {Object.entries(o.diagnostico_microdados.registros)
                        .map(([r, d]) => `${r}: ${inteiro(d.linhas_usadas)} linhas usadas, ${inteiro(d.codigos_fora_do_tradutor)} códigos fora do tradutor`)
                        .join("; ")}
                      .
                    </p>
                  )}
                </Auditoria>

                <Seguir ancora="p061" href="#acesso" pergunta="Quem ainda não tem acesso adequado à energia?" downloads={downloads(["/energia/series/inclusao_pof.csv"])} />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P062 ---------------- */}
          <Bloco id="acesso">
            <PainelEvidencia
              id="p062"
              pergunta={a.pergunta}
              subtitulo="Domicílios sem energia e com rede em tempo integral (PNAD), localidades isoladas (PASI) e ligações do Luz para Todos · domicílios e pessoas"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Ter ligação e ter serviço confiável são coisas diferentes, e as duas faltam em lugares diferentes. Localidades fora do Sistema Interligado têm energia, em geral de usinas
                  a óleo diesel pagas em parte pela CCC, e o Luz para Todos registra as ligações novas que o programa fez.
                </>
              }
              oQueMudou={mudancaAcesso(a)}
              comoInterpretar={
                <>
                  Três dimensões, três fontes: a PNAD estima domicílios sem energia de nenhuma fonte e o fornecimento em tempo integral entre os ligados à rede geral; o PASI lista as
                  localidades atendidas por sistemas isolados; o Luz para Todos conta domicílios ligados por ano do atendimento. Elas não se somam. O percentual em tempo integral é sobre
                  os ligados à rede, não sobre todos os domicílios.
                </>
              }
              naoConcluir={
                <>
                  A carga do SIN não mede acesso: sistemas isolados e domicílios sem ligação ficam fora dela. Ligação feita não garante serviço confiável depois. Domicílio sem energia
                  não tem erro-padrão publicado, e em UF pequenas o CV passa de 5%. Localidade isolada não é localidade sem energia.
                </>
              }
              proveniencia={a.proveniencia.pnad}
              complementares={[
                ...(a.proveniencia.isolados ? [{ rotulo: "Sistemas isolados (PASI)", p: a.proveniencia.isolados }] : []),
                ...(a.proveniencia.luz_para_todos ? [{ rotulo: "Luz para Todos", p: a.proveniencia.luz_para_todos }] : []),
                ...(custeio ? [{ rotulo: "Custeio anual da CDE", p: custeio.proveniencia }] : []),
              ]}
            >
              <div className="space-y-6">
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p062">
                  {respostaAcesso(a)}
                </p>
                <Recorte
                  periodo={
                    <>
                      PNAD de {a.pnad_serie[0]?.ano} a {a.ano_referencia}; PASI ciclos {si?.ciclos.map((x) => x.ciclo).join(", ") ?? "sem dado"}; Luz para Todos de{" "}
                      {mes(lpt?.evidencia_total.periodo.inicio)} a {mes(lpt?.ultimo_mes)}
                    </>
                  }
                  universo={<>Domicílios particulares permanentes do Brasil, regiões e UF; localidades isoladas do planejamento da EPE; atendimentos homologados pelo MME</>}
                  unidade="domicílios (mil e %); pessoas; domicílios atendidos"
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Numero
                    rotulo={`Sem energia de nenhuma fonte, ${a.ano_referencia}`}
                    natureza="ESTIMADO"
                    evidencia={a.evidencia_sem_energia}
                    casas={0}
                    unidade="mil domicílios"
                    tamanho="medio"
                    motivoAusencia="Sem estimativa nesta publicação."
                    nota={brPnad ? `${pct(brPnad.pct_sem_energia, 1)} dos domicílios.` : undefined}
                    endereco={`${ROTA}#p062`}
                  />
                  <Numero
                    rotulo="Rede em tempo integral, entre os ligados"
                    natureza="ESTIMADO"
                    valor={brPnad?.pct_integral_entre_rede ?? null}
                    formato="pct"
                    casas={1}
                    periodo={a.ano_referencia}
                    tamanho="medio"
                    nota={brPnad ? `CV ${pct(brPnad.cv_pct_integral, 1)}; publicado pelo IBGE (tabela 6738).` : undefined}
                  />
                  <Numero
                    rotulo={`Pessoas em localidades isoladas, ciclo ${si?.ciclo ?? ""}`.trim()}
                    natureza="OBSERVADO"
                    evidencia={si?.evidencia_populacao ?? null}
                    casas={0}
                    unidade="pessoas"
                    tamanho="medio"
                    motivoAusencia="PASI não processado nesta publicação."
                    endereco={`${ROTA}#p062`}
                  />
                  <Numero
                    rotulo="Domicílios atendidos pelo Luz para Todos"
                    natureza="OBSERVADO"
                    evidencia={lpt?.evidencia_total ?? null}
                    casas={0}
                    unidade="domicílios"
                    tamanho="medio"
                    motivoAusencia="Arquivo do MME não processado nesta publicação."
                    endereco={`${ROTA}#p062`}
                  />
                </div>

                <Subtitulo>Quantos domicílios ainda não têm energia, e com que regularidade chega a dos ligados?</Subtitulo>
                <InclusaoRegioesPnad serie={a.pnad_serie} />
                <InclusaoMapaPnad acesso={{ ano_referencia: a.ano_referencia, pnad_serie: a.pnad_serie, pnad_situacao: a.pnad_situacao }} csvUrl="/energia/series/inclusao_acesso_pnad.csv" fonte={FONTE_PNAD} />

                {si && (
                  <>
                    <Subtitulo>Quem vive fora do Sistema Interligado?</Subtitulo>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      Localidades atendidas por sistemas isolados no planejamento da EPE (PASI). Isolamento não é falta de acesso: é acesso fora do SIN, em geral por usinas térmicas
                      locais. A população é informada pelas distribuidoras, não é contagem censitária.
                    </p>
                    <InclusaoIsolados si={{ ciclo: si.ciclo, por_uf: si.por_uf, localidades_mais_populosas: si.localidades_mais_populosas, pontos_json: si.pontos_json }} fonte={FONTE_PASI} />
                    <TabelaInterativa
                      titulo="Localidades isoladas por ciclo do PASI"
                      colunas={COLUNAS_CICLOS}
                      linhas={si.ciclos.map((x) => ({
                        id: x.ciclo,
                        ciclo: x.ciclo,
                        localidades: x.localidades,
                        populacao: x.populacao,
                        sem_pop: x.localidades_sem_populacao,
                        previsao: x.com_previsao_interligacao,
                        sairam: x.sairam_da_lista ?? null,
                      }))}
                      chaveLinha="id"
                      colunaRotulo="ciclo"
                      fonte={FONTE_PASI}
                      versao={si.ciclo}
                      nomeArquivo="inclusao-pasi-ciclos"
                      nota="Sair da lista de um ciclo para o seguinte costuma indicar interligação ao SIN, mas o PASI não informa o motivo em cada caso. O primeiro ciclo não tem anterior: saídas sem dado."
                    />
                  </>
                )}

                {lpt && (
                  <>
                    <Subtitulo>Quantas ligações o Luz para Todos fez, e onde?</Subtitulo>
                    <InclusaoLpt lpt={{ serie_anual: lpt.serie_anual, ultimo_mes: lpt.ultimo_mes, programas: lpt.programas, por_uf: lpt.por_uf }} fonte={FONTE_LPT} />
                  </>
                )}

                <Analise titulo="Detalhes do atendimento: municípios, recursos e custeio">
                  {lpt && (
                    <>
                      <TabelaInterativa
                        titulo={`Municípios com mais domicílios atendidos desde jan/2023 (até ${mes(lpt.ultimo_mes)})`}
                        colunas={COLUNAS_MUN_LPT}
                        linhas={lpt.municipios_mais_atendidos_desde_2023.map((m, i) => ({ id: `${m.uf}|${m.cod ?? i}`, municipio: m.municipio, uf: m.uf, cod: m.cod, domicilios: m.domicilios }))}
                        chaveLinha="id"
                        colunaRotulo="municipio"
                        fonte={FONTE_LPT}
                        versao={lpt.ultimo_mes}
                        nomeArquivo="inclusao-luz-para-todos-municipios-desde-2023"
                        ordemInicial={{ coluna: "domicilios", direcao: "desc" }}
                      />
                      <TabelaInterativa
                        titulo="Luz para Todos por ano do atendimento e programa"
                        colunas={colunasLpt(lpt)}
                        linhas={linhasLptAnual(lpt)}
                        chaveLinha="id"
                        colunaRotulo="ano"
                        fonte={FONTE_LPT}
                        versao={lpt.ultimo_mes}
                        nomeArquivo="inclusao-luz-para-todos-anual"
                        nota="Sem dado: nenhuma linha do programa no ano. Zero: linhas com quantidade zero no arquivo do MME."
                      />
                      <TabelaInterativa
                        titulo="Recursos do Luz para Todos por UF e fonte (contratado e pago não se somam)"
                        colunas={recursosCols}
                        linhas={lpt.recursos_por_uf.map((r) => ({ id: r.uf, ...r, nome: r.nome ?? r.uf }))}
                        chaveLinha="id"
                        colunaRotulo="nome"
                        fonte={FONTE_LPT}
                        versao={lpt.ultimo_mes}
                        nomeArquivo="inclusao-luz-para-todos-recursos-uf"
                        nota="R$ correntes, sem correção pela inflação. Os recursos por contrato e o valor anual da CDE para o programa são grandezas diferentes."
                      />
                    </>
                  )}
                  <GraficoBarras
                    titulo="Valores anuais da CDE para o Luz para Todos e para a CCC (R$ bilhões correntes)"
                    dados={a.universalizacao.luz_para_todos_cde.map((l) => {
                      const ccc = a.universalizacao.ccc_cde.find((x) => x.ano === l.ano)?.valor_reais ?? null;
                      return {
                        id: l.ano,
                        rotulo: l.ano === a.universalizacao.ano_corrente_orcado ? `${l.ano} (ano em curso)` : l.ano,
                        lpt: l.valor_reais === null ? null : l.valor_reais / 1e9,
                        ccc: ccc === null ? null : ccc / 1e9,
                      };
                    })}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "lpt", rotulo: "Luz para Todos", cor: "var(--cor-energia)" },
                      { id: "ccc", rotulo: "CCC (sistemas isolados)", cor: "var(--serie-termica)" },
                    ]}
                    unidade="R$ bilhões"
                    casas={2}
                    altura={300}
                  />
                </Analise>

                <Auditoria titulo="Conferências, lacunas e fontes tentadas">
                  {si?.conferencia_pdf && (
                    <p className="text-sm text-carvao-muted">
                      PASI contra o caderno em PDF ({si.conferencia_pdf.documento}, página {si.conferencia_pdf.pagina}): {si.conferencia_pdf.localidades_pdf} localidades e{" "}
                      {num(si.conferencia_pdf.populacao_milhoes_pdf, 3)} milhão de pessoas no texto; {si.conferencia_pdf.localidades_xlsx} localidades e{" "}
                      {inteiro(si.conferencia_pdf.populacao_xlsx)} pessoas na exportação. Resultado: {si.conferencia_pdf.resultado}. Tolerância: {si.conferencia_pdf.tolerancia}.
                    </p>
                  )}
                  {lpt && (
                    <p className="text-sm text-carvao-muted">
                      Luz para Todos: {inteiro(lpt.municipios.total)} nomes de município no arquivo, {inteiro(lpt.municipios.com_codigo_ibge)} com código IBGE pelo nome exato na UF;{" "}
                      {lpt.municipios.sem_codigo_ibge} sem correspondência ({inteiro(lpt.municipios.domicilios_sem_codigo)} domicílios, contados na UF e no total). Maiores sem código:{" "}
                      {lpt.municipios.maiores_sem_codigo
                        .slice(0, 5)
                        .map((m) => `${m.municipio} (${m.uf})`)
                        .join(", ")}
                      .
                    </p>
                  )}
                  <p className="text-sm text-carvao-muted">{a.universalizacao.limitacao}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {a.universalizacao.fontes_tentadas.map((f) => (
                      <li key={f} className="break-words">
                        {f}
                      </li>
                    ))}
                  </ul>
                </Auditoria>

                <Seguir
                  ancora="p062"
                  href="/setor-eletrico/conta-de-luz"
                  pergunta="Quanto custa a energia ao consumidor e o que compõe a conta?"
                  downloads={downloads([
                    "/energia/series/inclusao_acesso_pnad.csv",
                    "/energia/series/inclusao_sistemas_isolados.csv",
                    "/energia/series/inclusao_luz_para_todos_mensal.csv",
                    "/energia/series/inclusao_luz_para_todos_municipios.csv",
                    "/energia/series/inclusao_luz_para_todos_recursos.csv",
                  ])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
