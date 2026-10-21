"use client";

import { useId } from "react";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { inteiro, numero } from "@/lib/eficiencia/seguranca/formato";

export type DadosDoisRegistros = {
  ano: number;
  simSituacao: "final" | "preliminar";
  ufs: { sigla: string; nome: string }[];
  /** por UF e "BR": vítimas de homicídio doloso (Sinesp), óbitos por agressão (SIM), % de intenção indeterminada (SIM) */
  valores: Record<string, { policia: number | null; saude: number | null; indeterminadas: number | null }>;
};

const ETAPAS = {
  policia: [
    ["O fato", "Uma pessoa morre de forma violenta."],
    ["Boletim de ocorrência", "A polícia registra o fato na delegacia da cidade onde ele aconteceu."],
    ["Classificação penal", "Homicídio doloso, latrocínio, feminicídio, morte por intervenção de agente do Estado, morte a esclarecer…"],
    ["Secretaria de Segurança", "O estado consolida os registros do mês e os envia ao Ministério da Justiça."],
    ["Sinesp VDE", "Vítimas por UF onde o fato foi registrado e por mês do fato."],
  ],
  saude: [
    ["O óbito", "A mesma morte gera um atestado."],
    ["Declaração de óbito", "O médico ou o Instituto Médico Legal preenche a declaração."],
    ["Causa básica pela CID-10", "Agressão (X85 a Y09), intenção indeterminada (Y10 a Y34), intervenção legal (Y35 e Y36)…"],
    ["Secretaria de Saúde", "O município e o estado codificam e revisam a causa; o ano fecha meses depois."],
    ["SIM", "Óbitos por UF de residência da vítima e por ano do óbito."],
  ],
} as const;

/**
 * Artefato didático "Uma morte, dois registros": os dois caminhos pelos quais a mesma morte violenta vira número, com as
 * contagens reais da UF escolhida (gold). Modelo simplificado do fluxo: as etapas reais têm mais passos e prazos.
 */
export function DoisRegistros({ dados: d }: { dados: DadosDoisRegistros }) {
  const escolha = useSelecaoGas("uf_registro", ["BR", ...d.ufs.map((u) => u.sigla)], "BR");
  const id = useId();
  const v = d.valores[escolha.valor];
  const nome = escolha.valor === "BR" ? "Brasil" : d.ufs.find((u) => u.sigla === escolha.valor)?.nome;
  const razao = v.policia !== null && v.saude ? v.policia / v.saude : null;
  return (
    <div className="space-y-6">
      <p className="text-xs uppercase tracking-label text-obee-dark">Modelo didático · fluxo simplificado, com os números reais de {d.ano}</p>
      <div className="grid gap-6 md:grid-cols-2">
        {(["policia", "saude"] as const).map((lado) => (
          <ol key={lado} aria-label={lado === "policia" ? "Caminho do registro policial" : "Caminho do registro de saúde"} className="space-y-2">
            <li className="font-serif text-xl">{lado === "policia" ? "Registro policial" : "Registro de saúde"}</li>
            {ETAPAS[lado].map(([t, txt], n) => (
              <li key={t} className={`border-l-4 pl-4 py-2 ${lado === "policia" ? "border-obee" : "border-[var(--cor-obee-neutro)]"} ${n === ETAPAS[lado].length - 1 ? "bg-obee-suave" : ""}`}>
                <p className="text-sm font-semibold">{t}</p>
                <p className="text-sm text-carvao-muted">{txt}</p>
              </li>
            ))}
          </ol>
        ))}
      </div>
      <div className="border-y border-linha py-5">
        <label htmlFor={id} className="block text-sm">Ver os dois números de</label>
        <select id={id} value={escolha.valor} onChange={(e) => escolha.selecionar(e.target.value)} className="mt-1 min-h-[44px] max-w-full border border-obee-dark bg-superficie px-3 text-sm">
          <option value="BR">Brasil</option>
          {[...d.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => <option key={u.sigla} value={u.sigla}>{u.nome}</option>)}
        </select>
        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
          <div><dt className="text-sm">Vítimas de homicídio doloso, polícia</dt><dd className="mt-2 font-serif text-3xl tabular-nums">{v.policia === null ? "sem dado" : inteiro(v.policia)}</dd><dd className="mt-1 text-xs text-carvao-muted">Sinesp VDE, {nome}, {d.ano}</dd></div>
          <div><dt className="text-sm">Óbitos por agressão, saúde</dt><dd className="mt-2 font-serif text-3xl tabular-nums">{v.saude === null ? "sem dado" : inteiro(v.saude)}</dd><dd className="mt-1 text-xs text-carvao-muted">SIM, {nome}, {d.ano}{d.simSituacao === "preliminar" ? ", preliminar" : ", dado final"}</dd></div>
          <div><dt className="text-sm">Mortes por causa externa de intenção indeterminada</dt><dd className="mt-2 font-serif text-3xl tabular-nums">{v.indeterminadas === null ? "sem dado" : `${numero(v.indeterminadas, 1)}%`}</dd><dd className="mt-1 text-xs text-carvao-muted">das mortes por causas externas, SIM, {d.ano}</dd></div>
        </dl>
        {razao !== null && <p className="mt-4 max-w-prose2 text-sm leading-relaxed">{nome}: {numero(razao * 100, 0)} vítimas de homicídio doloso na polícia para cada 100 óbitos por agressão no SIM.</p>}
      </div>
      <ul className="max-w-prose2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>Território: a polícia conta onde o fato foi registrado; a saúde, onde a vítima morava.</li>
        <li>Conceito: homicídio doloso não inclui latrocínio, lesão seguida de morte nem morte por intervenção de agente do Estado. Na saúde, o latrocínio e a lesão seguida de morte entram como agressão; a morte por intervenção pode entrar como agressão ou como intervenção legal (Y35 e Y36), que fica fora da conta.</li>
        <li>Intenção indeterminada: quando a declaração não diz se foi agressão, acidente ou suicídio, a morte sai das agressões. Quanto maior essa parcela numa UF, menos o SIM capta dos homicídios dela.</li>
        <li>Tempo: a polícia fecha o mês do fato; a saúde fecha o ano meses depois, e o dado mais recente é preliminar.</li>
      </ul>
    </div>
  );
}
