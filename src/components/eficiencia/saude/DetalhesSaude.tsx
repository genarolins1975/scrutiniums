"use client";

import type { ReactNode } from "react";
import { inteiro, percentual, reaisExtenso } from "@/lib/eficiencia/formato";
import { composicao, composicaoAgregada, type CapitalPainel, type ComposicaoAgregada, type IndiceSaude, type LinhaComposicao } from "@/lib/eficiencia/saude/consulta";
import { ROTA_SAUDE } from "@/lib/eficiencia/saude/rotas";
import type { ContextoFicha } from "../FichaConteudo";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { TabelaSimples } from "../TabelaSimples";
import { Siglas } from "../Siglas";
import { BarrasComposicao } from "../graficos";

/** Blocos de detalhe de cada tema: composição, componentes e o que os números não dizem. Sempre do mesmo conjunto de observações do gráfico. */

type Base = { ix: IndiceSaude; cap: CapitalPainel | null; ano: number; contextos: Record<string, ContextoFicha> };

function Bloco({ id, titulo, subtitulo, acao, children }: { id: string; titulo: string; subtitulo?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-linha pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={id} className="font-serif text-[1.45rem] leading-snug text-obee-tinta">
          {titulo}
        </h2>
        {acao}
      </div>
      {subtitulo && <p className="mt-1 max-w-prose2 text-sm leading-snug text-carvao-muted">{subtitulo}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Composicao({ linhas, detalhe }: { linhas: LinhaComposicao[]; detalhe: (l: LinhaComposicao) => string }) {
  return <BarrasComposicao linhas={linhas.map((l) => ({ chave: l.chave, rotulo: l.rotulo, pct: l.participacao, detalhe: detalhe(l) }))} />;
}

/** Quantas capitais entram na soma e quais ficam de fora, com o motivo: o agregado nunca esconde o seu universo. */
function UniversoDoAgregado({ ag, ano }: { ag: ComposicaoAgregada; ano: number }) {
  return (
    <p className="mt-3 max-w-prose2 text-sm leading-snug text-obee-tinta">
      <span className="font-semibold">Soma de {ag.capitais} de {ag.universo} capitais em {ano}.</span> Cada capital pesa pelo seu valor.
      {ag.fora.length > 0 && (
        <> Fora da soma: {ag.fora.map((f) => `${f.cap.nome} (${f.cap.uf}), ${f.motivo}`).join("; ")}.</>
      )}
    </p>
  );
}

const pctValor = (l: LinhaComposicao) => `${percentual(l.participacao, 1)} · ${reaisExtenso(l.valor)}`;

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-prose2 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-snug text-obee-tinta" role="note">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Gastos */

export function DetalheGastos({ ix, cap, ano, contextos }: Base) {
  const nomeCap = cap ? `${cap.nome} (${cap.uf})` : null;
  const sub: [string, string][] = ["301", "302", "303", "304", "305", "306", "122", "FU10"].map((k) => [k, ix.d.rotulos.subfuncoes[k] ?? k]);
  const nat: [string, string][] = Object.entries(ix.d.rotulos.natureza);
  const fon: [string, string][] = Object.entries(ix.d.rotulos.fontes);
  const fichaSub = ix.d.fichas.find((f) => f.id === "sau.despesa.subfuncao");
  const fichaNat = ix.d.fichas.find((f) => f.id === "sau.despesa.natureza");
  const fichaFon = ix.d.fichas.find((f) => f.id === "sau.despesa.por_fonte");
  const cSub = cap ? composicao(ix, "sau.despesa.subfuncao", cap.cod, ano, sub) : null;
  const aSub = !cap ? composicaoAgregada(ix, "sau.despesa.subfuncao", ano, sub) : null;
  const cNat = cap ? composicao(ix, "sau.despesa.natureza", cap.cod, ano, nat) : null;
  const aNat = !cap ? composicaoAgregada(ix, "sau.despesa.natureza", ano, nat, { exigeTodas: true }) : null;
  const cFon = cap ? composicao(ix, "sau.despesa.por_fonte", cap.cod, ano, fon) : null;
  const aFon = !cap ? composicaoAgregada(ix, "sau.despesa.por_fonte", ano, fon, { exigeTodas: true }) : null;
  const dca = cap ? ix.ponto("sau.despesa.funcao_saude", cap.cod, ano, "nominal") : null;
  const escopo = (ag: ComposicaoAgregada | null) => (cap ? `${nomeCap}, exercício ${ano}` : ag ? `soma de ${ag.capitais} de ${ag.universo} capitais, exercício ${ano}` : `exercício ${ano}`);
  return (
    <div className="space-y-12">
      <Bloco id="gastos-perimetro" titulo="O que a despesa inclui, e o que não inclui" subtitulo="Os recursos executados pelo município são um dos três perímetros do módulo.">
        <div className="grid max-w-[60rem] gap-x-10 gap-y-4 text-sm leading-relaxed text-obee-tinta md:grid-cols-2">
          <p>
            <span className="font-semibold">Inclui:</span> despesa liquidada na função Saúde do orçamento do município (<Siglas texto="DCA" />, Anexo I-E), qualquer subfunção e qualquer fonte de recursos, executada diretamente ou por terceiros contratados.
          </p>
          <p>
            <span className="font-semibold">Não inclui:</span> gasto da União e do estado no território, serviços privados e filantrópicos pagos por outras fontes e a parcela intraorçamentária do município, que fica em linha separada na fonte. Por isso não é o gasto total com saúde na capital.
          </p>
          <p>
            <span className="font-semibold">Transferências:</span> o repasse recebido do <Siglas texto="SUS" /> entra como receita e só aparece na despesa quando o município o executa. Receita recebida e despesa executada não se somam como gastos diferentes.
          </p>
          <p>
            <span className="font-semibold">Por habitante:</span> divide a despesa pela população do território. Não é custo por usuário do <Siglas texto="SUS" />: inclui quem usa saúde suplementar e não separa o atendimento a moradores de outros municípios.
          </p>
        </div>
      </Bloco>

      <Bloco
        id="gastos-subfuncao"
        titulo="Por subfunção orçamentária"
        subtitulo={`Participação de cada subfunção na despesa liquidada na função Saúde. ${escopo(aSub)}.`}
        acao={fichaSub && <SobreEsteDado f={fichaSub} ctx={contextos[fichaSub.id]} />}
      >
        {cSub?.indisponivel && <Aviso>{cSub.indisponivel}</Aviso>}
        {cSub && !cSub.indisponivel && <Composicao linhas={cSub.linhas} detalhe={pctValor} />}
        {aSub && <Composicao linhas={aSub.linhas} detalhe={pctValor} />}
        {aSub && <UniversoDoAgregado ag={aSub} ano={ano} />}
        {aSub && <p className="mt-2 max-w-prose2 text-xs leading-snug text-carvao-muted">A classificação por subfunção é contábil e varia entre municípios. Subfunção sem linha na declaração não aparece: a soma das linhas de cada declaração reproduz o total da função.</p>}
        {cSub && !cSub.indisponivel && <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted">A classificação por subfunção é contábil: a subfunção Atenção básica não é a despesa da rede de atenção primária, e a prática de classificação varia entre municípios.</p>}
      </Bloco>

      <Bloco
        id="gastos-natureza"
        titulo="Por natureza da despesa"
        subtitulo={`Pessoal, outras despesas correntes e despesas de capital, pela Matriz de Saldos Contábeis. ${escopo(aNat)}.`}
        acao={fichaNat && <SobreEsteDado f={fichaNat} ctx={contextos[fichaNat.id]} />}
      >
        {cNat?.indisponivel && <Aviso>{cNat.indisponivel}</Aviso>}
        {cNat && !cNat.indisponivel && <Composicao linhas={cNat.linhas} detalhe={pctValor} />}
        {aNat && <Composicao linhas={aNat.linhas} detalhe={pctValor} />}
        {aNat && <UniversoDoAgregado ag={aNat} ano={ano} />}
        <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted">
          A natureza não indica quem presta o serviço: outras despesas correntes incluem serviços de terceiros, organizações sociais e consórcios, e a composição muda conforme o modelo de gestão sem mudar o que é entregue. A abertura só é publicada onde as três categorias reproduzem a <Siglas texto="DCA" />.
        </p>
      </Bloco>

      <Bloco
        id="gastos-fonte"
        titulo="Por fonte de recursos, segundo o SIOPS"
        subtitulo={`Despesa total em saúde empenhada, por fonte, no perímetro declarado pelo município. ${escopo(aFon)}. Contexto: não é a despesa liquidada da DCA e não se soma a ela.`}
        acao={fichaFon && <SobreEsteDado f={fichaFon} ctx={contextos[fichaFon.id]} />}
      >
        {cFon?.indisponivel && <Aviso>{cFon.indisponivel}</Aviso>}
        {cFon && !cFon.indisponivel && <Composicao linhas={cFon.linhas} detalhe={pctValor} />}
        {aFon && <Composicao linhas={aFon.linhas} detalhe={pctValor} />}
        {aFon && <UniversoDoAgregado ag={aFon} ano={ano} />}
        <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted">
          A fonte financia, e não prova quem executa o serviço. A participação de transferências do <Siglas texto="SUS" /> descreve a origem declarada dos recursos e depende da divisão de responsabilidades no território; não é indicador de mérito.
        </p>
      </Bloco>

      {cap && dca && (
        <Bloco id="gastos-ponte" titulo="Conferência da despesa com outras fontes oficiais" subtitulo={`${nomeCap}, exercício ${ano}.`}>
          <div className="max-w-prose2 text-sm leading-relaxed text-obee-tinta">
            <p>
              Cada valor da <Siglas texto="DCA" /> é conferido com o <Siglas texto="RREO" /> do 6º bimestre e, quando a diferença é material, com a <Siglas texto="MSC" /> de dezembro. Situação desta capital e exercício: <span className="font-semibold">{dca.situacao ? SITUACAO[dca.situacao] ?? dca.situacao : "não disponível"}</span>.
            </p>
            {dca.nota && <p className="mt-2 text-carvao-muted"><Siglas texto={dca.nota} /></p>}
            <p className="mt-3 text-xs text-carvao-muted">Valores fora das comparações continuam disponíveis para consulta, com a ressalva. A política de conferência é a mesma do painel de Educação nas capitais.</p>
          </div>
        </Bloco>
      )}
    </div>
  );
}

const SITUACAO: Record<string, string> = {
  CONFERE: "confere com o RREO",
  DIFERENCA_MENOR: "diferença com o RREO abaixo de 0,1%",
  RECONCILIADA_MSC: "diferença com o RREO, DCA confirmada pela MSC",
  PERIMETRO_INTRA_MSC: "perímetro distinto: inclui despesas intraorçamentárias (fora das comparações)",
  PENDENTE: "conferência pendente: diferença material sem explicação (fora das comparações)",
  NAO_CONFERIDO: "não conferido: RREO indisponível",
};

/* ------------------------------------------------------------------ Rede e APS */

const COMP_UBS_RETRATO: [string, string][] = [
  ["total_ativas", "UBS ativas (tipos 01 e 02)"],
  ["publicas", "Natureza pública"],
  ["publicas_sus", "Públicas com atendimento ambulatorial SUS declarado"],
  ["nao_publicas", "Natureza não pública"],
  ["gestao_municipal", "Gestão municipal"],
  ["gestao_municipal_nao_publica", "Gestão municipal e natureza jurídica não pública (fora da contagem de UBS públicas)"],
  ["gestao_estadual", "Gestão estadual"],
  ["gestao_dupla", "Gestão dupla"],
];
const COMP_UBS_CONTEXTO: [string, string][] = [
  ["tp15", "Unidades mistas (tipo 15)"],
  ["tp32", "Unidades móveis fluviais (tipo 32)"],
  ["tp40", "Unidades móveis terrestres (tipo 40)"],
  ["tp71", "Centros de apoio à saúde da família (tipo 71)"],
  ["tp74", "Polos academia da saúde (tipo 74)"],
];
const TIPOS_EQUIPE: [string, string][] = [["esf", "Saúde da Família (eSF)"], ["eap20", "Atenção Primária, 20 h (eAP)"], ["eap30", "Atenção Primária, 30 h (eAP)"], ["esfr", "Saúde da Família ribeirinha (eSFR)"], ["ecr", "Consultório na Rua (eCR)"], ["eapp20", "Apoio à Atenção Primária, 20 h (eAPP)"], ["eapp30", "Apoio à Atenção Primária, 30 h (eAPP)"]];

export function DetalheRede({ ix, cap, ano, contextos }: Base) {
  const fichaRet = ix.d.fichas.find((f) => f.id === "sau.rede.ubs_retrato");
  const fichaEq = ix.d.fichas.find((f) => f.id === "sau.aps.equipes");
  const fichaCob = ix.d.fichas.find((f) => f.id === "sau.aps.cobertura_potencial");
  const retrato = (k: string, c: CapitalPainel) => ix.ponto("sau.rede.ubs_retrato", c.cod, 2026, k);
  const somaRet = (k: string) => {
    let n = 0;
    let t = 0;
    for (const c of ix.d.capitais) {
      const p = retrato(k, c);
      if (p.status === "OBSERVADO" && p.valor !== null) {
        t += p.valor;
        n++;
      }
    }
    return { total: t, n };
  };
  const linhasRet = COMP_UBS_RETRATO.map(([k, rot]) => {
    const v = cap ? retrato(k, cap) : null;
    const s = somaRet(k);
    return [rot, cap ? (v && v.valor !== null ? inteiro(v.valor) : "sem valor") : inteiro(s.total)];
  });
  const linhasCtx = COMP_UBS_CONTEXTO.map(([k, rot]) => {
    const v = cap ? retrato(k, cap) : null;
    const s = somaRet(k);
    return [rot, cap ? (v && v.valor !== null ? inteiro(v.valor) : "sem valor") : inteiro(s.total)];
  });
  const eq = (k: string, c: CapitalPainel) => ix.ponto("sau.aps.equipes", c.cod, ano, k);
  const capsComEquipe = ix.d.capitais.filter((c) => eq("esf", c).status === "OBSERVADO" && eq("esf", c).valor !== null);
  const linhasEq = TIPOS_EQUIPE.map(([k, rot]) => {
    if (cap) {
      const p = eq(k, cap);
      return [rot, p.valor === null ? "sem valor" : inteiro(p.valor)];
    }
    let t = 0;
    for (const c of capsComEquipe) t += eq(k, c).valor ?? 0;
    return [rot, inteiro(t)];
  });
  const cob = cap ? ix.ponto("sau.aps.cobertura_potencial", cap.cod, ano, null) : null;
  const rotulo = cap ? `${cap.nome} (${cap.uf})` : `soma de ${capsComEquipe.length} de ${ix.d.capitais.length} capitais`;
  return (
    <div className="space-y-12">
      <Bloco id="rede-conceitos" titulo="Estabelecimento, equipe, cobertura e pessoas atendidas são coisas diferentes" subtitulo="O módulo mostra cadastro e capacidade registrada, não atendimento efetivo.">
        <dl className="grid max-w-[60rem] gap-x-10 gap-y-4 text-sm leading-relaxed text-obee-tinta md:grid-cols-2">
          <div><dt className="font-semibold">Estabelecimento (<Siglas texto="UBS" />)</dt><dd>Uma unidade cadastrada no <Siglas texto="CNES" /> como posto de saúde ou centro de saúde. O cadastro não comprova funcionamento, acesso nem vaga, e uma unidade situada na capital pode ser de gestão estadual ou dupla.</dd></div>
          <div><dt className="font-semibold">Equipe</dt><dd>Contagem de equipes de Saúde da Família (<Siglas texto="eSF" />) e de Atenção Primária (<Siglas texto="eAP" />) financiadas e validadas. Uma unidade pode ter várias equipes, e os tipos não se somam como se fossem iguais.</dd></div>
          <div><dt className="font-semibold">Cobertura potencial</dt><dd>Capacidade teórica das equipes sobre a população de referência do Ministério da Saúde, sem teto de 100%. Não é cadastro nem atendimento.</dd></div>
          <div><dt className="font-semibold">Pessoas atendidas</dt><dd>Não estão neste módulo: o Siaps substituiu o Sisab, mas a consulta pública de produção não devolveu resposta válida nos testes, e nenhuma série comparável por município foi obtida. Nenhum outro indicador toma o lugar dessa medida.</dd></div>
        </dl>
      </Bloco>

      <Bloco
        id="rede-retrato"
        titulo="UBS no retrato do CNES"
        subtitulo={`Contagem de estabelecimentos ativos por natureza, gestão e atendimento SUS. ${rotulo}. Retrato de 09/10/2026, sem competência.`}
        acao={fichaRet && <SobreEsteDado f={fichaRet} ctx={contextos[fichaRet.id]} />}
      >
        <TabelaSimples legenda={`UBS no retrato do CNES: ${rotulo}`} cabecalho={["Recorte", "Estabelecimentos"]} linhas={linhasRet} />
        <p className="mt-4 rotulo text-mineral">Outros tipos de unidade com atenção primária (contexto, não se somam às UBS)</p>
        <TabelaSimples legenda={`Outros tipos de unidade de atenção primária: ${rotulo}`} cabecalho={["Tipo de unidade", "Estabelecimentos"]} linhas={linhasCtx} />
        <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted">
          Natureza pública é a natureza jurídica do estabelecimento (código iniciado em 1); a esfera administrativa do arquivo repete a gestão e não é usada para isso. Gestão municipal não equivale a propriedade municipal.
        </p>
      </Bloco>

      <Bloco
        id="rede-equipes"
        titulo="Equipes por tipo"
        subtitulo={`Contagem de equipes registradas em dezembro de ${ano}. ${rotulo}.`}
        acao={fichaEq && <SobreEsteDado f={fichaEq} ctx={contextos[fichaEq.id]} />}
      >
        <TabelaSimples legenda={`Equipes por tipo, dezembro de ${ano}: ${rotulo}`} cabecalho={["Tipo de equipe", "Equipes"]} linhas={linhasEq} />
      </Bloco>

      {cap && cob && (
        <Bloco id="rede-cobertura" titulo="Como se chega à cobertura potencial" subtitulo={`${cap.nome} (${cap.uf}), dezembro de ${ano}.`} acao={fichaCob && <SobreEsteDado f={fichaCob} ctx={contextos[fichaCob.id]} />}>
          {cob.valor === null ? (
            <Aviso>{cob.nota ?? "Sem valor para este recorte."}</Aviso>
          ) : (
            <div className="max-w-prose2 text-sm leading-relaxed text-obee-tinta">
              <p>
                Capacidade das equipes: <span className="tabular-nums font-semibold">{cob.numerador !== null ? inteiro(cob.numerador) : "sem valor"}</span> pessoas. População de referência do Ministério da Saúde: <span className="tabular-nums font-semibold">{cob.denominador !== null ? inteiro(cob.denominador) : "sem valor"}</span> habitantes. Cobertura potencial: <span className="tabular-nums font-semibold">{percentual(cob.valor, 2)}</span>.
              </p>
              {cob.valor > 100 && <p className="mt-2">O valor passa de 100%: a capacidade das equipes registradas é maior que a população de referência, e o serviço não limita o resultado. Isso não significa que toda a população seja atendida.</p>}
              {ano === 2021 && <p className="mt-2 text-carvao-muted">Dezembro de 2021 segue regra anterior de equipes e de cadastro e não reproduz a fórmula da Nota Técnica nº 2/2025: fica fora das comparações.</p>}
              {ano === 2022 && <p className="mt-2 text-carvao-muted">A população de referência de dezembro de 2022 é anterior ao Censo 2022. De dezembro de 2023 em diante a base é outra, e a variação entre esses meses não é uma medida direta da cobertura.</p>}
              <p className="mt-3 text-xs text-carvao-muted">A população de referência é a do ano anterior ao da competência e muda a cada janeiro: um salto entre dezembro e janeiro é efeito do denominador, não da capacidade.</p>
            </div>
          )}
        </Bloco>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Atendimento e resultados */

export function DetalheResultados({ ix, cap, ano, contextos }: Base) {
  const fichaGr = ix.d.fichas.find((f) => f.id === "sau.icsap.grupos");
  const fichaPl = ix.d.fichas.find((f) => f.id === "sau.ctx.cobertura_planos");
  const grupos: [string, string][] = Object.entries(ix.d.rotulos.grupos);
  const cGr = cap ? composicao(ix, "sau.icsap.grupos", cap.cod, ano, grupos) : null;
  const aGr = !cap ? composicaoAgregada(ix, "sau.icsap.grupos", ano, grupos, { exigeTodas: true }) : null;
  const linhas = (cGr?.linhas ?? aGr?.linhas ?? []).slice().sort((a, b) => b.valor - a.valor);
  const rotulo = cap ? `${cap.nome} (${cap.uf})` : aGr ? `soma de ${aGr.capitais} de ${aGr.universo} capitais` : "";
  const plano = cap ? ix.ponto("sau.ctx.cobertura_planos", cap.cod, ano, null) : null;
  const planosVals = ix.d.capitais.map((c) => ix.ponto("sau.ctx.cobertura_planos", c.cod, ano, null).valor).filter((v): v is number => v !== null).sort((a, b) => a - b);
  return (
    <div className="space-y-12">
      <Bloco id="res-perimetro" titulo="O que este resultado mede, e o que não mede" subtitulo="Resultado por residência: descreve o sistema de saúde que atende os moradores, não a produção da prefeitura.">
        <div className="grid max-w-[60rem] gap-x-10 gap-y-4 text-sm leading-relaxed text-obee-tinta md:grid-cols-2">
          <p><span className="font-semibold">Universo:</span> internações pagas pelo <Siglas texto="SUS" />, de residentes da capital, por ano de processamento da <Siglas texto="AIH" />. A internação de um morador em outro município conta para a capital de residência. Por local de internação o número seria outro, sobretudo em capitais que são polo regional; por isso o módulo usa residência.</p>
          <p><span className="font-semibold">Só SUS:</span> internações pagas por planos privados ou particulares não entram, e a cobertura de planos varia muito entre as capitais (bloco abaixo). A <Siglas texto="AIH" /> é a unidade, não a pessoa: reinternação e transferência contam mais de uma vez.</p>
          <p><span className="font-semibold">Taxa bruta:</span> não é ajustada por idade nem por cobertura de planos. Ajuste exigiria população por idade, população padrão e fórmula verificada, e não foi feito.</p>
          <p><span className="font-semibold">Não é falha de gestão:</span> cada internação não é um caso individual evitável. A taxa também depende de oferta de leitos, critérios de internação e registro, e não identifica a causa de diferenças entre capitais.</p>
        </div>
      </Bloco>

      <Bloco
        id="res-grupos"
        titulo="Por grupo da Lista Brasileira"
        subtitulo={`Internações ICSAP nos 19 grupos da Portaria SAS/MS nº 221/2008, em ordem de número de internações. ${rotulo}, ano ${ano}.`}
        acao={fichaGr && <SobreEsteDado f={fichaGr} ctx={contextos[fichaGr.id]} />}
      >
        {cGr?.indisponivel && <Aviso>{cGr.indisponivel}</Aviso>}
        {linhas.length > 0 && <Composicao linhas={linhas} detalhe={(l) => `${percentual(l.participacao, 1)} · ${inteiro(l.valor)}`} />}
        {aGr && <UniversoDoAgregado ag={aGr} ano={ano} />}
        <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted">Os grupos descrevem o diagnóstico principal da internação paga pelo SUS, não a incidência da doença nem o que a atenção primária teria evitado em cada caso. A composição por idade de cada capital influencia a distribuição.</p>
      </Bloco>

      <Bloco
        id="res-planos"
        titulo="Cobertura de planos de saúde privados"
        subtitulo={`Percentual da população com plano privado em dezembro de ${ano}, segundo a ANS. Contexto obrigatório da taxa de ICSAP, não ajuste.`}
        acao={fichaPl && <SobreEsteDado f={fichaPl} ctx={contextos[fichaPl.id]} />}
      >
        <div className="max-w-prose2 text-sm leading-relaxed text-obee-tinta">
          {plano && (
            <p>
              {cap!.nome} ({cap!.uf}): <span className="font-semibold tabular-nums">{plano.valor === null ? "sem valor" : percentual(plano.valor, 1)}</span> da população. Entre as {planosVals.length} capitais, de {planosVals.length ? percentual(planosVals[0], 1) : "sem valor"} a {planosVals.length ? percentual(planosVals[planosVals.length - 1], 1) : "sem valor"}.
            </p>
          )}
          {!plano && <p>Entre as {planosVals.length} capitais, a cobertura de planos privados vai de {planosVals.length ? percentual(planosVals[0], 1) : "sem valor"} a {planosVals.length ? percentual(planosVals[planosVals.length - 1], 1) : "sem valor"} em dezembro de {ano}.</p>}
          <p className="mt-2 text-carvao-muted">As internações pagas por planos privados não entram na taxa. A cobertura de planos varia entre as capitais e é mostrada aqui como contexto, sem relação estabelecida com a taxa. O módulo não estima usuários do SUS subtraindo beneficiários da população.</p>
        </div>
      </Bloco>

      <Bloco id="res-fora" titulo="Atendimento: o que não está nesta página" subtitulo="Lacunas registradas, sem substituição por outro indicador.">
        <ul className="max-w-prose2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-obee-tinta">
          <li><span className="font-semibold">Produção e atendimentos da atenção primária:</span> atendimentos individuais, procedimentos e visitas não têm série oficial extraível por município (a consulta pública do Siaps não devolveu resposta válida e o relatório do Sisab não tem API). Atendimentos, procedimentos e pessoas atendidas são medidas distintas e não se somam como produtividade.</li>
          <li><span className="font-semibold">Filas e tempo de espera:</span> não pesquisados nesta rodada; volume de consultas não substitui acesso oportuno.</li>
          <li><span className="font-semibold">Custo por atendimento ou internação:</span> não calculado, porque a despesa da função Saúde e a produção de um serviço não são do mesmo processo assistencial.</li>
        </ul>
        <p className="mt-3 text-sm"><a href={`${ROTA_SAUDE}/metodos#decisoes-fontes`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Ver as decisões sobre cada fonte em Dados e métodos</a></p>
      </Bloco>
    </div>
  );
}
