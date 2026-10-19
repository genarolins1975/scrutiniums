"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { cadenciaDe, rotuloReferencia, textosDominio, type DominioFrescorId } from "@/lib/frescor";

export type AlertaVisivel = { dominio: DominioFrescorId; referenciaAvisada: string | null; ultimoEnvioEm: string | null; criadoEm: string; entrada: string };

const dataBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

/**
 * "Alertas de atualização" na conta: as fontes de dados assinadas, a referência que a pessoa já conhece e o último
 * aviso, com cancelamento. O aviso vai ao e-mail da conta quando a referência publicada avança (src/lib/conta/alertas.ts).
 */
export function MeusAlertas({ iniciais, envioLigado }: { iniciais: AlertaVisivel[]; envioLigado: boolean }) {
  const [lista, setLista] = useState(iniciais);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function cancelar(d: string) {
    setOcupado(d);
    setErro("");
    try {
      const r = await fetch(`/api/conta/alertas/${encodeURIComponent(d)}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw new Error();
      setLista((l) => l.filter((a) => a.dominio !== d));
    } catch {
      setErro("Não foi possível cancelar o alerta. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="max-w-prose2 text-sm text-carvao-muted">
        Nos painéis, use <strong className="font-semibold text-carvao">Avisar quando atualizar</strong>, na barra superior, para
        receber um e-mail no endereço da conta quando a data de referência dos dados daquela fonte avançar. A verificação é
        diária; sem dado novo, nada é enviado. Todo aviso traz o caminho para cancelar.
      </p>
      {!envioLigado && (
        <Alert kind="aviso">
          O envio por e-mail ainda não está ligado. As assinaturas ficam registradas e passam a valer quando a verificação
          diária entrar em funcionamento, sem precisar assinar de novo; até lá, nenhum e-mail sai.
        </Alert>
      )}
      {erro && <Alert kind="erro">{erro}</Alert>}
      {lista.length === 0 ? (
        <p className="text-sm text-carvao">Nenhum alerta ativo.</p>
      ) : (
        <ul className="divide-y divide-linha border-y border-linha">
          {lista.map((a) => {
            const t = textosDominio(a.dominio);
            const ref = rotuloReferencia(a.referenciaAvisada);
            return (
              <li key={a.dominio} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={a.entrada} className="font-serif text-lg leading-snug text-carvao underline-offset-4 hover:text-bronze hover:underline">
                    {t.nome}
                  </Link>
                  <p className="mt-1 text-xs text-carvao-muted">
                    Cadência {cadenciaDe(a.dominio).rotulo} · referência conhecida ({t.referencia}): {ref ?? "não informada"}
                  </p>
                  <p className="mt-0.5 text-xs text-carvao-muted">
                    Desde {dataBr(a.criadoEm)} · {a.ultimoEnvioEm ? `último aviso em ${dataBr(a.ultimoEnvioEm)}` : "nenhum aviso enviado ainda"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rotulo inline-flex min-h-[44px] shrink-0 items-center text-carvao-muted underline underline-offset-4 hover:text-bronze disabled:opacity-50"
                  disabled={ocupado === a.dominio}
                  onClick={() => cancelar(a.dominio)}
                >
                  Cancelar alerta
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
