import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, NestaPagina, Nota, RessalvaAutodeclarado, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { meta, URL_GOLD } from "@/lib/saneamento/gold";
import { data, inteiro, numero } from "@/lib/saneamento/formato";
import { ROTULO_SITUACAO_FONTE, VIABILIDADE } from "@/lib/saneamento/viabilidade";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { ESTUDOS } from "@/lib/saneamento/dados/estudos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Método, fontes e conferências",
  description:
    "Fontes com data e sha256, matriz de viabilidade por pergunta, contrato metodológico, conferências entre bases, downloads e limitações da coleção Saneamento.",
  alternates: { canonical: "/saneamento/metodologia" },
};

const CONTRATO: [string, string][] = [
  ["Grão explícito", "Cada número declara a unidade de observação: morador, domicílio, economia, imóvel, volume, município, prestador ou estação. Grãos diferentes não se somam nem se dividem entre si."],
  ["Sem média de percentuais", "Territórios agregam pela soma: Σ numerador ÷ Σ denominador. Para o Censo, vale a tabulação do IBGE em cada nível; para o SINISA, o consolidado oficial do ministério. A NR 8 não tem agregado oficial e soma numeradores e denominadores municipais."],
  ["Zero, ausência e não informado", "Zero declarado aparece como zero. Campo vazio é ausência e aparece como \"sem dado\", com o motivo publicado pela fonte quando existe (não calculado, divisão por zero, consultar prestador). Nada é preenchido."],
  ["Valores nominais", "Reais correntes do ano de referência, sem correção monetária. Nenhuma série monetária do Observatório mistura anos sem deflator declarado."],
  ["Validade temporal", "Censo 2022 e SINISA 2024 ficam lado a lado com os anos nos rótulos. Tabelas tarifárias valem pela vigência do ato. Nenhuma comparação apresenta períodos diferentes como simultâneos."],
  ["Sem imputação silenciosa", "Municípios fora de um módulo ficam fora da soma e a cobertura é informada. Não há estimativa para quem não declarou."],
  ["Sem dado pessoal, com uma exceção declarada", "As bases são agregadas por município, prestador ou estação. Exceção, capítulo 7: o nome de pessoa física que a companhia aberta declara à CVM como controladora ou participante de acordo de acionistas aparece na posição acionária, como consta no Formulário de Referência público. CPF não é coletado nem publicado; as demais pessoas físicas entram somadas, sem nome."],
  ["Divergências explicadas", "Quando duas bases discordam, a diferença é calculada, publicada e explicada nas conferências abaixo; nunca redistribuída."],
];

/** Indicadores financeiros autodeclarados ao SINISA e onde aparecem (src/lib/saneamento/autodeclarado.ts). */
const FINANCEIROS: [string, string, string][] = [
  ["Investimento em água e em esgoto, do prestador e do governo estadual informado pelo prestador", "GFI2024, GFI2036, GFI2124, GFI2136 e destinos GFI2025 a GFI2143", "Capítulo 9, ficha do município, ficha e comparação de prestadores, tabela 5.4"],
  ["Investimento por habitante", "Campos acima ÷ DFE0001", "Atlas do capítulo 9 e comparação de municípios, sem ranking"],
  ["Origem dos recursos (próprios, onerosos e não onerosos)", "GFI2021 a GFI2023, GFI2033 a GFI2035, GFI2121 a GFI2123 e GFI2133 a GFI2135", "Capítulo 10"],
  ["Receita direta de água por m³ faturado (tarifa média declarada)", "GFI1001 ÷ GTA1221", "Ficha e comparação de prestadores"],
  ["Despesa de exploração de água por m³ faturado", "GFI2008 ÷ GTA1221 (IFA2004)", "Ficha e comparação de prestadores"],
  ["Margem líquida e grau de endividamento", "GFI3011 ÷ GFI3008; (GFI3004 + GFI3005) ÷ GFI3001", "Ficha e comparação de prestadores"],
  ["Balanço declarado (ativo, passivo, patrimônio, receitas, resultado e lucro)", "GFI3001 a GFI3011", "Ficha do prestador"],
  ["Valor da tarifa mínima residencial declarada", "GFI1018", "Ficha do município"],
];

const ARQUIVOS: [string, string][] = [
  ["municipios.csv", "Tabela municipal com todas as medidas (Censo, SINISA, NR 8, investimento autodeclarado, arranjo institucional), uma linha por município"],
  ["municipios.json", "A mesma tabela em formato compacto (campos e linhas), usada pelo atlas"],
  ["agregados.json", "Brasil, regiões e UFs: Censo, consolidado SINISA, continuidade, gestão municipal"],
  ["prestadores.csv", "Cadastro de prestadores com perímetro, população, perdas, consumo per capita e investimento autodeclarado"],
  ["prestadores.json", "Prestadores com volumes, consumo per capita e receita, despesa e balanço autodeclarados"],
  ["reguladores.json", "Entidades reguladoras por CNPJ e municípios que as declararam"],
  ["etes.csv", "Estações de tratamento de esgoto declaradas"],
  ["desigualdades_municipios.csv", "Censo 2022 por grupo (cor ou raça, quilombolas, indígenas, favelas): carência e universo por município"],
  ["qualidade_municipios.csv", "SISAGUA 2024 e 2025: registro de controle e vigilância e numerador e denominador de cada medida de qualidade da água, por município"],
  ["saude_municipios.csv", "SIH e SIM, 2022 a 2024: internações e óbitos por infecções intestinais, leptospirose e esquistossomose, soma dos três anos por município de residência"],
  ["controle_societario.csv", "CVM, Formulário de Referência: acionistas, controlador e cadeia de controle das companhias abertas prestadoras de água e esgoto, uma linha por acionista"],
  ["jmp_paises.csv", "JMP (OMS e UNICEF), 2024: água e esgotamento por degrau de serviço em cada país ou área, em percentual da população, com região e faixa de renda"],
  ["ods_paises.csv", "ONU, base global dos ODS: oito séries de referência mundial (água e esgotamento gerenciados com segurança, esgoto tratado, qualidade dos corpos d'água, estresse hídrico, gestão da água, ajuda oficial e mortalidade), uma linha por país no ano comparado"],
  ["meta.json", "Proveniência: arquivos de origem, sha256, datas, cobertura e conferências"],
];

export default function Pagina() {
  const m = meta();
  const zips = Object.values(m?.sinisa.zips ?? {});
  const planilhas = Object.entries(m?.sinisa.planilhas ?? {});
  const censo = Object.entries(m?.censo.tabelas ?? {});
  const consultasSaude = m?.saude?.consultas ?? [];
  const cvm = m?.cvm;
  const jmp = m?.jmp;
  const ods = m?.ods;

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
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
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
        <NestaPagina
          itens={[
            { id: "contrato", rotulo: "Contrato metodológico" },
            { id: "autodeclarados", rotulo: "Valores financeiros" },
            { id: "viabilidade", rotulo: "Matriz de viabilidade" },
            { id: "conferencias", rotulo: "Conferências entre bases" },
            { id: "fontes", rotulo: "Arquivos de origem" },
            { id: "downloads", rotulo: "Downloads" },
            { id: "limitacoes", rotulo: "Limitações" },
          ]}
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
          id="autodeclarados"
          titulo="Valores financeiros autodeclarados ao SINISA"
          texto="Quais indicadores levam a marca, de que campos vêm e onde aparecem. Nenhum deles está na página aberta, nas manchetes da entrada, nos números de abertura, em rankings ou no bloco Para você."
        >
          <RessalvaAutodeclarado />
          <div className="tabela-scroll mt-6" tabIndex={0} role="region" aria-label="Indicadores financeiros autodeclarados (rolável)">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Indicadores financeiros autodeclarados ao SINISA, campos de origem e onde aparecem</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Indicador</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Campos do SINISA 2024</th>
                  <th scope="col" className="py-2 font-medium">Onde aparece</th>
                </tr>
              </thead>
              <tbody>
                {FINANCEIROS.map(([i, c, o]) => (
                  <tr key={i} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{i}</th>
                    <td className="py-2 pr-4 text-carvao-muted">{c}</td>
                    <td className="py-2 text-carvao-muted">{o}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Nota>
            Quem declara: o formulário de gestão financeira do SINISA é preenchido pelo prestador, seja companhia, empresa, autarquia ou a própria
            prefeitura que presta o serviço. O investimento &quot;realizado pelo Estado&quot; vem do mesmo formulário: é o que o governo estadual
            investiu no sistema, segundo o prestador. Dados técnicos (população atendida, volumes, perdas, consumo) também são declarados, mas
            não têm demonstração auditada com que se possam conferir e não levam a marca.
          </Nota>
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
                {c.detalhe && c.detalhe.length > 0 && (
                  <div className="tabela-scroll mt-3" tabIndex={0} role="region" aria-label="Colunas que não fecham (rolável)">
                    <table className="w-full min-w-[40rem] border-collapse text-sm">
                      <caption className="sr-only">Colunas de contagem em que a soma dos municípios difere do consolidado da UF</caption>
                      <thead>
                        <tr className="border-b border-carvao text-left">
                          <th scope="col" className="py-2 pr-4 font-medium">UF e coluna</th>
                          <th scope="col" className="py-2 pr-4 text-right font-medium">Soma dos municípios</th>
                          <th scope="col" className="py-2 pr-4 text-right font-medium">Consolidado da UF</th>
                          <th scope="col" className="py-2 text-right font-medium">Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.detalhe.map((d) => (
                          <tr key={`${d.uf}-${d.codigo}`} className="border-b border-linha align-top">
                            <th scope="row" className="py-2 pr-4 text-left font-normal">
                              {d.uf}, {d.codigo}: {d.nome}
                            </th>
                            <td className="py-2 pr-4 text-right tabular-nums">{inteiro(d.soma_municipal)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{inteiro(d.consolidado_uf)}</td>
                            <td className="py-2 text-right tabular-nums">{d.diferenca_pct == null ? "sem dado" : `${numero(d.diferenca_pct, 2)}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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

          {cvm && (
            <details className="mt-6">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-obee-dark underline underline-offset-4">
                Arquivo da CVM, capítulo 7 ({cvm.companhias} companhias)
              </summary>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Formulário de Referência {cvm.ano}, arquivo anual das companhias abertas, capturado em {data(cvm.capturado_em)}
                {cvm.zip.last_modified ? `; Last-Modified do servidor: ${cvm.zip.last_modified}` : ""}. Critério: {cvm.criterio}. Ficha do prestador ligada só
                quando a ficha cobre ao menos {numero(cvm.regras.limiar_ficha * 100, 0)}% dos municípios que declaram o CNPJ; sem casamento por nome.
                Pessoas físicas: {cvm.regras.pessoa_fisica}.
              </p>
              <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Arquivos da CVM (rolável)">
                <table className="w-full min-w-[40rem] border-collapse text-xs">
                  <caption className="sr-only">Arquivos da CVM com sha256</caption>
                  <thead>
                    <tr className="border-b border-carvao text-left">
                      <th scope="col" className="py-2 pr-4 font-medium">Arquivo</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Bytes</th>
                      <th scope="col" className="py-2 font-medium">sha256</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-linha align-top">
                      <th scope="row" className="py-1 pr-4 text-left font-normal">fre_cia_aberta_{cvm.ano}.zip</th>
                      <td className="py-1 pr-4 text-right tabular-nums">{inteiro(cvm.zip.bytes)}</td>
                      <td className="py-1 font-mono [overflow-wrap:anywhere]">{cvm.zip.sha256}</td>
                    </tr>
                    {Object.entries(cvm.membros).map(([nome, v]) => (
                      <tr key={nome} className="border-b border-linha align-top">
                        <th scope="row" className="py-1 pr-4 text-left font-normal">{nome}</th>
                        <td className="py-1 pr-4 text-right tabular-nums">{inteiro(v.bytes)}</td>
                        <td className="py-1 font-mono [overflow-wrap:anywhere]">{v.sha256}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {jmp && (
            <details className="mt-6">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-obee-dark underline underline-offset-4">
                Arquivos do JMP e do IBGE, comparação internacional ({jmp.areas} países e áreas)
              </summary>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                JMP, base de domicílios, atualização de {jmp.edicao_mes.slice(5)}/{jmp.edicao_mes.slice(0, 4)}, estimativas de {jmp.periodo[0]} a {jmp.periodo[1]}, capturada em{" "}
                {data(jmp.capturado_em)}. Só as abas de dados sem arredondamento (wat e san) são lidas. Nomes de países em português da API de países do IBGE.
                As {jmp.brasil_fontes.length} fontes que o JMP lista para o Brasil vêm do arquivo do país.
              </p>
              <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Arquivos do JMP e do IBGE (rolável)">
                <table className="w-full min-w-[40rem] border-collapse text-xs">
                  <caption className="sr-only">Arquivos do JMP e do IBGE com sha256</caption>
                  <thead>
                    <tr className="border-b border-carvao text-left">
                      <th scope="col" className="py-2 pr-4 font-medium">Arquivo</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Bytes</th>
                      <th scope="col" className="py-2 font-medium">sha256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["JMP, arquivo mundial de domicílios", jmp.xlsx.bytes, jmp.xlsx.sha256],
                      ["JMP, arquivo do Brasil (aba Data Summary)", jmp.brasil_xlsx.bytes, jmp.brasil_xlsx.sha256],
                      ["IBGE, API de países", jmp.paises_ibge.bytes, jmp.paises_ibge.sha256],
                    ].map(([nome, bytes, sha]) => (
                      <tr key={String(nome)} className="border-b border-linha align-top">
                        <th scope="row" className="py-1 pr-4 text-left font-normal">{nome}</th>
                        <td className="py-1 pr-4 text-right tabular-nums">{inteiro(bytes as number)}</td>
                        <td className="py-1 font-mono [overflow-wrap:anywhere]">{sha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {ods && (
            <details className="mt-6">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-obee-dark underline underline-offset-4">
                Séries da base global dos ODS, referências mundiais por capítulo ({Object.keys(ods.series).length} séries)
              </summary>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                ONU, base global dos indicadores dos ODS (unstats.un.org/sdgapi), edição {ods.edicoes.join(", ")}, consulta em {data(ods.capturado_em.slice(0, 10))}. Só
                a versão global de cada série é lida, e uma linha repetida para a mesma área, ano e recorte faz a coleta falhar. Em cada série, o ano
                comparado é o mais recente em que o Brasil tem valor; mundo, América Latina e Caribe e os {ods.paises_onu} países e territórios da
                classificação da ONU são tomados nesse ano. Nomes de {ods.paises_ibge} países em português pela API de países do IBGE, pelo código M49;
                os demais ficam com o nome em inglês da ONU.
              </p>
              <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Séries dos ODS com sha256 (rolável)">
                <table className="w-full min-w-[40rem] border-collapse text-xs">
                  <caption className="sr-only">Séries dos ODS, ano comparado, países com valor e sha256 do seed</caption>
                  <thead>
                    <tr className="border-b border-carvao text-left">
                      <th scope="col" className="py-2 pr-4 font-medium">Série</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Ano comparado</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Países com valor</th>
                      <th scope="col" className="py-2 font-medium">sha256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ods.series).map(([codigo, s]) => (
                      <tr key={codigo} className="border-b border-linha align-top">
                        <th scope="row" className="py-1 pr-4 text-left font-normal">{codigo}</th>
                        <td className="py-1 pr-4 text-right tabular-nums">{s.ano_comparado}</td>
                        <td className="py-1 pr-4 text-right tabular-nums">{inteiro(s.paises)}</td>
                        <td className="py-1 font-mono [overflow-wrap:anywhere]">{s.sha256}</td>
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
              Receitas, despesas, investimentos, tarifa declarada e balanço são autodeclarados ao SINISA, sem conferência com demonstrações
              financeiras auditadas; ficam só nos capítulos que os tratam, com a marca (seção Valores financeiros, acima).
            </li>
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
