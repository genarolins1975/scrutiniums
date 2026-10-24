import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Fonte, NestaPagina, Nota, Ressalva } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { FaixaNumeros, FiguraAnalitica, GraficoBarras, NumeroIndicador, PaginaPainel, TabelaDados, type CelulaTabela, type NumeroProps } from "@/components/painel";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { provenienciaCadUnico, provenienciaSinisa } from "@/lib/saneamento/proveniencia";
import { agregado, agregados, fichas, meta, municipios } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug, eixoDoCapitulo, ROTA } from "@/lib/saneamento/capitulos";
import { acimaDoLimite, calcularConta } from "@/lib/saneamento/conta";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { razaoPct } from "@/lib/saneamento/municipios";
import { LIMITE_RAZAO_TARIFA_SOCIAL, razaoTarifaSocial } from "@/lib/saneamento/medidas";
import { inteiro, mesAno, numero, reais } from "@/lib/saneamento/formato";

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
      .filter(([k, cat]) => k !== "residencial" && CONSUMOS.every((c) => !acimaDoLimite(cat, c)))
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

  // Água Solidária (programa estadual da SANEPAR): conta de água e esgoto de Curitiba no menor consumo, ao lado da tarifa social federal e da residencial.
  const sanepar = TARIFAS.find((t) => t.id === "sanepar-2026-curitiba");
  const aguaSolidaria = sanepar?.categorias.agua_solidaria && sanepar.categorias.social && sanepar.categorias.residencial
    ? {
        consumo: CONSUMOS[0],
        solidaria: calcularConta(sanepar.categorias.agua_solidaria, CONSUMOS[0]).total,
        social: calcularConta(sanepar.categorias.social, CONSUMOS[0]).total,
        residencial: calcularConta(sanepar.categorias.residencial, CONSUMOS[0]).total,
      }
    : null;

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
      estado:
        (x.ts_estado ? ROTULO_ESTADO[x.ts_estado] : "Sem resposta") +
        ((razaoTarifaSocial(x) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL ? `; razão acima de ${LIMITE_RAZAO_TARIFA_SOCIAL}, declaração a verificar` : ""),
      familias: x.cad_fam_ms,
      economias: x.ts_economias,
      razao: razaoTarifaSocial(x),
    }));
  // Declarações acima do universo elegível: somam à razão publicada, mas ficam fora das classes do mapa.
  const acima = lista.filter((x) => (razaoTarifaSocial(x) ?? 0) > LIMITE_RAZAO_TARIFA_SOCIAL);
  const economiasAcima = acima.reduce((t, x) => t + (x.ts_economias ?? 0), 0);
  const familiasAcima = acima.reduce((t, x) => t + (x.cad_fam_ms ?? 0), 0);
  const razaoSemAcima =
    ts?.economias != null && ts.familias_mesmo_universo && ts.familias_mesmo_universo > familiasAcima
      ? ((ts.economias - economiasAcima) / (ts.familias_mesmo_universo - familiasAcima)) * 100
      : null;

  // números do kit: período, fonte e natureza de cada um; valor ausente fica ausente, com o motivo, nunca zero
  const AUSENTE = "A gold do Saneamento não traz este valor nesta publicação.";
  const n = (rotulo: string, valor: number | null | undefined, extra: Omit<NumeroProps, "rotulo" | "valor" | "motivoAusencia" | "valorTexto" | "formato">, casas = 0): NumeroProps =>
    valor == null || !Number.isFinite(valor)
      ? { ...extra, rotulo, valor: null, motivoAusencia: AUSENTE }
      : { ...extra, rotulo, valor, formato: casas === 0 ? "inteiro" : "decimal", casas };
  const SINISA = "SINISA 2025 (ano de referência 2024)";
  const numerosDeclaracoes: NumeroProps[] = [
    n("Municípios com tarifa social de água declarada", municipiosCom.size, {
      unidade: "municípios",
      periodo: "2024",
      fonte: SINISA,
      natureza: "CALCULADO",
      nota: <>De {inteiro(municipiosAgua.size)} municípios com prestador de água declarado ({numero(razaoPct(municipiosCom.size, municipiosAgua.size), 1)}%).</>,
    }),
    n("Economias residenciais com tarifa social", economias, { unidade: "economias", periodo: "2024", fonte: SINISA, natureza: "CALCULADO", nota: <>Soma do campo GFI1036 nos vínculos que declararam tarifa social.</> }),
    n("Vínculos que exigem inscrição no CadÚnico", exigeCad, {
      unidade: "vínculos",
      periodo: "2024",
      fonte: SINISA,
      natureza: "CALCULADO",
      nota: <>De {inteiro(comSocial)} vínculos com tarifa social; {inteiro(exigeRenda)} exigem comprovação de renda ao prestador.</>,
    }),
    n("Volume máximo com desconto abaixo de 15 m³", volMaxAte15, { unidade: "vínculos", periodo: "2024", fonte: SINISA, natureza: "CALCULADO", nota: <>Vínculos, entre {inteiro(volMaxInformado)} que informaram o volume máximo (GFI1025).</> }),
  ];
  const numerosCobertura: NumeroProps[] = [
    n(`Famílias elegíveis pelo critério de renda, ${mesAno(mesRef)}`, br?.cadunico[mesRef], {
      unidade: "famílias",
      periodo: mesAno(mesRef),
      fonte: "MDS, CadÚnico",
      natureza: "CALCULADO",
      nota: <>CadÚnico, renda per capita até meio salário-mínimo, 5.570 municípios. Em {mesAno(mesAtual)}: {inteiro(br?.cadunico[mesAtual])}.</>,
    }),
    n("Economias com tarifa social de água, 2024", ts?.economias, {
      unidade: "economias",
      periodo: "2024",
      fonte: SINISA,
      natureza: "CALCULADO",
      nota: <>SINISA, soma dos prestadores de água nos {inteiro(ts?.municipios_mesmo_universo)} municípios com resposta e CadÚnico.</>,
    }),
    n(
      "Economias com tarifa social por 100 famílias elegíveis",
      razaoBr,
      { unidade: "por 100 famílias", periodo: `2024 e ${mesAno(mesRef)}`, fonte: "SINISA 2024 e MDS, CadÚnico", natureza: "CALCULADO", nota: <>Brasil, mesmo universo: {inteiro(ts?.economias)} ÷ {inteiro(ts?.familias_mesmo_universo)} famílias.</> },
      1,
    ),
    n("Municípios cujo prestador declara não oferecer tarifa social", ts?.municipios_nao_oferece, {
      unidade: "municípios",
      periodo: "2024",
      fonte: SINISA,
      natureza: "CALCULADO",
      nota: <>{inteiro(ts?.municipios_oferece)} oferecem; {inteiro(ts?.municipios_sem_resposta)} sem resposta ou fora do módulo de água.</>,
    }),
  ];
  // as duas tabelas da amostra verificada: a primeira coluna leva o link para o simulador e a área de cada tabela
  const prestadorECategoria = (l: (typeof linhas)[number]) => (
    <>
      <Link href={`${ROTA}/preco-regulado/simulador?t=${l.tarifa}`} className="underline decoration-linha underline-offset-4 hover:decoration-obee">
        {l.prestador}
      </Link>{" "}
      · {l.categoria}
      <span className="block text-xs text-carvao-muted">
        {l.area}
        {l.soAgua ? "; só água: esgoto da categoria não verificado" : "; água e esgoto"}
      </span>
    </>
  );
  const linhasDesconto: CelulaTabela[][] = linhas.map((l) => [prestadorECategoria(l), ...l.porConsumo.flatMap((p) => [reais(p.r), reais(p.s), `${numero(p.desconto, 1)}%`])]);
  const linhasOrcamento: CelulaTabela[][] = linhas.map((l) => {
    const conta = l.porConsumo.find((p) => p.c === 10);
    return [
      <>
        {l.prestador} · {l.categoria}
        {l.soAgua && <span className="text-xs text-carvao-muted"> (só água)</span>}
        <span className="block text-xs text-carvao-muted">Residencial: {cenarios.map((c) => `${numero(razaoPct(conta?.r, c.renda), 1)}%`).join(" e ")}</span>
      </>,
      ...cenarios.map((c) => `${numero(razaoPct(conta?.s, c.renda), 1)}%`),
    ];
  });
  // a tabela municipal do kit (ordenável, com busca e exportação com conta), na ordem de antes: mais famílias elegíveis primeiro
  const porFamilias = [...linhasAlcance].sort((a, b) => (b.familias ?? -1) - (a.familias ?? -1));
  const fonteCobertura = (
    <>
      Ministério das Cidades, SINISA 2025 (ano de referência 2024), campos GFI1019 e GFI1036 por prestador e município; MDS, SAGI, API MI Social (base do VIS Data), CadÚnico de {mesAno(mesRef)} e{" "}
      {mesAno(mesAtual)}, consulta em {m?.cadunico.capturado_em.slice(0, 10).split("-").reverse().join("/")}.
    </>
  );

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:tarifa-social" />
      <PaginaPainel
        rota="/saneamento/tarifa-social"
        abertura={{
          grupo: eixoDoCapitulo(6)?.rotulo,
          acento: "obee",
          prontidao: cap.situacao === "parcial" ? "parcial" : undefined,
          // a pergunta do capítulo tem 65 caracteres; o H1 do molde vai até 60 (decisão do dono de 22/10/2026), e as duas perguntas ficam
          titulo: "A conta cabe no orçamento? A tarifa social chega?",
          lead: "A Lei 14.898/2024 criou regras nacionais para a tarifa social de água e esgoto. Antes dela, cada prestador definia a sua, com critérios e descontos próprios.",
          recorte: {
            periodo: "SINISA 2024; tabelas vigentes em 2026",
            universo: `${inteiro(vinculos)} vínculos prestador × município de água; tabelas verificadas de ${new Set(TARIFAS.map((t) => t.prestadorSinisa)).size} prestadores`,
            unidade: "economias, famílias, R$ e % da renda",
            fonte: "Ministério das Cidades, SINISA; MDS, CadÚnico; atos dos reguladores",
          },
          limite:
            "quantas famílias recebem a tarifa social: o SINISA conta economias, não famílias, e a razão sobre as famílias elegíveis do CadÚnico é uma aproximação entre contagens diferentes.",
          fontesDatasSiglas: (
            <>
              <p>
                {cap.pergunta} Este capítulo mostra a regra legal, o que os prestadores declararam ao SINISA para 2024, o desconto efetivo nas tabelas verificadas, o alcance da tarifa social em
                relação às famílias elegíveis do CadÚnico e o peso da conta na renda de famílias no limite da elegibilidade.
              </p>
              <p>
                SINISA 2024: {inteiro(vinculos)} vínculos prestador × município de água; tabelas verificadas de {new Set(TARIFAS.map((t) => t.prestadorSinisa)).size} prestadores, vigentes em 2026.
              </p>
              <p>SINISA: Sistema Nacional de Informações em Saneamento Básico. CadÚnico: Cadastro Único para Programas Sociais. BPC: Benefício de Prestação Continuada.</p>
            </>
          ),
        }}
        aviso={
          cap.situacao !== "publicado" && cap.pendencia ? (
            <p className="mt-4 max-w-prose2 border-l-2 border-aviso pl-4 text-sm leading-relaxed text-carvao-muted">{cap.pendencia}</p>
          ) : undefined
        }
        rotuloNumeros="Alcance da tarifa social"
        numeros={numerosCobertura}
        navegacaoLocal={
          <div className="mt-8">
            <NestaPagina
              itens={[
                { id: "regra", rotulo: "O que a lei garante" },
                { id: "declaracoes", rotulo: "Declarações de 2024" },
                { id: "desconto", rotulo: "Quanto reduz a conta" },
                { id: "orcamento", rotulo: "Peso na renda" },
                { id: "cobertura", rotulo: "Chega às famílias?" },
              ]}
            />
          </div>
        }
        figuras={
          <>
            <Recolhido id="regra" aberto nivelTitulo={2} titulo="O que a lei garante" resumo="Quem tem direito, o desconto mínimo e o limite de renda em 2026.">
              <div className="pb-6">
                <dl className="grid max-w-5xl grid-cols-1 gap-x-10 md:grid-cols-3">
                  <div className="border-t border-linha py-4">
                    <dt className="font-medium text-carvao">Quem tem direito</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                      Usuários com renda per capita de até meio salário-mínimo, de família inscrita no Cadastro Único ou de família com pessoa com deficiência ou idosa de 65 anos ou mais que
                      receba o Benefício de Prestação Continuada. O valor do BPC, entre outros benefícios listados na lei, não entra no cálculo da renda.
                    </dd>
                  </div>
                  <div className="border-t border-linha py-4">
                    <dt className="font-medium text-carvao">Desconto mínimo</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">50% sobre a tarifa da primeira faixa de consumo, aplicado aos primeiros 15 m³ do mês.</dd>
                  </div>
                  <div className="border-t border-linha py-4">
                    <dt className="font-medium text-carvao">Limite de renda em 2026</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                      Meio salário-mínimo: {reais(LIMITE_PER_CAPITA)} por pessoa, com o salário-mínimo de {reais(SALARIO_MINIMO_2026)} fixado pelo Decreto 12.797, de 23/12/2025.
                    </dd>
                  </div>
                </dl>
                <Fonte>Lei 14.898, de 13/06/2024, arts. 2º e 6º; Decreto 12.797/2025, conforme Ministério da Previdência Social, gov.br, publicação de 05/01/2026.</Fonte>
              </div>
            </Recolhido>

            <Recolhido
              id="declaracoes"
              aberto
              nivelTitulo={2}
              titulo="O que os prestadores declararam para 2024"
              resumo="Respostas do formulário financeiro do SINISA para cada prestador em cada município atendido com água. Ano de referência 2024, antes de a lei produzir todos os efeitos."
            >
              <div className="pb-6">
                <FaixaNumeros rotulo="Declarações de 2024 ao SINISA">
                  {numerosDeclaracoes.map((x) => (
                    <NumeroIndicador key={x.rotulo} {...x} tamanho="m" />
                  ))}
                </FaixaNumeros>
                <Ressalva
                  permite="Saber onde o prestador declara oferecer tarifa social, com que critérios e para quantas economias."
                  naoPermite="Dizer quantas famílias recebem o benefício: o SINISA conta economias, não famílias, e vínculos sem resposta ficam fora. A comparação com as famílias elegíveis do CadÚnico está na seção seguinte, como razão entre contagens diferentes."
                />
                <Nota>
                  {inteiro(semResposta)} vínculos não responderam se há tarifa social. O valor médio declarado da tarifa social (GFI1037) tem registros incompatíveis com uma conta mensal,
                  alguns acima de R$ 100 mil, e não é publicado, nem aqui nem na ficha de cada município.
                </Nota>
                <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), informações financeiras por prestador e município, campos GFI1019 a GFI1037.</Fonte>
              </div>
            </Recolhido>

            <Recolhido
              id="desconto"
              aberto
              nivelTitulo={2}
              titulo="Quanto a tarifa social reduz a conta, nas tabelas verificadas?"
              resumo="Conta mensal calculada com as tabelas vigentes em 2026, para a categoria residencial e cada categoria social ou de vulnerabilidade, no mesmo consumo. Água e esgoto quando as duas tabelas da categoria foram verificadas; só água, dos dois lados, quando não."
            >
              <div className="pb-6">
                <TabelaDados
                  titulo="Conta residencial e social para 10 e 15 m³"
                  colunas={["Prestador e categoria", ...CONSUMOS.flatMap((c) => [`${c} m³, residencial`, `${c} m³, categoria`, `${c} m³, desconto`])]}
                  linhas={linhasDesconto}
                  limite={linhasDesconto.length}
                  recolhida={false}
                />
                <Ressalva
                  permite="Comparar o desconto efetivo na conta, no mesmo consumo, entre categorias e prestadores da amostra."
                  naoPermite="Verificar a conformidade com a lei: a regra legal incide sobre a primeira faixa, e cada estrutura tarifária define faixas diferentes; categorias de vulnerabilidade podem ter critérios distintos da tarifa social da lei."
                />
                {aguaSolidaria && (
                  <Nota titulo="Água Solidária, o programa estadual da SANEPAR">
                    O Paraná manteve o Água Solidária ao lado da tarifa social federal. A Resolução AGEPAR 23/2026 traz tabela própria, com esgoto a 50% da tarifa de água. Em{" "}
                    {aguaSolidaria.consumo} m³ em Curitiba, a conta de água e esgoto é {reais(aguaSolidaria.solidaria)} no Água Solidária, {reais(aguaSolidaria.social)} na tarifa social federal e{" "}
                    {reais(aguaSolidaria.residencial)} na residencial. Quem está no Água Solidária não recebe a tarifa social federal, e cada CPF tem um benefício social ativo. Pelos critérios que
                    a Sanepar publica, com base no Decreto Estadual 9.606/2021, o programa vale para imóvel residencial de até 70 m², consumo de até 10 m³ por mês (famílias com mais de 4 pessoas e
                    consumo acima disso são medidas por até 2,5 m³ por residente), renda de até meio salário mínimo por pessoa ou de até 2 salários mínimos em imóvel com até 4 ocupantes, um
                    cadastro por CPF e validade de 24 meses. O texto do decreto não foi lido e o enquadramento não é verificado: a conta vale para quem se enquadra. O cenário de peso na renda,
                    mais abaixo, usa {aguaSolidaria.consumo} m³ para o Água Solidária, dentro do limite de consumo, e não verifica o tamanho do imóvel.
                  </Nota>
                )}
                <Fonte>Tabelas tarifárias verificadas nos atos dos reguladores; mesma regra de cálculo do simulador (capítulo 5.1).</Fonte>
              </div>
            </Recolhido>

            <Recolhido
              id="orcamento"
              aberto
              nivelTitulo={2}
              titulo="Quanto a conta pesa na renda de uma família no limite?"
              resumo={
                <>
                  Cenário, não medida: família com renda per capita exatamente no limite da lei ({reais(LIMITE_PER_CAPITA)} em 2026), com {FAMILIAS.join(" ou ")} pessoas, consumindo 10 m³ por mês.
                  Percentual da renda familiar mensal.
                </>
              }
            >
              <div className="pb-6">
                <TabelaDados
                  titulo="Conta de 10 m³ como percentual da renda familiar no limite de elegibilidade"
                  colunas={["Prestador e categoria", ...cenarios.map((c) => `${c.n} pessoas, renda de ${reais(c.renda)}`)]}
                  linhas={linhasOrcamento}
                  limite={linhasOrcamento.length}
                  recolhida={false}
                />
                <Ressalva
                  permite="Dimensionar a ordem de grandeza da conta no orçamento de uma família elegível, com e sem a tarifa social."
                  naoPermite="Afirmar que a conta cabe ou não cabe no orçamento de famílias reais: renda, tamanho da família e consumo variam, e não há limiar legal de comprometimento."
                />
              </div>
            </Recolhido>

            <FiguraAnalitica
              id="cobertura"
              pergunta="A tarifa social chega às famílias elegíveis?"
              subtitulo={`Economias com tarifa social por 100 famílias elegíveis, por UF · SINISA 2024 e CadÚnico ${mesAno(mesRef)} · 27 UFs`}
              natureza="CALCULADO"
              comoInterpretar={
                <>
                  Economias residenciais com tarifa social de água declaradas ao SINISA para 2024, para cada 100 famílias do CadÚnico com renda per capita até meio salário-mínimo em{" "}
                  {mesAno(mesRef)}, o critério de renda da lei. É razão entre duas contagens diferentes, não percentual de famílias atendidas. Permite ver onde a tarifa social declarada alcança
                  mais ou menos economias em relação ao público que a lei torna elegível, e onde o prestador declara não oferecê-la.
                </>
              }
              naoConcluir="quantas famílias elegíveis recebem o desconto: uma economia pode abrigar mais de uma família, parte das famílias não tem ligação à rede ou não é titular da conta, e critérios locais anteriores à lei podem incluir quem não está no CadÚnico. Razão acima de 100 fica sinalizada como declaração a verificar."
              proveniencia={provenienciaSinisa({
                indicador: "Economias com tarifa social de água por 100 famílias elegíveis do CadÚnico, por UF",
                natureza: "CALCULADO",
                unidade: "economias por 100 famílias",
                inicio: "2024",
                fim: "2024",
                planilha: "agua_financeira_municipio",
                formula: "economias com tarifa social (GFI1036, soma dos prestadores de água) ÷ famílias do CadÚnico com renda per capita até meio salário-mínimo, no mesmo universo de municípios × 100",
              })}
              complementares={[
                {
                  rotulo: `CadÚnico, ${mesAno(mesRef)}`,
                  p: provenienciaCadUnico({ indicador: "Famílias do CadÚnico com renda per capita até meio salário-mínimo", natureza: "OBSERVADO", unidade: "famílias", inicio: `${mesRef.slice(0, 4)}-${mesRef.slice(4, 6)}`, fim: `${mesRef.slice(0, 4)}-${mesRef.slice(4, 6)}`, mes: mesRef }),
                },
              ]}
              tabela={{
                titulo: `Economias com tarifa social por 100 famílias elegíveis, por UF (SINISA 2024 e CadÚnico ${mesAno(mesRef)})`,
                colunas: ["UF", "Por 100 famílias"],
                linhas: porUf.map((u) => [u.rotulo, u.v]),
                casas: [null, 1],
                limite: porUf.length,
              }}
              complemento={
                <Nota titulo="Declarações acima do universo elegível">
                  {inteiro(acima.length)} municípios declaram mais economias com tarifa social do que famílias elegíveis (razão acima de {LIMITE_RAZAO_TARIFA_SOCIAL}): {inteiro(economiasAcima)}{" "}
                  economias para {inteiro(familiasAcima)} famílias. Sem eles, a razão do Brasil seria {numero(razaoSemAcima, 1)} em vez de {numero(razaoBr, 1)}. O SINISA é declaratório e o
                  Observatório não corrige o dado: a soma publicada os mantém, a tabela os sinaliza e o atlas os deixa fora das classes, para que um erro de declaração não defina a escala.
                </Nota>
              }
              depois={
                <>
                  <div data-mapa-legado="atlas-tarifa-social">
                    <AtlasMunicipal semTabela ids={ATLAS} referencias={refs} nomesUf={nomesUf} titulo="Atlas municipal do alcance da tarifa social" />
                  </div>
                </>
              }
            >
              <GraficoBarras
                semTabela
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
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <TabelaDados
            titulo="Alcance da tarifa social por município"
            colunas={["Município", "UF", "Tarifa social declarada", `Famílias elegíveis (${mesAno(mesRef)})`, "Economias com tarifa social (2024)", "Por 100 famílias"]}
            linhas={porFamilias.map((x) => [x.municipio, x.uf, x.estado, x.familias, x.economias, x.razao])}
            links={{ Município: porFamilias.map((x) => x.href) }}
            nomeArquivo="saneamento-tarifa-social-cadunico"
            casas={[null, null, null, 0, 0, 1]}
            ordenavel
            recolhida={false}
          />
        }
        notas={{
          id: "para-ler",
          // h3: o "Nesta página" lista os capítulos (h2); a nota de leitura não é um deles
          nivelTitulo: 3,
          itens: [
            {
              termo: "Por que o BPC não entra somado",
              definicao:
                "Desde o Decreto 8.805/2016, a inscrição no CadÚnico é requisito para conceder e manter o BPC (MDS, Guia do BPC, 2018). As famílias com BPC já estão no cadastro, e o MDS publica o BPC por beneficiário, não por família: somar as duas contagens contaria famílias duas vezes. O denominador usa só o CadÚnico e pode deixar de fora famílias com BPC cuja renda, sem o benefício, fica abaixo do limite, porque a lei exclui o BPC do cálculo da renda.",
            },
          ],
        }}
        metodo={
          <>
            <Fonte>{fonteCobertura}</Fonte>
            <p>
              A tabela municipal tem busca, ordenação e exportação do recorte exibido; o nome de cada município abre a ficha dele em{" "}
              <Link className="text-obee-dark underline underline-offset-2" href={`${ROTA}/municipio`}>
                Meu município
              </Link>
              .
            </p>
          </>
        }
      />
    </>
  );
}
