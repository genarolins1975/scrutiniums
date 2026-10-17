import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FiguraOds, MundoNoCapitulo } from "@/components/saneamento/ReferenciaMundial";
import { LabRitmoMeta, type TerritorioRitmo } from "@/components/saneamento/Laboratorios";
import { agregado, agregados, meta, municipios } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero, sinal } from "@/lib/saneamento/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "O planejamento é suficiente para a universalização?",
  description:
    "Metas do art. 11-B da Lei 11.445/2007, indicadores de atendimento da NR ANA 8/2024 aproximados com dados públicos, distância à meta por UF, ritmo aritmético necessário e planos municipais declarados ao SINISA.",
  alternates: { canonical: "/saneamento/planejamento" },
};

const ATLAS = ["nr8-iaa-rede", "nr8-iae-rede"];
/** Anos de 2025 a 2033: do ano de referência do SINISA (2024) ao prazo legal (31/12/2033). */
const ANOS_ATE_META = 9;

export default function Pagina() {
  const cap = capituloPorSlug("planejamento")!;
  const m = meta();
  const ags = agregados();
  const br = agregado("BR");
  const lista = municipios();
  const refs = referencias(ags, lista, ATLAS);
  const ufs = ags.filter((a) => a.tipo === "UF");
  const nomesUf = Object.fromEntries(ufs.map((u) => [u.id, u.nome]));
  const metaAgua = m?.metas.agua ?? 99;
  const metaEsgoto = m?.metas.esgoto ?? 90;

  const comIaa = lista.filter((x) => x.iaa_rede != null);
  const comIae = lista.filter((x) => x.iae_rede != null);
  const iaaNaMeta = comIaa.filter((x) => (x.iaa_rede ?? 0) >= metaAgua).length;
  const iaeNaMeta = comIae.filter((x) => (x.iae_rede ?? 0) >= metaEsgoto).length;
  const iaaAcima100 = comIaa.filter((x) => (x.iaa_rede ?? 0) > 100).length;
  const iaeAcima100 = comIae.filter((x) => (x.iae_rede ?? 0) > 100).length;
  // Razão de somas no Brasil, com e sem limitar cada município a 100% (as economias que excedem a estimativa de domicílios).
  const comNr8 = comIaa.filter((x) => x.nr8_ag_num != null && x.dom_est24 != null && x.dom_est24 > 0);
  const domNr8 = comNr8.reduce((t, x) => t + (x.dom_est24 ?? 0), 0);
  const iaaBrasil = domNr8 > 0 ? (comNr8.reduce((t, x) => t + (x.nr8_ag_num ?? 0), 0) / domNr8) * 100 : null;
  const iaaBrasilLimitado = domNr8 > 0 ? (comNr8.reduce((t, x) => t + Math.min(x.nr8_ag_num ?? 0, x.dom_est24 ?? 0), 0) / domNr8) * 100 : null;
  const iag0004Brasil = br?.sinisa.agua.indicadores.IAG0004 ?? null;

  const linhasUf = [br!, ...ufs].map((u) => {
    const ag = u.sinisa.agua.indicadores.IAG0004 ?? null;
    const es = u.sinisa.esgoto.indicadores.IES0007 ?? null;
    const e22 = razaoPct(u.censo2022.moradores?.esgoto.rede_pluvial, u.censo2022.moradores?.esgoto.total);
    const e10 = razaoPct(u.censo2010?.esgoto_rede_pluvial, u.censo2010?.esgoto_moradores);
    return {
      id: u.id,
      nome: u.id === "BR" ? "Brasil" : u.nome,
      ag,
      ritmoAg: ag == null ? null : Math.max(0, metaAgua - ag) / ANOS_ATE_META,
      es,
      ritmoEs: es == null ? null : Math.max(0, metaEsgoto - es) / ANOS_ATE_META,
      historico: e22 == null || e10 == null ? null : (e22 - e10) / 12,
    };
  });

  // Régua do Censo, igual em 2010 e 2022: água pela rede geral como forma principal, esgoto pela rede geral ou pluvial.
  const territoriosRitmo: TerritorioRitmo[] = ags
    .map((a) => {
      const ag10 = razaoPct(a.censo2010?.agua_rede, a.censo2010?.moradores);
      const ag22 = razaoPct(a.censo2022.moradores?.agua.rede, a.censo2022.moradores?.agua.total);
      const es10 = razaoPct(a.censo2010?.esgoto_rede_pluvial, a.censo2010?.esgoto_moradores);
      const es22 = razaoPct(a.censo2022.moradores?.esgoto.rede_pluvial, a.censo2022.moradores?.esgoto.total);
      return {
        id: a.id,
        nome: a.tipo === "Região" ? `Região ${a.nome}` : a.nome,
        grupo: a.tipo === "UF" ? ("Unidades da Federação" as const) : ("Brasil e regiões" as const),
        agua: ag10 == null || ag22 == null ? null : { v2010: ag10, v2022: ag22 },
        esgoto: es10 == null || es22 == null ? null : { v2010: es10, v2022: es22 },
      };
    })
    .filter((t) => t.agua && t.esgoto);

  const g = br?.gestao;
  const anos = g ? Object.entries(g.plano_anos).map(([a, n]) => ({ a: Number(a), n })) : [];
  const porDecada = [
    { id: "ate2009", rotulo: "Até 2009", v: anos.filter((x) => x.a <= 2009).reduce((s, x) => s + x.n, 0) },
    ...Array.from({ length: 16 }, (_, i) => 2010 + i).map((a) => ({ id: String(a), rotulo: String(a), v: anos.find((x) => x.a === a)?.n ?? 0 })),
  ];
  const planoAntigo = anos.filter((x) => x.a <= 2014).reduce((s, x) => s + x.n, 0);
  const planosUf = ufs
    .map((u) => ({ id: u.id, rotulo: u.nome, v: razaoPct(u.gestao.plano_sim, u.gestao.respondentes), resp: u.gestao.respondentes, total: u.municipios }))
    .sort((a, b) => (b.v ?? 0) - (a.v ?? 0));

  return (
    <>
      <Cabecalho atual="planejamento" />
      <MarcaVisita secao="saneamento:planejamento" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={11}
          titulo={cap.pergunta}
          texto={
            <p>
              A Lei 11.445/2007, no art. 11-B, fixa até 31 de dezembro de 2033 o atendimento de {metaAgua}% da população com água potável e de{" "}
              {metaEsgoto}% com coleta e tratamento de esgoto. A ANA definiu, na Norma de Referência 8/2024, como medir essas metas. Este capítulo
              mostra onde cada território está pela melhor aproximação pública dessa medida, quanto falta, que ritmo a aritmética exige e que planos
              os municípios declaram ter.
            </p>
          }
          recorte={
            <>
              SINISA 2025 (ano de referência 2024) e IBGE. {inteiro(comIaa.length)} municípios com indicador de água calculável pela fórmula da NR 8 e{" "}
              {inteiro(comIae.length)} com indicador de esgoto com tratamento. Módulo Gestão Municipal: {inteiro(g?.respondentes)} municípios
              responderam.
            </>
          }
        />

        <Numeros
          colunas={3}
          itens={[
            {
              rotulo: `Municípios com IAA de rede pública de ${metaAgua}% ou mais`,
              valor: inteiro(iaaNaMeta),
              contexto: (
                <>
                  De {inteiro(comIaa.length)} com valor calculável; {inteiro(iaaAcima100)} deles passam de 100%, quando as economias ativas excedem a
                  estimativa de domicílios. Aproximação da NR 8 sem soluções alternativas e sem o ICA.
                </>
              ),
            },
            {
              rotulo: `Municípios com IAE de rede com tratamento de ${metaEsgoto}% ou mais`,
              valor: inteiro(iaeNaMeta),
              contexto: (
                <>
                  De {inteiro(comIae.length)} com economias com tratamento informadas; {inteiro(iaeAcima100)} deles passam de 100%. Sem soluções
                  individuais e sem o ICE.
                </>
              ),
            },
            {
              rotulo: "Municípios que declaram ter plano municipal de saneamento",
              valor: inteiro(g?.plano_sim),
              contexto: (
                <>
                  De {inteiro(g?.respondentes)} respondentes ({numero(razaoPct(g?.plano_sim, g?.respondentes), 1)}%); {inteiro(g?.nao_respondentes)} municípios não
                  responderam. Declaração, não verificação de conteúdo.
                </>
              ),
            },
          ]}
        />
        <Nota titulo="Por que o IAA do Brasil não é o IAG0004">
          Somando as economias residenciais ativas e os domicílios ocupados estimados dos {inteiro(comNr8.length)} municípios com valor, o IAA do Brasil é{" "}
          {numero(iaaBrasil, 1)}%. Limitando cada município a 100%, cai para {numero(iaaBrasilLimitado, 1)}%. O indicador oficial consolidado do SINISA
          para domicílios com rede de água (IAG0004) é {numero(iag0004Brasil, 1)}%. Os dois primeiros usam as economias ativas e a estimativa de domicílios do IBGE; o primeiro deixa o excesso de uma cidade compensar a
          falta de outra, o segundo não. O IAG0004 é o consolidado que o SINISA publica, segundo a sua própria ficha de indicador. Não são
          intercambiáveis, e nenhum dos três mede cumprimento de meta.
        </Nota>
        <Nota titulo="O que não é cumprimento de meta">
          A NR 8 mede a meta em domicílios e exige dois indicadores por serviço: o de atendimento (IAA, IAE) e o de cobertura (ICA, ICE), ambos acima
          da meta. O SINISA não traz a cobertura nem as soluções alternativas que o regulador pode aceitar. Por isso nenhum município é declarado aqui
          como tendo cumprido ou descumprido a meta: o que se mostra é a parcela de rede pública, calculada com a mesma fórmula.
        </Nota>

        <Secao
          id="atlas"
          titulo="Onde cada município está pela fórmula da NR 8?"
          texto="Economias residenciais ativas (de água; de esgoto com tratamento) sobre os domicílios ocupados estimados para 2024: população estimada pelo IBGE dividida pela média de moradores por domicílio do Censo 2022, como manda a ficha do indicador."
        >
          <AtlasMunicipal ids={ATLAS} referencias={refs} nomesUf={nomesUf} titulo="Atlas municipal dos indicadores de atendimento da NR 8" />
          <Fonte>
            ANA, Norma de Referência 8/2024, fichas IAA e IAE; Ministério das Cidades, SINISA 2025 (2024), campos GTA0009, GTA0016, GTE0009 e
            GTE0019; IBGE, estimativa de população 2024 e Censo 2022 (tabelas 6803 e 6894). A referência da UF soma numeradores e denominadores
            municipais: não há agregado oficial.
          </Fonte>
        </Secao>

        <Secao
          id="ritmo"
          titulo="Quanto falta e que ritmo a aritmética exige?"
          texto={
            <>
              Distância à meta pelo indicador oficial consolidado de domicílios do SINISA (IAG0004 para água; IES0007 para coleta com tratamento),
              dividida pelos {ANOS_ATE_META} anos de 2025 a 2033. É conta, não projeção: não supõe crescimento populacional, mudança de domicílios
              nem curva de obras.
            </>
          }
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Distância à meta por UF (rolável)">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only">Situação em 2024, distância à meta e ritmo aritmético por UF</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Território</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Domicílios com rede de água, 2024 (IAG0004)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Ritmo para {metaAgua}% (p.p. por ano)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Domicílios com coleta e tratamento, 2024 (IES0007)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Ritmo para {metaEsgoto}% (p.p. por ano)</th>
                  <th scope="col" className="py-2 font-medium">Referência histórica: rede de esgoto no Censo, 2010 a 2022 (p.p. por ano)</th>
                </tr>
              </thead>
              <tbody>
                {linhasUf.map((l) => (
                  <tr key={l.id} className={`border-b border-linha text-right tabular-nums ${l.id === "BR" ? "font-medium" : ""}`}>
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{l.nome}</th>
                    <td className="py-2 pr-4">{l.ag == null ? "sem dado" : `${numero(l.ag, 1)}%`}</td>
                    <td className="py-2 pr-4">{numero(l.ritmoAg, 2)}</td>
                    <td className="py-2 pr-4">{l.es == null ? "sem dado" : `${numero(l.es, 1)}%`}</td>
                    <td className="py-2 pr-4">{numero(l.ritmoEs, 2)}</td>
                    <td className="py-2">{sinal(l.historico, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Comparar o esforço anual que a meta exige em cada UF, sobre o indicador oficial consolidado, e pôr ao lado o ritmo observado entre os Censos."
            naoPermite="Comparar diretamente o ritmo exigido com o histórico: o Censo mede moradores com rede geral ou pluvial, sem tratamento; o SINISA mede domicílios com coleta e tratamento, sobre o total de domicílios informado pelo município. A coluna histórica é ordem de grandeza, não a mesma régua."
          />
          <Fonte>
            Lei 11.445/2007, art. 11-B (redação da Lei 14.026/2020); SINISA 2025 (2024), consolidado por UF; IBGE, Censos 2010 e 2022. Ritmo = (meta −
            valor de 2024) ÷ {ANOS_ATE_META}, zero quando o valor já supera a meta. &quot;Sem dado&quot;: o consolidado oficial publica a UF sem o indicador; o
            Observatório não o recalcula.
          </Fonte>
        </Secao>

        <Secao
          id="laboratorio-ritmo"
          titulo="E se o ritmo dos Censos continuasse?"
          texto="Para comparar o ritmo exigido com o observado, as duas pontas precisam ser medidas da mesma forma. O Censo é a única régua igual em 2010 e 2022; o laboratório a usa para as duas contas."
        >
          <LabRitmoMeta territorios={territoriosRitmo} metas={{ agua: metaAgua, esgoto: metaEsgoto }} />
        </Secao>

        <Secao
          id="mundo"
          titulo="Como o mundo mede o planejamento da água?"
          texto="O ODS 6.5.1 pergunta a cada governo quanto da gestão integrada de recursos hídricos já funciona: leis, instituições, instrumentos e financiamento. É a régua internacional de governança da água; não mede plano de saneamento nem distância da meta legal."
        >
          <MundoNoCapitulo>
            <FiguraOds codigo="ER_H2O_IWRMD" />
          </MundoNoCapitulo>
        </Secao>

        <Secao
          id="planos"
          titulo="Os municípios têm plano, e de quando?"
          texto="Resposta dos municípios ao módulo Gestão Municipal do SINISA 2024: se há plano municipal de saneamento básico, o instrumento que o aprovou e a data. A lei prevê revisão periódica dos planos em prazo não superior a dez anos."
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <GraficoBarras
              titulo="Planos municipais declarados, por ano do instrumento de aprovação"
              dados={porDecada}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "municípios", cor: "var(--cor-obee)" }]}
              unidade="municípios"
              casas={0}
              orientacao="vertical"
            />
            <GraficoBarras
              titulo="Respondentes que declaram ter plano, por UF (%)"
              dados={planosUf.map((u) => ({ id: u.id, rotulo: u.rotulo, v: u.v }))}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "%", cor: "var(--escala-seq-4)" }]}
              unidade="%"
              casas={1}
              orientacao="horizontal"
              referencias={[{ valor: razaoPct(g?.plano_sim, g?.respondentes) ?? 0, rotulo: "Brasil" }]}
              limiteInicial={12}
            />
          </div>
          <dl className="mt-8 grid max-w-5xl grid-cols-1 gap-x-10 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">Planos aprovados até 2014</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{inteiro(planoAntigo)}</dd>
              <dd className="text-xs text-carvao-muted">Dez anos ou mais antes do ano de referência, sem informação de revisão.</dd>
            </div>
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">Plano sem data informada</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{inteiro(g?.plano_sem_ano)}</dd>
            </div>
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">Sem plano, com plano em elaboração</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{inteiro(g?.plano_em_elaboracao)}</dd>
              <dd className="text-xs text-carvao-muted">De {inteiro(g?.plano_nao)} que declararam não ter plano.</dd>
            </div>
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">Com política municipal de saneamento</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{inteiro(g?.politica_sim)}</dd>
            </div>
          </dl>
          <Ressalva
            permite="Saber quantos municípios declaram ter plano, de quando é o instrumento e onde a declaração é menos frequente."
            naoPermite="Avaliar a qualidade do plano nem se ele foi revisado: o SINISA registra a data do instrumento informado, não o conteúdo, as metas nem a execução. O ano é o da data do instrumento informada pelo município."
          />
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), módulo Gestão Municipal, planilha publicada pelo ministério.</Fonte>
        </Secao>
      </main>
    </>
  );
}
