/**
 * Painel completo "Previdência e INSS" (com conta). Seções por pergunta, na ordem da procura: o município do leitor,
 * os tipos de benefício, como o Regime Geral fecha a conta (com o artefato do mecanismo), os estados, a evolução e o
 * método recolhido no fim. Tudo desenhado no servidor a partir da gold; nenhum número escrito à mão.
 */
import type { ReactNode } from "react";
import { BuscaPrevidencia } from "./BuscaPrevidencia";
import { GraficoColunas, GraficoLinhas, marcasAnos } from "./Graficos";
import { grupos, maioresDoBrasil, manchete, municipioNoAno, rankingUf, tiposPorId, type ConsultaMunicipio, type GruposAno } from "@/lib/previdencia/dados";
import { bilhoesDeMilhoes, dataBr, mesCurto, mesExtenso, milhoes, num, pct, razao, reais, reaisGrandes, SEM_DADO } from "@/lib/previdencia/formato";
import { DO_ESTADO, DOWNLOADS, NOME_GRUPO_Q, NOME_TIPO, ROTA_PREVIDENCIA, hrefMunicipio } from "@/lib/previdencia/paginas";
import type { ArquivoUf, CampoQ, CampoV, GoldPrevidencia, IdTipo, MunicipioGold } from "@/lib/previdencia/tipos";

const medio = (v: number | null | undefined, q: number | null | undefined) => razao(v, q);
/** Parte, em %, de um número no total; null quando falta um dos dois. */
const parte = (a: number | null | undefined, total: number | null | undefined) => {
  const x = razao(a, total);
  return x === null ? null : 100 * x;
};

export function PainelPrevidencia({ g, consulta, ferramentas }: { g: GoldPrevidencia; consulta: ConsultaMunicipio; ferramentas?: ReactNode }) {
  return (
    <>
      <Abertura g={g} />
      {ferramentas}
      <SecaoMunicipio g={g} c={consulta} />
      <SecaoTipos g={g} />
      <SecaoResultado g={g} />
      <SecaoEstados g={g} />
      <SecaoEvolucao g={g} />
      <Metodo g={g} />
    </>
  );
}

/* --------------------------------------------------------------------------------------------- abertura */

function Abertura({ g }: { g: GoldPrevidencia }) {
  const m = manchete(g);
  const t = tiposPorId(g);
  const f = g.fontes;
  return (
    <>
      <p className="pv-achado">
        Em {mesExtenso(m.mes)}, o INSS pagou <strong>{milhoes(m.beneficios)} de benefícios</strong>: {milhoes(t.rgps.q)} do Regime Geral, que exige contribuição, e{" "}
        {milhoes(t.assistenciais.q)} assistenciais, como o BPC, que não exigem. Em {m.ano}, a arrecadação do Regime Geral cobriu{" "}
        <strong>{pct(m.cobertura)}</strong> da despesa com os benefícios dele; a diferença, {bilhoesDeMilhoes(-m.resultado)}, veio do Tesouro.
      </p>
      <dl className="pv-numeros" aria-label="O tema em quatro números">
        <div className="pv-lider">
          <dt>Benefícios pagos pelo INSS no mês</dt>
          <dd className="pv-valor">{num(m.beneficios / 1e6, 2)}<span className="pv-unidade">milhões</span></dd>
          <dd className="pv-prova">{mesExtenso(m.mes)} · todos os grupos · {f.beps.orgao}, BEPS, tabela 15</dd>
        </div>
        <div>
          <dt>Valor médio de um benefício do Regime Geral</dt>
          <dd className="pv-valor">{reais(m.rgps.medio)}</dd>
          <dd className="pv-prova">{mesExtenso(m.mes)} · líquido, no mês · BEPS, tabela 15</dd>
        </div>
        <div>
          <dt>Despesa com benefícios do Regime Geral no ano</dt>
          <dd className="pv-valor">{bilhoesDeMilhoes(m.despesa)}</dd>
          <dd className="pv-prova">{m.ano} · valores nominais · {f.rtn.orgao}, RTN, tabela 2.2</dd>
        </div>
        <div>
          <dt>Necessidade de financiamento do Regime Geral</dt>
          <dd className="pv-valor">{bilhoesDeMilhoes(-m.resultado)}</dd>
          <dd className="pv-prova">{m.ano} · {pct(-m.resultadoPib, 2)} do PIB · benefícios menos arrecadação líquida · RTN</dd>
        </div>
      </dl>
    </>
  );
}

/* -------------------------------------------------------------------------------------------- município */

type LinhaGrupo = { q: CampoQ; v: CampoV | null; nivel: 0 | 1; forte?: boolean };
const LINHAS_GRUPO: LinhaGrupo[] = [
  { q: "aposentadorias", v: "aposentadorias", nivel: 0 },
  { q: "apo_idade", v: null, nivel: 1 },
  { q: "apo_invalidez", v: null, nivel: 1 },
  { q: "apo_tempo", v: null, nivel: 1 },
  { q: "pensoes", v: "pensoes", nivel: 0 },
  { q: "auxilios", v: "auxilios", nivel: 0 },
  { q: "outros_prev", v: "outros_prev", nivel: 0 },
  { q: "assistenciais", v: "assistenciais", nivel: 0 },
  { q: "total", v: "total", nivel: 0, forte: true },
];

function ComoLerMunicipio() {
  return (
    <div className="pv-ler" aria-label="Como ler os números por município">
      <p>
        <strong>Agência que paga, não endereço de quem recebe.</strong> O Ministério da Previdência classifica cada benefício pelo município do órgão pagador. Cidades que concentram agências
        bancárias aparecem com mais benefícios que moradores aposentados; as vizinhas, com menos.
      </p>
      <p>
        <strong>Benefícios, não pessoas; valor líquido.</strong> A quantidade conta créditos emitidos em dezembro (quem recebe dois benefícios conta duas vezes) e o valor é o líquido, depois de descontos
        como o empréstimo consignado. O grupo assistencial inclui o BPC e os benefícios de legislação específica, que o arquivo não separa.
      </p>
    </div>
  );
}

function SecaoMunicipio({ g, c }: { g: GoldPrevidencia; c: ConsultaMunicipio }) {
  const anos = g.anual.anos;
  return (
    <section className="pv-secao" id="municipio" aria-labelledby="municipio-titulo">
      <h2 id="municipio-titulo">Quanto o INSS paga no seu município?</h2>
      <p className="pv-intro">
        Os benefícios pagos por agências de cada um dos {num(g.municipios.total)} municípios em dezembro de cada ano, de {anos[0]} a {anos[anos.length - 1]}, por grupo de benefício, ao lado do
        estado e do Brasil.
      </p>
      <div className="pv-busca">
        <BuscaPrevidencia rotulo={c.estado === "ok" ? "Escolher outro município" : "Escolha o município"} ancora="municipio" />
      </div>
      {c.estado === "invalida" && (
        <p role="status" className="pv-aviso">
          {c.codigo ? `Nenhum município da base do INSS tem o código IBGE ${c.codigo}.` : "O endereço não traz um código IBGE de município, que tem sete dígitos."} Busque pelo nome.
        </p>
      )}
      {c.estado === "ok" ? <Municipio g={g} m={c.m} uf={c.uf} arquivo={c.arquivo} /> : <MaioresDoBrasil g={g} />}
    </section>
  );
}

function MaioresDoBrasil({ g }: { g: GoldPrevidencia }) {
  const lista = maioresDoBrasil(10, g);
  const ano = g.anual.anos[g.anual.anos.length - 1];
  const max = lista[0]?.q ?? 1;
  return (
    <>
      <h3 className="mt-10 font-serif text-[23px] leading-snug">Os dez municípios com mais benefícios em dezembro de {ano}</h3>
      <p className="pv-intro mt-2 max-w-[68ch] text-[15px] leading-relaxed text-carvao-muted">Escolha um deles ou busque o seu. A ordem reflete o tamanho da cidade e as agências que atendem a região, não a renda dos moradores.</p>
      <div className="pv-barras" role="list">
        {lista.map((m) => (
          <div key={m.id} className="pv-barra" role="listitem">
            <span>
              <a href={`${hrefMunicipio(m.id)}#municipio`} className="pv-toque text-obee-dark underline underline-offset-[3px]">{m.nome}</a> <span className="text-carvao-muted">({m.uf})</span>
            </span>
            <span className="pv-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * m.q) / max}%` }} /></span>
            <span>{num(m.q)}</span>
          </div>
        ))}
      </div>
      <ComoLerMunicipio />
    </>
  );
}

function Municipio({ g, m, uf, arquivo }: { g: GoldPrevidencia; m: MunicipioGold; uf: string; arquivo: ArquivoUf }) {
  const anos = arquivo.anos;
  let i = anos.length - 1;
  while (i > 0 && !m.q[i]) i--;
  const ano = anos[i];
  const d = municipioNoAno(m, i);
  const est = grupos(g.anual.ufs[uf]?.[String(ano)]?.q, g.anual.ufs[uf]?.[String(ano)]?.v);
  const br = grupos(g.anual.brasil[String(ano)]?.q, g.anual.brasil[String(ano)]?.v);
  if (!d) {
    return <p className="pv-aviso">O arquivo do Ministério da Previdência não traz {m.nome} em dezembro de {ano}. Ausência de dado, não zero.</p>;
  }
  const ranking = rankingUf(arquivo, i);
  const posicao = ranking.findIndex((x) => x.id === m.id) + 1;
  const mostrados = ranking.slice(0, 8);
  if (posicao > 8) mostrados.push(ranking[posicao - 1]);
  const max = ranking[0]?.q ?? 1;
  const serieQ = anos.map((a, k) => ({ x: a, y: m.q[k]?.[0] ?? null }));
  const serieMedio = anos.map((a, k) => ({ x: a, y: medio(m.v[k]?.[0], m.q[k]?.[0]) }));
  const serieMedioUf = anos.map((a) => {
    const u = g.anual.ufs[uf]?.[String(a)];
    return { x: a, y: u ? medio(u.v[0], u.q[0]) : null };
  });
  const primeiro = serieQ.find((p) => p.y !== null);
  return (
    <>
      <article className="pv-extrato" aria-labelledby="extrato-titulo">
        <header>
          <h3 id="extrato-titulo">
            {m.nome} <span className="pv-unidade">{arquivo.nome_uf} ({uf})</span>
          </h3>
          <span className="pv-competencia">Competência dezembro de {ano} · código IBGE {m.id}</span>
        </header>
        <dl>
          <div>
            <dt>Benefícios pagos pelo INSS no mês</dt>
            <dd className="pv-valor">{num(d.q.total)}<span className="pv-unidade">benefícios</span></dd>
            <dd className="pv-detalhe">{num(posicao)}º entre os {num(ranking.length)} municípios {DO_ESTADO[uf]} · {pct(parte(d.q.total, est?.q.total))} dos benefícios do estado</dd>
          </div>
          <div>
            <dt>Valor médio de cada benefício</dt>
            <dd className="pv-valor pv-valor-acento">{reais(medio(d.v.total, d.q.total))}<span className="pv-unidade">líquido, no mês</span></dd>
            <dd className="pv-detalhe">No estado, {reais(medio(est?.v.total, est?.q.total))}; no Brasil, {reais(medio(br?.v.total, br?.q.total))}. Somados, {reaisGrandes(d.v.total)} no mês.</dd>
          </div>
        </dl>
      </article>

      <p className="pv-legenda-tabela" aria-hidden="true">{m.nome}, por grupo de benefício, em dezembro de {ano}: quantidade, parte do total e valor médio líquido, ao lado do estado e do Brasil. O arquivo não separa o valor por tipo de
            aposentadoria.</p>
      <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
        <table className="pv-tabela pv-tabela-larga">
          <caption className="cp-sr-only">{m.nome}, por grupo de benefício, em dezembro de {ano}: quantidade, parte do total e valor médio líquido, ao lado do estado e do Brasil. O arquivo não separa o valor por tipo de
            aposentadoria.</caption>
          <thead>
            <tr>
              <th scope="col">Grupo de benefício</th>
              <th scope="col">Benefícios no município</th>
              <th scope="col">Parte do total</th>
              <th scope="col">Valor médio no município</th>
              <th scope="col">Valor médio em {uf}</th>
              <th scope="col">Valor médio no Brasil</th>
            </tr>
          </thead>
          <tbody>
            {LINHAS_GRUPO.map((l) => (
              <tr key={l.q} className={`${l.nivel ? "pv-nivel-1" : ""} ${l.forte ? "pv-forte" : ""}`}>
                <th scope="row">{NOME_GRUPO_Q[l.q]}</th>
                <td>{num(d.q[l.q])}</td>
                <td>{pct(parte(d.q[l.q], d.q.total))}</td>
                {l.v ? (
                  <>
                    <td>{celulaMedio(d, l)}</td>
                    <td>{celulaMedio(est, l)}</td>
                    <td>{celulaMedio(br, l)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="pv-sem">não separado no arquivo</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pv-graficos-dois">
        <figure className="pv-figura">
          <GraficoColunas
            pontos={serieQ.map((p) => ({ ...p, destaque: p.x === ano }))}
            marcasX={serieQ.map((p) => ({ x: p.x, rotulo: String(p.x) }))}
            unidade="benefícios em dezembro"
            casas={0}
            descricao={`${m.nome}: ${num(primeiro?.y ?? null)} benefícios em dezembro de ${primeiro?.x} e ${num(d.q.total)} em dezembro de ${ano}.`}
          />
          <figcaption>Benefícios pagos por agências de {m.nome} em dezembro de cada ano. Ano sem dado fica sem coluna.</figcaption>
        </figure>
        <figure className="pv-figura">
          <GraficoLinhas
            series={[
              { nome: m.nome, classe: "pv-linha", pontos: serieMedio, rotuloFim: "Município" },
              { nome: arquivo.nome_uf, classe: "pv-linha-ref", pontos: serieMedioUf, rotuloFim: uf },
            ]}
            marcasX={anos.filter((a, k) => k % 2 === 0 || k === anos.length - 1).map((a) => ({ x: a, rotulo: String(a) }))}
            unidade="R$ por benefício, em valores da época"
            casas={0}
            descricao={`Valor médio líquido em ${m.nome}: ${reais(serieMedio.find((p) => p.y !== null)?.y ?? null)} em dezembro de ${anos[0]} e ${reais(medio(d.v.total, d.q.total))} em dezembro de ${ano}; em ${arquivo.nome_uf}, ${reais(serieMedioUf[serieMedioUf.length - 1]?.y ?? null)}.`}
          />
          <figcaption>Valor médio líquido de cada benefício em dezembro, no município e no estado. Valores nominais, sem correção pela inflação; o salário mínimo, piso de muitos benefícios, sobe todo ano.</figcaption>
        </figure>
      </div>

      <h3 className="mt-12 font-serif text-[23px] leading-snug">{m.nome} entre os municípios {DO_ESTADO[uf]}</h3>
      <div className="pv-barras" role="list" aria-label={`Municípios ${DO_ESTADO[uf]} com mais benefícios em dezembro de ${ano}`}>
        {mostrados.map((x) => {
          const pos = ranking.findIndex((y) => y.id === x.id) + 1;
          return (
            <div key={x.id} className={`pv-barra ${x.id === m.id ? "pv-escolhido" : ""}`} role="listitem">
              <span>
                {num(pos)}º{" "}
                {x.id === m.id ? x.nome : <a href={`${hrefMunicipio(x.id)}#municipio`} className="pv-toque text-obee-dark underline underline-offset-[3px]">{x.nome}</a>}
              </span>
              <span className="pv-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * x.q) / max}%` }} /></span>
              <span>{num(x.q)}</span>
            </div>
          );
        })}
      </div>
      <p className="pv-fonte">Benefícios em dezembro de {ano}. A ordem acompanha o tamanho da cidade e a rede de agências, não a renda dos moradores. A lista completa está no arquivo por município.</p>
      <ComoLerMunicipio />
      <p className="pv-fonte">
        Fonte: {g.fontes.municipios.orgao}, {g.fontes.municipios.nome.toLowerCase()}, dezembro de {anos[0]} a dezembro de {anos[anos.length - 1]}; capturado em {dataBr(g.fontes.municipios.capturado_em)}. Estado e
        Brasil: soma dos municípios, conferida com o BEPS. Valor médio calculado pela Scrutiniums (valor líquido dividido pela quantidade).
      </p>
    </>
  );
}

function celulaMedio(x: GruposAno | null, l: LinhaGrupo) {
  if (!x || !l.v) return SEM_DADO;
  return reais(medio(x.v[l.v], x.q[l.q]));
}

/* ------------------------------------------------------------------------------------------------ tipos */

const BARRAS_TIPO: IdTipo[] = ["apo_idade", "pensoes", "apo_tempo", "loas_deficiencia", "apo_invalidez", "loas_idoso", "auxilios", "acidentarios", "salario_maternidade", "rmv", "ble"];
const ORDEM_TABELA: { id: IdTipo; nivel: 0 | 1 | 2; forte?: boolean }[] = [
  { id: "rgps", nivel: 0, forte: true },
  { id: "aposentadorias", nivel: 1 },
  { id: "apo_idade", nivel: 2 },
  { id: "apo_tempo", nivel: 2 },
  { id: "apo_invalidez", nivel: 2 },
  { id: "pensoes", nivel: 1 },
  { id: "auxilios", nivel: 1 },
  { id: "aux_doenca", nivel: 2 },
  { id: "aux_acidente", nivel: 2 },
  { id: "aux_reclusao", nivel: 2 },
  { id: "salario_maternidade", nivel: 1 },
  { id: "acidentarios", nivel: 1 },
  { id: "acid_apo_invalidez", nivel: 2 },
  { id: "acid_pensao", nivel: 2 },
  { id: "acid_aux_doenca", nivel: 2 },
  { id: "acid_aux_acidente", nivel: 2 },
  { id: "acid_aux_suplementar", nivel: 2 },
  { id: "prev_outros", nivel: 1 },
  { id: "assistenciais", nivel: 0, forte: true },
  { id: "loas", nivel: 1 },
  { id: "loas_idoso", nivel: 2 },
  { id: "loas_deficiencia", nivel: 2 },
  { id: "loas_outros", nivel: 2 },
  { id: "rmv", nivel: 1 },
  { id: "ble", nivel: 0, forte: true },
  { id: "total", nivel: 0, forte: true },
];

function SecaoTipos({ g }: { g: GoldPrevidencia }) {
  const t = tiposPorId(g);
  const mes = mesExtenso(g.brasil_mes.referencia);
  const barras = BARRAS_TIPO.map((id) => t[id]).sort((a, b) => b.q - a.q);
  const max = barras[0]?.q ?? 1;
  const nome = (id: IdTipo) => (id.startsWith("acid_") ? `${NOME_TIPO[id]} (acidente de trabalho)` : NOME_TIPO[id]);
  return (
    <section className="pv-secao" id="tipos" aria-labelledby="tipos-titulo">
      <h2 id="tipos-titulo">Que benefícios o INSS paga?</h2>
      <p className="pv-intro">
        Em {mes}, {milhoes(t.total.q)} de benefícios. Aposentadorias, pensões e auxílios são do Regime Geral e dependem de contribuição. O Benefício de Prestação Continuada (BPC) é assistencial: um
        salário mínimo para a pessoa idosa a partir de 65 anos ou com deficiência, de família de baixa renda, sem contribuição. O INSS paga os dois.
      </p>
      <div className="pv-barras" role="list" aria-label={`Benefícios por tipo em ${mes}`}>
        {barras.map((x) => (
          <div key={x.id} className="pv-barra" role="listitem">
            <span>{NOME_TIPO[x.id]}</span>
            <span className="pv-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * x.q) / max}%` }} /></span>
            <span>{num(x.q / 1e6, 2)} mi</span>
          </div>
        ))}
      </div>
      <p className="pv-fonte">Milhões de benefícios em {mes}. Auxílios e benefícios por acidente de trabalho aparecem somados; o detalhe está na tabela.</p>

      <p className="pv-legenda-tabela" aria-hidden="true">Todos os tipos de benefício emitidos pelo INSS em {mes}: quantidade, parte do total, valor médio líquido e parte paga à clientela rural.</p>
      <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
        <table className="pv-tabela pv-tabela-larga">
          <caption className="cp-sr-only">Todos os tipos de benefício emitidos pelo INSS em {mes}: quantidade, parte do total, valor médio líquido e parte paga à clientela rural.</caption>
          <thead>
            <tr>
              <th scope="col">Tipo de benefício</th>
              <th scope="col">Benefícios</th>
              <th scope="col">Parte do total</th>
              <th scope="col">Valor médio</th>
              <th scope="col">Clientela rural</th>
            </tr>
          </thead>
          <tbody>
            {ORDEM_TABELA.map(({ id, nivel, forte }) => {
              const x = t[id];
              return (
                <tr key={id} className={`${nivel === 1 ? "pv-nivel-1" : nivel === 2 ? "pv-nivel-2" : ""} ${forte ? "pv-forte" : ""}`}>
                  <th scope="row">{nivel === 2 ? nome(id) : NOME_TIPO[id]}</th>
                  <td>{num(x.q)}</td>
                  <td>{pct((100 * x.q) / t.total.q)}</td>
                  <td>{reais(x.medio)}</td>
                  <td>{x.q_rural === null ? SEM_DADO : pct((100 * x.q_rural) / x.q)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pv-fonte">
        Fonte: {g.fontes.beps.orgao}, {g.fontes.beps.nome}, {g.fontes.beps.edicao}, tabela 15, {mes}; capturado em {dataBr(g.fontes.beps.capturado_em)}. Valor médio: valor líquido emitido no mês
        dividido pela quantidade, calculado pela Scrutiniums. Clientela rural é a do benefício (trabalhador rural), não o lugar onde a pessoa mora.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------------------- resultado do RGPS */

function Fluxo({ rotulo, entra, sai, ano }: { rotulo: string; entra: number; sai: number; ano: number }) {
  const parte = Math.max(0, Math.min(100, (100 * entra) / sai));
  const falta = sai - entra;
  return (
    <div className="pv-fluxo-linha">
      <span>
        {rotulo}
        <br />
        <span className="text-carvao-muted">benefícios: {bilhoesDeMilhoes(sai)}</span>
      </span>
      <div className="min-w-0">
        <div className="pv-fluxo-trilho" role="img" aria-label={`${rotulo}, ${ano}: arrecadação de ${bilhoesDeMilhoes(entra)} cobre ${pct(parte)} dos benefícios de ${bilhoesDeMilhoes(sai)}; faltam ${bilhoesDeMilhoes(falta)}.`}>
          <span className="pv-fluxo-entra" style={{ width: `${parte}%` }} />
          <span className="pv-fluxo-falta" style={{ width: `${100 - parte}%` }} />
        </div>
        <p className="pv-fluxo-valores" aria-hidden="true">
          <span><i className="pv-fluxo-entra" />arrecadação {bilhoesDeMilhoes(entra)} ({pct(parte, 0)})</span>
          <span><i className="pv-fluxo-falta" />Tesouro {bilhoesDeMilhoes(falta)}</span>
        </p>
      </div>
    </div>
  );
}

function SecaoResultado({ g }: { g: GoldPrevidencia }) {
  const r = g.rgps;
  const k = r.anos.length - 1;
  const ano = r.anos[k];
  const iniDiv = r.anos.indexOf(r.inicio_divisao_urbana_rural);
  const anosDiv = r.anos.slice(iniDiv);
  const linhas = r.anos.map((a, i) => ({ a, i })).reverse();
  return (
    <section className="pv-secao" id="resultado" aria-labelledby="resultado-titulo">
      <h2 id="resultado-titulo">Como o Regime Geral fecha a conta?</h2>
      <p className="pv-intro">
        O Regime Geral funciona por repartição: as contribuições de quem trabalha hoje pagam os benefícios de hoje. Quando a arrecadação líquida não alcança a despesa com benefícios, a diferença é a
        necessidade de financiamento, coberta pelo Tesouro com os demais tributos. O BPC é pago pelo Tesouro à parte, porque não tem contribuição.
      </p>
      <div className="pv-mecanismo">
        <div className="pv-fluxo" aria-label={`Quanto entra e quanto sai do Regime Geral em ${ano}`}>
          <Fluxo rotulo="Regime Geral" entra={r.arrecadacao[k]} sai={r.beneficios[k]} ano={ano} />
          {r.arrecadacao_urbana[k] !== null && r.beneficios_urbano[k] !== null && <Fluxo rotulo="Clientela urbana" entra={r.arrecadacao_urbana[k] as number} sai={r.beneficios_urbano[k] as number} ano={ano} />}
          {r.arrecadacao_rural[k] !== null && r.beneficios_rural[k] !== null && <Fluxo rotulo="Clientela rural" entra={r.arrecadacao_rural[k] as number} sai={r.beneficios_rural[k] as number} ano={ano} />}
          <p className="pv-fluxo-nota">
            Proporções reais de {ano}: cada faixa é a despesa com benefícios daquela clientela; a parte cheia é a arrecadação líquida, a hachurada é o que o Tesouro cobriu. A clientela rural
            contribui sobre a venda da produção, por isso arrecada pouco perto do que recebe. Além disso, {bilhoesDeMilhoes(r.bpc_rmv[k])} em BPC e renda mensal vitalícia, assistência sem
            contribuição, fora do Regime Geral.
          </p>
        </div>
      </div>

      <div className="pv-graficos-dois">
        <figure className="pv-figura">
          <GraficoLinhas
            series={[
              { nome: "Benefícios", classe: "pv-linha", pontos: r.anos.map((a, i) => ({ x: a, y: r.pct_pib.beneficios[i] })), rotuloFim: "Benefícios" },
              { nome: "Arrecadação", classe: "pv-linha-ref", pontos: r.anos.map((a, i) => ({ x: a, y: r.pct_pib.arrecadacao[i] })), rotuloFim: "Arrecadação" },
            ]}
            marcasX={marcasAnos(r.anos)}
            unidade="% do PIB"
            casas={1}
            descricao={`Benefícios do Regime Geral: ${pct(r.pct_pib.beneficios[0], 2)} do PIB em ${r.anos[0]} e ${pct(r.pct_pib.beneficios[k], 2)} em ${ano}. Arrecadação líquida: ${pct(r.pct_pib.arrecadacao[0], 2)} e ${pct(r.pct_pib.arrecadacao[k], 2)}.`}
          />
          <figcaption>Arrecadação líquida e despesa com benefícios do Regime Geral, em % do PIB de cada ano, de {r.anos[0]} a {ano}.</figcaption>
        </figure>
        <figure className="pv-figura">
          <GraficoColunas
            pontos={r.anos.map((a, i) => ({ x: a, y: -r.pct_pib.resultado[i] }))}
            marcasX={marcasAnos(r.anos)}
            unidade="necessidade de financiamento, % do PIB"
            casas={1}
            descricao={`Necessidade de financiamento do Regime Geral: ${pct(-r.pct_pib.resultado[0], 2)} do PIB em ${r.anos[0]} e ${pct(-r.pct_pib.resultado[k], 2)} em ${ano}.`}
          />
          <figcaption>Benefícios menos arrecadação líquida, em % do PIB. Acima do zero, a arrecadação não cobriu os benefícios.</figcaption>
        </figure>
      </div>

      <details className="pv-metodo mt-10">
        <summary>Os valores ano a ano, de {r.anos[0]} a {ano}</summary>
        <p className="pv-legenda-tabela" aria-hidden="true">R$ bilhões em valores nominais de cada ano e % do PIB. Divisão urbana e rural desde {r.inicio_divisao_urbana_rural}; antes disso, o Tesouro não a publica.</p>
        <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
          <table className="pv-tabela pv-tabela-larga">
            <caption className="cp-sr-only">R$ bilhões em valores nominais de cada ano e % do PIB. Divisão urbana e rural desde {r.inicio_divisao_urbana_rural}; antes disso, o Tesouro não a publica.</caption>
            <thead>
              <tr>
                <th scope="col">Ano</th>
                <th scope="col">Arrecadação líquida</th>
                <th scope="col">Benefícios</th>
                <th scope="col">Necessidade de financiamento</th>
                <th scope="col">Em % do PIB</th>
                <th scope="col">Urbana</th>
                <th scope="col">Rural</th>
                <th scope="col">BPC e renda vitalícia</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ a, i }) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  <td>{num(r.arrecadacao[i] / 1e3, 1)}</td>
                  <td>{num(r.beneficios[i] / 1e3, 1)}</td>
                  <td>{num(-r.resultado[i] / 1e3, 1)}</td>
                  <td>{pct(-r.pct_pib.resultado[i], 2)}</td>
                  <td className={r.resultado_urbano[i] === null ? "pv-sem" : ""}>{r.resultado_urbano[i] === null ? SEM_DADO : num(-(r.resultado_urbano[i] as number) / 1e3, 1)}</td>
                  <td className={r.resultado_rural[i] === null ? "pv-sem" : ""}>{r.resultado_rural[i] === null ? SEM_DADO : num(-(r.resultado_rural[i] as number) / 1e3, 1)}</td>
                  <td className={r.bpc_rmv[i] === null ? "pv-sem" : ""}>{r.bpc_rmv[i] === null ? SEM_DADO : num((r.bpc_rmv[i] as number) / 1e3, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pv-fonte">
          Urbana e rural: necessidade de financiamento de cada clientela (benefícios menos arrecadação), apurada pelo Ministério da Previdência e publicada pelo Tesouro. Negativo indica que a
          arrecadação superou os benefícios naquele ano ({anosDiv.filter((_a, j) => (r.resultado_urbano[iniDiv + j] ?? 0) > 0).length} anos na clientela urbana).
        </p>
      </details>
      <p className="pv-fonte">
        Fonte: {g.fontes.rtn.orgao}, {g.fontes.rtn.nome}, edição de {mesExtenso(g.fontes.rtn.edicao)}, tabela 2.2 (R$ milhões correntes) e PIB nominal da tabela 2.1-A; capturado em{" "}
        {dataBr(g.fontes.rtn.capturado_em)}. Arrecadação líquida inclui a compensação do Tesouro pelas desonerações da folha. Benefícios incluem sentenças judiciais. A conta em % do PIB foi
        conferida com a publicada pelo Tesouro.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------- estados */

function SecaoEstados({ g }: { g: GoldPrevidencia }) {
  const u = g.ufs_mes;
  const mes = mesExtenso(u.referencia);
  const ano = g.anual.anos[g.anual.anos.length - 1];
  const porMedio = [...u.ufs].sort((a, b) => (b.medio ?? 0) - (a.medio ?? 0));
  const maxMedio = Math.max(...u.ufs.map((x) => x.medio ?? 0));
  const escala = maxMedio * 1.05;
  const porQ = [...u.ufs].sort((a, b) => b.q - a.q);
  return (
    <section className="pv-secao" id="estados" aria-labelledby="estados-titulo">
      <h2 id="estados-titulo">Como se compara cada estado?</h2>
      <p className="pv-intro">
        Valor médio do benefício do Regime Geral em cada estado em {mes}; a linha escura marca o do Brasil, {reais(u.brasil.medio)}. No Brasil, a clientela rural recebe em média{" "}
        {reais(u.brasil.medio_rural)} e a urbana, {reais(u.brasil.medio_urbana)}: a parte rural de cada estado está na tabela.
      </p>
      <div className="pv-barras" role="list" aria-label={`Valor médio do benefício do Regime Geral por estado em ${mes}`}>
        {porMedio.map((x) => (
          <div key={x.uf} className="pv-barra" role="listitem">
            <span>{x.nome}</span>
            <span className="pv-barra-trilho" aria-hidden="true">
              <i style={{ width: `${(100 * (x.medio ?? 0)) / escala}%` }} />
              <b style={{ left: `${(100 * (u.brasil.medio ?? 0)) / escala}%` }} />
            </span>
            <span>{reais(x.medio)}</span>
          </div>
        ))}
      </div>

      <p className="pv-legenda-tabela" aria-hidden="true">Regime Geral em {mes} (BEPS, tabela 19) e todos os benefícios em dezembro de {ano} (soma dos municípios). Ordem: mais benefícios do Regime Geral primeiro.</p>
      <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
        <table className="pv-tabela pv-tabela-larga">
          <caption className="cp-sr-only">Regime Geral em {mes} (BEPS, tabela 19) e todos os benefícios em dezembro de {ano} (soma dos municípios). Ordem: mais benefícios do Regime Geral primeiro.</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>Estado</th>
              <th scope="colgroup" colSpan={5}>Regime Geral, {mesCurto(u.referencia)}</th>
              <th scope="colgroup" colSpan={2}>Todos os benefícios, dez/{ano}</th>
            </tr>
            <tr>
              <th scope="col">Benefícios</th>
              <th scope="col">Valor médio</th>
              <th scope="col">Urbano</th>
              <th scope="col">Rural</th>
              <th scope="col">Parte rural</th>
              <th scope="col">Benefícios</th>
              <th scope="col">Assistenciais</th>
            </tr>
          </thead>
          <tbody>
            {porQ.map((x) => {
              const d = grupos(g.anual.ufs[x.uf]?.[String(ano)]?.q, g.anual.ufs[x.uf]?.[String(ano)]?.v);
              return (
                <tr key={x.uf}>
                  <th scope="row">{x.nome}</th>
                  <td>{num(x.q)}</td>
                  <td>{reais(x.medio)}</td>
                  <td>{reais(x.medio_urbana)}</td>
                  <td>{reais(x.medio_rural)}</td>
                  <td>{pct(x.pct_rural)}</td>
                  <td>{num(d?.q.total ?? null)}</td>
                  <td>{d ? pct((100 * d.q.assistenciais) / d.q.total) : SEM_DADO}</td>
                </tr>
              );
            })}
            <tr className="pv-forte">
              <th scope="row">Brasil</th>
              <td>{num(u.brasil.q)}</td>
              <td>{reais(u.brasil.medio)}</td>
              <td>{reais(u.brasil.medio_urbana)}</td>
              <td>{reais(u.brasil.medio_rural)}</td>
              <td>{pct(u.brasil.pct_rural)}</td>
              <td>{num(g.anual.brasil[String(ano)].q[0])}</td>
              <td>{pct((100 * g.anual.brasil[String(ano)].q[9]) / g.anual.brasil[String(ano)].q[0])}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="pv-fonte">
        Fonte: {g.fontes.beps.orgao}, BEPS {g.fontes.beps.edicao}, tabela 19 ({num(u.sem_localizacao)} créditos sem localização ficam fora dos estados e entram no Brasil da tabela 15), e
        benefícios emitidos por município, dezembro de {ano}, somados pelo código IBGE (município do órgão pagador). Valores líquidos, nominais. Parte rural: benefícios da clientela rural sobre o
        total do Regime Geral.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------------------------------------- evolução */

function SecaoEvolucao({ g }: { g: GoldPrevidencia }) {
  const s = g.serie;
  const tempo = (m: string) => Number(m.slice(0, 4)) + (Number(m.slice(5, 7)) - 1) / 12;
  const pts = (grupo: "rgps" | "assist") => s.meses.map((m, i) => ({ x: tempo(m), y: s.q[grupo][i] }));
  const dezembros = s.meses.map((m, i) => ({ m, i })).filter(({ m }) => m.endsWith("-12"));
  const ultimo = s.meses.length - 1;
  const anos = [...new Set(s.meses.map((m) => Number(m.slice(0, 4))))];
  const marcas = marcasAnos(anos).map((m) => ({ x: m.x, rotulo: m.rotulo }));
  const medioDez = (grupo: "rgps" | "assist") => dezembros.map(({ m, i }) => ({ x: Number(m.slice(0, 4)), y: medio(s.v[grupo][i], s.q[grupo][i]) }));
  const anosDez = dezembros.map(({ m }) => Number(m.slice(0, 4)));
  return (
    <section className="pv-secao" id="evolucao" aria-labelledby="evolucao-titulo">
      <h2 id="evolucao-titulo">Como o número de benefícios mudou?</h2>
      <p className="pv-intro">
        Benefícios emitidos a cada mês desde {mesExtenso(s.meses.find((m) => m.endsWith("-01")))} (antes disso, só dezembro, desde {s.meses[0].slice(0, 4)}). Em {mesExtenso(s.meses[ultimo])},{" "}
        {milhoes(s.q.rgps[ultimo])} do Regime Geral e {milhoes(s.q.assist[ultimo])} assistenciais.
      </p>
      <div className="pv-graficos-dois">
        <figure className="pv-figura">
          <GraficoLinhas
            series={[
              { nome: "Regime Geral", classe: "pv-linha", pontos: pts("rgps"), rotuloFim: "Regime Geral" },
              { nome: "Assistenciais", classe: "pv-linha-ref", pontos: pts("assist"), rotuloFim: "Assistenciais" },
            ]}
            marcasX={marcas}
            unidade="milhões de benefícios"
            divisor={1e6}
            casas={0}
            descricao={`Benefícios do Regime Geral: ${milhoes(s.q.rgps[0])} em ${mesExtenso(s.meses[0])} e ${milhoes(s.q.rgps[ultimo])} em ${mesExtenso(s.meses[ultimo])}. Assistenciais: ${milhoes(s.q.assist[0])} e ${milhoes(s.q.assist[ultimo])}.`}
          />
          <figcaption>Quantidade de benefícios emitidos no mês, por grande grupo. Os benefícios de legislação específica, {num(s.q.ble[ultimo])} no último mês, não aparecem na escala.</figcaption>
        </figure>
        <figure className="pv-figura">
          <GraficoLinhas
            series={[
              { nome: "Regime Geral", classe: "pv-linha", pontos: medioDez("rgps"), rotuloFim: "Regime Geral" },
              { nome: "Assistenciais", classe: "pv-linha-ref", pontos: medioDez("assist"), rotuloFim: "Assistenciais" },
            ]}
            marcasX={marcasAnos(anosDez)}
            unidade="R$ por benefício em dezembro, valores da época"
            casas={0}
            descricao={`Valor médio líquido em dezembro, Regime Geral: ${reais(medioDez("rgps")[0].y)} em ${anosDez[0]} e ${reais(medioDez("rgps").at(-1)?.y ?? null)} em ${anosDez.at(-1)}.`}
          />
          <figcaption>Valor médio líquido em dezembro de cada ano (sem o abono anual, que entra em outros meses). Valores nominais, sem correção pela inflação.</figcaption>
        </figure>
      </div>
      <p className="pv-fonte">
        Fonte: {g.fontes.beps.orgao}, BEPS {g.fontes.beps.edicao}, tabela 14 ({g.fontes.beps.tabelas["14"].toLowerCase()}); capturado em {dataBr(g.fontes.beps.capturado_em)}. Em cada dezembro, a
        quantidade e o valor conferem com a soma do arquivo por município.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ método */

function Metodo({ g }: { g: GoldPrevidencia }) {
  const f = g.fontes;
  const anos = g.anual.anos;
  return (
    <details className="pv-metodo" id="metodo">
      <summary>Método, fontes e arquivos para baixar</summary>
      <div className="pv-metodo-corpo">
        <div>
          <h3>O que cada número mede</h3>
          <ul>
            <li>
              <strong>Benefício emitido</strong>: crédito que o INSS encaminha à rede bancária no mês. Conta benefícios, não pessoas: quem recebe aposentadoria e pensão conta duas vezes. Não é o
              valor sacado.
            </li>
            <li>
              <strong>Valor líquido</strong>: valor bruto menos descontos, como o empréstimo consignado e o imposto de renda retido. Valor médio é o valor líquido dividido pela quantidade, calculado
              pela Scrutiniums.
            </li>
            <li>
              <strong>Município</strong>: o do órgão pagador (a agência), não o de residência. Estados e Brasil por município são somas pelo código IBGE.
            </li>
            <li>
              <strong>Regime Geral (RGPS)</strong>: previdência dos trabalhadores do setor privado e dos servidores sem regime próprio, paga pelo INSS. <strong>Assistenciais</strong>: BPC e renda
              mensal vitalícia, sem contribuição. <strong>Legislação específica</strong>: pensões especiais criadas por lei, pagas pelo INSS por conta da União.
            </li>
            <li>
              <strong>Necessidade de financiamento</strong>: benefícios previdenciários menos arrecadação líquida do Regime Geral, a mesma conta do Tesouro e do Ministério da Previdência. Valores
              nominais; a comparação entre anos usa o % do PIB.
            </li>
          </ul>
        </div>
        <div>
          <h3>Fontes</h3>
          <ul>
            <li>
              {f.beps.orgao}, <a href={f.beps.pagina}>{f.beps.nome}</a>, {f.beps.edicao}, referência {mesExtenso(f.beps.referencia)}, tabelas 14, 15 e 19 (<a href={f.beps.url}>planilha</a>). Mensal.
              Capturado em {dataBr(f.beps.capturado_em)}.
            </li>
            <li>
              {f.municipios.orgao}, <a href={f.municipios.pagina}>{f.municipios.nome.toLowerCase()}</a>, dezembro de {anos[0]} a dezembro de {anos[anos.length - 1]}, uma planilha por ano. Anual.
              Capturado em {dataBr(f.municipios.capturado_em)}. O arquivo de {anos[0] - 1} não está publicado e o de {anos[0] - 2} tem outro desenho, por isso a série começa em {anos[0]}.
            </li>
            <li>
              {f.rtn.orgao}, <a href={f.rtn.pagina}>{f.rtn.nome}</a>, edição de {mesExtenso(f.rtn.edicao)}{f.rtn.publicado_em ? `, publicada em ${dataBr(f.rtn.publicado_em)}` : ""}, tabelas 2.2 e 2.1-A (
              <a href={f.rtn.url}>planilha</a>). Capturado em {dataBr(f.rtn.capturado_em)}. Método do resultado: <a href={f.rtn.metodo_resultado}>Ministério da Previdência</a>.
            </li>
          </ul>
        </div>
        <div>
          <h3>Conferências que seguram a publicação</h3>
          <p>
            A atualização é agendada duas vezes por mês. Nada é publicado se a série mensal tiver mês faltando ou não fechar com os grupos, se a tabela dos tipos mudar de linhas ou as partes não
            somarem o todo, se os 27 estados não somarem o Brasil, se um município não fechar por grupo, se a soma dos municípios em algum dezembro diferir do BEPS, se a divisão urbana e rural do
            Tesouro não somar o total, se o % do PIB não conferir com o publicado ou se um ano fechado for revisto além do limite. Ausência fica como ausência: nunca vira zero nem estimativa.
          </p>
        </div>
        <div>
          <h3>Arquivos para baixar</h3>
          <div className="pv-arquivos">
            {DOWNLOADS.map((d) => (
              <a key={d.arquivo} href={`${ROTA_PREVIDENCIA}/${d.arquivo}`} download className="pv-toque text-obee-dark underline underline-offset-[3px]">
                {d.rotulo} (CSV)
              </a>
            ))}
          </div>
          <p className="pv-fonte">CSV com ponto e vírgula, codificação UTF-8, valores com ponto decimal. Ausência fica vazia, nunca zero. Cada arquivo traz a fonte e o período em colunas.</p>
        </div>
      </div>
    </details>
  );
}
