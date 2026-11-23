"use client";

import { useRouter } from "next/navigation";
import type { OpcaoUrl } from "./SeletorUrl";

/**
 * Lista de escolha que vive na URL (o mês da contagem, o estado): ao escolher, a página navega para o endereço da opção, sem
 * rolar, e o servidor devolve tudo no recorte novo. Sem JavaScript, o formulário GET envia o mesmo parâmetro pelo botão
 * "Aplicar", com os demais parâmetros do recorte nos campos ocultos.
 */
export function SelectUrl({ id, rotulo, nome, base, outros, opcoes, atual }: Readonly<{
  id: string;
  rotulo: string;
  /** Nome do parâmetro na URL. */
  nome: string;
  /** Endereço da página, sem a consulta e com a âncora do bloco. */
  base: string;
  /** Os demais parâmetros do recorte em vigor, que o envio sem JavaScript preserva. */
  outros: Readonly<Record<string, string>>;
  opcoes: readonly OpcaoUrl[];
  atual: string;
}>) {
  const router = useRouter();
  const [caminho, ancora] = base.split("#");
  return (
    <form method="get" action={caminho + (ancora ? `#${ancora}` : "")} className="min-w-0">
      {Object.entries(outros).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={id} className="block text-sm text-carvao-muted">
        {rotulo}
      </label>
      <span className="mt-1 flex items-center gap-2">
        <select
          id={id}
          name={nome}
          value={atual}
          onChange={(e) => {
            const o = opcoes.find((x) => x.valor === e.target.value);
            if (o) router.push(o.href, { scroll: false });
          }}
          className="block min-h-[44px] max-w-full border border-linha bg-superficie px-3 text-base text-carvao"
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao">
            Aplicar
          </button>
        </noscript>
      </span>
    </form>
  );
}
