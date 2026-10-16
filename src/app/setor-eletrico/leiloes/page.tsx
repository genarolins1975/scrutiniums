import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Histograma } from "@/components/energia/Histograma";
import { LeiloesDispersao } from "@/components/energia/LeiloesDispersao";
import { LabLeilao, LinhaDosProdutos, type ProdutoNaBase } from "@/components/energia/LeiloesLabs";
import { LeiloesAlternar, LeiloesMapaUf, LeiloesPrecoAno } from "@/components/energia/LeiloesOpcoes";
import { BarrasSituacao, DiagramaAcr, FrasesCitaveis, GruposControle, LeiloesIndisponivel, ListaRegras } from "@/components/energia/LeiloesPagina";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COR_CATEGORIA_LEILAO,
  COR_SITUACAO,
  COR_TIPO_LEILAO,
  CURTO_CATEGORIA,
  CURTO_SITUACAO,
  FONTE_LEILOES,
  ORDEM_CATEGORIAS,
  ORDEM_SITUACOES,
  PAGINAS_LEILOES,
  ROTA_LEILOES,
  ROTA_LEILOES_TRANSMISSAO,
  categoriasComPreco,
  frasesCitaveis,
  linhasEnergiaPorAno,
  linhasEntregaPorAno,
  mwmed,
  nomeLeilao,
  numeroAneel,
  participacao,
  rsMwh,
} from "@/lib/energia/leiloes";
import { lerManifestoLogos } from "@/lib/energia/logos-servidor";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { IdEntrada, LeiloesGold } from "@/lib/energia/tipos-leiloes";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Leilões do ACR: o que o mercado regulado comprou, a que preço e de quem",
  description:
    "Os leilões de geração do Ambiente de Contratação Regulada desde 2005, com dados da ANEEL: energia contratada por ano, fonte e tipo de leilão, preço médio em reais da época e corrigido pelo IPCA, deságio, onde estão as usinas, vencedoras e grupos que as controlam no cadastro mais recente, e o que já está em operação. Com laboratório do leilão e números para citar.",
  alternates: { canonical: ROTA_LEILOES },
};

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

const COLUNAS_LEILOES: ColunaTabela[] = [
  { id: "data", rotulo: "Data", tipo: "data" },
  { id: "nome", rotulo: "Leilão", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "empreendimentos", rotulo: "Empreendimentos", tipo: "numero", casas: 0 },
  { id: "energia_mwmed", rotulo: "Energia", tipo: "numero", unidade: "MWmédio", casas: 1 },
  { id: "mw", rotulo: "Potência das usinas", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "preco_medio", rotulo: "Preço médio da época", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "preco_medio_real", rotulo: "Preço médio corrigido pelo IPCA", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "teto_medio", rotulo: "Teto médio", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "desagio_agregado_pct", rotulo: "Deságio agregado", tipo: "percentual", casas: 2 },
  { id: "operacao_pct", rotulo: "Energia de usinas em operação no SIGA", tipo: "percentual", casas: 1 },
  { id: "leilao", rotulo: "Número ANEEL (nº/ano)", tipo: "texto", nivel: "auditar" },
];

export default function LeiloesAcrPage() {
  const g = lerGold<LeiloesGold>("leiloes.json");
  if (!integra(g)) return <LeiloesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const ref = g.referencias;
  const ev = g.evidencias;
  const t = g.totais;
  const ipca = mesAno(ref.ipca_ate);
  const periodo = `${mesAno(ref.primeiro_leilao.slice(0, 7))} a ${mesAno(ref.ultimo_leilao.slice(0, 7))}`;
  const siga = dataBR(ref.siga);
  const logos = lerManifestoLogos();
  const nomeCat = Object.fromEntries(g.categorias.map((c) => [c.id, c.rotulo]));
  const u = g.ultimo_leilao;
  const op = participacao(g, "operacao");
  const frases = frasesCitaveis(g);

  // séries de energia (fonte e tipo)
  const seriesCat = ORDEM_CATEGORIAS.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA_LEILAO[k] }));
  const seriesTipo = g.cobertura.tipos_presentes.map((x) => ({ id: x.id, rotulo: x.id === "Estruturante" ? "Estruturante" : x.id, cor: COR_TIPO_LEILAO[x.id] ?? "var(--serie-referencia)" }));
  const semLeilao = g.cobertura.anos_sem_leilao_na_base;

  // produtos A-x e demais tipos
  const produtos: ProdutoNaBase[] = g.tipos.map((tp) => {
    const ls = g.leiloes.filter((l) => l.tipo === tp.id);
    const ex = ls.at(-1);
    const ent = g.entrega.entrada_vs_ano_a[tp.id];
    return {
      id: tp.id,
      rotulo: tp.rotulo,
      antecedencia: tp.antecedencia,
      leiloes: ls.length,
      energiaMwmed: ls.reduce((s, l) => s + l.energia_mwmed, 0),
      exemplo: ex ? { nome: nomeLeilao(ex), data: dataBR(ex.data), ano: Number(ex.ano) } : null,
      entrada: ent ? (Object.fromEntries(Object.entries(ent).map(([k, v]) => [k, v.energia_mwmed])) as Record<IdEntrada, number>) : null,
    };
  });

  // preço por fonte e ano
  const comPreco = categoriasComPreco(g);
  const pontosPreco = g.preco_ano_categoria.map((x) => ({
    ano: x.ano, categoria: x.categoria, preco: x.preco_medio, precoReal: x.preco_medio_real, teto: x.teto_medio, energia: x.energia_mwmed, leiloes: x.leiloes,
  }));

  // deságio: histograma por empreendimento
  const hist = montaHistograma(g.desagio.valores, { largura: 5 });

  // UF
  const ufs = g.por_uf.map((x) => ({
    uf: x.uf,
    energia: x.energia_mwmed,
    empreendimentos: x.empreendimentos,
    preco: x.preco_medio,
    fontes: Object.entries(x.por_categoria)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([k, v]) => `${CURTO_CATEGORIA[k as keyof typeof CURTO_CATEGORIA]} ${num(v, 1)}`)
      .join("; "),
  }));

  // entrega
  const seriesSit = ORDEM_SITUACOES.map((k) => ({ id: k, rotulo: CURTO_SITUACAO[k], cor: COR_SITUACAO[k] }));
  const entregaCat = g.entrega.por_categoria.map((x) => {
    const valores = Object.fromEntries(ORDEM_SITUACOES.map((k) => [k, x.situacao[k].energia_mwmed])) as Record<string, number>;
    return { id: x.id, rotulo: nomeCat[x.id], valores, total: Object.values(valores).reduce((s, v) => s + v, 0) };
  });

  const linhasLeiloes = g.leiloes.map((l) => ({
    leilao: numeroAneel(l.leilao),
    data: l.data,
    nome: nomeLeilao(l),
    tipo: l.tipo,
    empreendimentos: l.empreendimentos,
    energia_mwmed: l.energia_mwmed,
    mw: l.mw,
    preco_medio: l.preco_medio,
    preco_medio_real: l.preco_medio_real,
    teto_medio: l.teto_medio,
    desagio_agregado_pct: l.desagio_agregado_pct,
    operacao_pct: l.energia_mwmed ? (100 * l.situacao_mwmed.operacao) / l.energia_mwmed : null,
  }));

  const oQueMudou = (
    <>
      O leilão mais recente da base é o {nomeLeilao(u)}, de {dataBR(u.data)}: {mwmed(u.energia_mwmed)} a {rsMwh(u.preco_medio)} em média,
      deságio agregado de {pct(u.desagio_agregado_pct, 2)}. O arquivo da ANEEL foi gerado em {dataBR(ref.arquivo_gerado_em)}.
    </>
  );
  const comoInterpretar = (
    <>
      Energia em MWmédio é a energia média vendida no ano e soma entre leilões; MW é potência e não soma entre leilões quando a mesma usina
      vende mais de uma vez. Preço é a média ponderada pela energia; o preço corrigido usa o IPCA do mês do leilão até {ipca}. Termelétricas
      por disponibilidade são contratadas pelo Índice de Custo Benefício (ICB), que não é o custo da energia que elas acabam gerando.
    </>
  );
  const naoConcluir = (
    <>
      Que uma fonte é mais barata para o consumidor só pelo preço do leilão: contratos têm prazos, riscos e formas de pagamento diferentes. Que
      deságio alto indica muita concorrência: o arquivo não traz o número de proponentes, e o teto muda a cada edital. Que usina fora de operação
      descumpriu o contrato: prazos alterados por ato, rescisões e substituições não estão nos arquivos. Que o grupo que controla a usina no cadastro mais recente venceu o leilão. Que
      não houve leilão nos anos ou tipos ausentes da base.
    </>
  );
  const complementares: ProvenienciaComplementar[] = [
    { rotulo: "Preço corrigido pelo IPCA", p: g.proveniencia.preco_real },
    { rotulo: "Situação atual das usinas (SIGA e atos)", p: g.proveniencia.situacao },
    { rotulo: "Grupo que controla a usina no cadastro mais recente", p: g.proveniencia.controle },
  ];

  return (
    <>
      <CabecalhoEnergia atual="leiloes" />
      <MarcaVisita secao="energia:leiloes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <NavegacaoLocal rotulo="Páginas de leilões" itens={PAGINAS_LEILOES.map((p) => ({ ...p }))} atual="acr" />
        <CabecalhoModulo
          siglas={["ACR", "ACL", "MME", "EPE", "ANEEL", "CCEE", "ONS", "CCEAR", "CER", "LEN", "LER", "LFA", "ICB", "IPCA", "SIGA", "CEG", "PLD", "TE", "MWmed"]}
          rotulo="Preços e mercado · Leilões"
          titulo="O que o mercado regulado comprou em leilão, a que preço e de quem"
          lead={
            <>
              As distribuidoras compram a energia dos consumidores cativos em leilões, no{" "}
              <Termo slug="acr">Ambiente de Contratação Regulada (ACR)</Termo>. Esta página reúne os leilões de geração publicados pela ANEEL desde 2005:
              quanto se contratou, a que preço, onde, de quem e o que já está operando.
            </>
          }
          recorte={`${periodo} · ${num(g.cobertura.leiloes, 0)} leilões · ${num(t.empreendimentos, 0)} empreendimentos · MWmédio, MW e R$/MWh`}
          fonte={`${FONTE_LEILOES}; IBGE, IPCA; ANEEL, SIGA`}
          limite="A base aberta não traz leilões de energia existente, de ajuste, de reserva de capacidade e de sistemas isolados; situação da usina não é cumprimento do contrato."
          referencia={
            <>
              {FONTE_LEILOES}, arquivo gerado em {dataBR(ref.arquivo_gerado_em)} e capturado em {carimbo(ref.capturado_em)}; IPCA do IBGE (tabela 1737)
              até {ipca}; SIGA de {siga} e atos de outorga até {dataBR(ref.atos)}, como publicados pelo módulo Expansão; proprietários e cadeia de
              controle como publicados pelo módulo Empresas. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Leilões de geração do ACR na base da ANEEL" nota={`Período: ${periodo}. Situação das usinas no SIGA de ${siga}.`}>
              <Numero variante="faixa" rotulo="Energia contratada" natureza="CALCULADO" evidencia={ev.energia_total} valor={t.energia_mwmed} unidade="MWmédio" casas={1} endereco={`${ROTA_LEILOES}#quanto`} />
              <Numero variante="faixa" rotulo="Leilões na base" natureza="OBSERVADO" valor={g.cobertura.leiloes} unidade={`com ${num(t.empreendimentos, 0)} empreendimentos`} casas={0} periodo={periodo} />
              <Numero
                variante="faixa"
                rotulo={`Preço médio do último leilão (${u.nome ?? numeroAneel(u.leilao)})`}
                natureza="CALCULADO"
                evidencia={ev.ultimo_preco}
                valor={u.preco_medio}
                formato="reais"
                unidade="R$/MWh"
                casas={2}
                endereco={`${ROTA_LEILOES}#preco`}
              />
              <Numero variante="faixa" rotulo={`Energia de usinas em operação em ${siga}`} natureza="CALCULADO" evidencia={ev.pct_operacao} valor={op} formato="pct" casas={1} unidade="da energia contratada" endereco={`${ROTA_LEILOES}#entrega`} />
            </FaixaMetricas>
          }
        >
          Os números vêm do arquivo de resultados dos leilões de geração da ANEEL, uma linha por empreendimento vencedor. A situação atual de cada
          usina vem do cadastro da ANEEL (SIGA) e dos atos de encerramento de outorga, e o grupo que a controla, da composição societária
          declarada à ANEEL. Os leilões de transmissão estão na{" "}
          <Link href={ROTA_LEILOES_TRANSMISSAO} className={link}>
            página de transmissão
          </Link>
          .
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="leiloes">
            <PainelEvidencia
              id="painel-leiloes"
              pergunta="Leilões de geração do ACR: quanto, a que preço, onde, de quem e o que já opera"
              subtitulo="Energia vendida em MWmédio, preço em R$/MWh da época e corrigido pelo IPCA, deságio em %, situação no SIGA"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  O que as distribuidoras compram em leilão vira a parcela de energia da conta de luz dos consumidores cativos por muitos anos. Os
                  leilões também decidem que usinas são construídas, de que fontes e onde.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.resultado}
              complementares={complementares}
            >
              <div className="space-y-10">
                <SecaoDoPainel id="como-funciona" titulo="O que é o ACR e quem compra" lead="Cinco papéis e três caminhos que não se confundem: o do contrato, o do dinheiro e o da energia.">
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      ["Quem compra", "As distribuidoras, para atender todo o seu mercado de consumidores cativos, por meio de licitação (Lei nº 10.848/2004, art. 2º)."],
                      ["Quem vende", "Geradores com usinas novas ou existentes; nos leilões de energia nova, projetos que ainda vão ser construídos."],
                      ["O que se compra", "Energia média ao longo de muitos anos (MWmédio), a um preço por MWh atualizado pelo contrato, ou disponibilidade de usinas térmicas."],
                    ].map(([a, b]) => (
                      <div key={a} className="border-t border-linha pt-3">
                        <p className="font-medium text-carvao">{a}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{b}</p>
                      </div>
                    ))}
                  </div>
                  <DiagramaAcr />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    O outro ambiente é o livre (<Termo slug="acl">ACL</Termo>), onde consumidores e comercializadores negociam contratos bilaterais sem
                    leilão. A divisão entre os dois está em{" "}
                    <Link href="/setor-eletrico/mercado#livre-regulado" className={link}>
                      Mercado
                    </Link>
                    .
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="produtos" titulo="Os produtos: A-3, A-5, reserva, fontes alternativas" lead="O nome do produto diz quantos anos separam o leilão do início da entrega.">
                  <LinhaDosProdutos produtos={produtos} dataSiga={siga} />
                  <TabelaDados
                    titulo="Leilões e energia contratada por tipo de leilão"
                    colunas={["Tipo", "Leilões", "Empreendimentos", "Energia (MWmédio)", "Preço médio da época (R$/MWh)", `Preço médio de ${ipca} (R$/MWh)`, "Deságio agregado (%)"]}
                    linhas={g.por_tipo.map((x) => [x.rotulo, x.leiloes, x.empreendimentos, x.energia_mwmed, x.preco_medio, x.preco_medio_real, x.desagio_agregado_pct])}
                    casas={[null, 0, 0, 1, 2, 2, 2]}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="laboratorio" titulo="Laboratório: como a concorrência derruba o preço" lead="Um modelo simples do leilão de preço descendente para ver de onde vem o deságio.">
                  <LabLeilao />
                </SecaoDoPainel>

                <SecaoDoPainel id="quanto" titulo="Quanto se contratou, ano a ano" lead={`${mwmed(t.energia_mwmed)} em ${num(g.cobertura.leiloes, 0)} leilões, de ${periodo}.`}>
                  <LeiloesAlternar
                    rotulo="Ver por"
                    nome="leiloes-energia"
                    opcoes={[["categoria", "Fonte"], ["tipo", "Tipo de leilão"]]}
                    conteudo={{
                      categoria: (
                        <GraficoBarras
                          titulo={`Energia contratada por ano do leilão e fonte, ${periodo}`}
                          dados={linhasEnergiaPorAno(g, "categoria")}
                          chaveCategoria="ano"
                          series={seriesCat}
                          unidade="MWmédio"
                          casas={0}
                          empilhado
                          altura={320}
                        />
                      ),
                      tipo: (
                        <GraficoBarras
                          titulo={`Energia contratada por ano do leilão e tipo de leilão, ${periodo}`}
                          dados={linhasEnergiaPorAno(g, "tipo")}
                          chaveCategoria="ano"
                          series={seriesTipo}
                          unidade="MWmédio"
                          casas={0}
                          empilhado
                          altura={320}
                        />
                      ),
                    }}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {semLeilao.length
                      ? `Anos sem leilão de geração na base aberta: ${semLeilao.join(", ")} (barra hachurada, ausência, não zero). `
                      : ""}
                    A numeração da CCEE presente no arquivo tem lacunas ({Object.entries(g.cobertura.lacunas_numeracao_ccee)
                      .filter(([, v]) => v.length)
                      .map(([k, v]) => `${k}: ${v.map((x) => `${x}º`).join(", ")}`)
                      .join("; ")}); o observatório não verificou o que cada número ausente foi.
                  </p>
                  <TabelaDados
                    titulo="Energia contratada por fonte, todo o período"
                    colunas={["Fonte", "Leilões", "Empreendimentos", "Energia (MWmédio)", "Primeiro leilão", "Último leilão"]}
                    linhas={g.por_categoria.map((x) => [x.rotulo, x.leiloes, x.empreendimentos, x.energia_mwmed, dataBR(x.primeiro), dataBR(x.ultimo)])}
                    casas={[null, 0, 0, 1, null, null]}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="preco" titulo="A que preço" lead={`Preço médio de venda por fonte, em reais da época e em reais de ${ipca}.`}>
                  <LeiloesPrecoAno
                    anos={Array.from({ length: (g.cobertura.anos?.[1] ?? 0) - (g.cobertura.anos?.[0] ?? 0) + 1 }, (_, i) => String((g.cobertura.anos?.[0] ?? 0) + i))}
                    categorias={comPreco.map((k) => ({ id: k, rotulo: CURTO_CATEGORIA[k], cor: COR_CATEGORIA_LEILAO[k] }))}
                    pontos={pontosPreco}
                    ipcaAte={ipca}
                    iniciais={["eolica", "solar", "uhe", "gas"].filter((k) => comPreco.includes(k as never))}
                  />
                  <TabelaDados
                    titulo={`Preço médio por fonte: primeiro e último ano com venda, em reais de ${ipca}`}
                    colunas={["Fonte", "Primeiro ano", "Preço (R$/MWh)", "Último ano", "Preço (R$/MWh)", "Todo o período (R$/MWh)"]}
                    linhas={g.por_categoria.map((x) => [x.rotulo, x.primeiro_ano?.ano ?? null, x.primeiro_ano?.preco_medio_real ?? null, x.ultimo_ano?.ano ?? null, x.ultimo_ano?.preco_medio_real ?? null, x.preco_medio_real])}
                    casas={[null, null, 2, null, 2, 2]}
                  />
                  <LeiloesDispersao url="/energia/series/leiloes_empreendimentos.json" categorias={g.categorias.filter((c) => comPreco.includes(c.id))} ipcaAte={ipca} />
                </SecaoDoPainel>

                <SecaoDoPainel id="desagio" titulo="Deságio: quanto o preço ficou abaixo do teto" lead="Distância entre o preço de venda e o preço teto do edital, por empreendimento.">
                  <Histograma
                    titulo={`Deságio por empreendimento, ${periodo}`}
                    dados={hist}
                    rotuloX="Deságio sobre o preço teto"
                    unidade="%"
                    casas={1}
                    contagem={{ singular: "empreendimento", plural: "empreendimentos" }}
                    periodo={periodo}
                    nota={`${num(g.desagio.zero, 0)} empreendimentos venderam no próprio teto (deságio zero). O deságio publicado confere com 100 × (1 − preço ÷ teto) em ${g.conferencias.desagio_publicado_confere}.`}
                  />
                  <GraficoBarras
                    titulo="Deságio agregado por ano do leilão (ponderado pela energia)"
                    dados={g.desagio.por_ano.map((x) => ({ ano: x.ano, agregado: x.agregado_pct }))}
                    chaveCategoria="ano"
                    series={[{ id: "agregado", rotulo: "Deságio agregado", cor: "var(--cor-energia)" }]}
                    unidade="%"
                    casas={1}
                    altura={260}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Deságio mede a distância ao teto do edital, não a concorrência: o teto muda a cada leilão e o arquivo não traz o número de
                    proponentes nem os lances perdedores.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="onde" titulo="Onde estão as usinas contratadas" lead="Energia contratada pela UF principal do empreendimento.">
                  <LeiloesMapaUf ufs={ufs} periodo={periodo} />
                </SecaoDoPainel>

                <SecaoDoPainel id="quem" titulo="Quem venceu, e quem controla as usinas" lead={`A vencedora como a ANEEL publica e, à parte, o grupo que controla a usina no cadastro de ${siga}.`}>
                  {g.grupos_controle ? (
                    <GruposControle g={g.grupos_controle} logos={logos} dataSiga={siga} />
                  ) : (
                    <p className="text-sm text-carvao-muted">O vínculo com o grupo de controle atual não está nesta publicação.</p>
                  )}
                  <TabelaDados
                    titulo="Vencedoras como publicadas pela ANEEL, pelas 20 maiores em energia contratada"
                    colunas={["Vencedora publicada", "Contratos", "Leilões", "Energia (MWmédio)", "Fontes"]}
                    linhas={g.vencedoras.maiores.map((x) => [x.nome ?? "sem nome", x.empreendimentos, x.leiloes, x.energia_mwmed, x.categorias.map((c) => CURTO_CATEGORIA[c]).join(", ")])}
                    casas={[null, 0, 0, 1, null]}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{g.vencedoras.regra} São {num(g.vencedoras.nomes_distintos, 0)} grafias distintas no arquivo.</p>
                </SecaoDoPainel>

                <SecaoDoPainel id="entrega" titulo="O que foi entregue" lead={`Situação atual, no cadastro da ANEEL de ${siga}, das usinas que venderam em cada ano.`}>
                  <GraficoBarras
                    titulo={`Energia contratada por ano do leilão e situação atual da usina (SIGA de ${siga})`}
                    dados={linhasEntregaPorAno(g)}
                    chaveCategoria="ano"
                    series={seriesSit}
                    unidade="MWmédio"
                    casas={0}
                    empilhado
                    altura={320}
                  />
                  <BarrasSituacao
                    titulo={`Parcela da energia contratada de cada fonte por situação da usina (SIGA de ${siga})`}
                    linhas={entregaCat}
                    ordem={ORDEM_SITUACOES}
                    cores={COR_SITUACAO}
                    rotulos={CURTO_SITUACAO}
                  />
                  <TabelaDados
                    titulo={`Energia contratada por fonte e situação da usina, MWmédio (SIGA de ${siga})`}
                    colunas={["Fonte", ...ORDEM_SITUACOES.map((k) => CURTO_SITUACAO[k])]}
                    linhas={entregaCat.map((x) => [x.rotulo, ...ORDEM_SITUACOES.map((k) => x.valores[k])])}
                    casas={[null, ...ORDEM_SITUACOES.map(() => 1)]}
                  />
                  <dl className="grid gap-4 text-sm md:grid-cols-3">
                    {ORDEM_SITUACOES.map((k) => (
                      <div key={k} className="border-l-4 pl-3" style={{ borderColor: COR_SITUACAO[k] }}>
                        <dt className="font-medium text-carvao">
                          {CURTO_SITUACAO[k]}: {mwmed(g.entrega.total[k].energia_mwmed)} ({pct(participacao(g, k), 1)})
                        </dt>
                        <dd className="mt-1 text-xs leading-relaxed text-carvao-muted">{g.situacoes.find((s) => s.id === k)?.definicao}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Leilões recentes ainda estão dentro do prazo de implantação. Das usinas contratadas que ainda não operam, o acompanhamento da
                    fiscalização (RALIE de {dataBR(ref.ralie)}) registra{" "}
                    {Object.entries(g.entrega.ralie_situacao_obra)
                      .map(([k, v]) => `${num(v, 0)} com obra "${k.toLowerCase()}"`)
                      .join(", ")}
                    . O cronograma de cada uma está em{" "}
                    <Link href="/setor-eletrico/expansao/cronograma#p041" className={link}>
                      Expansão, cronograma
                    </Link>
                    .
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="citar" titulo="Números para citar" lead="Frases calculadas da base publicada, com data e fonte. Atualizam a cada publicação.">
                  <FrasesCitaveis frases={frases} rotulo="Frases citáveis sobre os leilões do ACR" />
                </SecaoDoPainel>

                <SecaoDoPainel id="lista" titulo={`Os ${num(g.cobertura.leiloes, 0)} leilões da base`}>
                  <TabelaInterativa
                    titulo="Leilões de geração do ACR na base da ANEEL"
                    colunas={COLUNAS_LEILOES}
                    linhas={linhasLeiloes}
                    chaveLinha="leilao"
                    colunaRotulo="nome"
                    fonte={`${FONTE_LEILOES}; IBGE, IPCA até ${ipca}; ANEEL, SIGA de ${siga}`}
                    versao={ref.arquivo_gerado_em ?? ref.ultimo_leilao}
                    nomeArquivo="leiloes-acr"
                    chaveUrl="leiloes"
                    ordemInicial={{ coluna: "data", direcao: "desc" }}
                    dicaBusca="Número, tipo ou ano do leilão"
                  />
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  <ul className="space-y-1 text-sm">
                    {g.downloads.map((d) => (
                      <li key={d.url}>
                        <a href={d.url} className={link} download>
                          {d.rotulo}
                        </a>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras" titulo="Regras, cobertura e conferências">
                  <ListaRegras
                    itens={[
                      ["Cobertura", <>{g.cobertura.descricao_fonte} {g.cobertura.ausentes}</>],
                      ["Energia", g.regras.energia],
                      ["Preço", g.regras.preco],
                      ["Preço corrigido", g.regras.preco_real],
                      ["Deságio", g.regras.desagio],
                      ["Zeros da fonte", g.regras.zeros],
                      ["Situação atual", g.regras.situacao],
                      ["Ano A", g.regras.ano_a],
                      ["Fonte", g.regras.categoria],
                      ["Grupo controlador", g.grupos_controle?.regra ?? "sem vínculo nesta publicação"],
                    ]}
                  />
                  <TabelaDados
                    titulo="Conferência das unidades nos leilões estruturantes"
                    colunas={["Empreendimento", "Leilão", "Energia vendida (MWmédio)", "Garantia física (MWmédio)"]}
                    linhas={g.conferencias.estruturantes_mwmed.map((x) => [x.empreendimento, numeroAneel(x.leilao), x.energia_mwmed, x.garantia_fisica_mwmed])}
                    casas={[null, null, 1, 1]}
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
                    <li>
                      CEG repetido no mesmo leilão em {g.entrega.ceg_repetido.length} casos:{" "}
                      {g.entrega.ceg_repetido.map((x) => `${numeroAneel(x.leilao)} (${x.empreendimentos.join(" e ")})`).join("; ")}. A situação e o grupo vêm da usina do CEG.
                    </li>
                    <li>
                      Energia vendida acima da garantia física publicada em {g.conferencias.energia_acima_da_garantia_fisica.length} linhas (mantidas como
                      publicadas): {g.conferencias.energia_acima_da_garantia_fisica.map((x) => `${x.empreendimento} (${numeroAneel(x.leilao)})`).join("; ")}.
                    </li>
                    <li>
                      Zeros tratados como ausência: preço em {g.conferencias.zeros_tratados.preco} linha, garantia física em{" "}
                      {g.conferencias.zeros_tratados.garantia_fisica} e investimento em {g.conferencias.zeros_tratados.investimento}.
                    </li>
                    <li>
                      {g.entrega.operacao_com_ato_encerramento} contratos de usinas em operação no SIGA têm ato de revogação ou extinção publicado
                      (conversão de regime ou nova outorga); a fase do SIGA prevalece.
                    </li>
                    {g.ressalvas.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Insumos de outros módulos (tabela rolável)">
                    <table className="w-full min-w-[36rem] border-collapse text-xs">
                      <caption className="mb-2 text-left text-sm font-medium text-carvao">Insumos publicados por outros módulos na mesma execução</caption>
                      <thead>
                        <tr>
                          {["Arquivo", "Módulo", "sha256", "Gerado em"].map((h) => (
                            <th key={h} scope="col" className="border-b border-linha px-2 py-1.5 text-left font-medium text-mineral">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.insumos.map((x) => (
                          <tr key={x.arquivo} className="border-b border-linha">
                            <td className="px-2 py-1">
                              <a href={x.url} className={link}>
                                {x.arquivo}
                              </a>
                            </td>
                            <td className="px-2 py-1">{x.modulo}</td>
                            <td className="px-2 py-1 font-mono">{x.sha256.slice(0, 16)}…</td>
                            <td className="px-2 py-1">{carimbo(x.gerado_em)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
