import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Fonte, Numeros } from "@/components/saneamento/Editorial";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { Footer } from "@/components/layout/Footer";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { fichaMunicipio, meta, municipio, prestadores } from "@/lib/saneamento/gold";
import { CAPITULOS, EIXOS, ROTA } from "@/lib/saneamento/capitulos";
import { data, inteiro, mesAno, numero } from "@/lib/saneamento/formato";
import { ANOS_SISAGUA, FONTE_ROTULO, medida } from "@/lib/saneamento/medidas";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { ATENDIMENTO_REDE, CASAS_ATENDIMENTO, atendimentoRede } from "@/lib/saneamento/atendimento";
import { periodoPorExtenso, resumoDivida } from "@/lib/saneamento/divida";
import type { FichaMunicipio, Municipio } from "@/lib/saneamento/tipos";
import { BuscaAperitivo } from "./BuscaAperitivo";

/**
 * Versão aperitivo do Saneamento (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa
 * /saneamento/municipio sem sessão recebe esta página por rewrite do middleware; quem tem conta recebe a busca e a
 * ficha completas. Responde a uma pergunta só: como está o saneamento na minha cidade. Com ?ibge= de um município da
 * base, mostra o atendimento por rede de água e de esgoto (IAG0001 e IES0001), o prestador declarado, o ano, a fonte,
 * a captura e a ressalva de leitura; tudo o mais fica com a conta (ConviteAperitivo).
 *
 * Renderização no servidor a cada requisição (lê searchParams): o servidor lê a mesma gold da ficha completa
 * (municipios.json, a ficha da UF, prestadores.json e meta.json, com as mesmas funções) e o HTML leva só os poucos
 * valores do município pedido. Nenhum arquivo novo é publicado e o navegador só baixa o índice da busca, já aberto.
 */
export const dynamic = "force-dynamic";

const ROTA_PUBLICA = `${ROTA}/municipio`;

type Busca = { searchParams: Record<string, string | string[] | undefined> };

type Consulta =
  | { estado: "vazia" }
  | { estado: "invalida"; codigo: string | null }
  | { estado: "ok"; m: Municipio; ficha: FichaMunicipio };

/** Só o código IBGE de sete dígitos de um município com ficha na gold; o resto é consulta inválida, nunca um palpite. */
function consultar(ibge: string | string[] | undefined): Consulta {
  const valor = (Array.isArray(ibge) ? ibge[0] : ibge)?.trim() ?? "";
  if (valor === "") return { estado: "vazia" };
  if (!/^\d{7}$/.test(valor)) return { estado: "invalida", codigo: null };
  const m = municipio(valor);
  const ficha = m ? fichaMunicipio(m.id) : null;
  if (!m || !ficha) return { estado: "invalida", codigo: valor };
  return { estado: "ok", m, ficha };
}

export function generateMetadata({ searchParams }: Busca): Metadata {
  const c = consultar(searchParams.ibge);
  return {
    title: c.estado === "ok" ? `${c.m.nome} (${c.m.uf}): água, esgoto e prestador · Saneamento` : "Meu município: água, esgoto e prestador · Saneamento",
    description: "Busque o município pelo nome e veja quanto da população a rede de água e a rede de esgoto atendem e quem presta o serviço, com fonte e ano de referência.",
    alternates: { canonical: ROTA_PUBLICA },
  };
}

/**
 * O que a conta acrescenta (regra do dono de 20/10/2026: a página aberta mostra tudo o que mais existe com conta), seção
 * por seção da ficha completa (src/app/saneamento/municipio/[id]/page.tsx) e depois as ferramentas e os capítulos do
 * observatório. Cada dimensão vem do próprio dado (meta.json, registro de capítulos, catálogo de tarifas e de prestadores);
 * capítulo em preparação não entra na contagem.
 */
function comConta(): string[] {
  const mt = meta();
  const cob = mt?.cobertura;
  const capitulos = CAPITULOS.filter((c) => c.situacao !== "em_preparacao");
  const regionais = prestadores().filter((p) => p.abrangencia === "Regional").length;
  const ano = mt?.sinisa.ano_referencia ?? "sem dado";
  return [
    `Ficha completa do município, seção 1, comparação: o município ao lado da UF, do Brasil e da mediana dos municípios de porte semelhante da mesma região, em falta de água encanada e de esgoto, atendimento, esgoto tratado e perdas de água`,
    `Seção 2, acesso: quantas pessoas o prestador declara atender com rede de água e com rede coletora de esgoto, e como os moradores recebem água e destinam o esgoto pelo Censo 2022, forma por forma (rede, poço, nascente, água da chuva, fossa, vala e outras), para ${inteiro(cob?.municipios_censo_2022)} municípios`,
    `Seção 3, prestador e regulador: natureza jurídica, contrato, vigência e população atendida de cada prestador, e a agência reguladora que o município declara (${inteiro(cob?.gestao_municipal_respondentes)} municípios responderam)`,
    `Seção 4, tarifa e tarifa social: tarifa mínima declarada pelo prestador, se há tarifa social e quantas unidades de consumo têm o desconto, ao lado das famílias de baixa renda do CadÚnico (${mesAno(mt?.cadunico.mes_referencia)} e ${mesAno(mt?.cadunico.mes_mais_recente)})`,
    `Seção 5, metas e plano: a distância das metas legais de ${numero(mt?.metas.agua, 0)}% com água e ${numero(mt?.metas.esgoto, 0)}% com coleta e tratamento até ${data(mt?.metas.data)}, e se o município tem plano de saneamento`,
    `Seção 6, investimento: quanto o prestador declarou ao SINISA ter investido em ${ano} em água e em esgoto, inclusive o que informa como investido pelo governo estadual, e o valor por residente estimado, com a ressalva de que é autodeclarado, sem conferência com demonstrações financeiras auditadas`,
    `Seção 7, continuidade: paralisações com falta de água, racionamento ou rodízio e dias com o sistema em colapso, declarados para ${ano}`,
    `Seção 8, qualidade da água: análises do SISAGUA em ${ANOS_SISAGUA.join(" e ")} (bactérias, cloro, turbidez, flúor, agrotóxicos e outras substâncias), pelo controle do prestador e pela vigilância da saúde`,
    `Simulador da conta de água: quanto se paga pelo mesmo consumo em ${inteiro(TARIFAS.length)} tabelas tarifárias conferidas nos atos oficiais`,
    `Comparação de até quatro municípios lado a lado e mapas por município, para os ${inteiro(cob?.municipios_ibge)} municípios`,
    `Fichas dos ${inteiro(regionais)} prestadores regionais, com volumes, perdas, consumo médio por pessoa e os valores financeiros que eles declaram ao SINISA, com a mesma ressalva`,
    ...dividaComConta(),
    `Os ${inteiro(capitulos.length)} capítulos do observatório, em ${inteiro(EIXOS.length)} eixos: ${EIXOS.map((e) => e.rotulo.toLowerCase()).join("; ")}`,
  ];
}

/** Capítulo 7.1 (dívida dos prestadores), dimensionado pelo resumo da própria publicação; sem a publicação, não entra. */
function dividaComConta(): string[] {
  const r = resumoDivida();
  if (!r || !r.companhias || !r.primeiro_ano) return [];
  return [
    `Dívida e alavancagem das ${inteiro(r.companhias)} companhias de água e esgoto com demonstrações financeiras na CVM (${inteiro(r.operadoras)} prestadoras e ${inteiro(r.holdings)} holdings de grupo): dívida bruta e líquida, dívida sobre o EBITDA, o que vence em até 12 meses, série anual desde ${r.primeiro_ano} e fotografia do ${periodoPorExtenso(trimestreDe(r.referencia_trimestral))}`,
  ];
}

const trimestreDe = (d: string | null) => (d ? `${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}T${d.slice(0, 4)}` : null);

export default function Pagina({ searchParams }: Busca) {
  const c = consultar(searchParams.ibge);
  const cobertura = meta()?.cobertura.municipios_ibge;
  return (
    <div className="dominio-energia dominio-saneamento flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-obee focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">
        <Cabecalho atual="municipio" />
        <MarcaVisita secao="saneamento:municipio-aperitivo" />
        <main id="conteudo" className="ed-pagina pb-16 pt-8" data-aperitivo="saneamento">
          <header className="mb-8 border-b border-linha pb-6">
            <p className="rotulo text-obee-dark">Observatório Brasileiro do Saneamento · Meu município</p>
            <h1 className="mt-3 max-w-4xl font-serif text-[2rem] leading-tight text-carvao [text-wrap:balance] md:text-[2.75rem]">
              Como está o saneamento na minha cidade?
            </h1>
            <p className="mt-4 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              Busque o município pelo nome e veja quanto da população a rede de água e a rede de esgoto atendem e quem presta o serviço.
            </p>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao">
              <span className="rotulo mr-2 text-mineral">Recorte</span>
              {inteiro(cobertura)} municípios no índice do IBGE; declarações dos prestadores ao SINISA, ano de referência{" "}
              {meta()?.sinisa.ano_referencia ?? "sem dado"}.
            </p>
          </header>

          {c.estado === "ok" ? (
            <>
              <Resultado m={c.m} ficha={c.ficha} />
              <div className="mt-12 border-t border-linha pt-8">
                <BuscaAperitivo rotulo="Buscar outro município" />
              </div>
            </>
          ) : (
            <>
              {c.estado === "invalida" && (
                <p role="status" className="mb-6 max-w-prose2 border-l-2 border-aviso pl-4 text-sm leading-relaxed text-carvao">
                  {c.codigo
                    ? `Nenhum município da base tem o código IBGE ${c.codigo}. Busque pelo nome abaixo.`
                    : "O endereço não traz um código IBGE de município, que tem sete dígitos. Busque pelo nome abaixo."}
                </p>
              )}
              <BuscaAperitivo rotulo="Digite o nome do município" />
            </>
          )}

          {/* a volta do login leva o código: com sessão, /saneamento/municipio?ibge= vai à ficha completa (middleware) */}
          <ConviteAperitivo rota={c.estado === "ok" ? `${ROTA_PUBLICA}?ibge=${c.m.id}` : ROTA_PUBLICA} comConta={comConta()} className="mt-14" />
        </main>
      </div>
      <Footer compacto />
    </div>
  );
}

function Resultado({ m, ficha }: { m: Municipio; ficha: FichaMunicipio }) {
  // mesmos valores, rótulos, casas e motivos de ausência que a ficha completa (src/lib/saneamento/atendimento.ts)
  const agua = atendimentoRede(m, ficha, "agua");
  const esgoto = atendimentoRede(m, ficha, "esgoto");
  const medAgua = medida(ATENDIMENTO_REDE.agua.medida);
  const medEsgoto = medida(ATENDIMENTO_REDE.esgoto.medida);
  const s = meta()?.sinisa;
  const catalogo = prestadores();
  const vinculos = ficha.sinisa.prestadores ?? [];
  const nomes = (servico: "agua" | "esgoto") => [
    ...new Set(
      vinculos
        .filter((v) => v.servico === servico)
        .map((v) => {
          const p = catalogo.find((x) => x.id === v.prestador);
          return p?.nome ? `${p.nome}${p.sigla ? ` (${p.sigla})` : ""}` : "nome sem dado no catálogo do SINISA";
        }),
    ),
  ];

  return (
    <section aria-labelledby="resultado-titulo" data-resultado-aperitivo="">
      <p className="rotulo text-mineral">Resultado da consulta · código IBGE {m.id}</p>
      <h2 id="resultado-titulo" className="mt-2 font-serif text-[1.75rem] leading-tight text-carvao md:text-[2.25rem]">
        {m.nome} <span className="text-[0.65em] text-carvao-muted">({m.uf})</span>
      </h2>

      <div className="mt-6">
        <Numeros
          colunas={2}
          itens={[
            {
              rotulo: ATENDIMENTO_REDE.agua.rotulo,
              valor: numero(agua.pct, CASAS_ATENDIMENTO),
              unidade: agua.pct == null ? undefined : "%",
              contexto: agua.pct == null ? agua.motivo : ATENDIMENTO_REDE.agua.contexto,
            },
            {
              rotulo: ATENDIMENTO_REDE.esgoto.rotulo,
              valor: numero(esgoto.pct, CASAS_ATENDIMENTO),
              unidade: esgoto.pct == null ? undefined : "%",
              contexto: esgoto.pct == null ? esgoto.motivo : ATENDIMENTO_REDE.esgoto.contexto,
            },
          ]}
        />
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
        {(["agua", "esgoto"] as const).map((servico) => {
          const lista = nomes(servico);
          return (
            <div key={servico} className="min-w-0">
              <dt className="text-carvao-muted">Quem presta o serviço de {servico === "agua" ? "água" : "esgoto"}</dt>
              <dd className="mt-1 font-serif text-lg leading-snug text-carvao">
                {lista.length ? lista.join("; ") : <span className="font-sans text-sm text-carvao-muted">Nenhum prestador declarou atuação ao SINISA</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      <aside aria-label="Como ler estes números" className="mt-8 max-w-4xl border-l-2 border-obee pl-4 text-sm leading-relaxed">
        <p className="rotulo text-mineral">Não permite concluir</p>
        <ul className="mt-1 space-y-1.5 text-carvao">
          <li>
            <span className="font-medium">Água.</span> {medAgua.naoPermite}
          </li>
          <li>
            <span className="font-medium">Esgoto.</span> {medEsgoto.naoPermite}
          </li>
        </ul>
      </aside>

      <dl className="mt-6 grid max-w-prose2 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs leading-relaxed text-carvao-muted">
        <dt className="rotulo text-mineral">Ano</dt>
        <dd>Referência {s?.ano_referencia ?? "sem dado"}</dd>
        <dt className="rotulo text-mineral">Captura</dt>
        <dd>{data(s?.capturado_em)}</dd>
      </dl>
      <Fonte metodo={false}>
        {FONTE_ROTULO[medAgua.fonte]}, base municipal publicada em {data(s?.publicacao)}; a de água foi retificada em{" "}
        {data(s?.retificacao_agua_municipal)}. Prestadores declarados ao SINISA, módulo Informações.
      </Fonte>
    </section>
  );
}
