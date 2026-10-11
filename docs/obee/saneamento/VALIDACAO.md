# Validação — Saneamento

11 de outubro de 2026. Autoavaliação, sem revisão independente.

- Build de produção e tipos aprovados; 183 arquivos de teste, 4.447 testes aprovados, 1 ignorado.
- Quatro testes Python aprovados, incluindo reprodução byte a byte dos sete downloads.
- Navegador Chromium: 28 combinações de rota/largura (sete rotas × 320, 390, 768 e 1440 px), HTTP 200, um H1, nenhum overflow da página, nenhuma violação axe A/AA no conteúdo principal, nenhum erro de JavaScript.
- 25 verificações funcionais: texto em 200% nas sete rotas, filtros na URL e recarga, histórico, reset por teclado, CSV de cinco regiões, restrição regional dos relatórios, sete downloads, sitemap, descoberta no OBEE e 404.
- Inspeção visual das sete páginas completas em 390 e 1440 px: títulos, gráficos, referências, tabelas expansíveis, fontes e rodapé. Capturas e resultados locais gerados por `scripts/obee/saneamento-verificacao.mjs`.
- Após a inspeção, acrescentada orientação explícita de rolagem horizontal na tabela do panorama. Sem alteração de geometria da tabela ou contrato dos dados; CI e conferência final em produção verificam a versão publicada.
- Relatórios originais: páginas de resíduos 37/43 e drenagem 32 renderizadas e confrontadas com a transcrição. A leitura visual corrigiu a associação Nordeste/Centro-Oeste que o texto extraído não preservava.

## Rubrica por página

Escala 0–10. Colunas: arte, hierarquia, tipografia, densidade, didática, comparabilidade, interação/acessibilidade, responsividade.

| Página | Arte | Hierarquia | Tipo | Densidade | Didática | Comparabilidade | Interação | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Panorama | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Água | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| Esgoto | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| Resíduos | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Drenagem | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Recursos | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| Dados e métodos | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |

Evidência comum: identidade editorial existente, uma cor focal, barras com origem zero, referências rotuladas, conteúdo exato em tabela e CSV, ressalvas materiais fora de tooltips, quatro larguras e reflow com texto ampliado. Água/esgoto/recursos preservam as 27 UFs, produzindo uma leitura vertical longa no celular; a alternância para regiões reduz o conjunto explicitamente. Não se oculta território para diminuir a tela.

Limitações: não houve sessão com leitor de tela ou dispositivos físicos; axe não demonstra conformidade WCAG integral. A seleção nativa pode abreviar nomes longos, mas o nome completo permanece no título do gráfico e da tabela. As fontes são autodeclaradas e possuem elegibilidade própria. A divergência de população de esgoto está documentada no produto. Não há auditoria independente dos dados.
