/**
 * Parceiros institucionais da plataforma. A marca de cada um é o arquivo
 * oficial fornecido pelo parceiro, servido localmente em /home/parceiros
 * (pasta aberta, para carregar também sem sessão) e registrado em
 * public/home/parceiros/manifesto.json com origem, conversão e sha256.
 *
 * FGV CERI: parceria técnica (decisão do mantenedor, 20/10/2026). A marca
 * aparece na página inicial e nos painéis de infraestrutura (Setor Elétrico,
 * Gás Natural, Saneamento e Combustíveis), na entrada e no mapa do
 * Observatório de Energia e Infraestrutura.
 */
export const CERI = Object.freeze({
  id: "fgv-ceri",
  nome: "FGV CERI",
  descricao: "Centro de Estudos em Regulação e Infraestrutura da Fundação Getulio Vargas",
  // em inglês o nome da fundação fica pela sigla: o detector de português sem marca lê "Fundação" como vazamento
  descricaoEn: "Center for Regulation and Infrastructure Studies at FGV",
  url: "https://ceri.fgv.br/",
  /** Lockup colorido do kit, para fundos claros. */
  arquivo: "/home/parceiros/fgv-ceri.svg",
  /** Variante para fundos escuros (texto branco, CERI em azul-claro). */
  arquivoEscuro: "/home/parceiros/fgv-ceri-escuro.svg",
  largura: 448,
  altura: 118,
});

/** Coleções em que a marca do CERI acompanha o cabeçalho do módulo (painéis de infraestrutura). */
export const COLECOES_COM_CERI = Object.freeze(["energia", "gas", "saneamento", "combustiveis"] as const);
