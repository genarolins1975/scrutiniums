import type { ReactNode } from "react";
import { inteiro } from "@/lib/eficiencia/formato";
import type { CapitalPainel, RefGrupo } from "@/lib/eficiencia/saude/consulta";
import type { MedidaSaude } from "@/lib/eficiencia/saude/medidas";
import type { ReferenciaExternaSaude } from "@/lib/eficiencia/saude/tipos";

const nomes = (cs: CapitalPainel[]) => (cs.length <= 3 ? cs.map((c) => `${c.nome} (${c.uf})`).join(", ") : `${cs.slice(0, 2).map((c) => `${c.nome} (${c.uf})`).join(", ")} e mais ${cs.length - 2}`);

/**
 * Referências do grupo de capitais: mediana, média simples, extremos com empates, metade central e, quando existe, a razão agregada. Cada uma diz
 * quantas capitais entram. São descrição do grupo, não meta nem padrão: as capitais do grupo não são pares ajustados por necessidade assistencial.
 */
export function ReferenciasGrupoSaude({ r, m, nomeGrupo, textoRazao }: { r: RefGrupo; m: MedidaSaude; nomeGrupo: string; textoRazao?: ReactNode }) {
  const f = (v: number | null) => (v === null ? "sem valor" : m.formata(v));
  return (
    <div>
      <h3 className="rotulo text-mineral">Referências do grupo: {r.n} de {r.noGrupo} {nomeGrupo}</h3>
      <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Item rotulo="Mediana">{f(r.mediana)}</Item>
        <Item rotulo="Média simples">{f(r.media)} <span className="text-carvao-muted">(mesmo peso para cada capital)</span></Item>
        <Item rotulo="Menor valor">{f(r.minimo)} <span className="text-carvao-muted">{nomes(r.capitaisMinimo)}</span></Item>
        <Item rotulo="Maior valor">{f(r.maximo)} <span className="text-carvao-muted">{nomes(r.capitaisMaximo)}</span></Item>
        {r.quartisExibicao && r.q1 !== null && r.q3 !== null && <Item rotulo="Metade central">{f(r.q1)} a {f(r.q3)}</Item>}
        {!r.quartisExibicao && <Item rotulo="Metade central"><span className="text-carvao-muted">não exibida: menos de 8 capitais no grupo</span></Item>}
      </dl>
      {textoRazao && <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{textoRazao}</p>}
      <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted">
        Descrição do grupo de capitais com valor comparável no período, não meta nem padrão. As capitais diferem em porte, perfil etário e papel regional de referência, e nenhuma referência aqui é ajustada por necessidade assistencial.
      </p>
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="rotulo text-carvao-muted">{rotulo}</dt>
      <dd className="mt-0.5 tabular-nums text-obee-tinta">{children}</dd>
    </div>
  );
}

/** Referências externas ao grupo: nacional oficial, nacional calculado e norma, sempre com a classe e o escopo; o contexto nunca vira diferença contra a capital. */
export function ReferenciasExternasSaude({ itens, m, valorCapital }: { itens: ReferenciaExternaSaude[]; m: MedidaSaude; valorCapital: number | null }) {
  if (!itens.length) return null;
  return (
    <div>
      <h3 className="rotulo text-mineral">Referências de fora do grupo de capitais</h3>
      <ul className="mt-3 space-y-4">
        {itens.map((e) => {
          const dif = valorCapital !== null && e.comparabilidade === "direta" && e.tipo !== "normativa" ? valorCapital - e.valor : null;
          return (
            <li key={e.id} className="border-l-2 border-linha pl-3 text-sm leading-snug">
              <p className="font-semibold text-obee-tinta">
                {e.rotulo}: <span className="tabular-nums">{e.tipo === "normativa" ? `${inteiro(e.valor)}%` : m.formata(e.valor)}</span>
                <span className="rotulo ml-2 !text-[0.66rem] text-carvao-muted">{e.classe}</span>
              </p>
              <p className="mt-1 max-w-prose2 text-carvao-muted">{e.escopo}</p>
              {dif !== null && (
                <p className="mt-1 max-w-prose2 text-obee-tinta">
                  Diferença da capital escolhida para esta referência: {dif >= 0 ? "+" : "−"}{m.formata(Math.abs(dif))}.
                </p>
              )}
              <p className="mt-1 text-xs text-carvao-muted">Fonte: {e.fonte}.</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
