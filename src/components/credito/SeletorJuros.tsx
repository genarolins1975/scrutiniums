"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Opcoes = {
  segmentos: { id: string; rotulo: string }[];
  modalidades: { slug: string; segmento: string; rotulo: string; n: number }[];
  bancos: { cnpj8: string; nome: string }[];
};

/**
 * Seletor de segmento, modalidade e instituição das consultas de juros do Crédito. O estado vive na URL
 * (?seg=&mod=&banco=), para o leitor compartilhar o recorte: a página é montada no servidor a partir dela.
 *
 * Sem JavaScript é um formulário GET comum, com o botão "Consultar". Com JavaScript, cada troca atualiza a URL sem
 * recarregar e o botão sai. Trocar o segmento volta à modalidade padrão dele; `limpar` lista parâmetros que deixam de
 * valer quando o recorte muda (no simulador, a taxa digitada dá lugar à taxa publicada do novo recorte).
 */
export function SeletorJuros({
  base,
  opcoes,
  seg,
  mod,
  banco,
  manter = {},
  limpar = [],
  rotuloBanco = "Instituição",
}: {
  base: string;
  opcoes: Opcoes;
  seg: string;
  mod: string;
  banco: string;
  /** Outros parâmetros da URL que o formulário sem JavaScript precisa repetir. */
  manter?: Record<string, string>;
  limpar?: string[];
  rotuloBanco?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);

  const modalidades = opcoes.modalidades.filter((m) => m.segmento === seg);

  function ir(mudanca: { seg?: string; mod?: string; banco?: string }) {
    const p = new URLSearchParams(window.location.search);
    for (const k of limpar) p.delete(k);
    if (mudanca.seg !== undefined) {
      p.set("seg", mudanca.seg);
      p.delete("mod");
    }
    if (mudanca.mod !== undefined) p.set("mod", mudanca.mod);
    if (mudanca.banco !== undefined) {
      if (mudanca.banco) p.set("banco", mudanca.banco);
      else p.delete("banco");
    }
    iniciar(() => router.replace(`${base}?${p.toString()}`, { scroll: false }));
  }

  const campo = "mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-base text-carvao focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/30";
  return (
    <form key={`${seg}|${mod}|${banco}`} method="get" action={base} className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)]" aria-busy={pendente || undefined}>
      {Object.entries(manter).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="block text-sm text-carvao-muted">
        Segmento
        <select name="seg" defaultValue={seg} className={campo} onChange={(e) => ir({ seg: e.target.value })}>
          {opcoes.segmentos.map((s) => (
            <option key={s.id} value={s.id}>{s.rotulo}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-carvao-muted">
        Modalidade
        <select name="mod" defaultValue={mod} className={campo} onChange={(e) => ir({ mod: e.target.value })}>
          {modalidades.map((m) => (
            <option key={`${m.segmento}:${m.slug}`} value={m.slug}>
              {m.rotulo} · {m.n} instituições
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-carvao-muted">
        {rotuloBanco}
        <select name="banco" defaultValue={banco} className={campo} onChange={(e) => ir({ banco: e.target.value })}>
          <option value="">Nenhuma: ver só a modalidade</option>
          {opcoes.bancos.map((b) => (
            <option key={b.cnpj8} value={b.cnpj8}>{b.nome}</option>
          ))}
        </select>
      </label>
      <div className="md:col-span-3 flex min-h-[24px] flex-wrap items-center gap-x-4 text-sm text-carvao-muted">
        {!hidratado && (
          <button type="submit" className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao hover:bg-marfim">
            Consultar
          </button>
        )}
        <span role="status" aria-live="polite">{pendente ? "Atualizando a consulta..." : ""}</span>
        <span>A escolha fica no endereço da página: copie o link para compartilhar este recorte.</span>
      </div>
    </form>
  );
}
