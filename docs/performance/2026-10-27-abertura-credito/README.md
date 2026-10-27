# Iniciativa 2 — abertura progressiva do Crédito

Implementação de 27/10/2026, sobre a iniciativa 1 de mídia, no checkout baseado em `bd7a6fd0cda885308940553fe3b33b7abe149629`.

## Comportamento entregue

`/observatorio` e `/observatorio/map` entregam o título, contexto, síntese, gravura responsiva, atalhos e os três indicadores com fonte, período e definição no próprio HTML. A primeira tela é legível sem aguardar o JavaScript analítico ou os JSONs da aplicação. As outras rotas conservam o template inerte, sem buscar a gravura da entrada.

O template da abertura é único em `public/obs/index.html`: o servidor o publica na entrada e o atlas reutiliza o mesmo nó de imagem ao completar a página. O resumo dos indicadores usa `htmlResumoCredito` tanto no servidor quanto no navegador; lê os metadados da publicação corrente e é armazenado em memória por processo. Não se criou uma fonte de dados independente nem números fixos. Ausência continua indisponível; zero continua zero; metadados são escapados no HTML.

O mapa pede apenas `meta.json`, para complementar ciclo, catálogo, fontes e laboratório. Ao navegar para uma página analítica, `dadosDaVista` garante os arquivos do núcleo e os específicos da página, preservando os chunks existentes. Requisições simultâneas do mesmo arquivo compartilham a mesma carga. O CTA “Explorar o ciclo” também funciona quando acionado antes do boot: sua âncora é preservada durante a montagem.

O núcleo analítico ainda é baixado na abertura, mas não bloqueia o título, a gravura e os indicadores. O ciclo interativo continua progressivo; a prova abaixo distingue pintura da primeira tela de disponibilidade de seus controles.

## Método

Mesmo protocolo da iniciativa 1: build de produção, Chromium/Playwright, 390 × 844, DPR 1, CPU 4× mais lenta, rede de 200.000 B/s de download, 93.750 B/s de upload e 150 ms de latência. Três visitas por rota com contextos novos, servidor reaproveitado, usuário fictício e PGlite local. Medianas locais, não p75 de produção.

Bytes incluem os corpos codificados do documento e recursos até cinco segundos depois de `load`, sem cabeçalhos. `h1_dom_ms` mede a presença do título no DOM, não sua pintura; `controles_ms` mede a montagem do laboratório. `layout_shift_sum` é a soma de deslocamentos sem interação na janela, não o CLS oficial por janelas de sessão.

## Escopo da inspeção do Setor Elétrico

A entrada foi inspecionada: `PerguntasExploraveis` recebe resumos pequenos e as análises como filhos renderizados no servidor; `PercursoVisualEnergia` e o laboratório têm interações próprias. O volume observado no diagnóstico inclui essa árvore de conteúdo serializada. Não se removeu texto nem se ocultaram fontes para reduzir bytes. Após a iniciativa 1, seu LCP local já era 1,23 s; esta entrega concentra a mudança estrutural no bloqueio comprovado do Crédito. A redução adicional do HTML/RSC da Energia exige uma alteração específica dessas fronteiras e não foi implementada aqui.

## Resultados locais

| Versão — `/observatorio` | LCP | Evento load | Transferência |
|---|---:|---:|---:|
| Antes das iniciativas | 7,38 s | 2,45 s | 1281 kB |
| Após a iniciativa 1 | 3,78 s | 2,46 s | 554 kB |
| Após a iniciativa 2 | 1,71 s | 2,63 s | 464 kB |

Redução adicional de LCP sobre a iniciativa 1: **55%**. Meta laboratorial ≤2,5 s: atingida. O título entrou no DOM em 0,35 s e os controles do laboratório ficaram montados em 3,14 s. A entrada buscou apenas `meta.json`; os demais arquivos do núcleo foram exercitados pela navegação nos testes.

O alias `/observatorio/map` teve LCP mediano de 1,64 s. Os resultados individuais estão em `medicoes.json`.

## Verificação e limites

- Build de produção concluído.
- `npm run verificar:rapido`: lint, tipos, derivados e cobertura bilíngue aprovados; 7.458 testes passaram, 12 ignorados e 1 pendente.
- Quatro testes de navegador da abertura aprovados: acesso sem sessão, conteúdo sem JavaScript, script atrasado com CTA antecipado, navegação analítica e falha no carregamento de metadados. O laboratório também teve seu cálculo exercitado.
- Os três valores renderizados sem JavaScript foram comparados à gold corrente: conferem (`ssr-values.json`). Captura em `indicadores-sem-js-390.png`.
- Inspeção em 320, 390, 768 e 1440 px: sem erros de JavaScript ou transbordamento horizontal (`visual.json`). Imagens distantes da área visível podem permanecer sem carregar por lazy loading; o campo `ok` registra apenas o estado no instante da captura.
- Não foi executado o CI completo nem medição em produção. O evento `load` não melhorou: o ganho está na apresentação antecipada do conteúdo principal; os controles ainda dependem do JavaScript.

## Estado de entrega

Alterações locais, mantendo a iniciativa 1. Sem PR, merge ou deploy: a API do GitHub retorna `Forbidden` neste ambiente e o acesso à produção é bloqueado pela política de rede. Os números acima são evidências locais reproduzíveis, não confirmação do comportamento publicado.
