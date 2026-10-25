import type { Metadata } from "next";
import { Fragment } from "react";
import { apresentarNotaContratado, rotuloConferencia } from "@/lib/saneamento/contratos-apresentacao";
import { rotuloSinisa } from "@/lib/saneamento/edicao";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, Indisponivel, NestaPagina, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { CurvaMetas, LabContratado, type AreaLab, type TrajetoriaBr } from "@/components/saneamento/Contratado";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { agregado } from "@/lib/saneamento/gold";
import { data, inteiro, numero } from "@/lib/saneamento/formato";
import { razaoPct } from "@/lib/saneamento/municipios";
import {
  goldContratado,
  chaveTempo,
  metaNoAno,
  reaisMi,
  rotuloTempo,
  ROTULO_INDICADOR,
  ROTULO_RESULTADO,
  ROTULO_SERVICOS,
  ROTULO_TIPO,
  ROTULO_TIPO_FONTE,
  URL_CONTRATOS,
  type Contrato,
  type GoldContratado,
  type Indicador,
} from "@/lib/saneamento/contratos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "O que já está contratado para universalizar até 2033?",
  description:
    "Leilões de concessão e PPP de saneamento desde o novo marco legal, com vencedor, outorga, investimento previsto e prazo; metas contratuais transcritas dos contratos; posição 2024 das áreas concedidas; cenário didático para 2033 e estimativas do custo da universalização.",
  alternates: { canonical: `${ROTA}/contratado` },
};

const NUM = "tabular-nums text-right";

/** Contêiner de tabela que rola de lado no celular; focável pelo teclado, com nome, para a região rolável ser alcançável. */
function Rolavel({ rotulo, className = "", children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`tabela-scroll ${className}`} tabIndex={0} role="region" aria-label={rotulo}>
      {children}
    </div>
  );
}

/** Onda S1, 25/10/2026: auditoria acessível sem alongar a comparação inicial. */
function NotasDaLinha({ nota }: { nota: string }) {
  return (
    <details className="mt-2 text-xs leading-relaxed text-carvao-muted" data-notas-linha="">
      <summary className="cursor-pointer py-2 font-medium text-obee-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Notas desta linha</summary>
      <p className="max-w-[min(65ch,calc(100vw-3rem))] pb-2 [overflow-wrap:anywhere]">{apresentarNotaContratado(nota)}</p>
    </details>
  );
}

/** Domínio da fonte, sem "www": o título completo fica no atributo title e no CSV. */
function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function Pagina() {
  const cap = capituloPorSlug("contratado")!;
  const g = goldContratado();
  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:contratado" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        {g ? (
          <Conteudo g={g} pergunta={cap.pergunta} pendencia={cap.pendencia} />
        ) : (
          <>
            <Abertura capitulo={15} titulo={cap.pergunta} texto={<p>Dados indisponíveis nesta publicação.</p>} recorte="sem dado" />
            <Indisponivel titulo="A publicação do contratado desde o novo marco não está disponível">
              O arquivo public/saneamento/contratos/contratado.json não foi encontrado. Nenhum número é mostrado no lugar.
            </Indisponivel>
          </>
        )}
      </main>
    </>
  );
}

function Conteudo({ g, pergunta, pendencia }: { g: GoldContratado; pergunta: string; pendencia?: string }) {
  const t = g.totais;
  const transcritos = g.contratos.filter((c) => c.situacao === "transcrito");
  const semDocumento = g.contratos.filter((c) => c.situacao !== "transcrito");
  const anoLegal = g.marco.meta_legal.ano;
  const br = agregado("BR");
  const c22 = br?.censo2022.moradores;
  const c10 = br?.censo2010;
  const brasil: TrajetoriaBr | null =
    c22 && c10 && c22.agua.total
      ? {
          pop22: c22.agua.total,
          agua: { v2010: razaoPct(c10.agua_rede, c10.moradores) ?? 0, v2022: razaoPct(c22.agua.rede, c22.agua.total) ?? 0 },
          esgoto: { v2010: razaoPct(c10.esgoto_rede_pluvial, c10.esgoto_moradores) ?? 0, v2022: razaoPct(c22.esgoto.rede_pluvial, c22.esgoto.total) ?? 0 },
        }
      : null;
  const porContrato = new Map(g.contratos.map((c) => [c.id, c]));
  const porLeilao = new Map(g.leiloes.map((l) => [l.id, l]));
  const areas: AreaLab[] = g.posicao_2024.map((p) => {
    const c = porContrato.get(p.contrato);
    const ica = c ? metaNoAno(c, "ICA", anoLegal) : null;
    const ice = c ? metaNoAno(c, "ICE", anoLegal) : null;
    return {
      id: p.bloco,
      nome: p.rotulo,
      pop22: p.pop22,
      agua: p.censo.agua_rede_2022 == null ? null : { v2022: p.censo.agua_rede_2022, meta2033: ica },
      esgoto: p.censo.esgoto_rede_2022 == null ? null : { v2022: p.censo.esgoto_rede_2022, meta2033: ice },
    };
  });
  const custoUniversalizacao = g.custos.filter((e) => e.natureza === "custo_universalizacao");
  const contratado = g.custos.filter((e) => e.natureza === "contratado");
  const sinisaAno = g.referencia_posicao.sinisa_ano;
  const edicaoPosicao = { edicao: g.referencia_posicao.sinisa_edicao, ano_referencia: sinisaAno };

  return (
    <>
      <Abertura
        capitulo={15}
        titulo={pergunta}
        texto={
          <p>
            O novo marco legal ({g.marco.lei}) fixou a meta de {numero(g.marco.meta_legal.agua, 0)}% da população com água e {numero(g.marco.meta_legal.esgoto, 0)}% com coleta e
            tratamento de esgoto até {anoLegal}, e abriu a prestação a leilões de concessão e PPP. Aqui está o que foi leiloado desde então, leilão por
            leilão e com a fonte de cada linha; o que os contratos prometem ano a ano, transcrito dos próprios anexos de metas; onde essas áreas estavam
            em {sinisaAno}; um cenário didático de {anoLegal} se tudo for cumprido; e as estimativas de quanto custa universalizar, lado a lado.
          </p>
        }
        recorte={
          <>
            {inteiro(t.leiloes_registrados)} leilões e desestatizações de {g.marco.ano} a {g.leiloes[g.leiloes.length - 1]?.data_leilao.slice(0, 4)}, em tabela curada à mão
            com grau de verificação por linha; metas transcritas de {inteiro(transcritos.length)} {transcritos.length === 1 ? "contrato" : "contratos"};{" "}
            {inteiro(g.abrangencia.length)} {g.abrangencia.length === 1 ? "bloco" : "blocos"} com composição municipal pública. Valores em reais correntes de cada
            leilão, como na fonte. Captura mais recente em {data(g.capturado_em)}.
          </>
        }
        situacao="parcial"
        pendencia={pendencia}
      />

      <NestaPagina
        itens={[
          { id: "leiloes", rotulo: "Leilões desde 2020" },
          { id: "metas", rotulo: "O que cada contrato promete" },
          { id: "posicao", rotulo: `Onde estamos (${sinisaAno})` },
          { id: "laboratorio", rotulo: "Se tudo for cumprido" },
          { id: "custos", rotulo: "Quanto custa universalizar" },
          { id: "metodo", rotulo: "Método, lidos e não lidos" },
        ]}
      />

      <Numeros
        colunas={4}
        itens={[
          {
            rotulo: "Leilões com contrato de serviço adjudicado desde 2020",
            valor: inteiro(t.contratos_de_servico_adjudicados),
            contexto: (
              <>
                Concessões e PPPs adjudicadas na tabela curada ({inteiro(t.leiloes_registrados)} linhas no total, com vendas de ações e leilão sem propostas). Contagem
                própria, não a de entidades do setor.
              </>
            ),
          },
          {
            rotulo: `Municípios com concessão iniciada de ${g.proxy_sinisa.desde} em diante, no ${rotuloSinisa('curta', edicaoPosicao)}`,
            valor: inteiro(g.proxy_sinisa.municipios),
            contexto: (
              <>
                Vínculos declarados pelo prestador como &quot;{g.proxy_sinisa.instrumento}&quot; com início de {g.proxy_sinisa.desde} em diante ({Object.entries(g.proxy_sinisa.vinculos_por_ano)
                  .map(([a, n]) => `${n} em ${a}`)
                  .join("; ")}). Autodeclaração, sem valor nem meta.
              </>
            ),
          },
          {
            rotulo: "Contratos com metas anuais transcritas",
            valor: inteiro(transcritos.length),
            contexto: (
              <>
                Do anexo de metas de cada um, com cláusula e sha256 do PDF; {inteiro(transcritos.filter((c) => c.calendario === "civil").length)} com ano-calendário fixado
                no documento e {inteiro(transcritos.filter((c) => c.calendario === "contratual").length)} contados em anos de contrato;{" "}
                {inteiro(transcritos.reduce((s, c) => s + c.entidades_com_metas, 0))} municípios ou áreas com curva própria.
                {semDocumento.length ? ` ${inteiro(semDocumento.length)} sem documento público localizado (método).` : ""}
              </>
            ),
          },
          {
            rotulo: "Investimento previsto declarado, somado",
            valor: reaisMi(t.investimento_previsto_rs_mi.soma),
            contexto: (
              <>
                Só {inteiro(t.investimento_previsto_rs_mi.linhas_que_informam)} dos {inteiro(t.nos_totais)} leilões conferidos e adjudicados informam o valor; reais correntes de
                cada leilão, prazos de 24 a 40 anos: não comparável entre contratos nem com as estimativas de custo.
              </>
            ),
          },
        ]}
      />

      <Secao
        id="leiloes"
        titulo="Leilões desde 2020: o que foi contratado, por quem e por quanto"
        texto={
          <p>
            Uma linha por leilão ou lote, do mais antigo ao mais recente. Outorga (o que o vencedor paga), contraprestação (o que o poder público paga numa PPP) e
            investimento previsto são naturezas diferentes e nunca se somam. A conferência aparece por extenso: fonte oficial quando o documento ou a notícia oficial foi consultado; fonte consultada quando a página é de imprensa; só fonte secundária quando não houve conferência na página.
            Totais só somam contratos de serviço adjudicados e conferidos: {apresentarNotaContratado(t.criterio)}.
          </p>
        }
      >
        <p className="mb-2 text-xs text-carvao-muted">Deslize a tabela para comparar os valores e consultar as fontes. As notas de cada leilão abrem abaixo da linha.</p>
        <Rolavel rotulo="Tabela de leilões desde 2020">
          <table data-comparacao="" className="w-full min-w-[1200px] table-fixed border-collapse text-[13px] leading-snug">
            <thead>
              <tr className="border-b border-carvao text-left align-bottom">
                <th className="sticky left-0 z-10 w-[180px] bg-papel py-2 pr-3 font-medium">Leilão</th>
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Tipo e resultado</th>
                <th className="w-[14%] py-2 pr-3 font-medium">Vencedor</th>
                <th className={`py-2 pr-3 font-medium ${NUM}`}>Outorga</th>
                <th className={`py-2 pr-3 font-medium ${NUM}`}>Contraprestação</th>
                <th className={`py-2 pr-3 font-medium ${NUM}`}>Investimento previsto</th>
                <th className="py-2 pr-3 font-medium">Alcance e prazo</th>
                <th className="py-2 font-medium">Fonte e conferência</th>
              </tr>
            </thead>
            <tbody>
              {g.leiloes.map((l) => {
                const fora = t.fora_dos_totais.find((f) => f.id === l.id)?.motivo;
                return (
                  <Fragment key={l.id}>
                  <tr className={`border-b border-linha align-top ${fora ? "text-carvao-muted" : ""}`} data-leilao={l.id}>
                    <td className="sticky left-0 z-10 bg-papel py-2.5 pr-3">
                      <span className="font-medium text-carvao">{l.uf}</span> <span className="text-carvao">{l.objeto}</span>
                      <span className="block text-xs text-carvao-muted">
                        {l.poder_concedente} · {ROTULO_SERVICOS[l.servicos]}
                      </span>
                      {fora && <span className="block text-xs italic text-carvao-muted">Fora dos totais: {fora}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">{data(l.data_leilao)}</td>
                    <td className="py-2.5 pr-3">
                      {ROTULO_TIPO[l.tipo]}
                      <span className="block text-xs text-carvao-muted">{ROTULO_RESULTADO[l.resultado]}</span>
                    </td>
                    <td className="py-2.5 pr-3">{l.vencedor ?? "sem vencedor"}</td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 ${NUM}`}>{reaisMi(l.outorga_rs_mi)}</td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 ${NUM}`}>{reaisMi(l.contraprestacao_rs_mi)}</td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 ${NUM}`}>{reaisMi(l.investimento_previsto_rs_mi)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">
                      {l.municipios == null ? "mun. sem dado" : `${inteiro(l.municipios)} mun.`}
                      <span className="block">{l.populacao_mi == null ? "pop. sem dado" : `${numero(l.populacao_mi, 1)} mi hab.`}</span>
                      <span className="block">{l.prazo_anos == null ? "prazo sem dado" : `${inteiro(l.prazo_anos)} anos`}</span>
                    </td>
                    <td className="py-2.5 text-xs">
                      <a href={l.fonte.url} target="_blank" rel="noopener noreferrer" className="text-obee-dark underline underline-offset-2" title={l.fonte.titulo}>
                        {dominio(l.fonte.url)}
                      </a>
                      <span className="block text-carvao-muted">
                        {ROTULO_TIPO_FONTE[l.fonte.tipo_fonte]} · {data(l.fonte.data)}
                        <span className="block">{rotuloConferencia(l.fonte.grau, l.fonte.tipo_fonte)}</span>
                      </span>
                    </td>
                  </tr>
                  {l.observacoes && (
                    <tr data-nota-leilao={l.id}>
                      <td colSpan={9} className="border-b border-linha pb-2">
                        <NotasDaLinha nota={l.observacoes} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Rolavel>
        <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-linha pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Outorga", t.outorga_rs_mi],
              ["Contraprestação", t.contraprestacao_rs_mi],
              ["Investimento previsto", t.investimento_previsto_rs_mi],
              ["População declarada", t.populacao_mi],
            ] as const
          ).map(([rotulo, s]) => (
            <div key={rotulo}>
              <dt className="text-carvao-muted">{rotulo}, soma dos {inteiro(t.nos_totais)} leilões nos totais</dt>
              <dd className="font-medium tabular-nums text-carvao">
                {rotulo === "População declarada" ? `${numero(s.soma, 1)} mi` : reaisMi(s.soma)}{" "}
                <span className="font-normal text-carvao-muted">
                  ({inteiro(s.linhas_que_informam)} informam; {inteiro(s.linhas_sem_dado)} sem dado)
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <Ressalva
          permite={
            <>
              Ver, leilão a leilão, quem venceu, quanto pagou ou receberá, quanto declarou investir e por quanto tempo; comparar a contagem própria com as de entidades
              do setor; baixar a tabela com as fontes.
            </>
          }
          naoPermite={
            <>
              Somar outorga, contraprestação e investimento; comparar valores de anos diferentes sem deflacionar; tratar investimento previsto como executado; tratar
              linha só de fonte secundária como conferida.
            </>
          }
        />
        <p className="mt-4 text-sm">
          <a href={`${URL_CONTRATOS}/leiloes.csv`} className="text-obee-dark underline underline-offset-2">
            Baixar a tabela de leilões (CSV, uma linha por leilão, com fonte, grau e se entra nos totais)
          </a>
        </p>
        <Fonte>Tabela curada a partir das fontes de cada linha (B3, governos, agências, BNDES e imprensa), acessadas em {data(g.capturado_em)}; a conferência está descrita por extenso em cada linha.</Fonte>
      </Secao>

      <Secao
        id="metas"
        titulo="O que cada contrato promete, ano a ano"
        texto={
          <p>
            Metas transcritas do anexo de metas de cada contrato, com a cláusula e o sha256 do PDF lido. ICA e ICE são a cobertura de água e de esgoto definidas no
            próprio contrato; IEC é o tratamento do esgoto coletado; IPL são perdas. Quando o documento fixa metas por município, a linha do contrato é o piso comum
            e a curva de cada município está no arquivo por município. Quando o documento conta anos de contrato sem data de eficácia, as metas ficam em &quot;Ano
            N&quot; e não são convertidas a ano civil. Ano sem linha repete a última meta, como o contrato prevê. Metas são obrigações contratuais, não resultados.
          </p>
        }
      >
        {transcritos.length ? (
          <div className="space-y-10">
            {transcritos.map((c) => {
              const indicadores = Array.from(new Set(c.metas.map((m) => m.indicador))) as Indicador[];
              const chave = chaveTempo(c);
              const anos = Array.from(new Set(c.metas.map((m) => m[chave]).filter((a): a is number => a != null))).sort((a, b) => a - b);
              const doc = c.documento!;
              return (
                <article key={c.id} aria-label={c.nome} data-contrato={c.id} className="border-t border-linha pt-6">
                  <h3 className="font-serif text-xl text-carvao">{c.nome}</h3>
                  <p className="mt-1 text-sm text-carvao-muted">
                    {c.clausula} ·{" "}
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-obee-dark underline underline-offset-2">
                      {doc.titulo}
                    </a>{" "}
                    · sha256 <code className="text-xs">{doc.sha256.slice(0, 12)}…</code> · capturado em {data(doc.capturado_em)}
                    {c.blocos.length ? ` · ${inteiro(c.blocos.length)} ${c.blocos.length === 1 ? "bloco com abrangência" : "blocos com abrangência"}` : " · sem composição municipal pública nesta publicação"}
                  </p>
                  <p className="mt-1 max-w-prose2 text-xs leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
                    <span className="font-medium text-carvao">Versão do documento:</span> {c.versao_documento ?? "não informada"}.{" "}
                    <span className="font-medium text-carvao">Tempo:</span>{" "}
                    {c.calendario === "contratual" ? `anos de contrato (${c.inicio_contagem ?? "sem data de eficácia conhecida"}); sem conversão a ano civil` : `ano-calendário (${c.inicio_contagem ?? "fixado no documento"})`}.{" "}
                    <span className="font-medium text-carvao">Nível:</span>{" "}
                    {c.nivel === "contrato" ? "meta única do contrato" : c.nivel === "por_area" ? `metas por área (${inteiro(c.entidades_com_metas)} áreas; a linha "Total" abaixo)` : `metas por município (${inteiro(c.entidades_com_metas)} municípios; abaixo, o piso comum)`}.
                  </p>
                  {Object.keys(c.faixa_inicial).length > 0 && (
                    <ul className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-faixa-inicial="">
                      {(Object.entries(c.faixa_inicial) as [Indicador, NonNullable<Contrato["faixa_inicial"][Indicador]>][]).map(([i, f]) => (
                        <li key={i}>
                          {ROTULO_INDICADOR[i]}: em {f.rotulo_primeiro ?? rotuloTempo(c, f.primeiro)}, de {numero(f.min, 1)}% a {numero(f.max, 1)}% conforme o município ou área; em{" "}
                          {f.rotulo_ultimo ?? rotuloTempo(c, f.ultimo)}, de {numero(f.min_ultimo, 1)}% a {numero(f.max_ultimo, 1)}%.
                        </li>
                      ))}
                    </ul>
                  )}
                  <Rolavel rotulo={`Metas por ano: ${c.nome}`} className="mt-4">
                    <table data-comparacao="" className="min-w-[420px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-carvao text-left">
                          <th className="py-2 pr-4 font-medium">Indicador</th>
                          {anos.map((a) => (
                            <th key={a} className={`py-2 pr-4 font-medium ${NUM}`}>
                              {rotuloTempo(c, a)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {indicadores.map((i) => (
                          <tr key={i} className="border-b border-linha">
                            <td className="py-2 pr-4">{ROTULO_INDICADOR[i]}</td>
                            {anos.map((a) => {
                              const m = c.metas.find((x) => x.indicador === i && x[chave] === a);
                              return (
                                <td key={a} className={`py-2 pr-4 ${NUM}`}>
                                  {m ? `${numero(m.valor, 0)}%` : <span className="text-carvao-muted">·</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Rolavel>
                  <div className="mt-4">
                    <CurvaMetas contrato={{ ...c, observacoes: c.observacoes ? apresentarNotaContratado(c.observacoes) : c.observacoes }} anoLegal={anoLegal} />
                  </div>
                  {c.observacoes && <NotasDaLinha nota={c.observacoes} />}
                  <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao">
                    {c.calendario === "contratual"
                      ? `Diferença para a meta legal: a lei pede ${numero(g.marco.meta_legal.agua, 0)}% de água e ${numero(g.marco.meta_legal.esgoto, 0)}% de esgoto até ${anoLegal}; este contrato conta as metas em anos de contrato e, sem a data de eficácia no documento, não é possível dizer em que ano civil cada meta vence.`
                      : `Diferença para a meta legal: a lei pede ${numero(g.marco.meta_legal.agua, 0)}% de água e ${numero(g.marco.meta_legal.esgoto, 0)}% de esgoto até ${anoLegal}; este contrato prevê ${metaNoAno(c, "ICA", anoLegal) == null ? "sem meta de água transcrita" : `${numero(metaNoAno(c, "ICA", anoLegal), 0)}% de ICA`} e ${metaNoAno(c, "ICE", anoLegal) == null ? "sem meta de esgoto transcrita" : `${numero(metaNoAno(c, "ICE", anoLegal), 0)}% de ICE`} em ${anoLegal}.`}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <Indisponivel titulo="Nenhum contrato com metas transcritas nesta publicação">Os contratos lidos e os não lidos, com o motivo, estão no método.</Indisponivel>
        )}
        {transcritos.some((c) => c.entidades_com_metas > 0) && (
          <p className="mt-6 text-sm">
            <a href={`${URL_CONTRATOS}/metas_municipios.csv`} className="text-obee-dark underline underline-offset-2">
              Baixar as metas por município e área (CSV, uma linha por município, indicador e ano, como no documento)
            </a>
          </p>
        )}
        <Fonte>Contratos e anexos de metas dos próprios poderes concedentes e reguladores, lidos nos PDFs cujo sha256 está em cada ficha.</Fonte>
      </Secao>

      <Secao
        id="posicao"
        titulo={`Onde essas áreas estavam em ${sinisaAno}`}
        texto={
          <p>
            Para cada bloco com composição municipal pública, a média ponderada pela população dos indicadores do {rotuloSinisa('completa', edicaoPosicao)} (atendimento com água, IAG0001; com
            coleta de esgoto, IES0001; coleta com tratamento, IES0007) e a cobertura por rede do Censo 2022, ao lado da meta contratual em vigor até {sinisaAno}. É uma
            posição de partida, não aferição.
          </p>
        }
      >
        {g.posicao_2024.length ? (
          <Rolavel rotulo="Posição 2024 por bloco">
            <table data-comparacao="" className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-carvao text-left align-bottom">
                  <th className="py-2 pr-3 font-medium">Bloco</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>Municípios</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>População 2024</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>Água, SINISA (IAG0001)</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>Esgoto coletado (IES0001)</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>Coleta com tratamento (IES0007)</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>Água por rede, Censo 2022</th>
                  <th className={`py-2 pr-3 font-medium ${NUM}`}>Esgoto por rede, Censo 2022</th>
                  <th className="py-2 font-medium">Meta contratual em vigor até {sinisaAno}</th>
                </tr>
              </thead>
              <tbody>
                {g.posicao_2024.map((p) => {
                  const leilao = porLeilao.get(p.contrato);
                  const pond = (x: { valor: number | null; municipios_com_dado: number }) =>
                    x.valor == null ? "sem dado" : `${numero(x.valor, 1)}% (${inteiro(x.municipios_com_dado)} mun.)`;
                  return (
                    <tr key={p.bloco} className="border-b border-linha align-top" data-bloco={p.bloco}>
                      <td className="py-2 pr-3">
                        <span className="font-medium text-carvao">{p.rotulo}</span>
                        <span className="block text-xs text-carvao-muted">
                          {leilao ? `${leilao.uf}, leilão de ${data(leilao.data_leilao)}` : p.contrato}
                          {p.municipios_divididos_por_zona.length ? ` · ${inteiro(p.municipios_divididos_por_zona.length)} ${p.municipios_divididos_por_zona.length === 1 ? "município dividido" : "municípios divididos"} por zona` : ""}
                        </span>
                      </td>
                      <td className={`py-2 pr-3 ${NUM}`}>{inteiro(p.municipios)}</td>
                      <td className={`py-2 pr-3 ${NUM}`}>{inteiro(p.pop24)}</td>
                      <td className={`py-2 pr-3 ${NUM}`}>{pond(p.sinisa_2024.IAG0001)}</td>
                      <td className={`py-2 pr-3 ${NUM}`}>{pond(p.sinisa_2024.IES0001)}</td>
                      <td className={`py-2 pr-3 ${NUM}`}>{pond(p.sinisa_2024.IES0007)}</td>
                      <td className={`py-2 pr-3 ${NUM}`}>{p.censo.agua_rede_2022 == null ? "sem dado" : `${numero(p.censo.agua_rede_2022, 1)}%`}</td>
                      <td className={`py-2 pr-3 ${NUM}`}>{p.censo.esgoto_rede_2022 == null ? "sem dado" : `${numero(p.censo.esgoto_rede_2022, 1)}%`}</td>
                      <td className="py-2 text-xs">
                        {Object.keys(p.meta_contratual_ate_2024).length
                          ? Object.entries(p.meta_contratual_ate_2024)
                              .map(([i, v]) => `${i} ${numero(v, 0)}%`)
                              .join(" · ")
                          : "nenhuma meta vence até " + sinisaAno}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Rolavel>
        ) : (
          <Indisponivel titulo="Nenhum bloco com composição municipal pública nesta publicação">
            A posição de partida exige o vínculo entre o contrato e os códigos IBGE dos municípios abrangidos (seed de abrangência). Enquanto a composição de cada bloco
            não for localizada em documento público, nenhuma média é mostrada.
          </Indisponivel>
        )}
        <Nota titulo="Quatro ressalvas, na própria seção">
          <ol className="list-decimal space-y-1 pl-5">
            <li>ICA e ICE contratuais têm definição própria (economias, domicílios ou população por bloco); não são os indicadores do SINISA nem a cobertura por rede do Censo.</li>
            <li>O SINISA é autodeclaração do prestador, por município; o bloco pode cobrir só parte de um município (zonas), e a média aqui usa o município inteiro.</li>
            <li>As metas valem por ano contratual e sofrem repactuação; a tabela mostra a meta em vigor no ano, não o histórico de aditivos.</li>
            <li>Cumprido ou descumprido é conclusão da aferição anual do regulador (NR ANA 8/2024, art. 31), suspensa em 2026; este painel não emite esse selo.</li>
          </ol>
        </Nota>
        <Fonte>{rotuloSinisa('curta', edicaoPosicao)} e Censo 2022 por município (gold do observatório), composição dos blocos conforme a fonte de cada abrangência.</Fonte>
      </Secao>

      <Secao
        id="laboratorio"
        titulo={`Se tudo o que foi contratado for cumprido, onde estaremos em ${anoLegal}?`}
        texto={
          <p>
            Modelo didático, identificado como tal: as áreas com meta transcrita e composição pública chegam à meta contratual de {anoLegal}; o restante do país anda no ritmo
            que você escolher. Compare com o Brasil só no ritmo, sem os contratos.
          </p>
        }
      >
        {brasil ? (
          <LabContratado brasil={brasil} areas={areas} metas={{ agua: g.marco.meta_legal.agua, esgoto: g.marco.meta_legal.esgoto }} />
        ) : (
          <Indisponivel titulo="Sem os agregados do Censo nesta publicação">O laboratório precisa das coberturas por rede de 2010 e 2022 do Brasil.</Indisponivel>
        )}
        <Fonte>IBGE, Censos 2010 e 2022 (moradores por forma de abastecimento e de esgotamento); metas contratuais transcritas; composição dos blocos.</Fonte>
      </Secao>

      <Secao
        id="custos"
        titulo="Quanto custa universalizar, e quanto já está contratado, segundo cada fonte"
        texto={
          <p>
            Estimativas lado a lado, cada uma com a base de preço, o horizonte e o perímetro que a própria fonte declara. Como as bases diferem, nenhuma é subtraída de outra:
            &quot;quanto falta, descontado o contratado&quot; só pode ser lido dentro de uma mesma base. Entidades do setor aparecem como parte interessada.
          </p>
        }
      >
        {g.custos.length ? (
          <div className="space-y-8">
            {(
              [
                ["Custo da universalização", custoUniversalizacao],
                ["Já contratado, segundo entidades do setor", contratado],
              ] as const
            ).map(([titulo, lista]) =>
              lista.length ? (
                <div key={titulo}>
                  <h3 className="rotulo text-mineral">{titulo}</h3>
                  <Rolavel rotulo={`Estimativas: ${titulo}`} className="mt-2">
                    <table data-comparacao="" className="w-full min-w-[900px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-carvao text-left align-bottom">
                          <th className="py-2 pr-3 font-medium">Fonte</th>
                          <th className={`py-2 pr-3 font-medium ${NUM}`}>Valor</th>
                          <th className="py-2 pr-3 font-medium">Base de preço</th>
                          <th className="py-2 pr-3 font-medium">Horizonte</th>
                          <th className="py-2 pr-3 font-medium">Perímetro e método</th>
                          <th className="py-2 font-medium">Documento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((e) => (
                          <tr key={e.id} className="border-b border-linha align-top" data-estimativa={e.id}>
                            <td className="py-2 pr-3">
                              <span className="font-medium text-carvao">{e.autor}</span>
                              <span className="block text-xs text-carvao-muted">
                                {e.titulo}
                                {e.parte_interessada ? " · parte interessada" : ""}
                              </span>
                            </td>
                            <td className={`py-2 pr-3 ${NUM}`}>R$ {numero(e.valor_rs_bi, 1)} bi</td>
                            <td className="py-2 pr-3">{e.base_preco}</td>
                            <td className="py-2 pr-3">{e.horizonte}</td>
                            <td className="py-2 pr-3 text-xs">
                              {e.perimetro}
                              {e.metodo ? ` · ${apresentarNotaContratado(e.metodo)}` : ""}
                              {e.observacoes && <NotasDaLinha nota={e.observacoes} />}
                            </td>
                            <td className="py-2 text-xs">
                              <a href={e.fonte.url} target="_blank" rel="noopener noreferrer" className="text-obee-dark underline underline-offset-2">
                                {e.fonte.titulo ?? e.fonte.url}
                              </a>
                              <span className="block text-carvao-muted">
                                {data(e.fonte.data)} · {rotuloConferencia(e.fonte.grau)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Rolavel>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <Indisponivel titulo="Nenhuma estimativa de custo conferida nesta publicação">
            As estimativas entram só com base de preço, horizonte, perímetro e documento conferidos; nenhuma é reproduzida de trecho de busca.
          </Indisponivel>
        )}
        <Ressalva
          permite={<>Ver quanto cada fonte estima, em que base de preço e com que perímetro; perceber por que os números não batem entre si.</>}
          naoPermite={<>Subtrair o contratado de uma estimativa de custo feita em outra base; tratar investimento previsto em contrato como investimento realizado.</>}
        />
        <Fonte>Documentos de cada estimativa, acessados nas datas indicadas.</Fonte>
      </Secao>

      <Secao
        id="metodo"
        titulo="Método: o que foi lido, o que não foi e como a publicação é vigiada"
        texto={
          <p>
            As fontes não têm API. A tabela de leilões é curadoria manual com fonte, data e grau por linha; as metas vêm dos PDFs lidos, com sha256; a composição dos
            blocos vem de documento público por bloco. Uma vez por mês, cada PDF é baixado de novo e comparado pelo sha256: documento trocado na mesma URL ou fora do
            ar vira pendência registrada, nunca atualização silenciosa. Leilão novo, aditivo ou repactuação entra por revisão, com a fonte e o novo hash.
          </p>
        }
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div className="min-w-0">
            <h3 className="rotulo text-mineral">Contratos lidos</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {transcritos.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-carvao">{c.nome}</span>
                  <span className="block break-all text-xs text-carvao-muted">
                    {c.documento?.titulo} · sha256 {c.documento?.sha256} · {data(c.documento?.capturado_em)}
                    {c.versao_documento ? ` · ${c.versao_documento}` : ""}
                  </span>
                </li>
              ))}
              {!transcritos.length && <li className="text-carvao-muted">nenhum</li>}
            </ul>
          </div>
          <div className="min-w-0">
            <h3 className="rotulo text-mineral">Não lidos, e por quê</h3>
            <ul className="mt-2 space-y-2 text-sm" data-nao-lidos="">
              {[...semDocumento.map((c) => ({ id: c.id, nome: c.nome, motivo: c.situacao === "documento_nao_localizado" ? "documento público não localizado" : "documento sem metas por ano", tentativas: c.observacoes ? [c.observacoes] : [] })), ...g.nao_lidos].map((n) => (
                <li key={n.id}>
                  <span className="font-medium text-carvao">{n.nome}</span>
                  <span className="block text-xs text-carvao-muted">
                    {apresentarNotaContratado(n.motivo)}
                  </span>
                  {n.tentativas?.length ? <NotasDaLinha nota={n.tentativas.join("; ")} /> : null}
                </li>
              ))}
              {!semDocumento.length && !g.nao_lidos.length && <li className="text-carvao-muted">nenhum registrado</li>}
            </ul>
          </div>
        </div>
        {(g.abrangencia_nao_localizada.length > 0 || g.em_estruturacao.length > 0 || g.custos_nao_localizados.length > 0) && (
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {g.abrangencia_nao_localizada.length > 0 && (
              <div>
                <h3 className="rotulo text-mineral">Blocos fora da posição {sinisaAno}, e por quê</h3>
                <ul className="mt-2 space-y-2 text-sm" data-abrangencia-fora="">
                  {g.abrangencia_nao_localizada.map((b) => (
                    <li key={b.id}>
                      <span className="font-medium text-carvao">{b.id}</span>
                      {b.declarado_municipios != null && <span className="text-carvao-muted"> · {inteiro(b.declarado_municipios)} municípios declarados</span>}
                      <span className="block text-xs text-carvao-muted">{b.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              {g.em_estruturacao.length > 0 && (
                <>
                  <h3 className="rotulo text-mineral">Em estruturação, ainda sem leilão (só registro)</h3>
                  <ul className="mt-2 space-y-1 text-sm text-carvao-muted" data-em-estruturacao="">
                    {g.em_estruturacao.map((e) => (
                      <li key={e.nome}>
                        {e.nome}
                        {e.investimento_previsto_rs_mi != null ? ` · ${reaisMi(e.investimento_previsto_rs_mi)} previstos` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {g.custos_nao_localizados.length > 0 && (
                <>
                  <h3 className="rotulo mt-6 text-mineral">Números citados e não localizados em fonte aberta</h3>
                  <ul className="mt-2 space-y-1 text-sm text-carvao-muted">
                    {g.custos_nao_localizados.map((e) => (
                      <li key={e.id}>
                        {e.titulo}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
        <Nota titulo="Fontes que não entram">
          ABCON SINDCON (acesso automatizado recusado), Hub de Projetos do BNDES (aplicação só com JavaScript) e Radar PPP (assinatura, sem metas, licença restrita). Os
          números da ABCON e do BNDES entram só na seção de custos, como parte interessada, quando conferidos em documento ou veículo que os reproduz.
        </Nota>
        <p className="mt-4 text-sm">
          Arquivos desta publicação:{" "}
          <a href={`${URL_CONTRATOS}/contratado.json`} className="text-obee-dark underline underline-offset-2">
            contratado.json
          </a>
          ,{" "}
          <a href={`${URL_CONTRATOS}/leiloes.csv`} className="text-obee-dark underline underline-offset-2">
            leiloes.csv
          </a>
          ,{" "}
          <a href={`${URL_CONTRATOS}/metas_municipios.csv`} className="text-obee-dark underline underline-offset-2">
            metas_municipios.csv
          </a>{" "}
          e{" "}
          <a href={`${URL_CONTRATOS}/resumo.json`} className="text-obee-dark underline underline-offset-2">
            resumo.json
          </a>
          . Plano e decisões: <Link href={`${ROTA}/metodologia`} className="text-obee-dark underline underline-offset-2">método do observatório</Link>.
        </p>
        <Fonte metodo={false}>Pipeline pipeline/saneamento_contratos (seed versionado, validações que retêm a publicação, vigília mensal por sha256).</Fonte>
      </Secao>
    </>
  );
}
