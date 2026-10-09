# Pedidos da família Modelos e Previsões (rotas /pld/modelos, /pld/modelos/[modelo] e /pld/previsoes)

Registro dos pedidos ao coordenador: arquivos que ficaram sem uso (para apagar no fim, com o servidor parado), mudanças em componentes compartilhados, equivalências para a matriz de preservação e o que está fora do meu escopo.

## Arquivos sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/PrevisoesLinkPainel.tsx`: cópia do `LinkDoPainel`; as páginas passaram a usar `SeguirPainel`, que já inclui `LinkDoPainel`. Nenhum import restante.
- `src/components/energia/ArquivoPrevisoes.tsx`: componente antigo ("O que a plataforma registrava naquele dia"), sem uso nas páginas. Só é lido como texto por `src/tests/energia-governanca.test.ts` (linha 117), que confere três trechos desse arquivo. Para apagá-lo, esse teste precisa mudar de alvo: a regra "número de rodada interna de modelo fora de produção nunca aparece como previsão" vive hoje em `numeroRetido()` e em `linhasArquivo()` de `src/lib/energia/previsoes.ts` (rótulo "número retido (rodada interna)"), e já tem teste de comportamento em `src/tests/energia-previsoes.test.ts` (grupo do arquivo de emissões). O teste de governança pode ler `previsoes.ts` e procurar `tipo === "RODADA_INTERNA" && estadoModelo !== "PRODUCAO"` e `número retido`, e `PrevisoesArquivo.tsx` para `registrado_no_portal_em`.

## Mudanças em componentes compartilhados

1. `src/lib/energia/mapa.ts`, bloco `"pld-modelos"` (linha 483): o rótulo "Previsão atual por submercado e entrega" descreve o desenho antigo. A página agora responde "O que foi publicado antes do resultado?" e a rodada é "a mais recente", não "atual". Sugestão: "Rodada mais recente: referência B0 por submercado e entrega". As âncoras `#p013` a `#p016` existem e foram mantidas.
2. `TabelaInterativa` (opcional): em tabelas curtas com texto longo (matriz de modelos, entradas e fórmulas) a rolagem horizontal no celular esconde colunas. Resolvi localmente com `src/components/energia/PrevisoesTabela.tsx` (`TabelaAdaptativa`: tabela a partir de 768 px, lista de blocos abaixo disso). Se o coordenador quiser o mesmo comportamento em outras famílias, o componente pode subir para o sistema.

## Equivalências para a matriz de preservação

A ficha de cada modelo teve o painel principal renomeado: a pergunta "Como o X calcula a previsão do PLD?" virou o título da página (H1) e o painel passou a se chamar "Situação, entradas, fórmula e limites do X". Mesmo painel (`id` `ficha-<modelo>`), mesmo conteúdo. Para `docs/energia/redesign/equivalencias.json`:

```json
{
  "/setor-eletrico/pld/modelos/b0": [{ "antes": "painel|como o b0 calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do b0", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/c1": [{ "antes": "painel|como o c1 calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do c1", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/c2-h": [{ "antes": "painel|como o c2-h calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do c2-h", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/c2-p": [{ "antes": "painel|como o c2-p calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do c2-p", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/s0": [{ "antes": "painel|como o s0 calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do s0", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }]
}
```

Com essas cinco equivalências, o comparador casa as 41 visões anteriores das sete rotas, sem filtros, arquivos nem fichas "Comprove este número" a menos (Modelos 8 e 8; Previsões 3 antes e 5 depois).

## Fora do meu escopo

- `src/components/energia/PldPagina.tsx`: não precisei mudar. As páginas de Modelos e Previsões não importam mais nada dele; `src/tests/energia-pld.test.ts` passa.
- Testes de outras famílias que falharam quando rodei a suíte de conteúdo inteira: `src/tests/energia-conteudo-r8-R.test.ts` ("Element type is invalid", componente importado inexistente) e `src/tests/energia-interface-r2*.test.ts` (Geração, `chaveUrl="dia"`). Não toquei nem investiguei além da causa aparente.
