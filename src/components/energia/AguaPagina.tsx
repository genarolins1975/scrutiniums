import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { PAINEIS_AGUA, ROTA_AGUA, rotaPainel, type PainelAgua } from "@/lib/energia/agua";
import { carimbo, dataBR } from "@/lib/energia/formato";
import type { Natureza, Proveniencia } from "@/lib/energia/tipos";

/**
 * Peças de servidor das páginas de Água e clima (um painel por página:
 * /setor-eletrico/agua-e-clima para o P017, /afluencia para o P018,
 * /chuva-e-temperatura para o P019 e /reservatorios para o P020): navegação entre os
 * painéis, recorte (período, universo e unidade), avisos de ausência e defasagem,
 * rodapé com downloads, link compartilhável e próxima pergunta, os blocos dos modos
 * Analisar e Auditar, a lista de fontes e as datas de referência de cada parte.
 *
 * Por que um painel por página: cada painel tem séries, várias tabelas equivalentes e
 * fichas de prova; juntos passariam da meta de cerca de 600 KB de HTML por página
 * (contrato, seção 5.1).
 */

/** Páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta do painel (a mesma do Anexo A). */
const ITENS_AGUA = PAINEIS_AGUA.map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Navegação entre os quatro painéis: a faixa de páginas irmãs no alto de todas elas, a abertura inclusive (a atual vem marcada). A abertura
 * já mostrou os destinos como capítulos no meio da página, a mais de 2.600 px do alto; a faixa no alto os põe à vista antes do título.
 */
export function AguaNavegacao({ atual }: { atual: PainelAgua }) {
  return <NavegacaoLocal rotulo="Painéis de água e clima" itens={ITENS_AGUA} atual={atual} />;
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function AguaIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Água e clima indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold de água e clima (public/energia/gold/agua_detalhe.json) não foi gerada ou não passou na validação física; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_AGUA} className="text-energia-dark underline underline-offset-4">
            Voltar a água e clima
          </Link>
        </p>
      </main>
    </>
  );
}

/** Ausência legítima de uma parte (clima ou reservatórios) dentro de uma gold disponível. */
export function AguaParteAusente({ titulo, motivo }: { titulo: string; motivo: string }) {
  return (
    <div role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm leading-relaxed text-carvao">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 text-carvao-muted">{motivo}</p>
    </div>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function AguaRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-sm text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function AguaAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10), numa linha (SeguirPainel). */
export function AguaSeguir({
  ancora,
  proximo,
  downloads,
  extra,
}: {
  ancora: string;
  proximo: { href: string; pergunta: string };
  downloads: { rotulo: string; url: string }[];
  extra?: ReactNode;
}) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads} extra={extra} />;
}

export function AguaAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function AguaAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Lista das fontes do painel a partir das proveniências: órgão, conjunto, recurso, licença, período e captura. */
export function AguaFontes({ provs }: { provs: (Proveniencia | undefined)[] }) {
  const vistas = new Set<string>();
  const lista = provs.filter((p): p is Proveniencia => {
    if (!p) return false;
    const k = `${p.fonte.orgao}|${p.fonte.dataset}|${p.indicador}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  return (
    <ul className="space-y-2 text-sm text-carvao-muted">
      {lista.map((p) => (
        <li key={`${p.fonte.orgao}|${p.fonte.dataset}|${p.indicador}`} className="leading-relaxed">
          <span className="text-carvao">{p.indicador}</span>: {p.fonte.orgao}, {p.fonte.dataset} ({p.fonte.recurso}). Período de referência:{" "}
          {dataBR(p.periodo_referencia.inicio)} a {dataBR(p.periodo_referencia.fim)}; cobertura histórica: {dataBR(p.cobertura_historica.inicio)} a{" "}
          {dataBR(p.cobertura_historica.fim)}; última captura: {carimbo(p.capturado_em)}. Licença: {p.fonte.licenca.replace(/\.+$/, "")}.{" "}
          <a href={p.fonte.url_dataset || p.fonte.url_primaria} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
            Endereço da fonte
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Datas de referência de cada parte da gold: cada número diz o seu dia, sem sugerir simultaneidade. */
export function AguaDatas({ itens }: { itens: { rotulo: string; dia: string | null; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-carvao-muted" aria-label="Datas de referência de cada parte">
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.dia ? `até ${dataBR(x.dia)}` : "sem dado nesta publicação"}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Regras publicadas na gold (chave e texto), para o modo Auditar. */
export function AguaRegras({ regras, chaves }: { regras: Record<string, string>; chaves: string[] }) {
  const ROTULOS: Record<string, string> = {
    ear_agregada: "EAR agregada",
    ear_absoluta: "EAR em energia",
    capacidade: "Mudanças de capacidade",
    faixa_sazonal: "Faixa sazonal",
    nao_se_aplica: "Não se aplica",
    captura: "Captura usada",
    ena_30d: "ENA de 30 dias",
    mlt: "Versão da MLT",
    precipitacao: "Precipitação",
    temperatura: "Temperatura",
    anomalia: "Anomalia",
    balanco_reservatorio: "Balanço do reservatório",
    previsao: "Previsão",
    decomposicao_ear: "Decomposição da EAR",
  };
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {chaves
        .filter((k) => regras[k])
        .map((k) => (
          <div key={k}>
            <dt className="rotulo text-mineral">{ROTULOS[k] ?? k}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao">{regras[k]}</dd>
          </div>
        ))}
    </dl>
  );
}
