import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Fonte, Nota, Secao } from "@/components/saneamento/Editorial";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, fichaMunicipio, municipio, municipios, prestadores } from "@/lib/saneamento/gold";
import { ROTA } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { classePorte, mediana, ROTULO_PORTE } from "@/lib/saneamento/pares";
import { data, inteiro, numero, reais, reaisCompacto } from "@/lib/saneamento/formato";
import { MOTIVO_TEXTO, NATUREZA_CURTA, SITUACAO_AGUA, SITUACAO_ESGOTO } from "@/lib/saneamento/rotulos";
import { prestadorComTarifa } from "@/lib/saneamento/tarifas";
import type { Agregado, FichaMunicipio, Municipio } from "@/lib/saneamento/tipos";

export const dynamicParams = true;
export const revalidate = false;

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const m = municipio(params.id);
  if (!m) return { title: "Município não encontrado" };
  return {
    title: `${m.nome} (${m.uf}): água, esgoto, prestador e metas`,
    description: `Saneamento em ${m.nome} (${m.uf}): carência pelo Censo 2022, atendimento declarado ao SINISA 2024, prestador, regulador, plano, investimento e comparação com a UF.`,
    alternates: { canonical: `${ROTA}/municipio/${m.id}` },
  };
}

type Linha = { rotulo: string; fonte: string; m: number | null; uf: number | null; br: number | null; pares: number | null; unidade: string; casas: number; motivo?: string };

function Comparacao({ linhas, uf, pares }: { linhas: Linha[]; uf: string; pares: string }) {
  const f = (v: number | null, l: Linha) => (v == null ? "sem dado" : `${numero(v, l.casas)}${l.unidade === "%" ? "%" : ` ${l.unidade}`}`);
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Comparação do município com UF, Brasil e pares (rolável)">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">Medidas do município, da UF, do Brasil e mediana dos pares</caption>
        <thead>
          <tr className="border-b border-carvao text-left">
            <th scope="col" className="py-2 pr-4 font-medium text-carvao">Medida</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium text-carvao">Município</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium text-carvao-muted">{uf}</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium text-carvao-muted">Brasil</th>
            <th scope="col" className="py-2 text-right font-medium text-carvao-muted">Pares ({pares})</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b border-linha align-top">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                {l.rotulo}
                <span className="block text-xs text-carvao-muted">{l.fonte}</span>
              </th>
              <td className="py-2 pr-4 text-right tabular-nums text-carvao">
                {f(l.m, l)}
                {l.m == null && l.motivo && <span className="block text-xs text-carvao-muted">{l.motivo}</span>}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-carvao-muted">{f(l.uf, l)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-carvao-muted">{f(l.br, l)}</td>
              <td className="py-2 text-right tabular-nums text-carvao-muted">{f(l.pares, l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pctCenso(a: Agregado | null, f: (a: Agregado) => number | null | undefined) {
  return a ? razaoPct(f(a), a.censo2022.moradores?.agua.total) : null;
}

export default function Pagina({ params }: { params: { id: string } }) {
  const m = municipio(params.id);
  const ficha = m ? fichaMunicipio(m.id) : null;
  if (!m || !ficha) notFound();
  const uf = agregado(m.uf);
  const br = agregado("BR");
  const todos = municipios();
  const porte = classePorte(m.pop22);
  const grupo = porte == null ? [] : todos.filter((x) => x.regiao === m.regiao && classePorte(x.pop22) === porte && x.id !== m.id);
  const med = (f: (x: Municipio) => number | null) => mediana(grupo.map(f).filter((v): v is number => v != null));
  const mor = ficha.censo2022?.moradores;
  const ag = ficha.sinisa.agua;
  const es = ficha.sinisa.esgoto;
  const gm = ficha.gestao_municipal;
  const catalogo = prestadores();
  const vinculos = ficha.sinisa.prestadores ?? [];
  const pop24 = m.pop24;

  const linhas: Linha[] = [
    {
      rotulo: "Moradores sem ligação à rede geral de água",
      fonte: "Censo 2022",
      m: razaoPct(m.c22_ag_sem, m.pop22),
      uf: pctCenso(uf, (a) => a.censo2022.moradores?.agua.sem_ligacao),
      br: pctCenso(br, (a) => a.censo2022.moradores?.agua.sem_ligacao),
      pares: med((x) => razaoPct(x.c22_ag_sem, x.pop22)),
      unidade: "%",
      casas: 1,
    },
    {
      rotulo: "Moradores sem rede de esgoto nem fossa séptica",
      fonte: "Censo 2022",
      m: razaoPct(m.c22_es_precario != null && m.c22_es_sem_banheiro != null ? m.c22_es_precario + m.c22_es_sem_banheiro : null, m.pop22),
      uf: pctCenso(uf, (a) => a.censo2022.moradores?.esgoto.sem_rede_nem_septica),
      br: pctCenso(br, (a) => a.censo2022.moradores?.esgoto.sem_rede_nem_septica),
      pares: med((x) => razaoPct(x.c22_es_precario != null && x.c22_es_sem_banheiro != null ? x.c22_es_precario + x.c22_es_sem_banheiro : null, x.pop22)),
      unidade: "%",
      casas: 1,
    },
    {
      rotulo: "Atendimento da população com rede de água (IAG0001)",
      fonte: "SINISA 2024",
      m: m.IAG0001,
      uf: uf?.sinisa.agua.indicadores.IAG0001 ?? null,
      br: br?.sinisa.agua.indicadores.IAG0001 ?? null,
      pares: med((x) => x.IAG0001),
      unidade: "%",
      casas: 2,
      motivo: MOTIVO_TEXTO[ag.motivos?.IAG0001 ?? ""] ?? SITUACAO_AGUA[ag.situacao],
    },
    {
      rotulo: "Atendimento da população com rede de esgoto (IES0001)",
      fonte: "SINISA 2024",
      m: m.IES0001,
      uf: uf?.sinisa.esgoto.indicadores.IES0001 ?? null,
      br: br?.sinisa.esgoto.indicadores.IES0001 ?? null,
      pares: med((x) => x.IES0001),
      unidade: "%",
      casas: 2,
      motivo: MOTIVO_TEXTO[es.motivos?.IES0001 ?? ""] ?? SITUACAO_ESGOTO[es.situacao],
    },
    {
      rotulo: "Esgoto tratado sobre coletado (IES2004)",
      fonte: "SINISA 2024",
      m: m.IES2004,
      uf: uf?.sinisa.esgoto.indicadores.IES2004 ?? null,
      br: br?.sinisa.esgoto.indicadores.IES2004 ?? null,
      pares: med((x) => x.IES2004),
      unidade: "%",
      casas: 2,
      motivo: MOTIVO_TEXTO[es.motivos?.IES2004 ?? ""] ?? SITUACAO_ESGOTO[es.situacao],
    },
    {
      rotulo: "Perdas totais de água na distribuição (IAG2013)",
      fonte: "SINISA 2024",
      m: m.IAG2013,
      uf: uf?.sinisa.agua.indicadores.IAG2013 ?? null,
      br: br?.sinisa.agua.indicadores.IAG2013 ?? null,
      pares: med((x) => x.IAG2013),
      unidade: "%",
      casas: 2,
      motivo: MOTIVO_TEXTO[ag.motivos?.IAG2013 ?? ""] ?? SITUACAO_AGUA[ag.situacao],
    },
  ];

  const invAg = ag.investimento;
  const invEs = es.investimento;
  const tarifa = vinculos.find((v) => v.servico === "agua" && v.tarifa)?.tarifa;
  const comTarifa = prestadorComTarifa(m.id);

  return (
    <>
      <Cabecalho atual="municipio" />
      <MarcaVisita secao="saneamento:municipio" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <p className="text-sm">
          <Link href={`${ROTA}/municipio`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
            ← Buscar outro município
          </Link>
        </p>
        <header className="mb-8 border-b border-linha pb-8">
          <p className="rotulo text-obee-dark">Meu município · {uf?.nome ?? m.uf}</p>
          <h1 className="mt-3 font-serif text-[2.2rem] leading-tight text-carvao md:text-[3rem]">
            {m.nome} <span className="text-[0.6em] text-carvao-muted">({m.uf})</span>
          </h1>
          <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <div>
              <dt className="text-carvao-muted">Moradores, Censo 2022</dt>
              <dd className="tabular-nums text-carvao">{inteiro(m.pop22)}</dd>
            </div>
            <div>
              <dt className="text-carvao-muted">População estimada, 2024</dt>
              <dd className="tabular-nums text-carvao">{inteiro(pop24)}</dd>
            </div>
            <div>
              <dt className="text-carvao-muted">SINISA 2024, água</dt>
              <dd className="text-carvao">{SITUACAO_AGUA[ag.situacao]}</dd>
            </div>
            <div>
              <dt className="text-carvao-muted">SINISA 2024, esgoto</dt>
              <dd className="text-carvao">{SITUACAO_ESGOTO[es.situacao]}</dd>
            </div>
          </dl>
          <p className="mt-5 flex flex-wrap gap-x-6 text-sm">
            <Link href={`${ROTA}/comparar?m=${m.id}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
              Comparar com outros municípios
            </Link>
            <Link href={`${ROTA}/acesso?uf=${m.uf}&m=${m.id}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
              Ver no atlas
            </Link>
          </p>
        </header>

        <Secao id="comparacao" titulo="Como o município se compara?" texto={
          <>Cada linha tem sua fonte e seu ano. Pares: mediana dos municípios da mesma região com {porte != null ? ROTULO_PORTE[porte] : "porte semelhante"} ({inteiro(grupo.length)} municípios). A mediana dos pares não é meta nem referência de eficiência.</>
        }>
          <Comparacao linhas={linhas} uf={m.uf} pares={`${inteiro(grupo.length)} mun.`} />
        </Secao>

        <Secao id="agua-esgoto" titulo="Como os moradores recebem água e destinam o esgoto?" texto="Censo 2022, moradores em domicílios particulares permanentes ocupados.">
          {mor ? <Composicao f={ficha} /> : <Nota>O município não tem resultado no Censo 2022 (foi criado depois da coleta).</Nota>}
        </Secao>

        <Secao id="quem-presta" titulo="Quem presta o serviço e quem regula?" texto="Declarações dos prestadores (SINISA, Informações) e do município (SINISA, Gestão Municipal), referência 2024.">
          {vinculos.length === 0 ? (
            <Nota>Nenhum prestador declarou atuação no município ao SINISA 2024.</Nota>
          ) : (
            <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              {vinculos.map((v) => {
                const p = catalogo.find((x) => x.id === v.prestador);
                return (
                  <li key={v.servico + v.prestador} className="border-t border-linha py-4">
                    <p className="rotulo text-mineral">{v.servico === "agua" ? "Água" : "Esgoto"}</p>
                    <p className="mt-1 font-serif text-lg text-carvao">
                      {p && p.abrangencia !== "Local" ? (
                        <Link href={`${ROTA}/prestadores/${p.id}`} className="underline decoration-linha underline-offset-4 hover:decoration-obee">
                          {p.nome}
                        </Link>
                      ) : (
                        p?.nome
                      )}
                      {p?.sigla && <span className="text-base text-carvao-muted"> ({p.sigla})</span>}
                    </p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-carvao-muted">Natureza</dt>
                      <dd className="text-carvao">{NATUREZA_CURTA[p?.natureza ?? ""] ?? p?.natureza ?? "sem dado"}</dd>
                      <dt className="text-carvao-muted">Abrangência</dt>
                      <dd className="text-carvao">{p?.abrangencia ?? "sem dado"}</dd>
                      <dt className="text-carvao-muted">Forma</dt>
                      <dd className="text-carvao">{v.forma ?? "sem dado"}</dd>
                      <dt className="text-carvao-muted">Instrumento</dt>
                      <dd className="text-carvao">{v.instrumento ?? "sem dado"}</dd>
                      <dt className="text-carvao-muted">Vigência</dt>
                      <dd className="text-carvao">
                        {v.inicio ? data(v.inicio) : "início sem dado"} a {v.termino ? data(v.termino) : "término sem dado"}
                      </dd>
                      <dt className="text-carvao-muted">Atendidos</dt>
                      <dd className="tabular-nums text-carvao">{inteiro(v.populacao_atendida)} pessoas, declarado</dd>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
          <Reguladores f={ficha} />
          <Nota>
            Natureza jurídica e instrumento são os declarados ao SINISA para 2024. Controle societário e grupo econômico não são publicados
            pelo SINISA e não aparecem aqui.
          </Nota>
        </Secao>

        <Secao id="conta" titulo="Quanto custa e há tarifa social?" texto="O que o prestador declarou ao SINISA sobre tarifa mínima e tarifa social. A conta simulada só existe para tarifas verificadas em atos oficiais.">
          {comTarifa ? (
            <p className="mb-4 text-sm">
              <Link href={`${ROTA}/preco-regulado/simulador?t=${comTarifa}`} className="inline-flex min-h-[44px] items-center border border-obee px-4 font-medium text-obee-dark hover:bg-obee-fundo">
                Simular a conta com a tarifa verificada deste prestador
              </Link>
            </p>
          ) : (
            <Nota>A tarifa do prestador deste município ainda não está na amostra verificada do simulador.</Nota>
          )}
          {tarifa ? (
            <dl className="grid max-w-3xl grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-linha pt-4 text-sm">
              <dt className="text-carvao-muted">Cobra tarifa mínima de água?</dt>
              <dd className="text-carvao">{String(tarifa.GFI1008 ?? "sem dado")}</dd>
              <dt className="text-carvao-muted">Valor declarado da tarifa mínima residencial</dt>
              <dd className="tabular-nums text-carvao">{typeof tarifa.GFI1018 === "number" ? reais(tarifa.GFI1018) : "sem dado"}</dd>
              <dt className="text-carvao-muted">Tem tarifa social de água?</dt>
              <dd className="text-carvao">{String(tarifa.GFI1019 ?? "sem dado")}</dd>
              <dt className="text-carvao-muted">Norma que a regulamenta</dt>
              <dd className="text-carvao">{String(tarifa.GFI1021 ?? "sem dado")}</dd>
              <dt className="text-carvao-muted">Economias residenciais com tarifa social</dt>
              <dd className="tabular-nums text-carvao">{typeof tarifa.GFI1036 === "number" ? inteiro(tarifa.GFI1036) : "sem dado"}</dd>
              <dt className="text-carvao-muted">Valor médio declarado da tarifa social</dt>
              <dd className="tabular-nums text-carvao">{typeof tarifa.GFI1037 === "number" ? `${reais(tarifa.GFI1037)} por mês` : "sem dado"}</dd>
            </dl>
          ) : (
            <Nota>Sem declaração de tarifa no SINISA 2024 para este município.</Nota>
          )}
          <Nota>
            Valores declarados pelo prestador, sem verificação do Observatório. Economias com tarifa social não equivalem a famílias elegíveis:
            sem o número de elegíveis do CadÚnico no mesmo período, não se calcula cobertura do benefício.
          </Nota>
        </Secao>

        <Secao id="metas" titulo="A que distância está da meta e há plano?" texto="Metas do art. 11-B da Lei 11.445/2007 (99% com água e 90% com coleta e tratamento até 31/12/2033), aferidas pela NR ANA 8/2024 em domicílios.">
          <dl className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm md:grid-cols-3">
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">IAA da NR 8, parcela de rede pública</dt>
              <dd className="font-serif text-2xl tabular-nums text-carvao">{m.iaa_rede == null ? "sem dado" : `${numero(m.iaa_rede, 1)}%`}</dd>
              <dd className="text-xs text-carvao-muted">Meta: 99%. Economias residenciais ativas ÷ domicílios ocupados estimados ({inteiro(m.dom_est24)}).</dd>
            </div>
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">IAE da NR 8, parcela de rede com tratamento</dt>
              <dd className="font-serif text-2xl tabular-nums text-carvao">{m.iae_rede == null ? "sem dado" : `${numero(m.iae_rede, 1)}%`}</dd>
              <dd className="text-xs text-carvao-muted">Meta: 90%. Sem soluções individuais aceitas pelo regulador, que o SINISA não traz.</dd>
            </div>
            <div className="border-t border-linha pt-3">
              <dt className="text-carvao-muted">Plano de saneamento básico</dt>
              <dd className="text-carvao">
                {gm?.respondeu !== "Sim"
                  ? "Município não respondeu ao módulo Gestão Municipal"
                  : gm.plano?.existe === "Sim"
                    ? `Declarado${gm.plano.data ? `, aprovado em ${data(gm.plano.data)}` : ""}${gm.plano.instrumento ? ` (${gm.plano.instrumento.toLowerCase()})` : ""}`
                    : gm.plano?.existe === "Não"
                      ? `Não declarado${gm.plano.em_elaboracao === "Sim" ? "; em elaboração" : ""}`
                      : "sem dado"}
              </dd>
              {gm?.plano?.link && (
                <dd className="text-xs">
                  <a href={gm.plano.link} className="text-obee-dark underline underline-offset-2" rel="noopener noreferrer">
                    Endereço informado pelo município
                  </a>
                </dd>
              )}
            </div>
          </dl>
          <Nota>
            Os índices da NR 8 exigem também os indicadores de cobertura (ICA e ICE) para declarar meta cumprida. Aqui eles servem como
            referência; não atestam cumprimento. Plano declarado não equivale a plano atualizado, financiado ou executado.
          </Nota>
        </Secao>

        <Secao id="investimento" titulo="Quanto foi investido em 2024?" texto="Investimento declarado por prestadores e pelo Estado ao SINISA, em reais correntes de 2024.">
          <dl className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm md:grid-cols-2">
            {[["Água", invAg], ["Esgoto", invEs]].map(([rot, inv]) => {
              const i = inv as FichaMunicipio["sinisa"]["agua"]["investimento"];
              return (
                <div key={rot as string} className="border-t border-linha pt-3">
                  <dt className="text-carvao-muted">{rot as string}</dt>
                  <dd className="font-serif text-2xl tabular-nums text-carvao">{i?.total != null ? reaisCompacto(i.total) : "sem dado"}</dd>
                  <dd className="text-xs text-carvao-muted">
                    {i?.total != null && pop24 ? `${reais(i.total / pop24)} por residente estimado. ` : ""}
                    Prestador: {reaisCompacto(i?.prestador)}; Estado: {i?.estado_informado ? reaisCompacto(i?.estado) : "não informado"}.
                  </dd>
                </div>
              );
            })}
          </dl>
          <Nota>
            Investimento declarado não identifica obras nem prova entrada em operação. Por residente é razão descritiva sobre a população
            estimada, não custo de atender quem falta.
          </Nota>
        </Secao>

        <Secao id="continuidade" titulo="A água chega sem interrupção?" texto="Paralisações e interrupções sistemáticas declaradas pelo prestador ao SINISA 2024.">
          {ag.tecnica ? (
            <dl className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm md:grid-cols-3">
              <div className="border-t border-linha pt-3">
                <dt className="text-carvao-muted">Paralisações com falta de água</dt>
                <dd className="font-serif text-2xl tabular-nums text-carvao">{inteiro(ag.tecnica.GTA3001)}</dd>
                <dd className="text-xs text-carvao-muted">Duração média: {ag.indicadores?.IAG3004 != null ? `${numero(ag.indicadores.IAG3004, 1)} horas` : "sem dado"}.</dd>
              </div>
              <div className="border-t border-linha pt-3">
                <dt className="text-carvao-muted">Interrupções sistemáticas (racionamento ou rodízio)</dt>
                <dd className="font-serif text-2xl tabular-nums text-carvao">{inteiro(ag.tecnica.GTA3003)}</dd>
                <dd className="text-xs text-carvao-muted">Motivo principal declarado: {ag.motivo_interrupcoes ?? "sem dado"}.</dd>
              </div>
              <div className="border-t border-linha pt-3">
                <dt className="text-carvao-muted">Dias com sistema em colapso</dt>
                <dd className="font-serif text-2xl tabular-nums text-carvao">{ag.tecnica.GTA3006 == null ? "sem dado" : inteiro(ag.tecnica.GTA3006)}</dd>
              </div>
            </dl>
          ) : (
            <Nota>Sem declaração de continuidade: o município não participou do módulo de água do SINISA 2024.</Nota>
          )}
          <Nota>Registro declarado pelo prestador. Ausência de registro não prova fornecimento contínuo, e o SINISA não mede qualidade da água.</Nota>
        </Secao>

        <Fonte>
          IBGE, Censo 2022 e estimativa 2024; Ministério das Cidades, SINISA 2025 (ano de referência 2024), base municipal
          {ag.linha?.tecnica ? `, linha ${ag.linha.tecnica} da planilha técnica de água` : ""}
          {es.linha?.tecnica ? ` e ${es.linha.tecnica} da de esgoto` : ""}
          {gm ? `; Gestão Municipal, linha ${gm.linha}` : ""}.
        </Fonte>
      </main>
    </>
  );
}

function Composicao({ f }: { f: FichaMunicipio }) {
  const a = f.censo2022!.moradores!.agua;
  const e = f.censo2022!.moradores!.esgoto;
  const linhasAgua: [string, number | null][] = [
    ["Rede geral como forma principal", a.rede],
    ["Ligado à rede, mas usa outra forma", a.lig_outra],
    ["Sem ligação: poço profundo ou artesiano", a.sem_ligacao_fontes?.poco_profundo ?? null],
    ["Sem ligação: poço raso ou cacimba", a.sem_ligacao_fontes?.poco_raso ?? null],
    ["Sem ligação: fonte, nascente ou mina", a.sem_ligacao_fontes?.nascente ?? null],
    ["Sem ligação: carro-pipa", a.sem_ligacao_fontes?.carro_pipa ?? null],
    ["Sem ligação: água da chuva", a.sem_ligacao_fontes?.chuva ?? null],
    ["Sem ligação: rios, açudes, lagos", a.sem_ligacao_fontes?.rio ?? null],
    ["Sem ligação: outra", a.sem_ligacao_fontes?.outra ?? null],
  ];
  const linhasEsgoto: [string, number | null][] = [
    ["Rede geral ou pluvial", e.rede_pluvial],
    ["Fossa séptica ligada à rede", e.fossa_ligada],
    ["Fossa séptica não ligada à rede", e.septica],
    ["Fossa rudimentar ou buraco", e.rudimentar],
    ["Vala", e.vala],
    ["Rio, lago, córrego ou mar", e.corpo_dagua],
    ["Outra forma", e.outra],
    ["Sem banheiro nem sanitário", e.sem_banheiro],
  ];
  const Tab = ({ titulo, linhas, total }: { titulo: string; linhas: [string, number | null][]; total: number | null }) => (
    <table className="w-full border-collapse text-sm">
      <caption className="pb-2 text-left font-medium text-carvao">{titulo}</caption>
      <thead>
        <tr className="border-b border-carvao text-left">
          <th scope="col" className="py-1.5 pr-3 font-medium">Forma</th>
          <th scope="col" className="py-1.5 pr-3 text-right font-medium">Moradores</th>
          <th scope="col" className="py-1.5 text-right font-medium">%</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(([r, v]) => (
          <tr key={r} className="border-b border-linha">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">{r}</th>
            <td className="py-1.5 pr-3 text-right tabular-nums">{inteiro(v)}</td>
            <td className="py-1.5 text-right tabular-nums text-carvao-muted">{numero(razaoPct(v, total), 1)}</td>
          </tr>
        ))}
        <tr>
          <th scope="row" className="py-1.5 pr-3 text-left font-medium text-carvao">Total</th>
          <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{inteiro(total)}</td>
          <td className="py-1.5 text-right tabular-nums text-carvao-muted">100,0</td>
        </tr>
      </tbody>
    </table>
  );
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <Tab titulo="Abastecimento de água" linhas={linhasAgua} total={a.total} />
      <Tab titulo="Esgotamento sanitário" linhas={linhasEsgoto} total={e.total} />
    </div>
  );
}

function Reguladores({ f }: { f: FichaMunicipio }) {
  const gm = f.gestao_municipal;
  if (!gm || gm.respondeu !== "Sim") {
    return <Nota>O município não respondeu ao módulo Gestão Municipal do SINISA 2024; a entidade reguladora não está declarada.</Nota>;
  }
  const lista = (s: "agua" | "esgoto") => (gm.reguladores?.[s] ?? []).filter((r) => r.existe === "Sim");
  return (
    <dl className="mt-6 grid grid-cols-1 gap-x-10 gap-y-3 border-t border-carvao pt-4 text-sm md:grid-cols-2">
      {(["agua", "esgoto"] as const).map((s) => (
        <div key={s}>
          <dt className="rotulo text-mineral">Regulador declarado · {s === "agua" ? "água" : "esgoto"}</dt>
          <dd className="mt-1 text-carvao">
            {lista(s).length
              ? lista(s).map((r) => `${r.nome ?? "sem nome"}${r.sigla ? ` (${r.sigla})` : ""}${r.abrangencia ? `, ${r.abrangencia.toLowerCase()}` : ""}`).join("; ")
              : gm.regulacao_declarada?.[s] === "Não"
                ? "O município declarou não haver entidade reguladora"
                : "sem dado"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
