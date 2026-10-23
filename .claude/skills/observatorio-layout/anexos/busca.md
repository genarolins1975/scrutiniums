# Observatório Layout, anexo: Busca da plataforma

Carregar quando a tarefa tocar busca da barra, índice, /buscar, busca local da coleção. Texto movido sem alteração do SKILL.md de 22/10/2026; os números de seção são os do original.

### Navegação e acesso

Parte de busca desta seção; o acesso está em `anexos/acesso.md` e a navegação em `anexos/navegacao.md`.

- **Uma só busca (Iniciativa 3 do parecer de UX de 21/10/2026):** a busca da plataforma é `BuscaPlataforma` (`src/components/busca/BuscaPlataforma.tsx`), na linha da marca da barra comum, à esquerda da conta (prop `busca` de `BarraPlataforma`, passada por `CabecalhoPlataforma` e `PublicHeaderView`; na SPA do Crédito, o mesmo formulário GET gerado por `barraSpa.ts`). Abaixo de 640 px, uma lupa de 44 px abre a busca em tela cheia; "/" e Ctrl K levam ao campo, sem animação; Esc fecha e devolve o foco. O índice é único (`src/lib/busca/indice.ts`, servido em `/busca/indice.json` e baixado só no foco) e a lista de resultados também (`ListaResultados`, usada pela barra, por `/buscar` e por `/app/observatorios`); destinos fechados levam `SeloComConta` para quem não tem sessão. `/buscar` é aberta, não indexada e fora do sitemap; sem JavaScript, o campo envia para lá. Em página de coleção, a busca local é o mesmo componente com `filtro={{ colecao }}` e o link "Buscar em toda a plataforma"; não criar outra busca de páginas. **Destino novo entra na busca pelo registro e pelos catálogos, nunca à mão**: `src/lib/busca` não lista endereços (teste `busca-indice.test.ts`), e sinônimo novo vai para `src/lib/busca/sinonimos.json`. O índice é só em português: nas páginas em inglês o campo não aparece. A busca de município é a da consulta de cada tema (Iniciativa 7).
