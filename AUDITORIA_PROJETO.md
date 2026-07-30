# Auditoria do projeto Scrutiniums

Data: 2026-07-30 · Escopo: plataforma Next.js + Observatório Brasileiro de Crédito embutido (SPA em `public/obs`) · Método: inspeção de código, execução local (build de produção e dev), navegação automatizada por Playwright nas 17 rotas do Observatório e nas páginas Next, fluxos completos de cadastro e login via API, verificação pixel a pixel contra o original.

Status: ✅ aplicada · 🟨 registrada (não aplicada, com motivo)

| # | Página/Componente | Problema | Evidência | Categoria | Sev. | Correção | Status |
|---|---|---|---|---|---|---|---|
| 1 | Observatório · sidebar | Sem botão de saída nem acesso à conta: usuário ficava preso na SPA sem logout | index.html (sidefoot só com tema e recolher) | UX/Navegação | P0 | Botões "Minha conta" (/app/conta) e "Sair" (POST /api/auth/sair) no rodapé da navegação, no padrão visual dos toggles; logout validado de ponta a ponta (sessão revogada, /observatorio volta a exigir login) | ✅ |
| 2 | Observatório · cartão KPI | HTML vazava como texto no cartão de Inadimplência (aria-label quebrado por aspas do chip) | Print do usuário + reprodução local | Dado/Renderização | P0 | Rótulo em texto puro com aspas escapadas no aria-label (correção anterior, incorporada ao helper `attr()`) | ✅ |
| 3 | Observatório · `favStar()` | Rótulo com aspas/tags quebrava o atributo `onclick`, vazando HTML | app.js L239 | Renderização | P0 | Helper `attr()` (strip de tags + escape de aspas) aplicado | ✅ |
| 4 | Observatório · subíndices de estresse | Atributo `class` duplicado silenciava o destaque vermelho de z>1σ | app.js L574 | Dado/Semântica visual | P0 | Atributos mesclados; destaque volta a funcionar | ✅ |
| 5 | Observatório · ~25 sítios | `title`/`aria-label`/`data-mrow` interpolando textos de dados (notas metodológicas, nomes de IFs, termos do Trends) sem escape | Tabela completa no relatório do auditor da SPA | Robustez/A11y | P1 | `attr()` aplicado em todos os sítios de risco; conteúdo visível inalterado | ✅ |
| 6 | Observatório · elementos clicáveis | Linhas de tabela, cards e paths do mapa com onclick sem acesso por teclado | Varredura Playwright nas 17 rotas | Acessibilidade | P1 | `a11yEnhance` central (tabindex, role, Enter/Espaço) via MutationObserver, sem duplicar handlers existentes | ✅ |
| 7 | Observatório · sparkline/donut/histogram | SVGs decorativos sem `aria-hidden` | Varredura Playwright | Acessibilidade | P1 | `aria-hidden="true"` nos três geradores | ✅ |
| 8 | Next · AppHeader + /app | Ambiguidade: página /app chamada "Visão geral", igual à visão geral do Observatório | NAV e PageTitle | Arquitetura da informação | P1 | Renomeada para "Painéis Scrutiniums" (menu, título, metadata, aria-label); rota preservada | ✅ |
| 9 | Next · PublicHeader | Beco: usuário logado nas páginas públicas via só "Entrar/Criar acesso" | Componente estático | UX/Navegação | P1 | Header sensível à sessão: logado vê "Minha conta" e "Observatório" | ✅ |
| 10 | Next · /entrar | `?de=` do middleware era ignorado; destino original se perdia após login | Middleware seta, login não lia | UX/Fluxo | P1 | `safeInternalPath()` (anti open redirect: só caminho interno, sem //, \\, esquema, /api) aplicado no form e revalidado na API; coberto por 11 asserções de teste | ✅ |
| 11 | Tokens · mineral | Contraste 3,07:1 sobre marfim para texto pequeno (abaixo de AA) | Cálculo de razão de contraste | Acessibilidade | P1 | `mineral` escurecido para #6B6D6A (4,55:1 marfim; 4,92:1 papel); `mineral-soft` e séries de gráfico preservados; rodapé escuro ajustado para `mineral-soft` | ✅ |
| 12 | Headers · alvos de toque | Links de navegação com ~17 a 28px de altura | Medição Playwright | Acessibilidade | P2 | `min-h-[44px]` em todos os links dos dois headers e logos, sem alterar a altura visual | ✅ |
| 13 | Observatório · semântica de cor | Verificação dos ~40 usos de up/down: alta de inadimplência vermelha, queda de desocupação verde etc. | Auditoria dedicada | Dado/Semântica | — | Nenhuma inversão encontrada; único defeito era o item 4 | ✅ |
| 14 | Observatório · links e exportações | RSS, report.html, JSONs de produto/instituição/comparador | Checagem de existência + HTTP | Navegação | — | Todos presentes e respondendo; nenhum beco | ✅ |
| 15 | Middleware · /observatorio | Cookie inválido (não expirado) ainda serve a SPA; validação forte só nas rotas /app | curl com cookie falso | Segurança (baixo risco: conteúdo estático sem dado por usuário) | P3 | Validar sessão no middleware exige banco no edge; mudança estrutural registrada como recomendação | 🟨 |
| 16 | Painéis Next · hooks | 3 warnings `react-hooks/exhaustive-deps` pré-existentes | Saída do build | Técnico | P3 | Warnings sem efeito funcional; refatoração desnecessária agora | 🟨 |
| 17 | Observatório · RSS atrás do login | alerts.xml exige cookie; leitores externos não assinam | Consequência da proteção | Produto | P3 | Intencional enquanto todo o conteúdo é autenticado; revisitar se houver conteúdo público | 🟨 |

## Verificação final
`node --check` (SPA), `tsc --noEmit`, `vitest run` (81/81) e `next build` limpos. Playwright: 17/17 rotas do Observatório sem erros de console, pageerrors ou respostas ≥400, incluindo páginas dinâmicas de instituição/produto/setor e navegação por teclado; 14 páginas Next sem erros de console; logout validado de ponta a ponta; nenhum segredo (TWILIO*, COOKIE_SECRET, ACCESS_CODES) no bundle do cliente.

## Próximos passos sugeridos (impacto × esforço)
1. Validação forte de sessão no middleware edge (item 15) com verificação assinada sem banco (cookie JWT curto) — médio esforço.
2. Atualização periódica dos dados: rodar o pipeline Python e sincronizar `public/obs/data` (automatizável via Action) — médio.
3. Provedor de e-mail (Resend) para comunicações à lista de espera — baixo.
4. Rotação do COOKIE_SECRET e do Auth Token da Twilio expostos durante o setup — baixo.
5. Lighthouse/Core Web Vitals formais em produção e ajuste fino de fontes — baixo.
