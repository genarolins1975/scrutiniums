/**
 * Arquivos para baixar do painel Educação nos municípios (rotas com conta em src/app/educacao-municipal/*.csv). CSV com
 * ponto e vírgula, UTF-8 com BOM, ponto decimal; ausência fica vazia, nunca zero, e o motivo vai em coluna própria. Cada
 * linha leva a fonte e a edição, para o arquivo se explicar fora do painel. Tudo sai da gold, sem cálculo novo.
 * O Ideb por município sai em um arquivo por etapa: o arquivo único passava de 20 MB, o teto da Vercel para resposta
 * gerada no build (FALLBACK_BODY_TOO_LARGE).
 */
import { respostaCsv } from "@/lib/previdencia/csv";
import { SIGLAS, arquivoUf, goldEducacao } from "./dados";
import { CAMPOS_CENSO, ETAPAS, type Etapa, type Rede } from "./tipos";

type Celula = string | number | null | undefined;
const REDES: Rede[] = ["municipal", "publica"];

export function csvIdeb(etapa: Etapa): Response {
  const g = goldEducacao();
  const fonte = `INEP, Ideb ${g.fontes.ideb.edicao}`;
  const nomeEtapa = etapa === "ai" ? "anos iniciais" : "anos finais";
  const linhas: Celula[][] = [];
  for (const uf of [...SIGLAS].sort()) {
    const a = arquivoUf(uf);
    if (!a) continue;
    for (const m of a.municipios) {
      for (const rede of REDES) {
        const s = m[etapa][rede];
        const motivo = m[etapa][rede === "municipal" ? "motivo_municipal" : "motivo_publica"];
        if (!s) {
          // rede sem linha na planilha do INEP: uma linha só, para o motivo do ano mais recente
          linhas.push([m.id, m.nome, uf, nomeEtapa, rede, g.ideb.ano, null, null, null, null, null, null, null, null, motivo, fonte]);
          continue;
        }
        a.anos.forEach((ano, i) => {
          const k = a.anos_meta.indexOf(ano);
          linhas.push([
            m.id, m.nome, uf, nomeEtapa, rede, ano,
            s.ideb[i], s.aprov[i], s.mat[i], s.port[i], s.n[i], s.p[i], k >= 0 ? s.meta[k] : null, s.marca[i],
            i === a.anos.length - 1 ? motivo : null, fonte,
          ]);
        });
      }
    }
  }
  return respostaCsv(
    `educacao-ideb-${etapa === "ai" ? "anos-iniciais" : "anos-finais"}-por-municipio.csv`,
    ["codigo_ibge", "municipio", "uf", "etapa", "rede", "ano", "ideb", "aprovacao_pct", "saeb_matematica", "saeb_portugues", "nota_padronizada_n", "rendimento_p", "meta_primeiro_ciclo", "marca_saeb_inep", "motivo_sem_ideb", "fonte"],
    linhas,
  );
}

export function csvCenso(): Response {
  const g = goldEducacao();
  const f = g.fontes.censo;
  const fonte = `${f.orgao}, ${f.nome} ${f.edicao}`;
  const linhas: Celula[][] = [];
  for (const uf of [...SIGLAS].sort()) {
    const a = arquivoUf(uf);
    if (!a) continue;
    for (const m of a.municipios) {
      linhas.push([m.id, m.nome, uf, f.edicao, m.pop, ...CAMPOS_CENSO.map((c) => m.censo?.[c] ?? null), fonte]);
    }
  }
  return respostaCsv("educacao-censo-escolar-por-municipio.csv", ["codigo_ibge", "municipio", "uf", "ano_censo", `populacao_estimada_${g.fontes.populacao.ano}`, ...CAMPOS_CENSO, "fonte"], linhas);
}

export function csvEstados(): Response {
  const g = goldEducacao();
  const k = g.ideb.anos.length - 1;
  const linhas: Celula[][] = [];
  for (const uf of [...SIGLAS].sort()) {
    const c = g.censo.ufs[uf];
    for (const etapa of ETAPAS) {
      const d = g.distribuicao[etapa].ufs[uf];
      linhas.push([
        uf, etapa === "ai" ? "anos iniciais" : "anos finais", g.ideb.ano, g.ideb.ufs[etapa][uf].publica.ideb[k], d?.mediana ?? null, d?.n ?? null,
        etapa === "ai" ? c.ai_mun : c.af_mun, etapa === "ai" ? c.ai_publica : c.af_publica, g.censo.ano,
        `${g.fontes.ideb.orgao}, Ideb ${g.ideb.ano}; ${g.fontes.censo.nome} ${g.censo.ano}; mediana calculada pela Scrutiniums`,
      ]);
    }
  }
  return respostaCsv(
    "educacao-resumo-por-estado.csv",
    ["uf", "etapa", "ano_ideb", "ideb_rede_publica_uf", "mediana_ideb_redes_municipais", "redes_municipais_com_ideb", "matriculas_rede_municipal", "matriculas_rede_publica", "ano_censo", "fonte"],
    linhas,
  );
}
