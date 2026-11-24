import Link from "next/link";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { Escala } from "@/components/observatorios/EntradaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { NumeroEscala } from "@/components/observatorios/NumeroEscala";
import { indiceSnapshot } from "@/lib/eficiencia/indice-v4";
import {
  amplitude,
  inicioSequenciaCompleta,
  indicador,
  serieBR,
  seriePct,
  serieUF,
  ultimoIndice,
  ultimoIndiceSimFinal,
} from "@/lib/eficiencia/seguranca/dados";
import { contagemComUnidade, dataBr, inteiro, listaNatural, numero, percentualVariacao, reais } from "@/lib/eficiencia/seguranca/formato";
import type { GoldSeguranca } from "@/lib/eficiencia/seguranca/tipos";
import { numeroViolenciaNaUf } from "@/lib/observatorios/paraVoce";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { DoisRegistros, type DadosDoisRegistros } from "./DoisRegistros";
import { SeuEstado, type DadosSeuEstado } from "./SeuEstado";
import { Tendencia } from "./Tendencia";

/** Pergunta para começar do panorama: destino, resposta curta e o número lido da mesma gold do destino. */
export type PortaSeguranca = { rotulo: string; pergunta: string; resumo: string; href: string; numero: NumeroPorta };

const FONTE_SINESP = "Sinesp VDE (MJSP)";
const FONTE_SIM = "SIM (Ministério da Saúde)";

/**
 * Os quatro números da abertura, cada um com fonte, período e a ressalva que o acompanha (direção do coordenador, 24/11/2026):
 * homicídio doloso no último ano com as 27 UFs; óbito por agressão no último ano final do SIM, com a contagem policial do mesmo ano
 * ao lado (anos diferentes nunca lado a lado sem dizer); feminicídio; morte por intervenção de agente do Estado no último ano com as
 * 27 UFs. Tudo lido da gold.
 */
export function numerosAbertura(g: GoldSeguranca, rota: string): NumeroPorta[] {
  const kH = ultimoIndice(g, "homicidio"), kS = ultimoIndiceSimFinal(g), kF = ultimoIndice(g, "feminicidio"), kI = ultimoIndice(g, "intervencao");
  const h = serieBR(g, "homicidio"), s = serieBR(g, "agressoes"), f = serieBR(g, "feminicidio"), iv = serieBR(g, "intervencao");
  const kUltI = g.anos.length - 1;
  const ivDepois = kUltI > kI && iv.n[kUltI] !== null ? `Em ${g.anos[kUltI]}, ${listaNatural(iv.fora[kUltI])} sem dado completo: o total desse ano soma ${iv.cobertura[kUltI]} UFs.` : "";
  return [
    {
      rotulo: "Vítimas de homicídio doloso, registro policial",
      valor: numero(h.taxa?.[kH] as number, 1),
      unidade: "por 100 mil habitantes",
      periodo: String(g.anos[kH]),
      fonte: `${FONTE_SINESP}, 27 UFs`,
      nota: `${inteiro(h.n[kH] as number)} vítimas${h.variacao[kH] !== null ? `; ${percentualVariacao(h.variacao[kH] as number)} sobre ${g.anos[kH - 1]}` : ""}.`,
      href: `${rota}/estados?indicador=homicidio`,
    },
    {
      rotulo: "Óbitos por agressão, registro de saúde",
      valor: numero(s.taxa?.[kS] as number, 1),
      unidade: "por 100 mil habitantes",
      periodo: `${g.anos[kS]}, último ano com dado final`,
      fonte: FONTE_SIM,
      nota: `${inteiro(s.n[kS] as number)} óbitos. No mesmo ano, a polícia registrou ${h.situacao[kS] === "ok" ? `${inteiro(h.n[kS] as number)} vítimas de homicídio doloso` : "homicídio doloso sem as 27 UFs"}.`,
      href: `${rota}/estados?indicador=agressoes&ano=${g.anos[kS]}`,
    },
    {
      rotulo: "Vítimas de feminicídio",
      valor: numero(f.taxa?.[kF] as number, 2),
      unidade: "por 100 mil mulheres",
      periodo: String(g.anos[kF]),
      fonte: `${FONTE_SINESP}; mulheres residentes, IBGE`,
      nota: `${inteiro(f.n[kF] as number)} vítimas. Classificação penal específica: não é todo homicídio de mulher.`,
      href: `${rota}/mulheres`,
    },
    {
      rotulo: "Mortes por intervenção de agente do Estado",
      valor: numero(iv.taxa?.[kI] as number, 2),
      unidade: "por 100 mil habitantes",
      periodo: String(g.anos[kI]),
      fonte: `${FONTE_SINESP}, 27 UFs`,
      nota: `${inteiro(iv.n[kI] as number)} vítimas. ${ivDepois}`.trim(),
      href: `${rota}/estados?indicador=intervencao&ano=${g.anos[kI]}`,
    },
  ];
}

/** As oito portas do panorama, cada uma com o número do destino lido da gold (ou do índice das capitais, que é outra fonte). */
export function portasPanorama(g: GoldSeguranca, rota: string): PortaSeguranca[] {
  const ult = (id: string) => ultimoIndice(g, id);
  const kL = ult("latrocinio"), kF = ult("feminicidio"), kV = ult("estupro_vulneravel"), kR = ult("roubo_veiculo"), kD = ult("desaparecidos"), kG = ult("despesa_habitante");
  const kF0 = inicioSequenciaCompleta(g, "feminicidio"), kR0 = inicioSequenciaCompleta(g, "roubo_veiculo");
  const L = serieBR(g, "latrocinio"), F = serieBR(g, "feminicidio"), V = serieBR(g, "estupro_vulneravel"), R = serieBR(g, "roubo_veiculo"), D = serieBR(g, "desaparecidos"), G = serieBR(g, "despesa_habitante");
  const peso = seriePct(g, "despesa_participacao", "BR").pct[kG];
  const kUlt = g.anos.length - 1, iv = serieBR(g, "intervencao");
  const kVprimeiroCompleto = V.situacao.indexOf("ok");
  // capitais: Atlas da Violência (Ipea e FBSP), homicídios registrados mais os ocultos estimados; outra fonte, outro conceito e outro ano
  const atlas = indiceSnapshot.indicators.find((i) => i.id === "seguranca");
  const capitais = indiceSnapshot.rows
    .map((r) => ({ nome: r.name, v: r.raw_values.seguranca ?? null }))
    .filter((x): x is { nome: string; v: number } => typeof x.v === "number")
    .sort((a, b) => a.v - b.v);
  const portas: PortaSeguranca[] = [
    {
      rotulo: "Violência letal",
      pergunta: "Quantas pessoas morrem em cada tipo de violência?",
      resumo: "Homicídio doloso, latrocínio, lesão seguida de morte e mortes pela polícia, cada um com a própria série.",
      href: `${rota}/letalidade`,
      numero: { rotulo: "Vítimas de latrocínio", valor: inteiro(L.n[kL] as number), unidade: `vítimas · ${numero(L.taxa?.[kL] as number, 2)} por 100 mil`, periodo: String(g.anos[kL]), fonte: FONTE_SINESP, href: `${rota}/letalidade` },
    },
    {
      rotulo: "Mulheres",
      pergunta: "A violência contra as mulheres está crescendo?",
      resumo: "Feminicídio e tentativa, óbitos de mulheres por agressão e violência sexual, ano a ano.",
      href: `${rota}/mulheres`,
      numero: { rotulo: "Vítimas de feminicídio", valor: inteiro(F.n[kF] as number), unidade: "vítimas", periodo: String(g.anos[kF]), fonte: FONTE_SINESP, nota: kF0 < kF ? `Eram ${inteiro(F.n[kF0] as number)} em ${g.anos[kF0]}, com as 27 UFs.` : undefined, href: `${rota}/mulheres` },
    },
    {
      rotulo: "Violência sexual",
      pergunta: "Quantas vítimas de estupro de vulnerável são registradas?",
      resumo: "Vulnerável: menor de 14 anos ou pessoa sem condição de consentir. A idade da vítima não está na base do painel.",
      href: `${rota}/mulheres`,
      numero: { rotulo: "Vítimas de estupro de vulnerável", valor: inteiro(V.n[kV] as number), unidade: "vítimas", periodo: String(g.anos[kV]), fonte: FONTE_SINESP, nota: kVprimeiroCompleto === kV ? "Primeiro ano com as 27 UFs; antes, a soma não cobre o país." : undefined, href: `${rota}/mulheres` },
    },
    {
      rotulo: "Patrimônio",
      pergunta: "Roubar carro ficou mais raro?",
      resumo: "Furto e roubo de veículo, roubo de carga e a instituições financeiras, em ocorrências registradas.",
      href: `${rota}/patrimonio`,
      numero: { rotulo: "Roubos de veículo", valor: numero(R.taxa?.[kR] as number, 1), unidade: "por 100 mil habitantes", periodo: String(g.anos[kR]), fonte: FONTE_SINESP, nota: kR0 < kR ? `Era ${numero(R.taxa?.[kR0] as number, 1)} em ${g.anos[kR0]}, com as 27 UFs.` : undefined, href: `${rota}/patrimonio` },
    },
    {
      rotulo: "Busca de pessoas",
      pergunta: "Quantas pessoas desaparecem por ano?",
      resumo: "Desaparecimentos e localizações registrados, ao lado de apreensões de armas e mandados cumpridos.",
      href: `${rota}/resposta`,
      numero: { rotulo: "Registros de desaparecimento", valor: inteiro(D.n[kD] as number), unidade: "registros", periodo: String(g.anos[kD]), fonte: FONTE_SINESP, nota: "Registro não é pessoa única: a mesma pessoa pode ter mais de um.", href: `${rota}/resposta` },
    },
    {
      rotulo: "Recursos",
      pergunta: "Quanto os estados gastam com segurança?",
      resumo: "Despesa dos governos estaduais por habitante e o peso dela no orçamento de cada estado.",
      href: `${rota}/recursos`,
      numero: { rotulo: "Despesa estadual por habitante", valor: reais(G.taxa?.[kG] as number), unidade: "por habitante, reais correntes", periodo: String(g.anos[kG]), fonte: "Siconfi (Tesouro Nacional)", nota: peso != null ? `${numero(peso, 1)}% da despesa liquidada dos estados.` : undefined, href: `${rota}/recursos` },
    },
    {
      rotulo: "Mortes pela polícia",
      pergunta: "Quantas pessoas morrem em ações de agentes do Estado?",
      resumo: "Mortes por intervenção de agente do Estado e mortes de agentes, por estado e ano.",
      href: `${rota}/estados?indicador=intervencao`,
      numero: {
        rotulo: "Mortes por intervenção de agente do Estado",
        valor: inteiro(iv.n[kUlt] as number),
        unidade: "vítimas",
        periodo: iv.situacao[kUlt] === "ok" ? String(g.anos[kUlt]) : `${g.anos[kUlt]}, soma de ${iv.cobertura[kUlt]} UFs`,
        fonte: FONTE_SINESP,
        nota: iv.situacao[kUlt] === "ok" ? undefined : `Fora: ${listaNatural(iv.fora[kUlt])}. Soma parcial, não é o total do país.`,
        href: `${rota}/estados?indicador=intervencao`,
      },
    },
  ];
  if (atlas && capitais.length > 1) {
    const [menor, maior] = [capitais[0], capitais[capitais.length - 1]];
    portas.push({
      rotulo: "Capitais",
      pergunta: "E na minha capital?",
      resumo: `Outra fonte, outro ano e outro conceito: ${atlas.label.toLowerCase()} pelo Atlas da Violência, que soma registros e homicídios ocultos estimados.`,
      href: "/eficiencia-estatal",
      numero: { rotulo: `${atlas.label}, menor e maior entre as ${capitais.length} capitais`, valor: `${numero(menor.v, 1)} a ${numero(maior.v, 1)}`, unidade: `${atlas.unit}, de ${menor.nome} a ${maior.nome}`, periodo: atlas.period, fonte: atlas.source, href: "/eficiencia-estatal" },
    });
  }
  return portas;
}

/** Dados do bloco "Como está o meu estado?": a taxa de cada UF lida pelo mesmo leitor do "Para você" do mapa da conta. */
function dadosSeuEstado(g: GoldSeguranca, rota: string): DadosSeuEstado {
  const kH = ultimoIndice(g, "homicidio"), kS = ultimoIndiceSimFinal(g);
  const br = serieBR(g, "homicidio");
  return {
    ano: g.anos[kH],
    anoSim: g.anos[kS],
    rota,
    comparadas: amplitude(g, "homicidio", kH).comparadas,
    brasil: { taxa: br.taxa?.[kH] as number, sim: serieBR(g, "agressoes").taxa?.[kS] ?? null, indeterminadas: seriePct(g, "indeterminadas_pct", "BR").pct[kS] },
    ufs: g.ufs.map((u) => {
      const s = serieUF(g, "homicidio", u.sigla);
      return {
        sigla: u.sigla,
        nome: u.nome,
        taxa: s.taxa?.[kH] ?? null,
        valor: numeroViolenciaNaUf(u.sigla).valor,
        motivo: s.motivo[kH],
        posicao: s.posicao?.[kH] ?? null,
        sim: serieUF(g, "agressoes", u.sigla).taxa?.[kS] ?? null,
        indeterminadas: seriePct(g, "indeterminadas_pct", u.sigla).pct[kS],
      };
    }),
    fonteSinesp: `${FONTE_SINESP}, captura de ${dataBr(g.fontes.sinesp.capturado_em)}`,
    fonteSim: `${FONTE_SIM}, ${g.anos[kS]}, dado final`,
  };
}

function dadosDoisRegistros(g: GoldSeguranca): DadosDoisRegistros {
  const kS = ultimoIndiceSimFinal(g);
  const ano = g.anos[kS];
  return {
    ano,
    simSituacao: g.fontes.sim.situacao[String(ano)],
    ufs: g.ufs.map(({ sigla, nome }) => ({ sigla, nome })),
    valores: Object.fromEntries(["BR", ...g.ufs.map((u) => u.sigla)].map((uf) => {
      const h = g.series.homicidio[uf] as { n: (number | null)[]; situacao: string[] };
      const s = g.series.agressoes[uf] as { n: (number | null)[] };
      return [uf, { policia: h.situacao[kS] === "ok" ? h.n[kS] : null, saude: s.n[kS], indeterminadas: seriePct(g, "indeterminadas_pct", uf).pct[kS] }];
    })),
  };
}

/**
 * Panorama da Segurança pública, organizado pela pergunta do leitor (diagnóstico de 24/11/2026 e mock do Figma, "02 · Segurança"):
 * abertura com a pergunta e os quatro números; "Como está o meu estado?" (destino mais procurado a um clique); a evolução da violência
 * letal com a parcela sem intenção definida; o modelo didático dos dois registros; oito portas por pergunta; o método recolhido no fim.
 * Fatias marcadas com `data-fatia`, na ordem do molde das entradas. Nenhum número escrito à mão.
 */
export function Panorama({ g, rota }: { g: GoldSeguranca; rota: string }) {
  const kH = ultimoIndice(g, "homicidio");
  const numeros = numerosAbertura(g, rota);
  const portas = portasPanorama(g, rota);
  const capturaSinesp = dataBr(g.fontes.sinesp.capturado_em);
  const quatro = portas.length % 4 === 0;
  return (
    <div className="space-y-14 md:space-y-16" data-panorama="seguranca">
      <section aria-labelledby="panorama-titulo" data-fatia="abertura">
        <p className="rotulo text-mineral">Proteção e direitos · 27 UFs · {g.anos[0]} a {g.anos[kH]}</p>
        <h1 id="panorama-titulo" className="t-h1 mt-4 max-w-4xl text-carvao">A violência no Brasil está caindo? E no seu estado?</h1>
        <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
          A mesma morte violenta é contada duas vezes: pela polícia, no Sinesp, e pela saúde, no SIM. O painel mostra os dois registros em cada estado, em taxa por 100 mil habitantes.
        </p>
        <Escala escala={numeros} nota="Polícia e saúde não se somam nem se substituem: contam a mesma realidade com regras, territórios e prazos diferentes, e os anos de cada número estão ao lado dele. As UFs revisam as bases depois da publicação." />
      </section>

      <div data-fatia="para-voce">
        <SeuEstado dados={dadosSeuEstado(g, rota)} />
      </div>

      <div data-fatia="secao-propria">
        <Tendencia g={g} rota={rota} />
      </div>

      <div data-fatia="artefato">
        <ModeloDidatico
          id="dois-registros"
          titulo="Uma morte, dois registros"
          descricao="Por que a polícia e a saúde chegam a números diferentes para a mesma violência, e qual dos dois serve para cada pergunta."
          deixaDeFora={[
            "As etapas e os prazos reais de cada fluxo, que têm mais passos e variam entre os estados.",
            "As revisões que as UFs e as secretarias de saúde fazem depois da publicação.",
            "A Polícia Federal e a Polícia Rodoviária Federal, fora do recorte do Sinesp usado aqui.",
            "As intervenções legais (Y35 e Y36), que a saúde não conta como agressão.",
            "Latrocínio e lesão seguida de morte, que a polícia classifica à parte e a saúde conta como agressão.",
          ]}
        >
          <DoisRegistros dados={dadosDoisRegistros(g)} />
        </ModeloDidatico>
      </div>

      <section aria-labelledby="caminhos-titulo" data-fatia="caminhos">
        <h2 id="caminhos-titulo" className="t-h2 text-carvao">Perguntas para começar</h2>
        <ul className={`mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 ${quatro ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {portas.map((c) => (
            <li key={c.pergunta} className="bg-papel">
              <Link href={c.href} prefetch={prefetchDoLink(c.href)} className="group flex h-full min-h-[44px] flex-col p-4 sm:p-5">
                <span className="rotulo text-mineral">{c.rotulo}</span>
                <span className="mt-2 font-serif text-lg leading-snug text-carvao group-hover:underline">
                  {c.pergunta}
                  <SeloComConta href={c.href} className="font-sans" />
                </span>
                <span className="mb-4 mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
                <span className="mt-auto block border-t border-linha pt-3">
                  <span className="block text-xs text-carvao-muted">{c.numero.rotulo}</span>
                  <NumeroEscala n={c.numero} />
                  {c.numero.nota && <span className="mt-1 block text-xs leading-relaxed text-carvao-muted">{c.numero.nota}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <details className="border-t border-linha pt-4" data-fatia="metodo">
        <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e atualização</summary>
        <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
          <p>
            Registros policiais: Sinesp VDE, planilhas anuais de {g.fontes.sinesp.anos[0]} a {g.fontes.sinesp.anos.at(-1)}, só as polícias estaduais, somadas por UF e ano
            {g.fontes.sinesp.ano_parcial ? `; ${g.fontes.sinesp.ano_parcial.ano} tem ${g.fontes.sinesp.ano_parcial.meses} meses e fica fora até fechar o ano` : ""}. Registros de óbito: SIM pelo TabNet, dados finais até {g.fontes.sim.final_ate}
            {Object.keys(g.fontes.sim.extracao_preliminar).length ? ` e ${listaNatural(Object.keys(g.fontes.sim.extracao_preliminar))} preliminar` : ""}. Despesa: Siconfi, DCA dos 27 governos estaduais. População: IBGE, {g.fontes.ibge.rotulo}, a mesma série para todos os anos.
          </p>
          <p>
            Ausência não vira zero: um ano inteiro sem registro numa UF onde o esperado seria de {g.regra_ausencia.limiar_ano} ou mais, ou meses zerados que, pela média do próprio ano, teriam chance menor que {numero(g.regra_ausencia.prob_meses_zerados * 100, 0)}% de acontecer por acaso, ficam sem valor publicado, com o motivo ao lado ({g.ausencias.length} combinações de UF, ano e indicador).
          </p>
          <p>
            Três dimensões, três perguntas. Recursos: quanto foi mobilizado? Atividade: o que foi registrado? Resultados: qual violência é observada? Colocá-las lado a lado ajuda a formular perguntas, mas não identifica, sozinho, a eficiência do Estado; nenhuma ordem entre estados é nota.
          </p>
          <p>
            As capitais vêm de outra fonte: {indiceSnapshot.indicators.find((i) => i.id === "seguranca")?.source ?? "Atlas da Violência"}, com homicídios registrados mais os ocultos estimados pelo modelo da fonte, e não se comparam com o Sinesp.
          </p>
          <p>
            Coleta mensal automática; a publicação só muda quando um número muda e os testes passam. Última captura: Sinesp em {capturaSinesp}, SIM em {dataBr(g.fontes.sim.capturado_em)}, Siconfi em {dataBr(g.fontes.siconfi.capturado_em)}. Despesa total de {g.anos[ultimoIndice(g, "despesa_habitante")]}: {contagemComUnidade(indicador(g, "despesa_habitante"), serieBR(g, "despesa_habitante").n[ultimoIndice(g, "despesa_habitante")] as number)}.
          </p>
          <Link className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4" href={`${rota}/metodos`}>
            Ler o método completo e a lista de ausências
          </Link>
        </div>
      </details>
    </div>
  );
}
