import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Indisponivel, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FiguraOds, MundoNoCapitulo } from "@/components/saneamento/ReferenciaMundial";
import { TresTs } from "@/components/saneamento/Ilustracoes";
import { agregado, agregados, fichas, prestadores } from "@/lib/saneamento/gold";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { numero, reaisCompacto } from "@/lib/saneamento/formato";
import { NATUREZA_CURTA } from "@/lib/saneamento/rotulos";
import type { Agregado, Investimento } from "@/lib/saneamento/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "De onde vem o dinheiro do saneamento?",
  description:
    "Investimento em água e esgoto declarado ao SINISA 2024 por origem dos recursos (próprios, onerosos e não onerosos), por quem investe (prestador ou Estado), por natureza jurídica do prestador e por UF.",
  alternates: { canonical: "/saneamento/financiamento" },
};

const FONTES = [
  { id: "proprios", rotulo: "Recursos próprios", cor: "var(--cor-obee)" },
  { id: "onerosos", rotulo: "Onerosos (empréstimos e financiamentos)", cor: "var(--serie-comp-1)" },
  { id: "nao_onerosos", rotulo: "Não onerosos (transferências e doações)", cor: "var(--serie-comp-3)" },
] as const;
type ChaveFonte = (typeof FONTES)[number]["id"];

function fontesDe(a: Agregado): Record<ChaveFonte, number> {
  const out: Record<ChaveFonte, number> = { proprios: 0, onerosos: 0, nao_onerosos: 0 };
  for (const inv of [a.sinisa.agua.investimento, a.sinisa.esgoto.investimento] as (Investimento | null)[]) {
    for (const f of FONTES) out[f.id] += (inv?.prestador_fontes?.[f.id] ?? 0) + (inv?.estado_fontes?.[f.id] ?? 0);
  }
  return out;
}

export default function Pagina() {
  const cap = capituloPorSlug("financiamento")!;
  const br = agregado("BR")!;
  const ufs = agregados().filter((a) => a.tipo === "UF");
  const fb = fontesDe(br);
  const totalFontes = fb.proprios + fb.onerosos + fb.nao_onerosos;

  const quem = (["agua", "esgoto"] as const).flatMap((s) => {
    const inv = br.sinisa[s].investimento;
    const nome = s === "agua" ? "Água" : "Esgoto";
    return [
      { id: `${s}-p`, rotulo: `${nome}, prestador`, ...Object.fromEntries(FONTES.map((f) => [f.id, (inv?.prestador_fontes?.[f.id] ?? 0) / 1e9])) },
      { id: `${s}-e`, rotulo: `${nome}, Estado`, ...Object.fromEntries(FONTES.map((f) => [f.id, (inv?.estado_fontes?.[f.id] ?? 0) / 1e9])) },
    ];
  });

  const porUf = ufs
    .map((u) => {
      const f = fontesDe(u);
      const t = f.proprios + f.onerosos + f.nao_onerosos;
      return { id: u.id, rotulo: u.nome, proprios: razaoPct(f.proprios, t), onerosos: razaoPct(f.onerosos, t), nao_onerosos: razaoPct(f.nao_onerosos, t) };
    })
    .sort((a, b) => (b.onerosos ?? 0) + (b.nao_onerosos ?? 0) - ((a.onerosos ?? 0) + (a.nao_onerosos ?? 0)));

  // Natureza jurídica: soma das parcelas do prestador declaradas em cada vínculo prestador × município.
  const natureza = new Map(prestadores().map((p) => [p.id, p.natureza ?? "Não informada"]));
  const porNat = new Map<string, Record<ChaveFonte, number>>();
  for (const f of fichas()) {
    for (const v of f.sinisa.prestadores ?? []) {
      const pf = v.investimento?.prestador_fontes;
      if (!pf) continue;
      const n = natureza.get(v.prestador) ?? "Não informada";
      const acc = porNat.get(n) ?? { proprios: 0, onerosos: 0, nao_onerosos: 0 };
      for (const k of FONTES) acc[k.id] += pf[k.id] ?? 0;
      porNat.set(n, acc);
    }
  }
  const nat = [...porNat.entries()]
    .map(([n, f]) => ({ id: n, rotulo: NATUREZA_CURTA[n] ?? n, proprios: f.proprios / 1e9, onerosos: f.onerosos / 1e9, nao_onerosos: f.nao_onerosos / 1e9 }))
    .sort((a, b) => b.proprios + b.onerosos + b.nao_onerosos - (a.proprios + a.onerosos + a.nao_onerosos));
  const somaNat = nat.reduce((a, n) => a + n.proprios + n.onerosos + n.nao_onerosos, 0) * 1e9;
  const somaPrestador = (br.sinisa.agua.investimento?.prestador ?? 0) + (br.sinisa.esgoto.investimento?.prestador ?? 0);

  return (
    <>
      <Cabecalho atual="financiamento" />
      <MarcaVisita secao="saneamento:financiamento" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={10}
          titulo={cap.pergunta}
          texto={
            <p>
              O SINISA pede a quem investe que separe a origem do dinheiro: recursos próprios (em geral, a receita das tarifas), recursos onerosos
              (empréstimos e financiamentos, que serão pagos depois, também com tarifa) e recursos não onerosos (transferências a fundo perdido e
              doações). Quem suporta o custo, ao final, é o usuário pela tarifa ou o contribuinte pelo orçamento.
            </p>
          }
          recorte={<>Investimento de 2024 declarado por prestadores e Estados ao SINISA, valores correntes. As fontes somam {reaisCompacto(totalFontes)}.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />

        <Numeros
          colunas={3}
          itens={FONTES.map((f) => ({
            rotulo: f.rotulo,
            valor: reaisCompacto(fb[f.id]),
            contexto: <>{numero(razaoPct(fb[f.id], totalFontes), 1)}% do investimento com origem declarada, água e esgoto, prestador e Estado.</>,
          }))}
        />

        <Secao
          id="quem-paga"
          titulo="Quem paga, no fim?"
          texto="Todo investimento em água e esgoto acaba pago por uma de três fontes. Empréstimos e financiamentos só adiantam o dinheiro."
        >
          <TresTs proprios={fb.proprios} onerosos={fb.onerosos} naoOnerosos={fb.nao_onerosos} />
        </Secao>

        <Secao id="quem" titulo="Quem investe e com que dinheiro?" texto="Investimento de 2024 por serviço, por quem declara e por origem dos recursos, em bilhões de reais correntes.">
          <GraficoBarras
            titulo="Investimento por origem dos recursos (R$ bilhões correntes de 2024)"
            dados={quem}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={FONTES.map((f) => ({ id: f.id, rotulo: f.rotulo, cor: f.cor }))}
            unidade="R$ bi"
            casas={2}
            orientacao="horizontal"
            empilhado
          />
          <Ressalva
            permite="Ver o peso de cada origem de recursos no investimento declarado e a parcela dos governos estaduais."
            naoPermite="Separar quanto da tarifa paga a dívida ou quanto do recurso próprio veio de aporte do acionista: o SINISA não detalha a composição dos recursos próprios."
          />
        </Secao>

        <Secao
          id="natureza"
          titulo="A origem do dinheiro muda com a natureza do prestador?"
          texto="Parcela do investimento declarada pelos prestadores, somada por natureza jurídica do prestador, em bilhões de reais. Não inclui a parcela dos Estados."
        >
          <GraficoBarras
            titulo="Investimento do prestador por natureza jurídica e origem (R$ bilhões correntes de 2024)"
            dados={nat}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={FONTES.map((f) => ({ id: f.id, rotulo: f.rotulo, cor: f.cor }))}
            unidade="R$ bi"
            casas={2}
            orientacao="horizontal"
            empilhado
          />
          <Nota>
            Soma por natureza: {reaisCompacto(somaNat)}; parcela do prestador no consolidado nacional: {reaisCompacto(somaPrestador)}. A soma dos
            vínculos prestador × município reproduz o consolidado oficial por origem de recursos.
          </Nota>
          <Ressalva
            permite="Comparar a composição das fontes entre empresas privadas, companhias estaduais, autarquias e prestação direta municipal."
            naoPermite="Comparar eficiência ou capacidade de investimento entre naturezas: as áreas atendidas, as escalas e as fases de contrato são muito diferentes."
          />
        </Secao>

        <Secao id="por-uf" titulo="Onde o investimento depende mais de financiamento ou de transferência?" texto="Composição percentual do investimento de 2024 por origem, prestador e Estado somados, ordenada pela parcela não própria.">
          <GraficoBarras
            titulo="Origem do investimento em água e esgoto, por UF (% do investimento com origem declarada)"
            dados={porUf}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={FONTES.map((f) => ({ id: f.id, rotulo: f.rotulo, cor: f.cor }))}
            unidade="%"
            casas={1}
            orientacao="horizontal"
            empilhado
          />
          <Ressalva
            permite="Ver em que UFs o investimento de 2024 dependeu mais de dívida ou de transferências."
            naoPermite="Tratar um ano como padrão: a composição muda com a liberação de financiamentos e programas federais."
          />
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), consolidado por UF e base prestador × município, campos GFI2021 a GFI2023, GFI2033 a GFI2035, GFI2121 a GFI2123 e GFI2133 a GFI2135.</Fonte>
        </Secao>

        <Secao
          id="mundo"
          titulo="Quanto vem de ajuda internacional?"
          texto="A OCDE registra o que doadores desembolsam para água e saneamento em cada país que recebe ajuda oficial ao desenvolvimento. O valor dá a ordem de grandeza do dinheiro externo não reembolsável ou concessional; não entra na soma do investimento declarado."
        >
          <MundoNoCapitulo>
            <FiguraOds codigo="DC_TOF_WASHL" semRegua />
          </MundoNoCapitulo>
        </Secao>

        <Secao id="contratacoes" titulo="E os financiamentos contratados?">
          <Indisponivel titulo="Contratações e desembolsos ainda não conciliados">
            <p>
              Operações do BNDES, da CAIXA (FGTS) e transferências do Orçamento Geral da União registradas no Transferegov têm datas, mutuários e
              objetos próprios. Sem conciliar operação a operação com o investimento declarado ao SINISA, somar as duas fontes contaria o mesmo real
              duas vezes. A conciliação não foi feita.
            </p>
          </Indisponivel>
        </Secao>
      </main>
    </>
  );
}
