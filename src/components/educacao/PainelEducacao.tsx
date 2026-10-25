/**
 * Painel completo "Educação nos municípios" (com conta). Seções por pergunta, na ordem da procura: a escola pública do
 * município do leitor (o Ideb, a série com a meta, do que o índice é feito, a comparação com o estado, o Brasil e as
 * cidades do mesmo porte, as matrículas e as escolas), os estados lado a lado, o porte da cidade, onde não há Ideb e por
 * quê, as capitais em profundidade e o método recolhido no fim. Tudo desenhado no servidor a partir da gold; nenhum
 * número escrito à mão.
 */
import Link from "next/link";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { destinosDaColecao } from "@/components/observatorios/DestinosDaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { BuscaEducacao } from "./BuscaEducacao";
import { GraficoDistribuicao, GraficoIdeb, GraficoComponente, type SerieLinha } from "./Graficos";
import { LaboratorioIdeb } from "./LaboratorioIdeb";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { anosComIdeb, idebRecente, manchete, posicaoNaUf, rotuloPorte, type ConsultaMunicipio } from "@/lib/educacao/dados";
import { dataBr, ideb, num, parte, pct } from "@/lib/educacao/formato";
import {
  DESCRICAO_REDE, DOWNLOADS, NOME_ETAPA, NOME_REDE, PERGUNTA_PAINEL, ROTA_CAPITAIS, ROTA_EDUCACAO, ROTULO_MOTIVO, SERIES_ETAPA, TEXTO_MARCA, TEXTO_MOTIVO, TITULO_CAPITAIS, hrefFichaMunicipio,
} from "@/lib/educacao/paginas";
import { DO_ESTADO } from "@/lib/previdencia/paginas";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { ETAPAS, MOTIVOS, type ArquivoUf, type Etapa, type GoldEducacao, type MunicipioGold, type Rede, type Serie } from "@/lib/educacao/tipos";

export function PainelEducacao({ g, consulta }: { g: GoldEducacao; consulta: ConsultaMunicipio }) {
  const uf = consulta.estado === "ok" ? consulta.uf : null;
  const m = consulta.estado === "ok" ? consulta.m : null;
  const k = manchete(g);
  const br = g.ideb.brasil.ai.municipal;
  const i = g.ideb.anos.length - 1;
  const semIdeb = k.municipios - k.comIdebAi;
  // molde único de entrada (Iniciativa 4 do parecer de UX, 22/10/2026): as seções de sempre, nas fatias do molde; as longas, recolhidas
  return (
    <EntradaColecao
      tipo="colecao"
      rota={ROTA_EDUCACAO}
      idPrincipal="conteudo-educacao"
      acento="obee"
      titulo={PERGUNTA_PAINEL}
      frase={`Aprendizagem e aprovação no Índice de Desenvolvimento da Educação Básica (Ideb). Resultados de ${g.ideb.ano} e matrículas do Censo Escolar ${g.censo.ano}.`}
      frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/educacao-municipal"]} conteiner="mx-auto max-w-page px-6" />}
      escala={escalaEducacao(g)}
      seuMunicipio={consulta.estado === "ok" ? <ExtratoMunicipio g={g} m={consulta.m} uf={consulta.uf} arquivo={consulta.arquivo} ficha /> : undefined}
      paraVoce={
        <ParaVoce entrada={ROTA_EDUCACAO}>
          <SecaoMunicipio g={g} c={consulta} />
        </ParaVoce>
      }
      destinos={destinosDaColecao("educacao")}
      artefato={
        typeof br.n[i] === "number" && typeof br.p[i] === "number" && typeof br.ideb[i] === "number" ? (
          <ModeloDidatico
            id="laboratorio-ideb"
            titulo="Como a aprendizagem e a aprovação formam o Ideb"
            descricao={`Mova a nota (N) e o fluxo (P) e veja o índice que resulta, a partir dos números das redes municipais do Brasil nos anos iniciais em ${g.ideb.ano}. A conta é a do INEP: Ideb = N × P.`}
            deixaDeFora={[
              "A média harmônica das taxas de aprovação de cada ano escolar, de onde sai o P",
              "A régua do Saeb, que junta as notas de português e de matemática no N",
              "O que acontece em cada escola: o índice é o da rede inteira",
            ]}
          >
            <LaboratorioIdeb n={br.n[i] as number} p={br.p[i] as number} ideb={br.ideb[i] as number} rede="rede municipal do Brasil" ano={g.ideb.ano} />
          </ModeloDidatico>
        ) : (
          <ModeloDidatico id="laboratorio-ideb" titulo="Como a aprendizagem e a aprovação formam o Ideb" deixaDeFora={["A média harmônica das taxas de aprovação de cada ano escolar, de onde sai o P", "A régua do Saeb, que junta as notas de português e de matemática no N"]}>
            <ComoLer />
          </ModeloDidatico>
        )
      }
      caminhos={[
        { pergunta: "Como cada estado se compara?", resumo: "O Ideb das redes municipais e públicas de cada estado, lado a lado com o Brasil.", href: "#estados" },
        { pergunta: "O tamanho da cidade faz diferença no Ideb?", resumo: "O Ideb pelas faixas de população do IBGE, com a mediana e os quartis.", href: "#porte" },
        {
          pergunta: "Onde não há Ideb, e por quê?",
          resumo: "As redes sem resultado e o motivo de cada uma, como o INEP informa.",
          href: "#cobertura",
          numero: { rotulo: "Municípios sem Ideb dos anos iniciais na rede municipal", valor: num(semIdeb), unidade: `de ${num(k.municipios)}`, periodo: String(k.ano), fonte: `INEP, Ideb ${g.fontes.ideb.edicao}`, href: "#cobertura" },
        },
        { pergunta: "Como estão as escolas municipais das capitais?", resumo: `Gasto, alunos por turma, Ideb e Saeb das 26 capitais, no painel ${TITULO_CAPITAIS}.`, href: ROTA_CAPITAIS },
      ]}
      recolhidos={
        <>
          <Recolhido id="recolhido-retrato" titulo="O retrato do país" resumo="Os números de abertura numa frase, com a distribuição das redes.">
            <Achado g={g} />
          </Recolhido>
          <Recolhido id="recolhido-estados" titulo="Como cada estado se compara?" resumo="A tabela dos estados e do Brasil.">
            <SecaoEstados g={g} uf={uf} />
          </Recolhido>
          <Recolhido id="recolhido-porte" titulo="O tamanho da cidade faz diferença no Ideb?" resumo="O Ideb pelas faixas de população.">
            <SecaoPorte g={g} m={m} />
          </Recolhido>
          <Recolhido id="recolhido-cobertura" titulo="Onde não há Ideb, e por quê?" resumo="As redes sem resultado, com o motivo.">
            <SecaoCobertura g={g} />
          </Recolhido>
          <Recolhido id="recolhido-capitais" titulo="As capitais em profundidade" resumo={`O painel ${TITULO_CAPITAIS}, da Eficiência Estatal.`}>
            <SecaoCapitais />
          </Recolhido>
        </>
      }
      metodo={<Metodo g={g} />}
      frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/educacao-municipal"]} variante="metodo" />}
    />
  );
}

/** Os quatro números da abertura, lidos da gold (os mesmos da frase do retrato do país). */
function escalaEducacao(g: GoldEducacao): NumeroPorta[] {
  const k = manchete(g);
  const f = g.fontes;
  const v = (x: number | null | undefined, t: (n: number) => string) => (typeof x === "number" ? t(x) : null);
  return [
    { rotulo: "Ideb dos anos iniciais, redes municipais do Brasil", valor: v(k.ai, ideb), unidade: "de 0 a 10", periodo: `${k.ano}, 1º ao 5º ano`, fonte: `INEP, Ideb ${f.ideb.edicao}`, href: "#municipio" },
    { rotulo: "Ideb dos anos finais, redes municipais do Brasil", valor: v(k.af, ideb), unidade: "de 0 a 10", periodo: `${k.ano}, 6º ao 9º ano`, fonte: `INEP, Ideb ${f.ideb.edicao}`, href: "#municipio" },
    { rotulo: "Redes municipais com Ideb dos anos iniciais", valor: num(k.comIdebAi), unidade: `de ${num(k.municipios)} municípios`, periodo: String(k.ano), fonte: `INEP, Ideb ${f.ideb.edicao}`, nota: "As demais, com o motivo, na seção sobre a cobertura.", href: "#cobertura" },
    { rotulo: "Matrículas nas redes municipais", valor: v(k.matMunicipal, (x) => num(x / 1e6, 2)), unidade: "milhões", periodo: `${k.censoAno}, educação básica`, fonte: "INEP, Censo Escolar", href: "#municipio" },
  ];
}

/** Os anos do Ideb depois do fim do primeiro ciclo de metas ("2023 e 2025"). */
const semMeta = (anos: number[], anosMeta: number[]) => {
  const l = anos.filter((a) => a > anosMeta[anosMeta.length - 1]).map(String);
  return l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0] ?? "as edições seguintes";
};

const anoNota = (g: GoldEducacao) => (g.ideb.anos.includes(2021) ? { ano: 2021, texto: "2021, pandemia" } : undefined);

/* --------------------------------------------------------------------------------------------- abertura */

/** A frase do retrato do país (os quatro números estão na escala da entrada). */
function Achado({ g }: { g: GoldEducacao }) {
  const k = manchete(g);
  const d = g.distribuicao.ai.brasil;
  return (
    <p className="edm-achado">
        Em {k.ano}, o Ideb dos anos iniciais das redes municipais do Brasil foi <strong>{ideb(k.ai)}</strong>, numa escala de 0 a 10. Entre as {num(d.n)} redes municipais com
        resultado, metade ficou entre <strong>{ideb(d.p25)}</strong> e <strong>{ideb(d.p75)}</strong>. As prefeituras respondem por {pct(parte(k.matMunicipal, k.matPublica), 0)} das
        matrículas da educação básica pública, segundo o Censo Escolar {k.censoAno}.
    </p>
  );
}

/* -------------------------------------------------------------------------------------------- município */

function ComoLer() {
  return (
    <div className="edm-ler" aria-label="Como ler o Ideb">
      <p>
        <strong>O Ideb junta aprendizagem e aprovação.</strong> É a nota dos alunos na prova do Saeb (português e matemática, no 5º e no 9º ano) multiplicada por um indicador de
        aprovação. Vai de 0 a 10 e sai a cada dois anos. Uma rede que aprova todos com nota baixa e outra que reprova muitos com nota alta podem ter o mesmo Ideb.
      </p>
      <p>
        <strong>Rede municipal é a escola da prefeitura.</strong> A rede pública junta as escolas municipais, estaduais e federais do município. O resultado do município não é a
        média das escolas: o INEP recalcula a nota e a aprovação com todos os alunos da rede.
      </p>
    </div>
  );
}

function SecaoMunicipio({ g, c }: { g: GoldEducacao; c: ConsultaMunicipio }) {
  return (
    <section className="edm-secao" id="municipio" aria-labelledby="municipio-titulo">
      <h2 id="municipio-titulo">Como está a escola pública do seu município?</h2>
      <p className="edm-intro">
        O Ideb da rede municipal e da rede pública de cada um dos {num(g.municipios.total)} municípios, de {g.ideb.anos[0]} a {g.ideb.ano}, com a aprendizagem e a aprovação que o
        compõem, ao lado do estado, do Brasil e das cidades do mesmo porte, e as matrículas e as escolas do Censo Escolar {g.censo.ano}.
      </p>
      <div className="edm-busca">
        <BuscaEducacao rotulo={c.estado === "ok" ? "Escolher outro município" : "Escolha o município"} />
      </div>
      {c.estado === "invalida" && (
        <p role="status" className="edm-aviso">
          {c.codigo ? `Nenhum município da base tem o código IBGE ${c.codigo}.` : "O endereço não traz um código IBGE de município, que tem sete dígitos."} Busque pelo nome.
        </p>
      )}
      {c.estado !== "ok" && <ComoLer />}
    </section>
  );
}

/** A rede que representa o município: a municipal quando tem Ideb em algum ano; senão a pública toda. */
function redeDoMunicipio(m: MunicipioGold, etapa: Etapa, anos: number[]): Rede | null {
  if (anosComIdeb(m[etapa].municipal, anos).length) return "municipal";
  if (anosComIdeb(m[etapa].publica, anos).length) return "publica";
  return null;
}

export function Municipio({ g, m, uf, arquivo }: { g: GoldEducacao; m: MunicipioGold; uf: string; arquivo: ArquivoUf }) {
  const anos = arquivo.anos;
  const porte = rotuloPorte(g, m.porte);
  return (
    <>
      <ExtratoMunicipio g={g} m={m} uf={uf} arquivo={arquivo} />
      {m.capital && (
        <p className="edm-capital">
          <span>{m.nome} é capital: o gasto da prefeitura com educação por matrícula, os alunos por turma e o Ideb lado a lado com as outras 25 capitais estão no painel</span>
          <Link href={ROTA_CAPITAIS} prefetch={prefetchDoLink(ROTA_CAPITAIS)} className="edm-toque">
            {TITULO_CAPITAIS}
            <SeloComConta href={ROTA_CAPITAIS} />
          </Link>
        </p>
      )}
      <ComoLer />

      <div className="edm-sub" id="serie">
        <h2>O Ideb ao longo do tempo</h2>
        <p>
          A rede de {m.nome} ao lado da rede pública {DO_ESTADO[uf]} e das redes municipais do Brasil, a cada dois anos desde {anos[0]}. As marcas mostram as metas do primeiro ciclo
          do INEP para a rede municipal, que foram de {arquivo.anos_meta[0]} a {arquivo.anos_meta[arquivo.anos_meta.length - 1]}; {semMeta(anos, arquivo.anos_meta)} não têm meta.
        </p>
        <div className="edm-series">
          {ETAPAS.map((e) => (
            <SerieEtapa key={e} g={g} m={m} uf={uf} etapa={e} anos={anos} anosMeta={arquivo.anos_meta} />
          ))}
        </div>
      </div>

      <Componentes g={g} m={m} anos={anos} />
      <Comparacao g={g} m={m} uf={uf} arquivo={arquivo} porte={porte} />
      <MatriculasEscolas g={g} m={m} uf={uf} />
      <TabelasComponentes g={g} m={m} anos={anos} anosMeta={arquivo.anos_meta} />
    </>
  );
}

export function ExtratoMunicipio({ g, m, uf, arquivo, ficha = false }: { g: GoldEducacao; m: MunicipioGold; uf: string; arquivo: ArquivoUf; ficha?: boolean }) {
  return (
      <article className={`edm-extrato${ficha ? " edm-extrato-entrada" : ""}`} aria-labelledby="extrato-titulo">
        <header>
          <h2 id="extrato-titulo">
            {ficha ? <>{m.nome} <span className="edm-unidade">{arquivo.nome_uf} ({uf})</span></> : "O resultado das duas etapas"}
          </h2>
          <span className="edm-competencia">
            Ideb {g.ideb.ano}
          </span>
        </header>
        <dl>
          {ETAPAS.map((e) => (
            <ExtratoEtapa key={e} g={g} m={m} uf={uf} etapa={e} compacto={ficha} />
          ))}
        </dl>
        {ficha && <Link className="edm-link inline-flex min-h-[44px] items-center" href={hrefFichaMunicipio(m.id)} prefetch={false}>Ficha completa da cidade</Link>}
        <p className="edm-fonte">Fonte: {g.fontes.ideb.orgao}, Índice de Desenvolvimento da Educação Básica (Ideb) {g.fontes.ideb.edicao}. Cada rede tem seu próprio universo.</p>
      </article>
  );
}

function ExtratoEtapa({ g, m, uf, etapa, compacto = false }: { g: GoldEducacao; m: MunicipioGold; uf: string; etapa: Etapa; compacto?: boolean }) {
  const b = m[etapa];
  const v = idebRecente(b.municipal);
  const k = g.ideb.anos.length - 1;
  const pub = idebRecente(b.publica);
  const est = g.ideb.ufs[etapa][uf]?.publica.ideb[k] ?? null;
  const br = g.ideb.brasil[etapa].municipal.ideb[k];
  return (
    <div>
      <dt>
        {NOME_ETAPA[etapa]}, rede municipal
        <small>{SERIES_ETAPA[etapa]}{!compacto && <> · {DESCRICAO_REDE.municipal}</>}</small>
      </dt>
      {v !== null ? (
        <dd className="edm-valor">{ideb(v)}<span className="edm-unidade">de 0 a 10</span></dd>
      ) : (
        <dd className="edm-sem">
          <strong>Sem Ideb {g.ideb.ano}</strong>
          {b.motivo_municipal ? TEXTO_MOTIVO[b.motivo_municipal] : null}
        </dd>
      )}
      <dd className="edm-detalhe">
        {!compacto && <>Rede pública da cidade: {pub !== null ? ideb(pub) : `sem Ideb (${b.motivo_publica ? ROTULO_MOTIVO[b.motivo_publica].toLowerCase() : "sem dado"})`} · </>}Rede pública {DO_ESTADO[uf]}: {ideb(est)} · redes municipais
        do Brasil: {ideb(br)}
      </dd>
    </div>
  );
}

function SerieEtapa({ g, m, uf, etapa, anos, anosMeta }: { g: GoldEducacao; m: MunicipioGold; uf: string; etapa: Etapa; anos: number[]; anosMeta: number[] }) {
  const rede = redeDoMunicipio(m, etapa, anos);
  const s = rede ? m[etapa][rede] : null;
  const est = g.ideb.ufs[etapa][uf]?.publica ?? null;
  const br = g.ideb.brasil[etapa].municipal;
  const pontos = (x: Serie | null) => anos.map((a, i) => ({ x: a, y: x ? x.ideb[i] : null }));
  const series: SerieLinha[] = [
    ...(s ? [{ nome: "municipio", rotulo: "Cidade", classe: "edm-linha" as const, pontos: pontos(s) }] : []),
    { nome: "estado", rotulo: uf, classe: "edm-linha-ref", pontos: pontos(est) },
    { nome: "brasil", rotulo: "Brasil", classe: "edm-linha-br", pontos: pontos(br) },
  ];
  const metas = rede === "municipal" && s ? anosMeta.map((a, i) => ({ x: a, y: s.meta[i], observado: s.ideb[anos.indexOf(a)] ?? null })) : [];
  const comDado = s ? anos.filter((_, i) => s.ideb[i] !== null) : [];
  const faltam = s ? anos.filter((a, i) => s.ideb[i] === null && a >= (comDado[0] ?? anos[0])) : [];
  const descricao = s
    ? `${NOME_ETAPA[etapa]}: Ideb da ${NOME_REDE[rede as Rede].toLowerCase()} de ${m.nome} de ${ideb(s.ideb[anos.indexOf(comDado[0])])} em ${comDado[0]} a ${ideb(idebRecente(s))} em ${anos[anos.length - 1]}; rede pública ${DO_ESTADO[uf]}, ${ideb(est?.ideb[anos.length - 1])}; redes municipais do Brasil, ${ideb(br.ideb[anos.length - 1])}.`
    : `${NOME_ETAPA[etapa]}: ${m.nome} não tem Ideb nesta etapa; o gráfico mostra o estado e o Brasil.`;
  return (
    <figure className="edm-figura">
      <h3>{NOME_ETAPA[etapa]} ({SERIES_ETAPA[etapa]})</h3>
      <GraficoIdeb series={series} anos={anos} metas={metas} anoNota={anoNota(g)} descricao={descricao} />
      <div className="edm-legenda">
        {s && <span><i />{rede === "municipal" ? `Rede municipal de ${m.nome}` : `Rede pública de ${m.nome}`}</span>}
        <span><i className="edm-l-ref" />Rede pública {DO_ESTADO[uf]}</span>
        <span><i className="edm-l-br" />Redes municipais do Brasil</span>
        {metas.some((x) => x.y !== null) && <span><i className="edm-l-meta edm-meta-cheia" />Alcançou a meta projetada pelo INEP · <i className="edm-l-meta" />Não alcançou · Sem marca quando falta Ideb</span>}
      </div>
      <figcaption>
        {!s && `${m.nome} não tem Ideb nesta etapa em nenhuma edição. `}
        {rede === "publica" && `A rede municipal de ${m.nome} não tem Ideb nesta etapa; a linha é a da rede pública da cidade. `}
        {faltam.length > 0 && `Sem Ideb publicado em ${faltam.join(", ")}: a linha se interrompe, sem zero nem estimativa. `}
        Ideb publicado pelo INEP, com uma casa decimal.
      </figcaption>
    </figure>
  );
}

function Componentes({ g, m, anos }: { g: GoldEducacao; m: MunicipioGold; anos: number[] }) {
  const k = anos.length - 1;
  const escolha = (["municipal", "publica"] as Rede[]).flatMap((r) => ETAPAS.map((e) => ({ e, r, s: m[e][r] }))).find((x) => x.s?.ideb[k] != null && x.s.n[k] != null && x.s.p[k] != null);
  return (
    <div className="edm-sub" id="componentes">
      <h2>Do que o Ideb é feito: aprendizagem e aprovação</h2>
      <p>O Ideb multiplica a nota padronizada (N) do Sistema de Avaliação da Educação Básica (Saeb) pelo indicador de rendimento (P), que resume a aprovação.</p>
      {escolha?.s ? (
        <ModeloDidatico id="laboratorio-municipio" titulo="E se a aprendizagem ou a aprovação mudasse?"
          descricao={`${NOME_REDE[escolha.r]} de ${m.nome}, ${NOME_ETAPA[escolha.e].toLowerCase()}, INEP, Ideb ${g.ideb.ano}.`}
          deixaDeFora={["N reúne português e matemática na escala do Saeb", "P é a média harmônica da aprovação de cada ano escolar", "O resultado da rede não descreve cada escola nem demonstra causa"]}>
          <LaboratorioIdeb n={escolha.s.n[k]!} p={escolha.s.p[k]!} ideb={escolha.s.ideb[k]!} rede={`${NOME_REDE[escolha.r].toLowerCase()} de ${m.nome}`} ano={g.ideb.ano} />
        </ModeloDidatico>
      ) : <p className="edm-aviso">{m.nome} não tem componentes completos do Ideb {g.ideb.ano}. As séries preservam as edições anteriores disponíveis.</p>}
      {ETAPAS.map((e) => {
        const rede = redeDoMunicipio(m, e, anos);
        const s = rede ? m[e][rede] : null;
        if (!s || !rede) return null;
        return <section key={e} className="edm-sub" aria-label={`${NOME_ETAPA[e]}, componentes`}>
          <h3>{NOME_ETAPA[e]} · {NOME_REDE[rede]} de {m.nome}</h3>
          <div className="edm-componentes-grade">
            {([
              ["n", "Aprendizagem (N)", "nota padronizada, de 0 a 10", 10],
              ["p", "Fluxo (P)", "indicador de rendimento, de 0 a 1", 1],
              ["mat", "Saeb de matemática", "pontos na escala do Saeb", 500],
              ["port", "Saeb de português", "pontos na escala do Saeb", 500],
            ] as const).map(([campo, titulo, unidade, max]) => <figure key={campo} className="edm-figura">
              <h4>{titulo}</h4>
              <GraficoComponente anos={anos} valores={s[campo]} max={max} unidade={unidade} descricao={`${titulo}, ${NOME_REDE[rede]} de ${m.nome}, ${NOME_ETAPA[e]}, INEP, ${anos[0]} a ${anos.at(-1)}. Lacunas interrompem a linha.`} />
              <figcaption>{unidade} · INEP, Ideb {g.ideb.ano}. Lacunas são ausência de dado; 2021 requer a ressalva da pandemia.</figcaption>
            </figure>)}
          </div>
        </section>;
      })}
    </div>
  );
}

function TabelasComponentes({ g, m, anos, anosMeta }: { g: GoldEducacao; m: MunicipioGold; anos: number[]; anosMeta: number[] }) {
  return (
    <Recolhido id="tabelas-componentes" titulo="Tabelas completas por edição" resumo="Ideb, meta, aprovação, notas de português e matemática, N e P, com as marcas de ausência do INEP." className="mt-12">
      {ETAPAS.map((e) => {
        const rede = redeDoMunicipio(m, e, anos);
        const s = rede ? m[e][rede] : null;
        if (!s || !rede) return null;
        const titulo = `${m.nome}, ${NOME_REDE[rede].toLowerCase()}, ${NOME_ETAPA[e].toLowerCase()}: Ideb e as partes dele a cada edição`;
        return (
          <div key={e}>
            <p className="edm-legenda-tabela" aria-hidden="true">{titulo}.</p>
            <div className="edm-tabela-rolagem" tabIndex={0} role="region" aria-label={`${titulo}; no celular, deslize para o lado`}>
              <table className="edm-tabela edm-tabela-larga">
                <caption className="sr-only">{titulo}</caption>
                <thead>
                  <tr>
                    <th scope="col">Ano</th>
                    <th scope="col">Ideb</th>
                    <th scope="col">Meta</th>
                    <th scope="col">Situação da meta</th>
                    <th scope="col">Aprovação</th>
                    <th scope="col">Saeb matemática</th>
                    <th scope="col">Saeb português</th>
                    <th scope="col">N (0 a 10)</th>
                    <th scope="col">P (0 a 1)</th>
                  </tr>
                </thead>
                <tbody>
                  {anos.map((a, i) => {
                    const km = anosMeta.indexOf(a);
                    const marca = s.marca[i];
                    if (s.ideb[i] === null && s.aprov[i] === null && s.n[i] === null && !marca) return null;
                    return (
                      <tr key={a} className={i === anos.length - 1 ? "edm-forte" : ""}>
                        <th scope="row">{a}</th>
                        <td>{s.ideb[i] === null ? <span className="edm-vazio">Sem Ideb</span> : ideb(s.ideb[i])}</td>
                        <td>{km >= 0 && rede === "municipal" ? (s.meta[km] === null ? <span className="edm-vazio">Sem meta</span> : ideb(s.meta[km])) : <span className="edm-vazio">Sem meta</span>}</td>
                        <td>{km < 0 || rede !== "municipal" || s.meta[km] == null ? "Sem meta" : s.ideb[i] == null ? "Sem Ideb" : s.ideb[i]! >= s.meta[km]! ? "Alcançou a meta projetada pelo INEP" : "Não alcançou a meta projetada pelo INEP"}</td>
                        <td>{s.aprov[i] === null ? <span className="edm-vazio">Sem dado</span> : pct(s.aprov[i])}</td>
                        <td>{s.mat[i] === null ? <span className="edm-vazio">{marca && TEXTO_MARCA[marca] ? marca : "Sem dado"}</span> : num(s.mat[i], 1)}{s.mat[i] !== null && marca ? ` ${marca}` : ""}</td>
                        <td>{s.port[i] === null ? <span className="edm-vazio">{marca && TEXTO_MARCA[marca] ? marca : "Sem dado"}</span> : num(s.port[i], 1)}{s.port[i] !== null && marca ? ` ${marca}` : ""}</td>
                        <td>{s.n[i] === null ? <span className="edm-vazio">Sem dado</span> : num(s.n[i], 2)}</td>
                        <td>{s.p[i] === null ? <span className="edm-vazio">Sem dado</span> : num(s.p[i], 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="edm-fonte">
        Fonte: {g.fontes.ideb.orgao}, Ideb {g.fontes.ideb.edicao}, planilhas por município. Marcas do INEP na nota do Saeb: ND, participação insuficiente para divulgar; ND*, não
        divulgado a pedido; *, média calculada com as avaliações estaduais por extravio de provas; **, participação abaixo de 50%. A meta é da rede municipal; a planilha não traz meta
        da rede pública por município.
      </p>
    </Recolhido>
  );
}

function Comparacao({ g, m, uf, arquivo, porte }: { g: GoldEducacao; m: MunicipioGold; uf: string; arquivo: ArquivoUf; porte: string | null }) {
  const k = g.ideb.anos.length - 1;
  return (
    <div className="edm-sub" id="comparacao">
      <h2>Comparado ao estado, ao Brasil e a cidades do mesmo porte</h2>
      <p>
        Onde a rede municipal de {m.nome} fica entre as redes municipais com Ideb {g.ideb.ano}: no estado e entre as cidades do mesmo porte{porte ? ` (${porte.toLowerCase()})` : ""},
        pela população estimada pelo IBGE para {g.fontes.populacao.ano}. A posição não diz por que a rede está ali.
      </p>
      <div className="edm-graficos-dois">
        {ETAPAS.map((e) => {
          const v = idebRecente(m[e].municipal);
          const pos = posicaoNaUf(arquivo, e, m.id);
          const dUf = g.distribuicao[e].ufs[uf];
          const dPorte = m.porte ? g.distribuicao[e].portes[m.porte] : null;
          const est = g.ideb.ufs[e][uf]?.publica.ideb[k] ?? null;
          return (
            <figure key={e} className="edm-figura">
              <h3>{NOME_ETAPA[e]} ({SERIES_ETAPA[e]})</h3>
              {v === null ? (
                <p className="edm-aviso">A rede municipal de {m.nome} não tem Ideb {g.ideb.ano} nesta etapa. {m[e].motivo_municipal ? TEXTO_MOTIVO[m[e].motivo_municipal!] : ""}</p>
              ) : (
                <ul className="edm-pontos">
                  {pos && <li><strong>{num(pos.posicao)}º</strong> entre as {num(pos.total)} redes municipais {DO_ESTADO[uf]} com Ideb {g.ideb.ano} (1º é o maior Ideb; redes empatadas ficam com a mesma posição)</li>}
                  <li>Mediana das redes municipais {DO_ESTADO[uf]}: {ideb(dUf?.mediana ?? null)}; rede pública do estado (INEP): {ideb(est)}</li>
                  {dPorte && <li>Mediana das {num(dPorte.n)} redes municipais do mesmo porte no Brasil: {ideb(dPorte.mediana)}</li>}
                </ul>
              )}
              {dPorte && (
                <>
                  <GraficoDistribuicao
                    faixas={dPorte.faixas}
                    destaque={v}
                    mediana={dPorte.mediana}
                    unidade="redes municipais"
                    descricao={`${NOME_ETAPA[e]}: distribuição do Ideb ${g.ideb.ano} das ${num(dPorte.n)} redes municipais de cidades do mesmo porte (${(porte ?? "").toLowerCase()}), de ${ideb(dPorte.min)} a ${ideb(dPorte.max)}, mediana ${ideb(dPorte.mediana)}${v !== null ? `; ${m.nome} tem ${ideb(v)}` : ""}.`}
                  />
                  <figcaption>
                    Quantas redes municipais de cidades do mesmo porte{porte ? ` (${porte.toLowerCase()})` : ""} tiveram cada Ideb em {g.ideb.ano}, em faixas de meio ponto.
                    {v !== null ? ` Em destaque, a faixa de ${m.nome}.` : ""} A linha tracejada é a mediana.
                  </figcaption>
                </>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function MatriculasEscolas({ g, m, uf }: { g: GoldEducacao; m: MunicipioGold; uf: string }) {
  const c = m.censo;
  const e = g.censo.ufs[uf];
  if (!c) return <p className="edm-aviso">O Censo Escolar {g.censo.ano} não traz {m.nome}. Ausência de dado, não zero.</p>;
  const linhas: { rotulo: string; mun: number; total: number; munUf: number; totalUf: number; base: string }[] = [
    { rotulo: "Creche", mun: c.creche_mun, total: c.creche_total, munUf: e.creche_mun, totalUf: e.creche_total, base: "todas as redes" },
    { rotulo: "Pré escola", mun: c.pre_mun, total: c.pre_total, munUf: e.pre_mun, totalUf: e.pre_total, base: "todas as redes" },
    { rotulo: "Anos iniciais (1º ao 5º ano)", mun: c.ai_mun, total: c.ai_publica, munUf: e.ai_mun, totalUf: e.ai_publica, base: "rede pública" },
    { rotulo: "Anos finais (6º ao 9º ano)", mun: c.af_mun, total: c.af_publica, munUf: e.af_mun, totalUf: e.af_publica, base: "rede pública" },
    { rotulo: "Educação básica, todas as etapas", mun: c.mat_municipal, total: c.mat_publica, munUf: e.mat_municipal, totalUf: e.mat_publica, base: "rede pública" },
  ];
  const titulo = `${m.nome}: matrículas da rede municipal por etapa, Censo Escolar ${g.censo.ano}, e a parte que ela atende`;
  return (
    <div className="edm-sub" id="matriculas">
      <h2>Quantos alunos e escolas a rede municipal tem</h2>
      <p>
        {c.mat_municipal > 0
          ? `A rede municipal de ${m.nome} tem ${num(c.mat_municipal)} matrículas e ${num(c.esc_municipal)} escolas, ${num(c.esc_mun_rural)} delas na zona rural, no Censo Escolar ${g.censo.ano}.`
          : `${m.nome} não tem rede municipal com alunos no Censo Escolar ${g.censo.ano}: as ${num(c.mat_publica)} matrículas públicas são de outras redes.`}{" "}
        No município, há {num(c.esc_publica)} escolas públicas e {num(c.esc_privada)} privadas.
      </p>
      <p className="edm-legenda-tabela" aria-hidden="true">{titulo}.</p>
      <div className="edm-tabela-rolagem" tabIndex={0} role="region" aria-label={`${titulo}; no celular, deslize para o lado`}>
        <table className="edm-tabela edm-tabela-larga">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col">Matrículas na rede municipal</th>
              <th scope="col">Matrículas na base de comparação</th>
              <th scope="col">Parte da rede municipal</th>
              <th scope="col">No estado, parte da rede municipal</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.rotulo} className={i === linhas.length - 1 ? "edm-forte" : ""}>
                <th scope="row">{l.rotulo}</th>
                <td>{num(l.mun)}</td>
                <td>{num(l.total)}<small>{l.base}</small></td>
                <td>{l.total ? pct(parte(l.mun, l.total), 0) : <span className="edm-vazio">Sem matrícula</span>}</td>
                <td>{pct(parte(l.munUf, l.totalUf), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="edm-fonte">
        Fonte: {g.fontes.censo.orgao}, {g.fontes.censo.nome} {g.fontes.censo.edicao}, tabelas de matrículas por etapa e dependência administrativa e de estabelecimentos. Creche e pré
        escola comparam com todas as redes, inclusive a privada, porque a Sinopse não separa a rede pública por etapa nelas; creches conveniadas com a prefeitura contam como rede privada.
        Parte calculada pela Scrutiniums.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- estados */

function SecaoEstados({ g, uf }: { g: GoldEducacao; uf: string | null }) {
  const k = g.ideb.anos.length - 1;
  const siglas = Object.keys(g.ideb.ufs.ai).sort((a, b) => nomeUf(a).localeCompare(nomeUf(b), "pt-BR"));
  const titulo = `Os 27 estados: Ideb ${g.ideb.ano} da rede pública (INEP) e mediana das redes municipais (Scrutiniums), por etapa`;
  return (
    <section className="edm-secao" id="estados" aria-labelledby="estados-titulo">
      <h2 id="estados-titulo">Como cada estado se compara?</h2>
      <p className="edm-intro">
        O INEP publica o Ideb do estado para a rede pública, que junta escolas estaduais e municipais; não publica o da rede municipal por estado. Ao lado, a mediana das redes
        municipais do estado com Ideb {g.ideb.ano}: metade delas fica acima, metade abaixo.
      </p>
      <p className="edm-legenda-tabela" aria-hidden="true">{titulo}.</p>
      <div className="edm-tabela-rolagem" tabIndex={0} role="region" aria-label={`${titulo}; no celular, deslize para o lado`}>
        <table className="edm-tabela edm-tabela-larga">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Anos iniciais, rede pública</th>
              <th scope="col">Anos iniciais, mediana das redes municipais</th>
              <th scope="col">Anos finais, rede pública</th>
              <th scope="col">Anos finais, mediana das redes municipais</th>
              <th scope="col">Matrículas nas redes municipais</th>
            </tr>
          </thead>
          <tbody>
            {siglas.map((s) => {
              const ai = g.distribuicao.ai.ufs[s];
              const af = g.distribuicao.af.ufs[s];
              return (
                <tr key={s} className={s === uf ? "edm-escolhido" : ""}>
                  <th scope="row">{nomeUf(s)}</th>
                  <td>{ideb(g.ideb.ufs.ai[s].publica.ideb[k])}</td>
                  <td>{ai ? <>{ideb(ai.mediana)}<small>{num(ai.n)} redes</small></> : <span className="edm-vazio">Sem rede municipal com Ideb</span>}</td>
                  <td>{ideb(g.ideb.ufs.af[s].publica.ideb[k])}</td>
                  <td>{af ? <>{ideb(af.mediana)}<small>{num(af.n)} redes</small></> : <span className="edm-vazio">Sem rede municipal com Ideb</span>}</td>
                  <td>{num(g.censo.ufs[s].mat_municipal)}</td>
                </tr>
              );
            })}
            <tr className="edm-forte">
              <th scope="row">Brasil</th>
              <td>{ideb(g.ideb.brasil.ai.publica.ideb[k])}</td>
              <td>{ideb(g.distribuicao.ai.brasil.mediana)}<small>rede municipal (INEP): {ideb(g.ideb.brasil.ai.municipal.ideb[k])}</small></td>
              <td>{ideb(g.ideb.brasil.af.publica.ideb[k])}</td>
              <td>{ideb(g.distribuicao.af.brasil.mediana)}<small>rede municipal (INEP): {ideb(g.ideb.brasil.af.municipal.ideb[k])}</small></td>
              <td>{num(g.censo.brasil.mat_municipal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="edm-fonte">
        Fontes: {g.fontes.ideb.orgao}, Ideb {g.ideb.ano} por UF e Brasil e por município (as medianas são calculadas pela Scrutiniums com as redes municipais que têm Ideb); Censo
        Escolar {g.censo.ano}. O Distrito Federal não tem rede municipal: a rede pública de Brasília é distrital, registrada como estadual. Matrículas de {g.censo.ano}.
      </p>
    </section>
  );
}

const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
const nomeUf = (s: string) => NOMES_UF[s] ?? s;

/* ----------------------------------------------------------------------------------------------- porte */

function SecaoPorte({ g, m }: { g: GoldEducacao; m: MunicipioGold | null }) {
  return (
    <section className="edm-secao" id="porte" aria-labelledby="porte-titulo">
      <h2 id="porte-titulo">O tamanho da cidade faz diferença no Ideb?</h2>
      <p className="edm-intro">
        As redes municipais com Ideb {g.ideb.ano} agrupadas pela população da cidade, nas sete faixas do IBGE. A barra vai do primeiro ao terceiro quartil: metade das redes da
        faixa está dentro dela. O traço é a mediana.{m ? ` O ponto é ${m.nome}.` : ""} Diferença entre faixas não prova que o tamanho cause o resultado.
      </p>
      {ETAPAS.map((e) => {
        const v = m ? idebRecente(m[e].municipal) : null;
        const dist = g.portes.map((p) => g.distribuicao[e].portes[p.id]).filter((d): d is NonNullable<typeof d> => !!d);
        // a escala vai do inteiro abaixo do menor primeiro quartil ao inteiro acima do maior terceiro quartil (e do município)
        const lo = Math.floor(Math.min(...dist.map((d) => d.p25), ...(v !== null ? [v] : [])));
        const hi = Math.max(lo + 2, Math.ceil(Math.max(...dist.map((d) => d.p75), ...(v !== null ? [v] : []))));
        const x = (val: number) => `${((Math.min(hi, Math.max(lo, val)) - lo) / (hi - lo)) * 100}%`;
        const marcas = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
        return (
          <figure key={e} className="edm-figura edm-sub">
            <h4>{NOME_ETAPA[e]} ({SERIES_ETAPA[e]})</h4>
            <div className="edm-faixas" role="list" aria-label={`${NOME_ETAPA[e]}: Ideb ${g.ideb.ano} das redes municipais por porte da cidade`}>
              <div className="edm-escala" aria-hidden="true">
                <span />
                <span className="edm-escala-marcas">{marcas.map((t) => <span key={t} style={{ left: x(t) }}>{num(t)}</span>)}</span>
                <span />
              </div>
              {g.portes.map((p) => {
                const d = g.distribuicao[e].portes[p.id];
                const meu = m?.porte === p.id;
                return (
                  <div key={p.id} role="listitem" className={`edm-faixa ${meu ? "edm-escolhido" : ""}`}>
                    <span>{p.rotulo}</span>
                    {d ? (
                      <span className="edm-faixa-trilho" aria-hidden="true">
                        {marcas.map((t) => <u key={t} style={{ left: x(t) }} />)}
                        <i style={{ left: x(d.p25), width: `calc(${x(d.p75)} - ${x(d.p25)})` }} />
                        <b style={{ left: x(d.mediana) }} />
                        {meu && v !== null && <em style={{ left: x(v) }} />}
                      </span>
                    ) : (
                      <span className="edm-faixa-trilho" aria-hidden="true" />
                    )}
                    <span>{d ? <>mediana {ideb(d.mediana)} · {ideb(d.p25)} a {ideb(d.p75)}<small>{num(d.n)} redes</small></> : "sem rede com Ideb"}</span>
                  </div>
                );
              })}
            </div>
            <div className="edm-chave" aria-hidden="true">
              <span><i className="edm-chave-faixa" />Metade das redes da faixa</span>
              <span><i className="edm-chave-mediana" />Mediana</span>
              {m && v !== null && <span><i className="edm-chave-ponto" />{m.nome}, {ideb(v)}</span>}
            </div>
            <figcaption>
              Escala do Ideb de {num(lo)} a {num(hi)}, recortada para mostrar as diferenças; o índice vai de 0 a 10. Quartis pelo método inclusivo, calculados pela Scrutiniums com o
              Ideb publicado pelo INEP.
            </figcaption>
          </figure>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------- cobertura */

function SecaoCobertura({ g }: { g: GoldEducacao }) {
  const titulo = `Municípios com e sem Ideb ${g.ideb.ano}, por etapa e rede, e o motivo de não haver resultado`;
  const col = [
    { e: "ai" as Etapa, r: "municipal" as Rede },
    { e: "af" as Etapa, r: "municipal" as Rede },
    { e: "ai" as Etapa, r: "publica" as Rede },
    { e: "af" as Etapa, r: "publica" as Rede },
  ];
  return (
    <section className="edm-secao" id="cobertura" aria-labelledby="cobertura-titulo">
      <h2 id="cobertura-titulo">Onde não há Ideb, e por quê?</h2>
      <p className="edm-intro">
        Ausência de Ideb não é nota zero. Em cada município sem resultado, o painel diz o motivo, pelas notas do próprio INEP e pelo Censo Escolar. Nos anos finais, muitas
        prefeituras simplesmente não têm alunos: a etapa fica com a rede estadual.
      </p>
      <p className="edm-legenda-tabela" aria-hidden="true">{titulo}.</p>
      <div className="edm-tabela-rolagem" tabIndex={0} role="region" aria-label={`${titulo}; no celular, deslize para o lado`}>
        <table className="edm-tabela edm-tabela-larga">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Situação em {g.ideb.ano}</th>
              {col.map((c) => <th key={`${c.e}-${c.r}`} scope="col">{NOME_ETAPA[c.e]}, {NOME_REDE[c.r].toLowerCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="edm-forte">
              <th scope="row">Com Ideb</th>
              {col.map((c) => <td key={`${c.e}-${c.r}`}>{num(g.cobertura[c.e][c.r].com_ideb)}</td>)}
            </tr>
            {MOTIVOS.filter((mo) => col.some((c) => g.cobertura[c.e][c.r].motivos[mo] > 0)).map((mo) => (
              <tr key={mo}>
                <th scope="row">{ROTULO_MOTIVO[mo]}<small>{TEXTO_MOTIVO[mo]}</small></th>
                {col.map((c) => <td key={`${c.e}-${c.r}`}>{num(g.cobertura[c.e][c.r].motivos[mo])}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row">Total de municípios</th>
              {col.map((c) => <td key={`${c.e}-${c.r}`}>{num(g.municipios.total)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="edm-fonte">
        Contagens da Scrutiniums. A contagem com Ideb confere com o Quadro 1 da <a href={g.fontes.ideb.nota_informativa ?? g.fontes.ideb.pagina}>nota informativa do Ideb {g.ideb.ano}</a>. O
        INEP não divulga o Ideb de rede com participação no Saeb abaixo de 50% ou, quando há uma só escola avaliada, abaixo de 80%; escolas com menos de 10 alunos na série avaliada
        não fazem a prova.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------------------------------------- capitais */

function SecaoCapitais() {
  return (
    <section className="edm-secao" id="capitais" aria-labelledby="capitais-titulo">
      <h2 id="capitais-titulo">As capitais em profundidade</h2>
      <p className="edm-intro">
        Para as 26 capitais, o painel {TITULO_CAPITAIS}, da Eficiência Estatal, junta ao Ideb e ao Saeb o gasto da prefeitura com educação, por habitante e por matrícula, os alunos
        por turma e a comparação entre as capitais. O Ideb das capitais é o mesmo nos dois painéis: as duas publicações leem as mesmas planilhas do INEP.
      </p>
      <p className="edm-capital">
        <Link href={ROTA_CAPITAIS} prefetch={prefetchDoLink(ROTA_CAPITAIS)} className="edm-toque">
          Abrir {TITULO_CAPITAIS}
          <SeloComConta href={ROTA_CAPITAIS} />
        </Link>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ método */

export function Metodo({ g, semDownloads = false }: { g: GoldEducacao; semDownloads?: boolean }) {
  const f = g.fontes;
  const div = Object.entries(f.ideb.codigos_divergentes).flatMap(([arquivo, l]) => l.map((d) => ({ arquivo, ...d })));
  return (
    <div className="edm-metodo-corpo" id="metodo">
        <div>
          <h3>O que cada número mede</h3>
          <ul>
            <li><strong>Ideb</strong>: N × P, publicado pelo INEP com uma casa decimal, de 0 a 10, a cada dois anos, para os anos iniciais (1º ao 5º ano) e finais (6º ao 9º ano) do ensino fundamental.</li>
            <li><strong>N</strong>: média das notas de matemática e língua portuguesa no Saeb, padronizadas de 0 a 10 pelos limites fixos da escala do Saeb. O Saeb é aplicado no 5º e no 9º ano.</li>
            <li><strong>P</strong>: indicador de rendimento, o inverso da média dos inversos das taxas de aprovação de cada ano escolar (média harmônica), do Censo Escolar. A taxa de aprovação da etapa vai à parte, em %.</li>
            <li><strong>Rede municipal</strong>: escolas da prefeitura. <strong>Rede pública</strong>: municipais, estaduais e federais do município. O desempenho do município considera as escolas urbanas, como nas edições anteriores do Saeb (nota informativa).</li>
            <li>
              <strong>Meta</strong>: metas do primeiro ciclo do Ideb, de {g.ideb.anos_meta[0]} a {g.ideb.anos_meta[g.ideb.anos_meta.length - 1]}, por rede municipal. O INEP não fixou metas para{" "}
              {semMeta(g.ideb.anos, g.ideb.anos_meta)}
              {f.ideb.ultima_formula_original === g.ideb.ano ? ` e informa, na nota informativa, que o Ideb ${g.ideb.ano} é a última divulgação com a fórmula original` : ""}.
            </li>
            <li><strong>Porte</strong>: faixa de população do IBGE, pela estimativa de {f.populacao.ano}. <strong>Mediana e quartis</strong> (método inclusivo): calculados pela Scrutiniums com as redes que têm Ideb.</li>
            <li><strong>Matrículas e escolas</strong>: Sinopse Estatística do Censo Escolar, por dependência administrativa. Creches conveniadas contam como rede privada.</li>
          </ul>
        </div>
        <div>
          <h3>Fontes</h3>
          <ul>
            <li>
              {f.ideb.orgao}, <a href={f.ideb.pagina}>Ideb {f.ideb.edicao}, resultados</a>: planilhas por município (<a href={f.ideb.arquivos.ai.url ?? f.ideb.pagina}>anos iniciais</a>,{" "}
              <a href={f.ideb.arquivos.af.url ?? f.ideb.pagina}>anos finais</a>), por <a href={f.ideb.arquivos.ufs.url ?? f.ideb.pagina}>UF</a> e do <a href={f.ideb.arquivos.brasil.url ?? f.ideb.pagina}>Brasil</a>,
              publicadas em {dataBr(f.ideb.publicado_em)}, e a <a href={f.ideb.nota_informativa ?? f.ideb.pagina}>nota informativa</a>. Bienal. Capturado em {dataBr(f.ideb.capturado_em)}; cada planilha conferida com o
              MD5 publicado pelo INEP.
            </li>
            <li>
              {f.censo.orgao}, <a href={f.censo.pagina}>{f.censo.nome} {f.censo.edicao}</a> (<a href={f.censo.url ?? f.censo.pagina}>pacote</a>), publicada em {dataBr(f.censo.publicado_em)}. Anual. Capturado em{" "}
              {dataBr(f.censo.capturado_em)}.
            </li>
            <li>
              {f.populacao.orgao}, <a href={f.populacao.pagina}>{f.populacao.nome}</a>, {f.populacao.ano}. Capturado em {dataBr(f.populacao.capturado_em)}.
            </li>
          </ul>
        </div>
        <div>
          <h3>Conferências que seguram a publicação</h3>
          <p>
            A coleta roda todo mês e só publica dado novo. Nada é publicado se uma planilha não conferir com o MD5 do INEP, se algum Ideb diferir de N × P, se a contagem de municípios com
            Ideb divergir da nota informativa, se faltar UF, se os municípios do Censo não somarem o estado e o Brasil, se as redes não fecharem com o total, se a população não somar a do
            Brasil, se uma rede com Ideb não tiver matrícula no Censo da mesma edição ou se um Ideb já publicado mudar ou sumir. O Ideb das 26 capitais é conferido contra o do painel{" "}
            {TITULO_CAPITAIS}. Ausência fica como ausência, com o motivo: nunca vira zero nem estimativa.
          </p>
          {div.length > 0 && (
            <p>
              As planilhas de {f.ideb.edicao} trazem {div.length === 1 ? "um código de coluna trocado" : `${div.length} códigos de coluna trocados`} ({div.map((d) => `${d.esperado} rotulado como ${d.codigo_na_fonte ?? "vazio"}`).join("; ")}). O painel lê
              cada coluna pelo rótulo por extenso, e a conta N × P confirma a leitura.
            </p>
          )}
        </div>
        {!semDownloads && <DownloadsEducacao />}
    </div>
  );
}

export function DownloadsEducacao() {
  return (
        <div>
          <h3>Arquivos para baixar</h3>
          <div className="edm-arquivos">
            {DOWNLOADS.map((d) => (
              <a key={d.arquivo} href={`${ROTA_EDUCACAO}/${d.arquivo}`} download className="edm-toque edm-link">
                {d.rotulo} (CSV)
              </a>
            ))}
          </div>
          <p className="edm-fonte">CSV com ponto e vírgula, codificação UTF-8, ponto decimal. Ausência fica vazia, nunca zero, com o motivo em coluna própria. Cada linha traz a fonte e a edição.</p>
        </div>
  );
}
