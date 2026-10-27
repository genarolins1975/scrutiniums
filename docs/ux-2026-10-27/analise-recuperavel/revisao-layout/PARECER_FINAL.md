# Parecer independente final — recuperar e compartilhar a análise

27/10/2026, confirmação às 16h26 UTC. Commit examinado: [`bff6a318a63677cccb63980426ee96906b6b13f4`](https://github.com/genarolins1975/scrutiniums/commit/bff6a318a63677cccb63980426ee96906b6b13f4). Build efetivamente servido: `sovLxFGQXUHYW9DceE2Ob`.

Avaliação realizada por agente separado da implementação, sem alterações no checkout. Esta última rodada verificou somente a entrelinha e a legibilidade de Meus recortes a 390 e 1440 px com texto ampliado a 200%, conforme escopo solicitado. Chromium local, banco e sessão sintéticos isolados, movimento reduzido. Navegadores e servidor encerrados.

## Conclusão

**A correção residual está confirmada.** Os parágrafos e metadados da lista não se sobrepõem mais: a fonte de 28 px usa entrelinha de 45,5 px; os metadados de 24 px usam 39 px. O resumo permanece legível e “Ver endereço e parâmetros” cabe, recebe foco e abre/fecha por Enter/Espaço. No celular, o item e o summary medem 276 px, sem extravasamento próprio.

As duas falhas encontradas nas rodadas independentes foram corrigidas com avanço verificável: primeiro o corte do summary, depois a entrelinha fixa da lista. Não há indicação de novas alterações cosméticas para encerrar este incremento.

Evidências deste build: `jornada.json`, `conta-texto200-390.png` e `conta-texto200-1440.png`, nesta pasta.

## Antes e depois observados

| Antes | Depois | Benefício observado |
|---|---|---|
| Consulta mostrava PE e 60 litros, mas o endereço guardava apenas UF | Endereço salvo e copiado recuperou PE e 60 litros nas jornadas verificadas | Recuperação da simulação examinada |
| Endereço técnico como principal descrição | Resumo “Pernambuco · 60 litros” e endereço completo em detalhes | Reconhecimento do recorte sem decifrar chaves |
| Lista sem compartilhamento direto | Copiar link junto de cada recorte | Menos passos |
| Área de transferência recusada sem saída | Endereço selecionável, mensagem e foco | Alternativa útil |
| Limite histórico pouco claro | Aviso de que o recorte consulta dados disponíveis ao reabrir | Não promete preservar uma edição histórica |
| Summary cortado e parágrafos sobrepostos no ensaio de texto200% | Summary com quebra e entrelinha proporcional | Legibilidade do fluxo ampliado |

A linha de base examinada corresponde a `3e6ca25`, em `/workspace/analise-baseline`. A jornada completa de salvar, deduplicar, copiar, abrir detalhes por teclado e recuperar PE/60 litros foi executada a 320, 390, 768 e 1440 px no candidato `29708ebdb`; a confirmação do summary final foi feita no build `zdkU37XJIzk4uJJiZ55kv`, commit `32db0c3d2`. Não reapresentei essas capturas antigas como se pertencessem ao build desta última rodada. A mudança desde a confirmação anterior restringe-se à entrelinha em MeusRecortes, conferida pelo diff.

## Oito dimensões, sem média compensatória

Notas restritas a Salvar recorte e Meus recortes. Salvar mantém a avaliação da rodada anterior, pois não foi alterado nesta última correção. Não são notas de todos os painéis nem homologação integral da página da conta.

| Dimensão | Salvar recorte | Meus recortes | Fundamentação |
|---|---:|---:|---|
| Direção de arte | 8,5 | 8,5 | Identidade editorial e componentes existentes preservados |
| Hierarquia | 8,5 | 8,5 | Resumo legível antecede detalhe técnico; ações identificáveis |
| Tipografia e acabamento | 8,5 | 8,5 | Corte e sobreposição corrigidos; tipografia proporcional no ensaio ampliado |
| Densidade e profundidade | 8 | 8 | Conteúdo e ressalvas preservados; introduções ainda extensas no celular |
| Didática visual | 8,5 | 8,5 | UF/volume reconhecíveis; limite histórico explícito |
| Comparabilidade/identificação | 8,5 | 8,5 | Resumo coincide com parâmetros recuperados nas jornadas |
| Interação e acessibilidade | 8,5 | 8,5 | Foco, teclado e alternativa de cópia verificados; sem leitor de tela |
| Responsividade | 8,5 | 8,5 | Quatro larguras normais examinadas; estados ampliados dos componentes legíveis |

Não atribuo 9 para encerrar o trabalho: as evidências demonstram um fluxo bom e consistente, com limites de cobertura e espaço para síntese editorial.

## Ressalva externa preexistente, preservada

A página inteira da conta ainda mede 490 px no ensaio a 390 px com texto200%. **A origem principal é Alterar telefone, não a lista de recortes.** Input e select daquele bloco medem 433 px, começam em x=57 e terminam em x=490. Localização: `src/components/conta/AlterarTelefone.tsx:161–181` e `src/components/ui/Field.tsx:24–35`; ambos os arquivos são idênticos aos de `3e6ca25` (diff vazio). A grade e seus itens preservam a largura intrínseca do input ampliado, sem `min-w-0`. Há extravasamentos menores do botão Sair e do e-mail de privacidade; neste último só a cor mudou na frente3.

O diagnóstico numérico permanece em `/workspace/analise-layout-confirmacao-final/diagnostico/jornada.json`. Esta limitação não foi corrigida por estar fora do incremento autorizado, e impede declarar a página inteira da conta homologada em texto ampliado.

## Limites e decisão

O ensaio duplica os tamanhos calculados de fonte; não equivale a zoom nativo do navegador. Não executei leitor de tela, dispositivos físicos, produção ou nova auditoria integral de todos os painéis. A sessão usada é sintética/local. Não declaro conformidade WCAG integral a partir destas verificações.

**Decisão:** correções e fluxo de recortes examinados aprovados dentro do escopo registrado. Meta de excelência9 em cada dimensão não atingida; homologação de toda a página da conta e de toda a plataforma não concedida. A limitação externa de Alterar telefone permanece documentada, sem ser atribuída ao componente corrigido.
