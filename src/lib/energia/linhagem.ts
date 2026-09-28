import type { EtapaLinhagem } from "@/components/energia/LinhagemDados";
import { gold, integra } from "./gold";
import { carimbo, dataBR } from "./formato";
import { DATASETS_INTEGRADOS } from "./datasets";

/**
 * As etapas da linhagem dos dados, com contagens lidas das golds publicadas:
 * fontes catalogadas, capturas com sha256, arquivos processados, páginas que
 * os usam e modelos registrados. Contagens do próprio portal, não do setor.
 */
export function etapasLinhagem(): EtapaLinhagem[] {
  const cat = gold.catalogo();
  const meta = gold.meta();
  const mods = gold.modelos();
  const portais = cat ? Object.entries(cat.portais) : [];
  const capturas = meta ? Object.values(meta.fontes).reduce((s, f) => s + (f.historico?.length ?? f.capturas.length), 0) : 0;
  const recapturas = meta ? Object.values(meta.fontes).reduce((s, f) => s + (f.recapturas_sem_mudanca ?? 0), 0) : 0;
  const golds = meta ? Object.entries(meta.golds) : [];
  const golsOk = golds.filter(([, g]) => g.disponivel).length;
  const paginas = new Set(DATASETS_INTEGRADOS.flatMap((d) => d.paginas.map((p) => p.href.split("#")[0]))).size;
  const revisoes = [gold.pld(), gold.hidrologia(), gold.carga(), gold.geracao(), gold.rede(), gold.cmo()]
    .filter(integra)
    .flatMap((g) => Object.values(g.proveniencia as Record<string, { revisoes_conhecidas: { total: number } | null }>))
    .reduce((s, p) => s + (p.revisoes_conhecidas?.total ?? 0), 0);
  return [
    {
      id: "fontes",
      rotulo: "Fontes",
      icone: "dados",
      numero: cat ? cat.total.toLocaleString("pt-BR") : "–",
      unidade: "conjuntos catalogados",
      resumo: "Portais de dados abertos do ONS, da ANEEL e da CCEE. Catalogar é registrar que um conjunto existe, com os metadados oficiais da fonte: título, órgão, licença, formatos e data de modificação.",
      detalhes: portais.map(([o, p]) => `${o}: ${p.conjuntos} ${p.conjuntos === 1 ? "conjunto" : "conjuntos"}${p.colhido_em ? `, metadados colhidos em ${carimbo(p.colhido_em)}` : ""}${p.erro ? ` (${p.erro})` : ""}`),
      confere: "A URL oficial de cada conjunto e a licença declarada pela fonte.",
      href: "#explorer",
      hrefRotulo: "Explorar o catálogo",
    },
    {
      id: "captura",
      rotulo: "Captura",
      icone: "regulacao",
      numero: capturas.toLocaleString("pt-BR"),
      unidade: "arquivos capturados",
      resumo: "Cada arquivo baixado da fonte é guardado como cópia original imutável, identificada pelo sha256, com a URL, o instante da captura e a data de publicação informada pela fonte.",
      detalhes: [
        `${DATASETS_INTEGRADOS.length} conjuntos integrados, do ONS e da CCEE.`,
        `${recapturas.toLocaleString("pt-BR")} downloads posteriores vieram idênticos a arquivos já integrados e não geraram captura nova.`,
        meta?.fontes.ccee_pld_horario?.ultima_tentativa ? `Última tentativa de coleta direta na CCEE: ${carimbo(meta.fontes.ccee_pld_horario.ultima_tentativa.tentado_em)}, ${meta.fontes.ccee_pld_horario.ultima_tentativa.ok ? "bem-sucedida" : "sem sucesso"}.` : "Sem registro de tentativa de coleta direta na CCEE nesta publicação.",
      ],
      confere: "O sha256 de cada captura, listado na ficha de cada conjunto integrado.",
      href: "/setor-eletrico/dados/ccee-pld-horario",
      hrefRotulo: "Ficha do PLD horário: capturas e sha256",
    },
    {
      id: "historico",
      rotulo: "Histórico",
      icone: "modelo",
      numero: revisoes.toLocaleString("pt-BR"),
      unidade: "revisões detectadas",
      resumo: "As observações de cada captura entram num histórico que só acrescenta, nunca apaga: uma revisão da fonte cria uma nova versão sem sobrescrever a anterior. A consulta \"como estava em\" devolve o que se sabia em qualquer instante.",
      detalhes: [
        "Revisão de valor é registrada; remoção de referência pela fonte, ainda não (limitação declarada).",
        "O histórico vive no cache da automação, com cópia durável do banco de vintages numa release do repositório.",
      ],
      confere: "As revisões conhecidas de cada indicador, na ficha Sobre este dado.",
      href: "/setor-eletrico/metodologia#linhagem",
      hrefRotulo: "Linhagem e vintages",
    },
    {
      id: "processados",
      rotulo: "Processados",
      icone: "sistema",
      numero: `${golsOk}`,
      unidade: `de ${golds.length} arquivos íntegros`,
      resumo: "Regras publicadas (médias, percentis, participações, faixas) transformam o histórico em indicadores com proveniência: natureza, fonte, período, snapshot, fórmula, revisões e limitações em cada um.",
      detalhes: golds.map(([nome, g]) => `${nome}: ${g.disponivel ? `gerado em ${carimbo(g.gerado_em)}` : "indisponível"}`),
      confere: "A fórmula e as transformações de cada indicador calculado; ausência nunca vira zero.",
      href: "/setor-eletrico/metodologia#classificacao",
      hrefRotulo: "Regras de classificação",
    },
    {
      id: "paginas",
      rotulo: "Páginas",
      icone: "aprenda",
      numero: `${paginas}`,
      unidade: "páginas com indicadores",
      resumo: "Cada visualização responde às mesmas seis perguntas (o que estou vendo, por que importa, o que mudou, como interpretar, o que não é possível concluir, qual é a fonte) e traz o selo de natureza de cada número.",
      detalhes: DATASETS_INTEGRADOS.map((d) => `${d.slug}: ${d.paginas.map((p) => p.rotulo).join(", ")}`),
      confere: "O selo de natureza e a ficha Sobre este dado ao pé de cada painel.",
      href: "/setor-eletrico/visao-geral",
      hrefRotulo: "Visão geral",
    },
    {
      id: "modelos",
      rotulo: "Modelos",
      icone: "modelo",
      numero: mods ? `${mods.modelos.length}` : "–",
      unidade: mods ? `registrados, ${mods.em_producao.length} em produção` : "sem registro",
      resumo: "Modelos de previsão têm estado explícito (pesquisa, validação, produção, aposentado) e só o de produção alimenta a previsão principal. Cada previsão registrada é imutável, com sha256.",
      detalhes: mods ? mods.modelos.map((m) => `${m.codigo} · ${m.nome}: ${m.estado.toLowerCase()}`) : [],
      confere: "O estado de cada modelo, as evidências com sha256 e o arquivo de previsões, registro a registro.",
      href: "/setor-eletrico/pld/modelos",
      hrefRotulo: "Registro de modelos",
    },
  ];
}

/** Datas de referência de cada gold, para o rodapé da linhagem. */
export function datasGolds(): string {
  const meta = gold.meta();
  if (!meta) return "";
  return `processados em ${carimbo(meta.gerado_em)}; PLD até ${dataBR(gold.pld()?.dia_referencia ?? null)}`;
}
