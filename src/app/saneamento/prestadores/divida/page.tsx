import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, Indisponivel, NestaPagina, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { LabAlavancagem, SerieDivida, type Preset, type SerieCompanhia } from "@/components/saneamento/Divida";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { controleSocietario } from "@/lib/saneamento/gold";
import { data, inteiro, numero, SEM_DADO } from "@/lib/saneamento/formato";
import { logosSaneamento, soDigitos } from "@/lib/saneamento/logos";
import {
  comPonto,
  fotografia,
  goldDivida,
  milhoes,
  periodoPorExtenso,
  reaisDeMil,
  ROTULO_ESCOPO,
  ROTULO_PAPEL,
  URL_DIVIDA,
  vezes,
  type CompanhiaDivida,
  type GoldDivida,
  type PontoDivida,
} from "@/lib/saneamento/divida";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quanto devem as empresas de água e esgoto?",
  description:
    "Dívida bruta e líquida, dívida sobre o EBITDA e sobre o patrimônio, parte que vence em até 12 meses e cobertura das despesas financeiras das prestadoras de água e esgoto com demonstrações na CVM, desde 2010.",
  alternates: { canonical: `${ROTA}/prestadores/divida` },
};

/** Escala do gráfico de barras da alavancagem: valores acima aparecem cortados, com o número escrito. */
const ESCALA_BARRAS = 15;

const NOMES_INDICADOR: Record<string, string> = {
  ebitda: "EBITDA",
  dl_ebitda: "dívida líquida sobre EBITDA",
  dl_pl: "dívida líquida sobre patrimônio líquido",
  parcela_cp: "parte que vence em até 12 meses",
  cobertura: "cobertura das despesas financeiras",
};

/** Símbolo oficial pelo CNPJ (manifesto em public/saneamento/logos); sem arquivo, o nome em texto ao lado basta. */
type Logos = ReturnType<typeof logosSaneamento>;
const logoDe = (logos: Logos, cnpj: string) => logos.get(soDigitos(cnpj)) ?? null;

const mi = (v: number | null | undefined) => {
  const m = milhoes(v);
  return m == null ? SEM_DADO : numero(m, 0).replace(/^-/, "−");
};

export default function Pagina() {
  const cap = capituloPorSlug("prestadores")!;
  const sub = cap.subpaineis!.find((s) => s.slug === "divida")!;
  const g = goldDivida();
  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:divida" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        {g ? (
          <Conteudo g={g} pergunta={sub.pergunta} situacao={sub.situacao} pendencia={sub.pendencia} />
        ) : (
          <>
            <Abertura capitulo={7} rotuloExtra={`${sub.numero} ${sub.rotulo}`} titulo={sub.pergunta} texto={<p>Dados indisponíveis nesta publicação.</p>} recorte="sem dado" />
            <Indisponivel titulo="A publicação da dívida dos prestadores não está disponível">
              O arquivo public/saneamento/divida/divida.json não foi encontrado. Nenhum número é mostrado no lugar.
            </Indisponivel>
          </>
        )}
      </main>
    </>
  );
}

function Conteudo({ g, pergunta, situacao, pendencia }: { g: GoldDivida; pergunta: string; situacao: "publicado" | "parcial" | "em_preparacao"; pendencia?: string }) {
  const lista = comPonto(g);
  const operadoras = lista.filter((c) => c.papel === "operadora");
  const holdings = lista.filter((c) => c.papel === "holding");
  const f = fotografia(g);
  const periodoRef = f.operadoras[0]?.ultimo?.periodo ?? null;
  const primeiroAno = lista.flatMap((c) => c.anual.filter((p) => !p.retido).map((p) => p.periodo)).sort()[0];
  const fichas = new Map(controleSocietario().filter((c) => c.prestador).map((c) => [c.cnpj, c.prestador!]));
  const fora = lista.filter((c) => c.ultimo!.data !== g.referencia_trimestral);
  const logos = logosSaneamento();

  const presets: Preset[] = [...operadoras, ...holdings]
    .filter((c) => c.ultimo!.ebitda != null && c.ultimo!.ebitda > 0 && c.ultimo!.divida_liquida != null && c.ultimo!.data === g.referencia_trimestral)
    .map((c) => ({ id: c.cnpj, nome: c.nome, periodo: periodoPorExtenso(c.ultimo!.periodo), ebitda: c.ultimo!.ebitda! / 1e6, dl: c.ultimo!.divida_liquida! / 1e6 }));

  const series: SerieCompanhia[] = [...operadoras, ...holdings].map((c) => ({
    id: c.cnpj,
    nome: c.nome,
    papel: ROTULO_PAPEL[c.papel],
    anual: c.anual.map((p) => pontoSerie(p, p.periodo)),
    trimestral: c.trimestral.map((p) => pontoSerie(p, p.data)),
    notas: notasDaSerie(c),
  }));

  return (
    <>
      <Abertura
        capitulo={7}
        rotuloExtra="7.1 Dívida e alavancagem"
        titulo={pergunta}
        texto={
          <p>
            Para levar água e esgoto a mais gente, as prestadoras fazem obras que se pagam em décadas, e boa parte delas é financiada com
            empréstimos e debêntures. Aqui está quanto devem as companhias que entregam demonstrações financeiras à CVM, quanto essa dívida pesa
            diante do que a operação gera de caixa e quanto dela vence nos próximos 12 meses. Os números vêm das demonstrações revisadas por auditor
            (trimestrais) e auditadas (anuais), não dos dados financeiros declarados ao SINISA.
          </p>
        }
        recorte={
          <>
            {inteiro(lista.length)} companhias: {inteiro(operadoras.length)} prestadoras declaradas por municípios no SINISA 2024 e{" "}
            {inteiro(holdings.length)} holdings de grupo que as controlam. Demonstração consolidada; fotografia de {data(g.referencia_trimestral)} e série
            anual desde {primeiroAno}. Valores nominais, em reais de cada data.
          </>
        }
        situacao={situacao}
        pendencia={pendencia}
      />

      <NestaPagina
        itens={[
          { id: "mecanismo", rotulo: "Por que importa" },
          { id: "fotografia", rotulo: "Quanto cada uma deve" },
          { id: "serie", rotulo: "Desde 2010" },
          { id: "lacunas", rotulo: "O que não está aqui" },
          { id: "metodo", rotulo: "Método e arquivos" },
        ]}
      />

      <Numeros
        colunas={4}
        itens={[
          {
            rotulo: "Companhias com demonstrações na CVM",
            valor: inteiro(lista.length),
            contexto: (
              <>
                {inteiro(operadoras.length)} prestadoras e {inteiro(holdings.length)} holdings; série anual desde {primeiroAno} (DFP) e trimestral desde{" "}
                {g.fontes.itr.primeiro_ano} (ITR).
              </>
            ),
          },
          {
            rotulo: `Dívida bruta das prestadoras, ${periodoPorExtenso(periodoRef)}`,
            valor: reaisDeMil(f.dividaBruta),
            contexto: (
              <>
                Soma das {inteiro(f.operadoras.length)} prestadoras com ITR em {data(f.referencia)}. As holdings ficam fora da soma porque já incluem
                prestadoras da lista.
              </>
            ),
          },
          {
            rotulo: "Mediana da dívida líquida sobre o EBITDA das prestadoras",
            valor: vezes(f.medianaDlEbitda),
            contexto: (
              <>
                Entre as {inteiro(f.comRazao)} prestadoras com EBITDA positivo nos 12 meses até {data(f.referencia)}
                {f.semRazao.length ? `; sem leitura para ${f.semRazao.map((c) => c.nome).join(", ")}` : ""}.
              </>
            ),
          },
          {
            rotulo: "Parte da dívida das prestadoras que vence em até 12 meses",
            valor: `${numero(f.parcelaCp, 1)}%`,
            contexto: <>Dívida no passivo circulante sobre a dívida bruta somada, em {data(f.referencia)}.</>,
          },
        ]}
      />

      <Secao
        id="mecanismo"
        titulo="Por que a dívida pesa na hora de investir e disputar contratos?"
        texto={
          <>
            <p>
              Dívida não é, por si, sinal de problema: é assim que se paga hoje uma obra que vai gerar receita por décadas. O que importa é o tamanho
              dela diante do que a operação gera. A medida mais usada é a dívida líquida (o que se deve menos o que se tem em caixa) dividida pelo
              EBITDA (o resultado da operação antes de juros, impostos, depreciação e amortização). Uma razão de 3 vezes quer dizer que, se todo o
              EBITDA fosse usado para isso, a dívida líquida levaria cerca de três anos para ser paga.
            </p>
            <p className="mt-3">
              Contratos de financiamento e escrituras de debêntures costumam fixar um limite para essa razão. Num leilão de concessão, quem vence paga
              a outorga e assume o investimento dos primeiros anos, em boa parte com dívida nova. Quem já está perto do limite tem menos espaço para
              dar lances e investir sem trazer capital de sócios.
            </p>
          </>
        }
      >
        {presets.length > 0 ? (
          <LabAlavancagem presets={presets} />
        ) : (
          <Indisponivel titulo="Laboratório sem ponto de partida">Nenhuma companhia tem EBITDA positivo e dívida líquida na data de referência.</Indisponivel>
        )}
      </Secao>

      <Secao
        id="fotografia"
        titulo={`Quanto cada companhia deve no ${periodoPorExtenso(periodoRef)}?`}
        texto={
          <>
            Dívida líquida sobre o EBITDA dos 12 meses até {data(g.referencia_trimestral)}, em vezes. Prestadoras e holdings separadas: a holding consolida as
            prestadoras que controla, então as duas linhas nunca se somam.
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-12 gap-y-8 xl:grid-cols-2">
          <BarrasAlavancagem titulo="Prestadoras" companhias={operadoras} logos={logos} />
          <BarrasAlavancagem titulo="Holdings de grupo" companhias={holdings} logos={logos} />
        </div>
        <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          Escala até {inteiro(ESCALA_BARRAS)} vezes; acima disso a barra aparece cortada, com o valor escrito. Sem leitura quando o EBITDA dos 12 meses é
          negativo ou nulo.
        </p>

        <h3 className="mt-10 font-serif text-xl text-carvao">Todas as medidas, companhia por companhia</h3>
        <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">Valores em R$ milhões; razões em vezes. Na tela estreita a tabela rola de lado, com o nome fixo.</p>
        <TabelaFotografia operadoras={operadoras} holdings={holdings} fichas={fichas} logos={logos} />
        <NotasDaTabela companhias={[...operadoras, ...holdings]} />
        {fora.length > 0 && (
          <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
            Com período anterior a {data(g.referencia_trimestral)}:{" "}
            {fora
              .map((c) => `${c.nome} (${periodoPorExtenso(c.ultimo!.periodo)}${c.registro.cancelado_em ? `, registro na CVM cancelado em ${data(c.registro.cancelado_em)}` : ""})`)
              .join("; ")}
            .
          </p>
        )}
        <Ressalva
          permite="Comparar o peso da dívida de cada companhia diante da geração de caixa da operação e do patrimônio, e quanto vence no próximo ano."
          naoPermite="Concluir que uma companhia vai ou não pagar o que deve, nem se cumpre os limites dos próprios contratos: cada contrato define dívida e EBITDA à sua maneira. Também não permite somar holding e prestadora controlada."
        />
        <Fonte>
          CVM, dados abertos: ITR de {data(g.referencia_trimestral)} e DFP de {g.ultima_dfp?.slice(0, 4)}, demonstração consolidada (individual quando a companhia
          não tem controladas a consolidar). Capturado em {data(g.capturado_em)}.
        </Fonte>
      </Secao>

      <Secao
        id="serie"
        titulo={`Como a dívida de cada companhia evoluiu desde ${primeiroAno}?`}
        texto="Escolha a companhia e a medida. Na série anual, cada ponto é o fim do ano (DFP); na trimestral, o fim de cada trimestre (ITR), com o EBITDA dos 12 meses anteriores. Ponto ausente é demonstração ausente ou inconsistente, nunca zero."
      >
        <SerieDivida companhias={series} />
        <Fonte>CVM, dados abertos, DFP desde {g.fontes.dfp.primeiro_ano} e ITR desde {g.fontes.itr.primeiro_ano}. Valores nominais.</Fonte>
      </Secao>

      <Secao id="lacunas" titulo="O que estes números não mostram">
        <ul className="max-w-prose2 space-y-3 text-[0.95rem] leading-relaxed text-carvao">
          <li>
            <span className="font-medium">Prazo médio da dívida (duration) e cronograma de vencimentos.</span> O ano a ano dos pagamentos está só nas notas
            explicativas, em texto, sem base estruturada na CVM. Esta página mostra apenas a divisão entre o que vence em até 12 meses e o que vence
            depois, e não estima prazo médio.
          </li>
          <li>
            <span className="font-medium">Custo e indexador.</span> Quanto da dívida segue CDI, IPCA ou moeda estrangeira, e a que taxa, também só nas notas
            explicativas.
          </li>
          <li>
            <span className="font-medium">Limites contratuais (covenants) e o seu cumprimento.</span> Cada contrato tem o seu limite e a sua definição; nenhum é
            estimado aqui.
          </li>
          <li>
            <span className="font-medium">Arrendamentos.</span> A dívida bruta é empréstimos, financiamentos e debêntures; o financiamento por arrendamento
            fica fora e aparece à parte nos arquivos quando a companhia o separa.
          </li>
          <li>
            <span className="font-medium">EBITDA ajustado.</span> O EBITDA daqui é o das demonstrações, sem tirar ganhos e perdas que não se repetem; pode
            diferir do que as companhias divulgam aos investidores.
          </li>
          <li>
            <span className="font-medium">Quem não tem registro na CVM.</span> Prestadoras privadas sem registro, autarquias e departamentos municipais não
            entregam essas demonstrações e não estão aqui.
          </li>
        </ul>
      </Secao>

      <Secao id="metodo" titulo="Método, fontes e arquivos">
        <Metodo g={g} lista={lista} logos={logos} />
      </Secao>
    </>
  );
}

/** Ponto da série para o navegador, arredondado uma casa além do que o gráfico mostra (o valor exato está nos arquivos). */
function pontoSerie(p: PontoDivida, chave: string) {
  const r = (v: number | null, casas: number) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas);
  return {
    x: chave,
    dl_ebitda: r(p.dl_ebitda, 2),
    dl_pl: r(p.dl_pl, 3),
    parcela_cp: r(p.parcela_cp, 2),
    divida_bruta: r(p.divida_bruta == null ? null : p.divida_bruta / 1e6, 2),
    caixa: r(p.caixa == null ? null : p.caixa / 1e6, 2),
    divida_liquida: r(p.divida_liquida == null ? null : p.divida_liquida / 1e6, 2),
  };
}

/** Notas da série da companhia: mudança de demonstração, pontos fora da série e linhas sem abertura. */
function notasDaSerie(c: CompanhiaDivida): string[] {
  const notas: string[] = [];
  const validos = c.anual.filter((p) => !p.retido);
  const escopos = [...new Set(validos.map((p) => p.escopo))];
  if (escopos.length > 1) {
    const ind = validos.filter((p) => p.escopo === "ind").map((p) => p.periodo);
    notas.push(`Demonstração individual em ${ind.join(", ")}, anos em que a companhia não publicou consolidada; consolidada nos demais.`);
  }
  for (const p of [...c.anual, ...c.trimestral.filter((q) => q.fonte === "ITR")].filter((q) => q.retido)) {
    notas.push(`${periodoPorExtenso(p.periodo)}: ${p.retido}.`);
  }
  const sem = c.anual.filter((p) => p.sem_abertura?.length).map((p) => p.periodo);
  if (sem.length) notas.push(`Em ${sem.join(", ")}, a companhia não separou empréstimos, debêntures e arrendamento: a dívida bruta é a linha total, que pode incluir arrendamento.`);
  const parciais = c.anual.filter((p) => p.inicio_resultado && !p.inicio_resultado.endsWith("-01-01"));
  for (const p of parciais) notas.push(`${p.periodo}: exercício de ${data(p.inicio_resultado)} a ${data(p.data)}, menor que 12 meses.`);
  return notas;
}

function BarrasAlavancagem({ titulo, companhias, logos }: { titulo: string; companhias: CompanhiaDivida[]; logos: Logos }) {
  const linhas = [...companhias].sort((a, b) => (b.ultimo!.dl_ebitda ?? -Infinity) - (a.ultimo!.dl_ebitda ?? -Infinity));
  const minimo = Math.min(0, ...linhas.map((c) => c.ultimo!.dl_ebitda ?? 0));
  const dominio = ESCALA_BARRAS - minimo;
  const pos = (v: number) => ((Math.min(v, ESCALA_BARRAS) - minimo) / dominio) * 100;
  const zero = pos(0);
  return (
    <figure>
      <figcaption className="text-sm font-medium text-carvao">{titulo}</figcaption>
      <ul className="mt-3 space-y-1.5">
        {linhas.map((c) => {
          const u = c.ultimo!;
          const v = u.dl_ebitda;
          const cortado = v != null && v > ESCALA_BARRAS;
          const ini = v == null ? 0 : Math.min(pos(v), zero);
          const fim = v == null ? 0 : Math.max(pos(v), zero);
          return (
            <li key={c.cnpj} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_6rem]">
              <span className="flex min-w-0 items-center gap-3">
                {/* no celular a coluna do nome é estreita: o símbolo fica na tabela logo abaixo; sem símbolo, o mesmo espaço vazio alinha os nomes */}
                <span className="hidden sm:contents">
                  <ListadasLogo logo={logoDe(logos, c.cnpj)} nome={c.nome} tamanho="sm" decorativo />
                </span>
                <span className="truncate text-carvao" title={c.nome}>
                  {c.nome}
                  {u.data !== companhias[0]?.ultimo?.data && u.periodo !== companhias[0]?.ultimo?.periodo && <span className="text-xs text-carvao-muted"> ({u.periodo})</span>}
                </span>
              </span>
              <span className="relative block h-4" aria-hidden="true">
                <span className="absolute inset-y-0 w-px bg-linha" style={{ left: `${zero}%` }} />
                {v != null && (
                  <span
                    className="absolute inset-y-0 bg-obee"
                    style={{ left: `${ini}%`, width: `${Math.max(fim - ini - (cortado ? 3 : 0), 0.5)}%` }}
                  />
                )}
                {cortado && <span className="absolute inset-y-0 bg-obee" style={{ left: "98%", width: "2%" }} />}
              </span>
              <span className={`text-right tabular-nums ${v == null ? "text-carvao-muted" : "text-carvao"}`}>
                {v == null ? "sem leitura" : vezes(v)}
                {cortado && <span className="block text-[11px] leading-tight text-carvao-muted">fora da escala</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function TabelaFotografia({ operadoras, holdings, fichas, logos }: { operadoras: CompanhiaDivida[]; holdings: CompanhiaDivida[]; fichas: Map<string, string>; logos: Logos }) {
  const colunas = [
    "Período",
    "Dívida bruta",
    "Caixa e aplicações",
    "Dívida líquida",
    "EBITDA 12 meses",
    "Dívida líquida / EBITDA",
    "Dívida líquida / patrimônio",
    "Vence em até 12 meses",
    "EBITDA / despesas financeiras",
  ];
  const grupo = (rotulo: string, nota: string, lista: CompanhiaDivida[]) => (
    <tbody>
      <tr className="border-b border-carvao">
        <th scope="colgroup" colSpan={colunas.length + 1} className="sticky left-0 bg-papel pb-2 pt-6 text-left font-normal">
          <span className="font-medium text-carvao">{rotulo}</span> <span className="text-xs text-carvao-muted">{nota}</span>
        </th>
      </tr>
      {lista.map((c) => {
        const u = c.ultimo!;
        const ficha = fichas.get(c.cnpj);
        const logo = logoDe(logos, c.cnpj);
        const cel = (v: string, ausente: boolean) => <td className={`py-2 pr-4 text-right tabular-nums ${ausente ? "text-carvao-muted" : "text-carvao"}`}>{v}</td>;
        return (
          <tr key={c.cnpj} className="border-b border-linha align-top">
            <th scope="row" className="sticky left-0 z-10 bg-papel py-2 pr-4 text-left font-normal">
              {logo?.arquivo && (
                <span className="mb-1.5 block">
                  <ListadasLogo logo={logo} nome={c.nome} tamanho="sm" decorativo />
                </span>
              )}
              {ficha ? (
                <Link href={`${ROTA}/prestadores/${ficha}`} className="text-obee-dark underline underline-offset-2">
                  {c.nome}
                </Link>
              ) : (
                <span className="text-carvao">{c.nome}</span>
              )}
              <span className="block text-xs text-carvao-muted">
                {c.papel === "holding" ? `consolida ${c.controladas.map((x) => x.nome).join(", ")}` : c.holdings.length ? `grupo: ${c.holdings.map((x) => x.nome).join(", ")}` : `CNPJ ${c.cnpj}`}
              </span>
            </th>
            <td className="py-2 pr-4 text-right tabular-nums text-carvao">
              {u.periodo}
              <span className="block text-xs text-carvao-muted">{ROTULO_ESCOPO[u.escopo]}</span>
            </td>
            {cel(mi(u.divida_bruta), u.divida_bruta == null)}
            {cel(mi(u.caixa), u.caixa == null)}
            {cel(mi(u.divida_liquida), u.divida_liquida == null)}
            {cel(mi(u.ebitda), u.ebitda == null)}
            {cel(u.dl_ebitda == null ? "sem leitura" : numero(u.dl_ebitda, 1).replace(/^-/, "−"), u.dl_ebitda == null)}
            {cel(u.dl_pl == null ? "sem leitura" : numero(u.dl_pl, 2).replace(/^-/, "−"), u.dl_pl == null)}
            {cel(u.parcela_cp == null ? "sem leitura" : `${numero(u.parcela_cp, 1)}%`, u.parcela_cp == null)}
            {cel(u.cobertura == null ? "sem leitura" : numero(u.cobertura, 1), u.cobertura == null)}
          </tr>
        );
      })}
    </tbody>
  );
  return (
    <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Dívida e alavancagem por companhia (rolável)">
      <table className="w-full min-w-[68rem] border-collapse text-sm">
        <caption className="sr-only">Dívida, caixa, EBITDA e razões de alavancagem por companhia, na data mais recente de cada uma</caption>
        <thead>
          <tr className="border-b border-carvao">
            <th scope="col" className="sticky left-0 z-10 w-[15rem] bg-papel py-2 pr-4 text-left font-medium">
              Companhia
            </th>
            {colunas.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 text-right font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {grupo("Prestadoras", "declaradas por municípios no SINISA 2024", operadoras)}
        {grupo("Holdings de grupo", "consolidam as prestadoras que controlam: não some com as linhas acima", holdings)}
      </table>
    </div>
  );
}

function NotasDaTabela({ companhias }: { companhias: CompanhiaDivida[] }) {
  const notas: string[] = [];
  for (const c of companhias) {
    const u = c.ultimo!;
    const vistos = new Set<string>();
    for (const [k, m] of Object.entries(u.motivos)) {
      if (!m || vistos.has(`${k}`) || (k === "ebitda" && u.motivos.dl_ebitda === m)) continue;
      vistos.add(k);
      notas.push(`${c.nome}, ${NOMES_INDICADOR[k] ?? k}: ${m}.`);
    }
    if (u.sem_abertura.length) notas.push(`${c.nome}: empréstimos, debêntures e arrendamento publicados numa linha só; a dívida bruta é essa linha.`);
  }
  if (!notas.length) return null;
  return (
    <div className="mt-4 max-w-prose2">
      <p className="text-xs font-medium text-carvao">Notas da tabela</p>
      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-carvao-muted">
        {notas.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

function Metodo({ g, lista, logos }: { g: GoldDivida; lista: CompanhiaDivida[]; logos: Logos }) {
  const semSimbolo = g.companhias.filter((c) => !logoDe(logos, c.cnpj)?.arquivo);
  const definicoes: [string, string][] = [
    ["Dívida bruta", "Empréstimos e financiamentos mais debêntures, no passivo circulante e no não circulante (contas 2.01.04.01, 2.01.04.02, 2.02.01.01 e 2.02.01.02 do plano padronizado da CVM). Financiamento por arrendamento fica fora. Quando a companhia não abre a linha nas subcontas, vale a linha total, com nota."],
    ["Caixa e aplicações", "Caixa e equivalentes de caixa mais aplicações financeiras do ativo circulante (1.01.01 e 1.01.02)."],
    ["Dívida líquida", "Dívida bruta menos caixa e aplicações. Negativa quando o caixa é maior que a dívida."],
    ["EBITDA", "Resultado antes do resultado financeiro e dos tributos (3.05) mais depreciação, amortização e exaustão da demonstração do valor adicionado (7.04.01). Sem ajustes. No trimestre, os últimos 12 meses: acumulado do ano, mais o exercício anterior, menos o acumulado do mesmo período do ano anterior."],
    ["Dívida líquida sobre EBITDA", "Em vezes; sem leitura com EBITDA negativo ou nulo, ou com exercício menor que 12 meses."],
    ["Dívida líquida sobre patrimônio líquido", "Patrimônio líquido total (2.03), com a parte dos não controladores no consolidado; sem leitura com patrimônio negativo ou nulo."],
    ["Parte que vence em até 12 meses", "Dívida no passivo circulante sobre a dívida bruta. É o único recorte de prazo que a base estruturada permite."],
    ["Cobertura das despesas financeiras", "EBITDA sobre as despesas financeiras da DRE (3.06.02), que somam juros, variação monetária e cambial e outras despesas: não é a cobertura de juros em sentido estrito. Sem leitura quando a companhia publica só o resultado financeiro líquido."],
    ["Demonstração", "Consolidada sempre que publicada; individual quando a companhia não tem controladas a consolidar e só publica essa. Última versão de cada documento (reapresentações substituem a original)."],
  ];
  const arquivos: [string, string][] = [
    ["divida_anual.csv", "Série anual (DFP), uma linha por companhia e ano"],
    ["divida_trimestral.csv", "Série trimestral (ITR e DFP), uma linha por companhia e trimestre"],
    ["divida.json", "Publicação completa, com fontes, sha256, critérios, inconsistências e exclusões"],
  ];
  return (
    <details className="group max-w-5xl border-t border-linha pt-4">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-base text-obee-dark [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-xs motion-safe:transition-transform group-open:rotate-90">
          ▸
        </span>
        Abrir definições, universo, conferências e arquivos
      </summary>
      <div className="mt-6 space-y-10 text-sm leading-relaxed text-carvao">
        <section aria-labelledby="metodo-definicoes">
          <h3 id="metodo-definicoes" className="font-serif text-lg">Definições</h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-[14rem_1fr]">
            {definicoes.map(([t, d]) => (
              <div key={t} className="contents">
                <dt className="font-medium">{t}</dt>
                <dd className="text-carvao-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="metodo-universo">
          <h3 id="metodo-universo" className="font-serif text-lg">Quem está e por quê</h3>
          <p className="mt-2 max-w-prose2 text-carvao-muted">
            Prestadora: {g.criterio.operadora}. Holding: {g.criterio.holding}. Nenhum vínculo é feito por nome. Uma companhia cuja ficha de prestador
            existe no capítulo 7 leva o link para ela na tabela.
          </p>
          <div className="tabela-scroll mt-3" tabIndex={0} role="region" aria-label="Companhias do capítulo (rolável)">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Companhia</th>
                  <th scope="col" className="py-2 pr-4 font-medium">CNPJ</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Papel</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Municípios que a declaram</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Desde</th>
                  <th scope="col" className="py-2 font-medium">Registro na CVM</th>
                </tr>
              </thead>
              <tbody>
                {g.companhias.map((c) => (
                  <tr key={c.cnpj} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      {logoDe(logos, c.cnpj)?.arquivo && (
                        <span className="mb-1.5 block">
                          <ListadasLogo logo={logoDe(logos, c.cnpj)} nome={c.nome} tamanho="sm" decorativo />
                        </span>
                      )}
                      {c.nome}
                    </th>
                    <td className="py-2 pr-4 tabular-nums text-carvao-muted">{c.cnpj}</td>
                    <td className="py-2 pr-4">{ROTULO_PAPEL[c.papel]}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{c.papel === "operadora" ? inteiro(c.municipios_declarados) : "não se aplica"}</td>
                    <td className="py-2 pr-4">{lista.includes(c) ? periodoPorExtenso(c.anual.find((p) => !p.retido)?.periodo ?? c.primeiro_periodo) : "sem ponto válido"}</td>
                    <td className="py-2 text-carvao-muted">
                      {c.registro.situacao === "ATIVO" ? "ativo" : `cancelado${c.registro.cancelado_em ? ` em ${data(c.registro.cancelado_em)}` : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-prose2 text-xs text-carvao-muted">
            Símbolos: o arquivo oficial publicado pela própria companhia, baixado sem alteração e ligado pelo CNPJ registrado na CVM, com
            origem, data de captura e sha256 em public/saneamento/logos/manifesto.json.
            {semSimbolo.length > 0
              ? ` Sem símbolo oficial obtido (${inteiro(semSimbolo.length)}): ${semSimbolo.map((c) => c.nome).join(", ")}; o motivo de cada ausência está no mesmo arquivo, e a página mostra só o nome.`
              : ""}
          </p>
          {g.fora_do_recorte.length > 0 && (
            <p className="mt-3 max-w-prose2 text-xs text-carvao-muted">
              Registradas no setor de saneamento da CVM e fora do recorte ({inteiro(g.fora_do_recorte.length)}): {g.fora_do_recorte.map((x) => x.denominacao).join("; ")}. Motivo
              comum: {g.fora_do_recorte[0].motivo}. O setor da CVM reúne também gás canalizado e resíduos.
            </p>
          )}
        </section>

        <section aria-labelledby="metodo-conferencias">
          <h3 id="metodo-conferencias" className="font-serif text-lg">Conferências que retêm a publicação</h3>
          <p className="mt-2 max-w-prose2 text-carvao-muted">
            Cada demonstração usada passa por: ativo igual ao passivo; passivo igual a circulante, não circulante e patrimônio líquido; linha de empréstimos e
            financiamentos igual à soma das subcontas publicadas; ativo total plausível para a escala declarada; depreciação com o sinal certo; resultado
            terminando na data do balanço. Também: as companhias esperadas presentes na DFP mais recente e nenhum indicador ausente sem motivo. Falhou, a
            publicação anterior continua no ar. As inconsistências abaixo, das próprias demonstrações, foram conferidas uma a uma e saem da série como
            ausência, com o motivo.
          </p>
          <ul className="mt-3 max-w-prose2 space-y-1 text-xs text-carvao-muted">
            {g.inconsistencias.map((i) => (
              <li key={`${i.cnpj}-${i.fonte}-${i.data}`}>
                {i.nome}, {i.fonte} de {data(i.data)}: {i.motivo.replace(/^demonstração publicada inconsistente, ponto fora da série: /, "")}.
              </li>
            ))}
            {g.exclusoes.map((i) => (
              <li key={`${i.cnpj}-${i.fonte}-${i.data}-x`}>
                {i.nome}, {i.fonte} de {data(i.data)}: {i.motivo}.
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="metodo-fontes">
          <h3 id="metodo-fontes" className="font-serif text-lg">Fontes</h3>
          <ul className="mt-2 max-w-prose2 space-y-2 text-carvao-muted">
            <li>
              CVM, Demonstrações Financeiras Padronizadas (DFP): ZIP anual por ano de referência, CSV com separador ponto e vírgula, desde {g.fontes.dfp.primeiro_ano}.{" "}
              <a className="text-obee-dark underline underline-offset-2" href={g.fontes.dfp.pagina}>Página do conjunto</a>.
            </li>
            <li>
              CVM, Informações Trimestrais (ITR): ZIP anual com os três primeiros trimestres, mesmo formato, usado desde {g.fontes.itr.primeiro_ano}.{" "}
              <a className="text-obee-dark underline underline-offset-2" href={g.fontes.itr.pagina}>Página do conjunto</a>.
            </li>
            <li>
              CVM, cadastro de companhias abertas (situação do registro e setor).{" "}
              <a className="text-obee-dark underline underline-offset-2" href={g.fontes.cadastro.pagina}>Página do conjunto</a>.
            </li>
            <li>
              SINISA 2024, módulo Gestão Municipal (CNPJ declarado por município) e Formulário de Referência da CVM (cadeia de controle), já usados no
              capítulo 7.
            </li>
          </ul>
          <p className="mt-2 text-xs text-carvao-muted">
            Capturado em {data(g.capturado_em)}. {inteiro(g.fontes.dfp.arquivos.length + g.fontes.itr.arquivos.length)} arquivos originais, cada um com endereço,
            tamanho e sha256 em divida.json.
          </p>
        </section>

        <section aria-labelledby="metodo-arquivos">
          <h3 id="metodo-arquivos" className="font-serif text-lg">Arquivos</h3>
          <ul className="mt-2 space-y-1">
            {arquivos.map(([a, d]) => (
              <li key={a}>
                <a className="text-obee-dark underline underline-offset-2" href={`${URL_DIVIDA}/${a}`} download>
                  {a}
                </a>{" "}
                <span className="text-carvao-muted">{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-carvao-muted">Valores dos arquivos em milhares de reais nominais, como publicados pelas companhias.</p>
        </section>
      </div>
    </details>
  );
}
