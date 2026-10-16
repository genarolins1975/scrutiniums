import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Nota, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { meta, URL_GOLD } from "@/lib/saneamento/gold";
import { inteiro } from "@/lib/saneamento/formato";
import { ROTULO_SITUACAO_FONTE, VIABILIDADE } from "@/lib/saneamento/viabilidade";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { ESTUDOS } from "@/lib/saneamento/dados/estudos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Método, fontes e conferências",
  description:
    "Fontes com data e sha256, matriz de viabilidade por pergunta, contrato metodológico, conferências entre bases, downloads e limitações do Observatório Brasileiro do Saneamento.",
  alternates: { canonical: "/saneamento/metodologia" },
};

const CONTRATO: [string, string][] = [
  ["Grão explícito", "Cada número declara a unidade de observação: morador, domicílio, economia, imóvel, volume, município, prestador ou estação. Grãos diferentes não se somam nem se dividem entre si."],
  ["Sem média de percentuais", "Territórios agregam pela soma: Σ numerador ÷ Σ denominador. Para o Censo, vale a tabulação do IBGE em cada nível; para o SINISA, o consolidado oficial do ministério. A NR 8 não tem agregado oficial e soma numeradores e denominadores municipais."],
  ["Zero, ausência e não informado", "Zero declarado aparece como zero. Campo vazio é ausência e aparece como \"sem dado\", com o motivo publicado pela fonte quando existe (não calculado, divisão por zero, consultar prestador). Nada é preenchido."],
  ["Valores nominais", "Reais correntes do ano de referência, sem correção monetária. Nenhuma série monetária do Observatório mistura anos sem deflator declarado."],
  ["Validade temporal", "Censo 2022 e SINISA 2024 ficam lado a lado com os anos nos rótulos. Tabelas tarifárias valem pela vigência do ato. Nenhuma comparação apresenta períodos diferentes como simultâneos."],
  ["Sem imputação silenciosa", "Municípios fora de um módulo ficam fora da soma e a cobertura é informada. Não há estimativa para quem não declarou."],
  ["Sem dado pessoal", "Todas as bases são agregadas por município, prestador ou estação. Nenhum dado de pessoa física é coletado ou publicado."],
  ["Divergências explicadas", "Quando duas bases discordam, a diferença é calculada, publicada e explicada nas conferências abaixo; nunca redistribuída."],
];

const ARQUIVOS: [string, string][] = [
  ["municipios.csv", "Tabela municipal com todas as medidas (Censo, SINISA, NR 8, investimento, arranjo institucional), uma linha por município"],
  ["municipios.json", "A mesma tabela em formato compacto (campos e linhas), usada pelo atlas"],
  ["agregados.json", "Brasil, regiões e UFs: Censo, consolidado SINISA, continuidade, gestão municipal"],
  ["prestadores.csv", "Cadastro de prestadores com perímetro, população, perdas e investimento"],
  ["prestadores.json", "Prestadores com volumes, receita, despesa e balanço declarados"],
  ["reguladores.json", "Entidades reguladoras por CNPJ e municípios que as declararam"],
  ["etes.csv", "Estações de tratamento de esgoto declaradas"],
  ["desigualdades_municipios.csv", "Censo 2022 por grupo (cor ou raça, quilombolas, indígenas, favelas): carência e universo por município"],
  ["qualidade_municipios.csv", "SISAGUA 2024 e 2025: registro de controle e vigilância e numerador e denominador de cada medida de qualidade da água, por município"],
  ["saude_municipios.csv", "SIH e SIM, 2022 a 2024: internações e óbitos por infecções intestinais, leptospirose e esquistossomose, soma dos três anos por município de residência"],
  ["meta.json", "Proveniência: arquivos de origem, sha256, datas, cobertura e conferências"],
];

export default function Pagina() {
  const m = meta();
  const zips = Object.values(m?.sinisa.zips ?? {});
  const planilhas = Object.entries(m?.sinisa.planilhas ?? {});
  const censo = Object.entries(m?.censo.tabelas ?? {});
  const consultasSaude = m?.saude?.consultas ?? [];

  const linhasViab = VIABILIDADE.map((v) => ({
    pergunta: v.pergunta,
    capitulo: v.capitulo,
    indicador: v.indicador,
    fonte: v.fonte,
    periodo: v.periodo,
    unidade_geografica: v.unidadeGeografica,
    unidade_observacao: v.unidadeObservacao,
    cobertura: v.cobertura,
    atualizacao: v.atualizacao,
    acesso: v.acesso,
    limitacoes: v.limitacoes,
    situacao: ROTULO_SITUACAO_FONTE[v.situacao],
  }));

  return (
    <>
      <Cabecalho atual="metodologia" />
      <MarcaVisita secao="saneamento:metodologia" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          titulo="Método, fontes e conferências"
          texto={
            <p>
              Tudo o que o Observatório publica vem de fonte pública identificada, com data de captura e impressão digital (sha256) do arquivo original.
              Esta página reúne as fontes, o que cada uma permite responder, as regras de cálculo, as conferências entre bases e os arquivos para
              download.
            </p>
          }
          recorte={
            <>
              SINISA 2025 (ano de referência 2024), publicação de {m?.sinisa.publicacao.split("-").reverse().join("/") ?? "sem dado"}, retificação municipal de
              água em {m?.sinisa.retificacao_agua_municipal.split("-").reverse().join("/") ?? "sem dado"}; IBGE, Censos 2010 e 2022 e estimativa de população
              2024. Captura em {m?.sinisa.capturado_em.slice(0, 10).split("-").reverse().join("/") ?? "sem dado"}.
            </>
          }
        />

        <Secao id="contrato" titulo="Contrato metodológico">
          <dl className="grid max-w-5xl grid-cols-1 gap-x-10 md:grid-cols-2">
            {CONTRATO.map(([t, d]) => (
              <div key={t} className="border-t border-linha py-4">
                <dt className="font-medium text-carvao">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </Secao>

        <Secao
          id="viabilidade"
          titulo="Matriz de viabilidade"
          texto="Cada pergunta do Observatório com o indicador, a fonte, o grão, a cobertura, o acesso, as limitações e a situação real de integração. O que não está integrado aparece como tal nos capítulos."
        >
          <TabelaDados
            titulo="Matriz de viabilidade"
            arquivo="saneamento-matriz-viabilidade.csv"
            colunas={[
              { id: "pergunta", rotulo: "Pergunta", detalhe: "indicador" },
              { id: "capitulo", rotulo: "Capítulo" },
              { id: "fonte", rotulo: "Fonte" },
              { id: "periodo", rotulo: "Período" },
              { id: "unidade_geografica", rotulo: "Unidade geográfica" },
              { id: "unidade_observacao", rotulo: "Unidade de observação" },
              { id: "cobertura", rotulo: "Cobertura" },
              { id: "atualizacao", rotulo: "Atualização" },
              { id: "acesso", rotulo: "Acesso" },
              { id: "limitacoes", rotulo: "Limitações" },
              { id: "situacao", rotulo: "Situação" },
            ]}
            linhas={linhasViab}
            limite={40}
            rotuloLinhas={{ singular: "pergunta", plural: "perguntas" }}
          />
        </Secao>

        <Secao id="conferencias" titulo="Conferências entre bases" texto="Pontos em que duas publicações oficiais poderiam divergir, com o cálculo feito e a conclusão.">
          <div className="space-y-6">
            {(m?.conferencias ?? []).map((c) => (
              <article key={c.id} className="max-w-4xl border-t border-linha pt-4">
                <h3 className="font-medium text-carvao">{c.descricao}</h3>
                <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  {Object.entries(c.valores).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-linha py-1">
                      <dt className="text-carvao-muted">{k.replace(/_/g, " ")}</dt>
                      <dd className="tabular-nums text-carvao">{v == null ? "sem dado" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-sm leading-relaxed text-carvao">{c.conclusao}</p>
              </article>
            ))}
          </div>
          <Nota titulo="Os mesmos números do Observatório de Eficiência do Estado">
            O capítulo de saneamento do Observatório de Eficiência do Estado usa os mesmos arquivos consolidados do SINISA 2024 (sha256 idênticos).
            A diferença de população no módulo de esgoto, antes registrada como divergência aberta, é a conferência acima: os{" "}
            {inteiro(m?.cobertura.esgoto_delegacao_sem_atendimento)} municípios com delegação sem atendimento entram no denominador do consolidado e
            ficam fora dos indicadores municipais.
          </Nota>
        </Secao>

        <Secao id="fontes" titulo="Arquivos de origem" texto="Arquivos baixados das páginas oficiais, com tamanho e sha256 conferíveis por qualquer pessoa.">
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Arquivos do SINISA (rolável)">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">Arquivos ZIP do SINISA com sha256</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Arquivo</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Bytes</th>
                  <th scope="col" className="py-2 font-medium">sha256</th>
                </tr>
              </thead>
              <tbody>
                {zips.map((z) => (
                  <tr key={z.arquivo} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      <a href={z.url} className="text-obee-dark underline underline-offset-2" rel="noopener noreferrer">
                        {z.arquivo}
                      </a>
                    </th>
                    <td className="py-2 pr-4 text-right tabular-nums">{inteiro(z.bytes)}</td>
                    <td className="py-2 font-mono text-xs [overflow-wrap:anywhere]">{z.sha256}</td>
                  </tr>
                ))}
                {m?.sinisa.gestao_municipal && (
                  <tr className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      <a href={m.sinisa.gestao_municipal.url} className="text-obee-dark underline underline-offset-2" rel="noopener noreferrer">
                        SINISA, Gestão Municipal 2024 (planilha)
                      </a>
                    </th>
                    <td className="py-2 pr-4 text-right">sem dado</td>
                    <td className="py-2 font-mono text-xs [overflow-wrap:anywhere]">{m.sinisa.gestao_municipal.sha256}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <details className="mt-6">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-obee-dark underline underline-offset-4">
              Planilhas extraídas ({planilhas.length}) e tabelas do IBGE ({censo.length})
            </summary>
            <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Planilhas extraídas (rolável)">
              <table className="w-full min-w-[52rem] border-collapse text-xs">
                <caption className="sr-only">Planilhas do SINISA usadas</caption>
                <thead>
                  <tr className="border-b border-carvao text-left">
                    <th scope="col" className="py-2 pr-4 font-medium">Planilha</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Data no ZIP</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Registros</th>
                    <th scope="col" className="py-2 font-medium">sha256</th>
                  </tr>
                </thead>
                <tbody>
                  {planilhas.map(([id, p]) => (
                    <tr key={id} className="border-b border-linha align-top">
                      <th scope="row" className="py-1 pr-4 text-left font-normal">
                        {p.arquivo}
                        <span className="block text-carvao-muted">aba {p.aba}</span>
                      </th>
                      <td className="py-1 pr-4">{p.data_no_zip}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{inteiro(p.registros)}</td>
                      <td className="py-1 font-mono [overflow-wrap:anywhere]">{p.sha256}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {censo.map(([id, t]) => (
                <li key={id} className="border-t border-linha pt-2">
                  <span className="font-medium">SIDRA {t.tabela}</span> ({t.ano}): {t.titulo}.{" "}
                  <span className="text-carvao-muted">
                    {inteiro(t.consultas)} consultas, sha256 de cada resposta em meta.json.
                  </span>
                </li>
              ))}
              {m && (
                <li className="border-t border-linha pt-2">
                  <span className="font-medium">SIDRA {m.censo.populacao_2024.tabela}</span>: estimativa de população {m.censo.populacao_2024.ano}.{" "}
                  <span className="text-carvao-muted">Lista de municípios do IBGE: {inteiro(m.censo.municipios.total)} municípios.</span>
                </li>
              )}
            </ul>
          </details>

          {consultasSaude.length > 0 && (
            <details className="mt-6">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-obee-dark underline underline-offset-4">
                Consultas ao DATASUS, capítulo 13 ({consultasSaude.length})
              </summary>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Tabulações públicas do TabNet (Morbidade Hospitalar do SUS por residência e Mortalidade por residência), uma por doença e medida, gravadas
                como a fonte as devolveu. Município de residência; janela de {m?.saude?.periodo[0]} a {m?.saude?.periodo[m.saude.periodo.length - 1]}.
              </p>
              <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Consultas ao DATASUS (rolável)">
                <table className="w-full min-w-[48rem] border-collapse text-xs">
                  <caption className="sr-only">Consultas ao TabNet com sha256 da resposta</caption>
                  <thead>
                    <tr className="border-b border-carvao text-left">
                      <th scope="col" className="py-2 pr-4 font-medium">Consulta</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Bytes</th>
                      <th scope="col" className="py-2 font-medium">sha256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultasSaude.map((c) => (
                      <tr key={c.id} className="border-b border-linha align-top">
                        <th scope="row" className="py-1 pr-4 text-left font-normal">{c.rotulo}</th>
                        <td className="py-1 pr-4 text-right tabular-nums">{inteiro(c.bytes)}</td>
                        <td className="py-1 font-mono [overflow-wrap:anywhere]">{c.sha256}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <h3 className="mt-10 font-serif text-xl text-carvao">Atos e tabelas tarifárias</h3>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {TARIFAS.length} tabelas tarifárias e {ESTUDOS.length} estudos de caso de formação da tarifa, lidos nos documentos oficiais; cada um traz URL,
            sha256 e localizador da página na própria página do capítulo 5. Exemplos de conta publicados pelos reguladores são recalculados pelo
            gerador e pelos testes automatizados e coincidem ao centavo.
          </p>
        </Secao>

        <Secao id="downloads" titulo="Downloads" texto="Arquivos derivados, gerados de forma reprodutível pelo pipeline do repositório (pipeline/observatorio_saneamento). CSV com ponto e vírgula e vírgula decimal; campo vazio é ausência.">
          <ul className="grid max-w-5xl grid-cols-1 gap-x-10 md:grid-cols-2">
            {ARQUIVOS.map(([a, d]) => (
              <li key={a} className="border-t border-linha py-3 text-sm">
                <a href={`${URL_GOLD}/${a}`} download className="font-medium text-obee-dark underline underline-offset-2">
                  {a}
                </a>
                <span className="mt-1 block text-carvao-muted">{d}</span>
              </li>
            ))}
          </ul>
          <Nota>Fichas municipais completas, por UF, em {URL_GOLD}/uf/SIGLA.json (por exemplo, {URL_GOLD}/uf/SE.json).</Nota>
        </Secao>

        <Secao id="limitacoes" titulo="Limitações gerais">
          <ul className="max-w-prose2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao">
            <li>O SINISA reúne declarações de prestadores e municípios. O ministério aplica regras de consistência, mas não audita os dados em campo.</li>
            <li>
              O Censo 2022 e o SINISA 2024 medem coisas diferentes (ligação declarada pelo morador; atendimento declarado pelo prestador) em anos
              diferentes. Os dois aparecem lado a lado e nunca são combinados numa mesma razão.
            </li>
            <li>Não há base nacional de tarifas nem de atos regulatórios: o capítulo 5 trabalha com amostra verificada, declarada como tal.</li>
            <li>
              O cumprimento das metas da Lei 11.445/2007 depende de indicadores (ICA, ICE) e de soluções alternativas que o SINISA não traz; o
              Observatório não declara cumprimento nem descumprimento.
            </li>
            <li>Capítulos 2 e 13 e a comparação internacional ainda não têm painel; a matriz acima mostra a fonte de cada um.</li>
          </ul>
        </Secao>
      </main>
    </>
  );
}
