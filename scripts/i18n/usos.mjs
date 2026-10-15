const campos = (valor) => valor && typeof valor === "object" && !Array.isArray(valor)
  ? Object.keys(valor).sort().join(",") : "";
const comparar = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const identificador = (valor) => typeof valor === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(valor);

/** @typedef {{ id: string, estado: "traduzido", chaves: string[] } | { id: string, estado: "portugues_marcado" }} RegiaoUso */
/** @typedef {{ pt: string, en: string, dominio: string, regioes: RegiaoUso[] }} RotaUso */

/**
 * Valida declarações de consumo, sem renderizar HTML nem deduzir uso por imports.
 * A prova DOM consome as mesmas regiões/chaves e rejeita declarações sem consumidor.
 * @param {object} manifesto
 * @param {{ pares: Array<{ pt: string, en: string, dominio: string, conteudo_declarado: string }> } | null} irmas
 * @param {Record<string, { estado: string }>} entradasEn
 * @returns {{ schema_version: number, rotas: RotaUso[], rotas_parciais_declaradas: number, chaves_en_declaradas_em_uso: number, ocorrencias_en_declaradas: number, regioes_pt_nao_catalogadas: number, html_verificado_pelo_inventario: false } | null}
 */
export function validarUsoInterface(manifesto, irmas, entradasEn) {
  const parciais = new Map((irmas?.pares ?? [])
    .filter((par) => par.conteudo_declarado === "parcialmente_traduzido")
    .map((par) => [par.pt, par]));
  const declaracao = manifesto.uso_interface;
  if (declaracao === undefined) {
    if (parciais.size) throw new Error("Rota parcialmente traduzida requer declaração de uso na interface.");
    return null;
  }
  if (campos(declaracao) !== "rotas,schema_version" || declaracao.schema_version !== 1
    || !Array.isArray(declaracao.rotas) || !declaracao.rotas.length) {
    throw new Error("Declaração de uso na interface inválida.");
  }
  const vistas = new Set();
  const chavesUnicas = new Set();
  let ocorrencias = 0;
  let pendentes = 0;
  const rotas = declaracao.rotas.map((rota) => {
    if (campos(rota) !== "pt,regioes" || !parciais.has(rota.pt)
      || !Array.isArray(rota.regioes) || !rota.regioes.length) {
      throw new Error("Uso na interface exige rota parcial registrada e regiões explícitas.");
    }
    if (vistas.has(rota.pt)) throw new Error(`Uso na interface duplicado para a rota: ${rota.pt}`);
    vistas.add(rota.pt);
    const par = parciais.get(rota.pt);
    const ids = new Set();
    let traduzidas = 0;
    let portuguesas = 0;
    const regioes = rota.regioes.map((regiao) => {
      if (!identificador(regiao?.id) || ids.has(regiao.id)) {
        throw new Error(`ID de região inválido ou duplicado em ${rota.pt}.`);
      }
      ids.add(regiao.id);
      if (regiao.estado === "portugues_marcado") {
        if (campos(regiao) !== "estado,id") throw new Error("Região portuguesa não catalogada não admite chaves fictícias.");
        portuguesas++;
        pendentes++;
        return { id: regiao.id, estado: regiao.estado };
      }
      if (regiao.estado !== "traduzido" || campos(regiao) !== "chaves,estado,id"
        || !Array.isArray(regiao.chaves) || !regiao.chaves.length) {
        throw new Error("Região traduzida requer estado conhecido e chaves explícitas.");
      }
      const locais = new Set();
      const chaves = regiao.chaves.map((chave) => {
        if (typeof chave !== "string" || !Object.hasOwn(entradasEn, chave)
          || entradasEn[chave].estado !== "traduzido") {
          throw new Error(`Chave declarada sem tradução disponível: ${String(chave)}`);
        }
        if (/^(idioma|traducao)\./.test(chave)) throw new Error("Mensagem de infraestrutura não conta como conteúdo traduzido.");
        if (locais.has(chave)) throw new Error(`Chave duplicada na região ${regiao.id}: ${chave}`);
        locais.add(chave);
        chavesUnicas.add(chave);
        ocorrencias++;
        return chave;
      }).sort(comparar);
      traduzidas++;
      return { id: regiao.id, estado: regiao.estado, chaves };
    }).sort((a, b) => comparar(a.id, b.id));
    if (!traduzidas || !portuguesas) throw new Error("Rota parcial exige regiões traduzidas e portuguesas pendentes.");
    return { pt: par.pt, en: par.en, dominio: par.dominio, regioes };
  }).sort((a, b) => comparar(a.pt, b.pt));
  if (vistas.size !== parciais.size) throw new Error("Toda rota parcial precisa de declaração de uso na interface.");
  return {
    schema_version: 1,
    rotas,
    rotas_parciais_declaradas: rotas.length,
    chaves_en_declaradas_em_uso: chavesUnicas.size,
    ocorrencias_en_declaradas: ocorrencias,
    regioes_pt_nao_catalogadas: pendentes,
    html_verificado_pelo_inventario: false,
  };
}
