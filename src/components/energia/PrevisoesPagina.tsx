import { datasLegiveis } from "@/lib/energia/formato";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import {
  PAINEIS_PREVISOES,
  ROTA_MODELOS,
  ROTA_PREVISOES,
  enderecoPainel,
  painelPrevisoes,
  rotaModelo,
  slugModelo,
  type AvisoRodada,
  type IdPainelPrevisoes,
} from "@/lib/energia/previsoes";
import type { Natureza } from "@/lib/energia/tipos";

/**
 * Peças de servidor das páginas de Previsões e modelos do PLD (duas aberturas, /previsoes e /modelos, e as fichas de cada modelo):
 * capítulos para as perguntas da outra página, faixa de fichas irmãs, resposta curta, recorte (período, universo e unidade), avisos de
 * ausência, avisos materiais da rodada, datas de cada parte, rodapé com downloads, link compartilhável e próxima pergunta, e as seções
 * dos modos Analisar e Auditar.
 *
 * Por que dois painéis por página: a rodada mais recente e o arquivo de emissões leem a mesma rodada (o que se prevê e o que ficou
 * registrado antes do resultado); o registro de modelos e o desempenho comparam os mesmos modelos. Juntos, os quatro levariam fichas,
 * coeficientes, o arquivo e as provas de cada número a uma página só, acima da meta de cerca de 600 KB de HTML (contrato, seção 5.1).
 */

/** Os painéis como itens da navegação local: o nome de cada um e a pergunta que responde. */
const ITENS_PAINEIS: ItemLocal[] = PAINEIS_PREVISOES.map((p) => ({ id: p.id, href: enderecoPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Capítulos de uma abertura: as perguntas da outra página, cada uma com o nome do painel, a pergunta e o link. As duas perguntas desta
 * página já estão nela, em sequência, e por isso não entram (o mesmo rótulo não aparece duas vezes na mesma página).
 */
export function PrevisoesCapitulos({ pagina }: { pagina: "previsoes" | "modelos" }) {
  const rota = pagina === "previsoes" ? ROTA_PREVISOES : ROTA_MODELOS;
  const outros = ITENS_PAINEIS.filter((i) => painelPrevisoes(i.id as IdPainelPrevisoes).rota !== rota);
  return (
    <NavegacaoLocal
      rotulo="Capítulos de previsões e modelos"
      itens={outros}
      atual=""
      variante="capitulos"
      titulo={pagina === "modelos" ? "Outras perguntas sobre as previsões" : "Outras perguntas sobre os modelos"}
    />
  );
}

/** Faixa de páginas irmãs das fichas: o registro de modelos e as fichas de cada modelo, com a atual marcada. */
export function PrevisoesFaixaFichas({ atual, fichas }: { atual: string; fichas: readonly { codigo: string }[] }) {
  const itens: ItemLocal[] = [
    { id: "registro", href: ROTA_MODELOS, rotulo: "Modelos" },
    ...fichas.map((f) => ({ id: slugModelo(f.codigo), href: rotaModelo(f.codigo), rotulo: f.codigo })),
  ];
  return <NavegacaoLocal rotulo="Fichas dos modelos de previsão" itens={itens} atual={atual} />;
}

/**
 * Envoltório de cada painel com o código do painel em atributo (data-painel): o código identifica o painel para os instrumentos de
 * coleta e de teste, e nunca aparece como texto para o leitor.
 */
export function PrevisoesPainel({ id, children }: { id: IdPainelPrevisoes; children: ReactNode }) {
  return <div data-painel={painelPrevisoes(id).codigo}>{children}</div>;
}

/** Gold ausente ou reprovada: a página diz o que falta, nunca mostra número de reserva. */
export function PrevisoesIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Previsões e modelos indisponíveis nesta publicação"
          motivo={
            motivo ??
            "A gold das previsões (public/energia/gold/previsoes_desempenho.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Voltar ao PLD
          </Link>
        </p>
      </main>
    </>
  );
}

/**
 * Resposta curta do painel em duas camadas (seção 7.2, item 2): o veredito em palavras simples fica à vista e a resposta completa,
 * derivada dos mesmos campos, fica em Analisar e Auditar. `vivo` anuncia a troca quando a resposta muda com a escolha do leitor.
 */
export function PrevisoesResposta({ id, veredito, children, vivo = false }: { id: IdPainelPrevisoes; veredito: string; children: ReactNode; vivo?: boolean }) {
  return (
    <RespostaCurta id={id} veredito={veredito} vivo={vivo} tamanho="base">
      {children}
    </RespostaCurta>
  );
}

/**
 * Termos da página explicados com o texto do próprio registro de modelos (definicoes.corte_operacional e definicoes.quantis), sem
 * "vintages" nem fuso: corte, origem, rodada e a faixa P10 a P90. Cada linha só aparece quando a definição está no registro. Ficam
 * logo depois da figura que os usa, em texto visível.
 */
export function PrevisoesTermos({ itens, titulo = "Termos desta página" }: { itens: { termo: string; texto: string }[]; titulo?: string }) {
  if (!itens.length) return null;
  return (
    <section aria-label={titulo} data-termos="" className="border-t border-linha pt-3">
      <p className="rotulo text-mineral">{titulo}</p>
      <dl className="mt-1 grid max-w-5xl gap-x-8 gap-y-1 text-xs leading-relaxed text-carvao-muted md:grid-cols-2">
        {itens.map((t) => (
          <div key={t.termo}>
            <dt className="inline font-medium text-carvao">{t.termo}: </dt>
            <dd className="inline">{t.texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (seção 7.2, item 3). */
export function PrevisoesRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3" data-recorte-painel="">
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

/** Aviso que muda a leitura (fonte defasada, ausência legítima, número retido). */
export function PrevisoesAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <div
      role={tipo === "alerta" ? "status" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </div>
  );
}

/** Como ler a figura: a legenda fica logo abaixo dela, em texto visível. */
export function PrevisoesLegenda({ children }: { children: ReactNode }) {
  return <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{children}</p>;
}

/**
 * Avisos materiais da rodada, junto da emissão: emissão manual ou depois do prazo, código sem versão registrada e rotina sem
 * comprovação. Ficam à vista em Entender, ao lado dos números que qualificam, e não só em Auditar.
 */
export function PrevisoesAvisosRodada({ avisos, titulo = "Condições desta rodada" }: { avisos: AvisoRodada[]; titulo?: string }) {
  if (!avisos.length) return null;
  return (
    <section aria-label={titulo} data-avisos-rodada="" className="mt-3 border-l-2 border-aviso pl-4">
      <p className="text-sm leading-relaxed text-carvao">
        <span className="rotulo mr-2 text-mineral">{titulo}</span>
        {avisos.map((a, i) => (
          <span key={a.id} data-aviso={a.id}>
            <span className="font-medium">{a.rotulo}: </span>
            {a.texto}
            {i < avisos.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </section>
  );
}

/**
 * Resumo da ficha de um modelo logo abaixo da abertura: situação, papel, número publicado e reexecução do arquivo, em texto. A página de
 * ficha não tem medida de abertura (a faixa de métricas é só das páginas com números), e o estado do modelo é a primeira informação.
 */
export function PrevisoesResumoFicha({ itens }: { itens: { rotulo: string; valor: ReactNode }[] }) {
  return (
    <section aria-label="Resumo da ficha" className="ed-faixa" data-resumo-ficha="">
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map((i) => (
          <div key={i.rotulo} className="min-w-0">
            <dt className="rotulo text-mineral">{i.rotulo}</dt>
            <dd className="mt-1 text-sm leading-snug text-carvao [overflow-wrap:anywhere]">{i.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Datas de referência de cada parte, no bloco "Fontes, datas e siglas" da abertura: cada número diz o seu dia, sem sugerir simultaneidade. */
export function PrevisoesDatas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label="Datas de referência de cada parte">
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.texto}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function PrevisoesSeguir({
  ancora,
  proximo,
  downloads,
}: {
  ancora: string;
  proximo: { href: string; pergunta: string };
  downloads: { rotulo: string; url: string }[];
}) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads.map((d) => ({ ...d, rotulo: datasLegiveis(d.rotulo) }))} />;
}

/** Seção que aparece a partir do modo Analisar. */
export function PrevisoesAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="analisar">
      {children}
    </SecaoDoPainel>
  );
}

/** Seção que aparece só no modo Auditar. */
export function PrevisoesAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="auditar">
      {children}
    </SecaoDoPainel>
  );
}

/** Lista de definição compacta (rótulo e valor) para fichas e metadados da rodada; `nivel` esconde a linha em Entender. */
export function PrevisoesFichaLinha({ rotulo, children, nivel }: { rotulo: string; children: ReactNode; nivel?: "analisar" | "auditar" }) {
  return (
    <div data-nivel={nivel} className="border-t border-linha py-3 md:grid md:grid-cols-[13rem_1fr] md:gap-6">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-1 min-w-0 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere] md:mt-0">{children}</dd>
    </div>
  );
}

/** Link externo para documento oficial; abre em nova aba com aviso para leitor de tela. */
export function PrevisoesLinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere] hover:text-carvao">
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
