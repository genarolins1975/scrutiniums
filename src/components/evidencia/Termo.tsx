import type { ReactNode } from "react";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { TermoDica } from "@/components/evidencia/TermoDica";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";

/**
 * Glossário como parte da interface: a sigla abre uma dica curta (hover ou
 * foco; Esc fecha) e leva ao verbete completo. Verbete pendente de conferência
 * não mostra definição. A base de verbetes fica no servidor; o cliente recebe
 * só o texto da dica.
 */
export function Termo({ slug, children, alvo = false }: { slug: string; children: ReactNode; alvo?: boolean }) {
  const c = conceito(slug);
  if (!c) return <>{children}</>;
  // com a frase em palavras simples, ela vem primeiro e a definição literal da fonte logo depois; sem ela, só a definição da fonte
  const conferido = c.estado === "CONFERIDO" && c.emUmaFrase;
  const dicaPt = conferido ? (c.emPalavrasSimples ? `${c.emPalavrasSimples} Na fonte: ${c.emUmaFrase}` : c.emUmaFrase) : null; // i18n: dado (texto do verbete, só em português; em inglês sai em TrechoPortugues)
  // em inglês, a definição do verbete (texto conferido na fonte, só em português) sai marcada; o nome do conceito, como nome
  const en = idiomaEnergia() === "en";
  const dica = dicaPt === null ? tx("Verbete em preparação: fonte primária ainda não conferida.", "Entry in preparation: primary source not yet checked.") : en ? <TrechoPortugues regiao="termo-dica">{dicaPt}</TrechoPortugues> : dicaPt;
  const rotuloPt = `${c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? `${c.sigla} · ` : ""}${c.nome}`;
  return (
    <TermoDica href={`/setor-eletrico/aprenda/${c.slug}`} rotulo={en ? <Nome>{rotuloPt}</Nome> : rotuloPt} dica={dica} alvo={alvo}>
      {children}
    </TermoDica>
  );
}
