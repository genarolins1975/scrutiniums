import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { PAINEIS_CARGA, ROTA_CARGA, rotaPainel, type PainelCarga } from "@/lib/energia/carga";
import { carimbo, dataBR } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";
import type { FonteCarga } from "@/lib/energia/tipos-carga";
import { datasLegiveis } from "@/lib/energia/visao";

/**
 * Peças de servidor das páginas da Carga (um painel por página: /setor-eletrico/carga
 * para o P025, /perfil-horario para o P026 e /clima-e-calendario para o P027):
 * navegação entre as páginas, avisos de ausência e defasagem, as datas de cada parte,
 * o rodapé com downloads, link compartilhável e próxima pergunta, e a lista de fontes.
 * As seções de Analisar e Auditar são `SecaoDoPainel`, direto nas páginas.
 *
 * Por que um painel por página: cada painel tem séries horárias ou diárias, várias
 * tabelas equivalentes e fichas de prova; juntos passariam da meta de cerca de 600 KB
 * de HTML por página (contrato, seção 5.1).
 */

/** Páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta do painel. */
const ITENS_CARGA = PAINEIS_CARGA.map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Navegação entre as três páginas: faixa de páginas irmãs nas filhas. A abertura (nível e crescimento) não leva a faixa, porque mostra
 * os mesmos destinos como capítulos depois da figura principal (CargaCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function CargaNavegacao({ atual }: { atual: PainelCarga }) {
  if (atual === "p025") return null;
  return <NavegacaoLocal rotulo="Páginas da carga" itens={ITENS_CARGA} atual={atual} />;
}

/** Capítulos da abertura: as outras duas páginas do módulo, cada uma com a pergunta que responde. */
export function CargaCapitulos({ atual = "p025" }: { atual?: PainelCarga }) {
  return <NavegacaoLocal rotulo="Capítulos da carga" itens={ITENS_CARGA} atual={atual} variante="capitulos" titulo="Outras perguntas sobre a carga" />;
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function CargaIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Carga indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold de detalhe da carga (public/energia/gold/carga_detalhe.json) não foi gerada ou não passou na validação física; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_CARGA} className="text-energia-dark underline underline-offset-4">
            Voltar à carga
          </Link>
        </p>
      </main>
    </>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function CargaAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function CargaSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads} />;
}

/** Datas de referência de cada parte da página: cada número diz o seu dia, sem sugerir simultaneidade. */
export function CargaDatas({ itens }: { itens: { rotulo: string; dia: string | null; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label="Datas de referência de cada parte">
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

/** Lista das fontes usadas no painel, com recurso, licença, período e última captura. */
export function CargaFontes({ fontes }: { fontes: FonteCarga[] }) {
  return (
    <ul className="space-y-2 text-sm text-carvao-muted">
      {fontes.map((f) => (
        // recurso pode ser um endereço longo sem espaço: quebra dentro da linha em vez de alargar a página no celular
        <li key={f.id} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-carvao">
            {f.orgao}, {f.conjunto}
          </span>
          : {f.recurso}. Grão: {f.grao}
          {f.unidade ? `; unidade: ${f.unidade}` : ""}
          {f.periodo ? `; período: ${datasLegiveis(f.periodo.inicio ?? "sem início")} a ${datasLegiveis(f.periodo.fim ?? "sem fim")}` : ""}
          {f.ultima_captura ? `; última captura: ${carimbo(f.ultima_captura)}` : ""}. Licença: {f.licenca}.{" "}
          <a href={f.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
            Endereço da fonte
          </a>
        </li>
      ))}
    </ul>
  );
}
