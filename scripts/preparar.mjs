/**
 * Prepara os derivados gitignorados de que dev, build e testes dependem. Rodar na raiz.
 *
 * Até 22/10/2026 a mesma lista vivia repetida em `predev`, `prebuild` e `pretest`, com uma
 * diferença silenciosa: o `pretest` não gerava o app.min.js, e quem chamava `npm test` num
 * clone limpo caía em ENOENT nos três testes de exportação do Crédito. Os três hooks agora
 * apontam para este arquivo, e `npm run preparar` faz o mesmo sob demanda.
 *
 * Cada materializador confere o SHA-256 da sua semente antes de gravar; o minificador
 * importa o de Trabalho e Renda (o import repetido não executa duas vezes).
 */
await import("./materializar-assistencia.mjs");
await import("./materializar-seguranca-alimentar.mjs");
await import("./materializar-trabalho-renda.mjs");
await import("./minify-obs.mjs");

await import("./materializar-entradas.mjs");
