import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, agregados, fichas, meta, municipios } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { calcularConta } from "@/lib/saneamento/conta";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero, reais } from "@/lib/saneamento/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "A conta cabe no orçamento? A tarifa social chega a quem precisa?",
  description:
    "Regras da tarifa social da Lei 14.898/2024, o que os prestadores declararam ao SINISA 2024, economias com tarifa social para cada 100 famílias elegíveis do CadÚnico, desconto efetivo nas tabelas verificadas e peso da conta na renda de famílias no limite de elegibilidade.",
  alternates: { canonical: "/saneamento/tarifa-social" },
};

/** Salário mínimo de 2026: Decreto 12.797, de 23/12/2025 (vigência em 01/01/2026). */
const SALARIO_MINIMO_2026 = 1621;
const LIMITE_PER_CAPITA = SALARIO_MINIMO_2026 / 2;
const CONSUMOS = [10, 15];
const FAMILIAS = [3, 4];
const ATLAS = ["tarifa-social-por-familia-elegivel"];

/** "202412" → "dez/2024". */
function mesAno(m: string | undefined): string {
  if (!m) return "sem dado";
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m.slice(4)) - 1]}/${m.slice(0, 4)}`;
}

export default function Pagina() {
  const cap = capituloPorSlug("tarifa-social")!;

  // Declarações por vínculo prestador × município de água.
  let vinculos = 0;
  let semResposta = 0;
  let comSocial = 0;
  let economias = 0;
  let exigeCad = 0;
  let exigeRenda = 0;
  let volMaxInformado = 0;
  let volMaxAte15 = 0;
  const municipiosCom = new Set<string>();
  const municipiosAgua = new Set<string>();
  for (const f of fichas()) {
    for (const v of f.sinisa.prestadores ?? []) {
      if (v.servico !== "agua") continue;
      vinculos += 1;
      municipiosAgua.add(f.id);
      const t = v.tarifa ?? {};
      if (t.GFI1019 == null) semResposta += 1;
      if (t.GFI1019 !== "Sim") continue;
      comSocial += 1;
      municipiosCom.add(f.id);
      if (typeof t.GFI1036 === "number") economias += t.GFI1036;
      if (t.GFI1030 === "Sim") exigeCad += 1;
      if (t.GFI1033 === "Sim") exigeRenda += 1;
      if (typeof t.GFI1025 === "number") {
        volMaxInformado += 1;
        if (t.GFI1025 < 15) volMaxAte15 += 1;
      }
    }
  }

  // Tabelas verificadas: conta residencial e social para o mesmo consumo.
  const linhas = TARIFAS.flatMap((t) => {
    const res = t.categorias.residencial;
    if (!res) return [];
    return Object.entries(t.categorias)
      .filter(([k]) => k !== "residencial")
      .map(([k, cat]) => {
        // Sem esgoto verificado na categoria, compara só a água dos dois lados: nunca conta completa contra conta parcial.
        const soAgua = !cat.esgoto || !!cat.esgotoNaoVerificado || !res.esgoto || !!res.esgotoNaoVerificado;
        const porConsumo = CONSUMOS.map((c) => {
          const r = calcularConta(res, c);
          const x = calcularConta(cat, c);
          const vr = soAgua ? r.agua : r.total;
          const vs = soAgua ? x.agua : x.total;
          return { c, r: vr, s: vs, desconto: vr > 0 ? (1 - vs / vr) * 100 : null };
        });
        return {
          id: `${t.id}-${k}`,
          tarifa: t.id,
          prestador: t.prestador.replace(/^.*\(([^)]+)\)$/, "$1"),
          area: t.area,
          categoria: cat.rotulo,
          porConsumo,
          soAgua,
        };
      });
  });

  const cenarios = FAMILIAS.map((n) => ({ n, renda: n * LIMITE_PER_CAPITA }));

  // Alcance: economias com tarifa social (SINISA 2024) sobre famílias elegíveis do CadÚnico (dez/2024).
  const m = meta();
  const ags = agregados();
  const br = agregado("BR");
  const lista = municipios();
  const refs = referencias(ags, lista, ATLAS);
  const ufs = ags.filter((a) => a.tipo === "UF");
  const nomesUf = Object.fromEntries(ufs.map((u) => [u.id, u.nome]));
  const mesRef = m?.cadunico.mes_referencia ?? "202412";
  const mesAtual = m?.cadunico.mes_mais_recente ?? "";
  const ts = br?.tarifa_social;
  const razaoBr = ts?.economias != null && ts.familias_mesmo_universo ? (ts.economias / ts.familias_mesmo_universo) * 100 : null;
  const porUf = ufs
    .map((u) => ({
      id: u.id,
      rotulo: u.nome,
      v: u.tarifa_social.economias != null && u.tarifa_social.familias_mesmo_universo ? (u.tarifa_social.economias / u.tarifa_social.familias_mesmo_universo) * 100 : null,
    }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const ROTULO_ESTADO: Record<string, string> = { oferece: "Oferece", nao_oferece: "Não oferece" };
  const linhasAlcance = lista
    .filter((x) => x.cad_fam_ms != null)
    .map((x) => ({
      municipio: x.nome,
      href: `${ROTA}/municipio/${x.id}`,
      uf: x.uf,
      estado: x.ts_estado ? ROTULO_ESTADO[x.ts_estado] : "Sem resposta",
      familias: x.cad_fam_ms,
      economias: x.ts_economias,
      razao: x.ts_economias != null && x.cad_fam_ms ? (x.ts_economias / x.cad_fam_ms) * 100 : null,
    }));

  return (
    <>
      <Cabecalho atual="tarifa-social" />
      <MarcaVisita secao="saneamento:tarifa-social" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={6}
          titulo={cap.pergunta}
          texto={
            <p>
              A Lei 14.898/2024 criou regras nacionais para a tarifa social de água e esgoto. Antes dela, cada prestador definia a sua, com critérios
              e descontos próprios. Este capítulo mostra a regra legal, o que os prestadores declararam ao SINISA para 2024, o desconto efetivo nas
              tabelas verificadas, o alcance da tarifa social em relação às famílias elegíveis do CadÚnico e o peso da conta na renda de famílias no
              limite da elegibilidade.
            </p>
          }
          recorte={<>SINISA 2024: {inteiro(vinculos)} vínculos prestador × município de água; tabelas verificadas de cinco prestadores, vigentes em 2026.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />

        <Secao id="regra" titulo="O que a lei garante">
          <dl className="grid max-w-5xl grid-cols-1 gap-x-10 md:grid-cols-3">
            <div className="border-t border-linha py-4">
              <dt className="font-medium text-carvao">Quem tem direito</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                Usuários com renda per capita de até meio salário-mínimo, de família inscrita no Cadastro Único ou de família com pessoa com
                deficiência ou idosa de 65 anos ou mais que receba o Benefício de Prestação Continuada. O valor do BPC, entre outros benefícios listados na lei, não entra no cálculo
                da renda.
              </dd>
            </div>
            <div className="border-t border-linha py-4">
              <dt className="font-medium text-carvao">Desconto mínimo</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">50% sobre a tarifa da primeira faixa de consumo, aplicado aos primeiros 15 m³ do mês.</dd>
            </div>
            <div className="border-t border-linha py-4">
              <dt className="font-medium text-carvao">Limite de renda em 2026</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                Meio salário-mínimo: {reais(LIMITE_PER_CAPITA)} por pessoa, com o salário-mínimo de {reais(SALARIO_MINIMO_2026)} fixado pelo Decreto 12.797,
                de 23/12/2025.
              </dd>
            </div>
          </dl>
          <Fonte>Lei 14.898, de 13/06/2024, arts. 2º e 6º; Decreto 12.797/2025, conforme Ministério da Previdência Social, gov.br, publicação de 05/01/2026.</Fonte>
        </Secao>

        <Secao
          id="declaracoes"
          titulo="O que os prestadores declararam para 2024"
          texto="Respostas do formulário financeiro do SINISA para cada prestador em cada município atendido com água. Ano de referência 2024, antes de a lei produzir todos os efeitos."
        >
          <Numeros
            colunas={4}
            itens={[
              {
                rotulo: "Municípios com tarifa social de água declarada",
                valor: inteiro(municipiosCom.size),
                contexto: <>De {inteiro(municipiosAgua.size)} municípios com prestador de água declarado ({numero(razaoPct(municipiosCom.size, municipiosAgua.size), 1)}%).</>,
              },
              {
                rotulo: "Economias residenciais com tarifa social",
                valor: inteiro(economias),
                contexto: <>Soma do campo GFI1036 nos vínculos que declararam tarifa social.</>,
              },
              {
                rotulo: "Vínculos que exigem inscrição no CadÚnico",
                valor: inteiro(exigeCad),
                contexto: <>De {inteiro(comSocial)} vínculos com tarifa social; {inteiro(exigeRenda)} exigem comprovação de renda ao prestador.</>,
              },
              {
                rotulo: "Volume máximo com desconto abaixo de 15 m³",
                valor: inteiro(volMaxAte15),
                contexto: <>Vínculos, entre {inteiro(volMaxInformado)} que informaram o volume máximo (GFI1025).</>,
              },
            ]}
          />
          <Ressalva
            permite="Saber onde o prestador declara oferecer tarifa social, com que critérios e para quantas economias."
            naoPermite="Dizer quantas famílias recebem o benefício: o SINISA conta economias, não famílias, e vínculos sem resposta ficam fora. A comparação com as famílias elegíveis do CadÚnico está na seção seguinte, como razão entre contagens diferentes."
          />
          <Nota>
            {inteiro(semResposta)} vínculos não responderam se há tarifa social. O valor médio declarado da tarifa social (GFI1037) tem registros
            incompatíveis com uma conta mensal, alguns acima de R$ 100 mil, e não é publicado aqui. A ficha de cada município mostra a declaração local.
          </Nota>
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), informações financeiras por prestador e município, campos GFI1019 a GFI1037.</Fonte>
        </Secao>

        <Secao
          id="desconto"
          titulo="Quanto a tarifa social reduz a conta, nas tabelas verificadas?"
          texto="Conta mensal calculada com as tabelas vigentes em 2026, para a categoria residencial e cada categoria social ou de vulnerabilidade, no mesmo consumo. Água e esgoto quando as duas tabelas da categoria foram verificadas; só água, dos dois lados, quando não."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Desconto efetivo da tarifa social (rolável)">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">Conta residencial e social para 10 e 15 m³</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Prestador e categoria</th>
                  {CONSUMOS.map((c) => (
                    <th key={c} scope="col" colSpan={3} className="py-2 pr-4 text-center font-medium">
                      {c} m³
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-linha text-right text-xs text-carvao-muted">
                  <th scope="col" className="py-1 pr-4 text-left font-normal">
                    <span className="sr-only">Categoria</span>
                  </th>
                  {CONSUMOS.flatMap((c) => [
                    <th key={`${c}r`} scope="col" className="py-1 pr-4 font-normal">Residencial</th>,
                    <th key={`${c}s`} scope="col" className="py-1 pr-4 font-normal">Categoria</th>,
                    <th key={`${c}d`} scope="col" className="py-1 pr-4 font-normal">Desconto</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-b border-linha text-right tabular-nums align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      <Link href={`${ROTA}/preco-regulado/simulador?t=${l.tarifa}`} className="underline decoration-linha underline-offset-4 hover:decoration-obee">
                        {l.prestador}
                      </Link>{" "}
                      · {l.categoria}
                      <span className="block text-xs text-carvao-muted">
                        {l.area}
                        {l.soAgua ? "; só água: esgoto da categoria não verificado" : "; água e esgoto"}
                      </span>
                    </th>
                    {l.porConsumo.flatMap((p) => [
                      <td key={`${p.c}r`} className="whitespace-nowrap py-2 pr-4">{reais(p.r)}</td>,
                      <td key={`${p.c}s`} className="whitespace-nowrap py-2 pr-4">{reais(p.s)}</td>,
                      <td key={`${p.c}d`} className="py-2 pr-4">{numero(p.desconto, 1)}%</td>,
                    ])}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Comparar o desconto efetivo na conta, no mesmo consumo, entre categorias e prestadores da amostra."
            naoPermite="Verificar a conformidade com a lei: a regra legal incide sobre a primeira faixa, e cada estrutura tarifária define faixas diferentes; categorias de vulnerabilidade podem ter critérios distintos da tarifa social da lei."
          />
          <Fonte>Tabelas tarifárias verificadas nos atos dos reguladores; mesma regra de cálculo do simulador (capítulo 5.1).</Fonte>
        </Secao>

        <Secao
          id="orcamento"
          titulo="Quanto a conta pesa na renda de uma família no limite?"
          texto={
            <>
              Cenário, não medida: família com renda per capita exatamente no limite da lei ({reais(LIMITE_PER_CAPITA)} em 2026), com {FAMILIAS.join(" ou ")}{" "}
              pessoas, consumindo 10 m³ por mês. Percentual da renda familiar mensal.
            </>
          }
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Peso da conta na renda (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Conta de 10 m³ como percentual da renda familiar no limite de elegibilidade</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Prestador e categoria</th>
                  {cenarios.map((c) => (
                    <th key={c.n} scope="col" className="py-2 pr-4 font-medium">
                      {c.n} pessoas, renda de {reais(c.renda)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const conta = l.porConsumo.find((p) => p.c === 10);
                  return (
                    <tr key={l.id} className="border-b border-linha text-right tabular-nums">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                        {l.prestador} · {l.categoria}
                        {l.soAgua && <span className="text-xs text-carvao-muted"> (só água)</span>}
                        <span className="block text-xs text-carvao-muted">Residencial: {cenarios.map((c) => `${numero(razaoPct(conta?.r, c.renda), 1)}%`).join(" e ")}</span>
                      </th>
                      {cenarios.map((c) => (
                        <td key={c.n} className="py-2 pr-4">{numero(razaoPct(conta?.s, c.renda), 1)}%</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Dimensionar a ordem de grandeza da conta no orçamento de uma família elegível, com e sem a tarifa social."
            naoPermite="Afirmar que a conta cabe ou não cabe no orçamento de famílias reais: renda, tamanho da família e consumo variam, e não há limiar legal de comprometimento."
          />
        </Secao>

        <Secao
          id="cobertura"
          titulo="A tarifa social chega às famílias elegíveis?"
          texto={
            <>
              Economias residenciais com tarifa social de água declaradas ao SINISA para 2024, para cada 100 famílias do CadÚnico com renda per capita
              até meio salário-mínimo em {mesAno(mesRef)}, o critério de renda da lei. É razão entre duas contagens diferentes, não percentual de famílias
              atendidas.
            </>
          }
        >
          <Numeros
            colunas={4}
            itens={[
              {
                rotulo: `Famílias elegíveis pelo critério de renda, ${mesAno(mesRef)}`,
                valor: inteiro(br?.cadunico[mesRef]),
                contexto: <>CadÚnico, renda per capita até meio salário-mínimo, 5.570 municípios. Em {mesAno(mesAtual)}: {inteiro(br?.cadunico[mesAtual])}.</>,
              },
              {
                rotulo: "Economias com tarifa social de água, 2024",
                valor: inteiro(ts?.economias),
                contexto: <>SINISA, soma dos prestadores de água nos {inteiro(ts?.municipios_mesmo_universo)} municípios com resposta e CadÚnico.</>,
              },
              {
                rotulo: "Economias com tarifa social por 100 famílias elegíveis",
                valor: numero(razaoBr, 1),
                contexto: <>Brasil, mesmo universo: {inteiro(ts?.economias)} ÷ {inteiro(ts?.familias_mesmo_universo)} famílias.</>,
              },
              {
                rotulo: "Municípios cujo prestador declara não oferecer tarifa social",
                valor: inteiro(ts?.municipios_nao_oferece),
                contexto: <>{inteiro(ts?.municipios_oferece)} oferecem; {inteiro(ts?.municipios_sem_resposta)} sem resposta ou fora do módulo de água.</>,
              },
            ]}
          />
          <div className="mt-10">
            <AtlasMunicipal ids={ATLAS} referencias={refs} nomesUf={nomesUf} titulo="Atlas municipal do alcance da tarifa social" />
          </div>
          <div className="mt-10">
            <GraficoBarras
              titulo={`Economias com tarifa social por 100 famílias elegíveis, por UF (SINISA 2024 e CadÚnico ${mesAno(mesRef)})`}
              dados={porUf}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "por 100 famílias", cor: "var(--cor-obee)" }]}
              unidade="por 100 famílias"
              casas={1}
              orientacao="horizontal"
              referencias={razaoBr != null ? [{ valor: razaoBr, rotulo: "Brasil" }] : undefined}
              limiteInicial={14}
            />
          </div>
          <div className="mt-10">
            <TabelaDados
              titulo="Alcance da tarifa social por município"
              arquivo="saneamento-tarifa-social-cadunico.csv"
              colunas={[
                { id: "municipio", rotulo: "Município", href: "href" },
                { id: "uf", rotulo: "UF" },
                { id: "estado", rotulo: "Tarifa social declarada" },
                { id: "familias", rotulo: `Famílias elegíveis (${mesAno(mesRef)})`, tipo: "inteiro" },
                { id: "economias", rotulo: "Economias com tarifa social (2024)", tipo: "inteiro" },
                { id: "razao", rotulo: "Por 100 famílias", tipo: "numero" },
              ]}
              linhas={linhasAlcance}
              ordemInicial={{ coluna: "familias", direcao: "desc" }}
              rotuloLinhas={{ singular: "município", plural: "municípios" }}
            />
          </div>
          <Ressalva
            permite="Ver onde a tarifa social declarada alcança mais ou menos economias em relação ao público que a lei torna elegível, e onde o prestador declara não oferecê-la."
            naoPermite="Dizer quantas famílias elegíveis recebem o desconto: uma economia pode abrigar mais de uma família, parte das famílias não tem ligação à rede ou não é titular da conta, e critérios locais anteriores à lei podem incluir quem não está no CadÚnico. A razão pode passar de 100."
          />
          <Nota titulo="Por que o BPC não entra somado">
            Desde o Decreto 8.805/2016, a inscrição no CadÚnico é requisito para conceder e manter o BPC (MDS, Guia do BPC, 2018). As famílias com BPC
            já estão no cadastro, e o MDS publica o BPC por beneficiário, não por família: somar as duas contagens contaria famílias duas vezes. O
            denominador usa só o CadÚnico e pode deixar de fora famílias com BPC cuja renda, sem o benefício, fica abaixo do limite, porque a lei exclui
            o BPC do cálculo da renda.
          </Nota>
          <Fonte>
            Ministério das Cidades, SINISA 2025 (ano de referência 2024), campos GFI1019 e GFI1036 por prestador e município; MDS, SAGI, API MI Social
            (base do VIS Data), CadÚnico de {mesAno(mesRef)} e {mesAno(mesAtual)}, consulta em {m?.cadunico.capturado_em.slice(0, 10).split("-").reverse().join("/")}.
          </Fonte>
        </Secao>
      </main>
    </>
  );
}
