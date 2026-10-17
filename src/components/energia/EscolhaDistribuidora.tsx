"use client";

import { useId, useSyncExternalStore } from "react";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import Link from "@/components/i18n/LinkIdioma";
import { linkDistribuidoraNoIdioma } from "@/lib/energia/i18n/conta-inclusao";

/**
 * "Sua distribuidora" da página inicial (seção 6.2 D): a pessoa escolhe a distribuidora uma vez, no alto das seis perguntas, e as três
 * perguntas que têm resposta por distribuidora (Conta de luz, Qualidade e Perdas) abrem a página de destino com ela já selecionada, pelo
 * mesmo parâmetro de URL que cada página usa (Conta de luz e Qualidade: ?dist=CNPJ; Perdas: ?d=CNPJ). Só entram distribuidoras que alguma
 * dessas páginas publica, e cada pergunta sabe de quem tem o dado dela: a distribuidora sem dado numa delas aparece com o aviso, e o link
 * leva à página sem escolha.
 *
 * A escolha é uma só e fica guardada neste navegador (localStorage), para valer na próxima visita e nas três perguntas ao mesmo tempo. O
 * controle e os links são ilhas separadas de uma página que o servidor monta: elas conversam por um pequeno repositório deste módulo
 * (useSyncExternalStore), que também ouve a mudança feita em outra aba. Sem JavaScript, a escolha não existe e cada link leva à página sem
 * escolha; navegador sem armazenamento guarda a escolha só enquanto a página está aberta.
 */

export type OpcaoDistribuidora = { cnpj: string; sigla: string; nome: string | null; ufs?: string[] };

type Escolha = { cnpj: string; sigla: string };

const CHAVE = "energia:sua-distribuidora";
let atual: Escolha | null = null;
let lido = false;
const ouvintes = new Set<() => void>();

function lerGuardado(): Escolha | null {
  try {
    const texto = window.localStorage.getItem(CHAVE);
    if (!texto) return null;
    const o = JSON.parse(texto) as Partial<Escolha>;
    return typeof o.cnpj === "string" && /^\d{14}$/.test(o.cnpj) && typeof o.sigla === "string" && o.sigla ? { cnpj: o.cnpj, sigla: o.sigla } : null;
  } catch {
    return null;
  }
}

/** A escolha vigente: lida do armazenamento na primeira vez e depois guardada, para o mesmo valor voltar a cada leitura. */
function escolhaAtual(): Escolha | null {
  if (!lido) {
    atual = lerGuardado();
    lido = true;
  }
  return atual;
}

function guardar(e: Escolha | null) {
  atual = e;
  lido = true;
  try {
    if (e) window.localStorage.setItem(CHAVE, JSON.stringify(e));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento (janela privada, dados bloqueados): a escolha vale enquanto a página está aberta
  }
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const aoMudar = (ev: StorageEvent) => {
    if (ev.key === CHAVE || ev.key === null) {
      lido = false;
      f();
    }
  };
  window.addEventListener("storage", aoMudar);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", aoMudar);
  };
}

const semEscolhaNoServidor = (): Escolha | null => null;

/** O controle: a lista das distribuidoras, o botão de limpar e a frase que diz a quem a escolha vale e quantas há em cada página. */
export function SuaDistribuidora({ opcoes, descricao }: { opcoes: OpcaoDistribuidora[]; descricao: string }) {
  const id = useId();
  const tx = useTx();
  // <option> não aceita o <span> de <Nome>: na página inglesa, a própria opção leva a marca de nome próprio
  const marcaNome = useIdioma() === "en" ? { lang: "pt-BR", translate: "no" as const, "data-i18n-nome": "" } : {};
  const escolha = useSyncExternalStore(assinar, escolhaAtual, semEscolhaNoServidor);
  // uma escolha guardada de uma distribuidora que a lista não tem mais não vale
  const valida = escolha && opcoes.some((o) => o.cnpj === escolha.cnpj) ? escolha : null;
  return (
    <div data-sua-distribuidora="" className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-2 border border-linha bg-superficie p-4">
      <div className="min-w-0">
        <label htmlFor={`${id}-d`} className="block text-sm text-carvao">
          {tx("Sua distribuidora", "Your distribution utility")}
        </label>
        <select
          id={`${id}-d`}
          value={valida?.cnpj ?? ""}
          onChange={(e) => {
            const o = opcoes.find((x) => x.cnpj === e.target.value);
            guardar(o ? { cnpj: o.cnpj, sigla: o.sigla } : null);
          }}
          aria-describedby={`${id}-ajuda`}
          className="mt-1 min-h-[44px] max-w-full border border-linha bg-superficie px-2 text-sm text-carvao"
        >
          <option value="">{tx("Escolha a distribuidora", "Choose the distribution utility")}</option>
          {opcoes.map((o) => (
            // sigla e estados: o nome oficial da fonte vem em caixa alta e sem acento, e fica no title
            <option key={o.cnpj} value={o.cnpj} title={o.nome ?? undefined} {...marcaNome}>
              {o.sigla}
              {o.ufs && o.ufs.length ? ` (${o.ufs.join(", ")})` : ""}
            </option>
          ))}
        </select>
      </div>
      {valida && (
        <button type="button" onClick={() => guardar(null)} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
          {tx("Limpar a escolha", "Clear the choice")}
        </button>
      )}
      <p id={`${id}-ajuda`} className="basis-full text-xs leading-snug text-carvao-muted">
        {descricao}
      </p>
      <p aria-live="polite" className="sr-only">
        {valida
          ? tx(
              `Distribuidora escolhida: ${valida.sigla}. Os links de Conta de luz, Qualidade e Perdas abrem com ela selecionada.`,
              `Chosen distribution utility: ${valida.sigla}. The Electricity bill, Quality of supply and Losses links open with it selected.`,
            )
          : ""}
      </p>
    </div>
  );
}

/**
 * O link de uma pergunta: com a distribuidora escolhida e com dado nessa página, leva a página com ela selecionada e diz o nome dela no
 * texto; sem escolha, é o link de sempre da pergunta. Escolhida sem dado (ou com parte do ano), o aviso aparece abaixo do link.
 */
export function LinkPorDistribuidora({
  destino,
  parametro,
  ancora,
  rotuloPadrao,
  rotuloEscolhida,
  comDado,
  emParte = [],
  semDado,
  emParteTexto,
  className,
}: {
  destino: string;
  parametro: "d" | "dist";
  ancora: string;
  rotuloPadrao: string;
  /** Texto do link com a escolha feita, com {sigla} no lugar da sigla. */
  rotuloEscolhida: string;
  /** CNPJ de quem tem o dado desta pergunta. */
  comDado: string[];
  /** CNPJ de quem tem só parte do ano (a página abre com ela, e o aviso diz que não há dado anual). */
  emParte?: string[];
  /** Aviso para a escolhida que não tem dado nesta pergunta, com {sigla}. */
  semDado: string;
  emParteTexto?: string;
  className: string;
}) {
  const escolha = useSyncExternalStore(assinar, escolhaAtual, semEscolhaNoServidor);
  const idioma = useIdioma();
  const tem = !!escolha && comDado.includes(escolha.cnpj);
  const parcial = !!escolha && emParte.includes(escolha.cnpj);
  const aberta = tem || parcial;
  // LinkIdioma leva à irmã /en quando a página tem tradução publicada
  const href = `${destino}${aberta ? `?${parametro}=${escolha!.cnpj}` : ""}#${ancora}`;
  // os textos chegam da página inicial em português; em inglês saem da tabela exata (o que já chega em inglês passa como veio)
  const t = (s: string) => linkDistribuidoraNoIdioma(s, idioma);
  const aviso = escolha && !aberta ? t(semDado) : escolha && parcial && emParteTexto ? t(emParteTexto) : null;
  return (
    <>
      <Link href={href} className={className} data-por-distribuidora={aberta ? escolha!.cnpj : undefined}>
        {aberta ? t(rotuloEscolhida).replace("{sigla}", escolha!.sigla) : t(rotuloPadrao)}
        <span aria-hidden="true" className="ml-1.5">
          →
        </span>
      </Link>
      {aviso && escolha && <p className="text-xs leading-snug text-carvao-muted">{aviso.replace("{sigla}", escolha.sigla)}</p>}
    </>
  );
}
