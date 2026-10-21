# Assistência social e cuidado — primeira entrega

Autorização: em 10/10/2026, o responsável aprovou iniciar a proposta de capítulo de assistência social e cuidado. Integração nativa na Scrutiniums, mantendo Next.js, tokens OBEE e rotas públicas.

## Escopo e entregas

Oito rotas em `/eficiencia-estatal/assistencia-social`: panorama, necessidades, acesso, acompanhamento, cuidado, recursos, dados, métodos. Necessidades distingue demanda elegível de inscrição no Cadastro Único e liga aos dados de renda existentes. Não publica estimativa inédita de demanda.

Snapshot Censo SUAS 2025: 8.903 CRAS, 3.044 CREAS (36 regionais) e 2.103 centros-dia e similares (cinco estaduais). A UF agrupa a rede; não define integralmente sua área de atendimento. Brasília permanece distrital. Fernando de Noronha, presente na fonte, não é tratado como prefeitura comum. Centros-dia incluem 1.933 unidades não governamentais e 170 governamentais; natureza não prova financiamento público.

RMA CRAS 2025: 103.847 formulários unidade-mês da Base tratada. Recorte de a1, a2, c1, c5 e respectivas colunas originais. Estoques mensais não são somados no ano. Alterações pelo tratamento oficial ficam quantificadas. Formulários zerados excluídos pela fonte não são recriados. Cobertura por variável usa formulários presentes, não cadastro completo das unidades que deveriam enviar.

29 fichas precedem cada indicador. CSVs nacionais completos e JSONs por UF mantêm ausências, saltos de questionário e valores originais. RH só publica contagem de vínculos ligados à unidade, sem nomes, documentos, contatos ou atributos individuais de trabalhadores. 118.327 registros RH CRAS e 29.077 CREAS, todos ligados a unidades do recorte; não são pessoas únicas ou jornadas equivalentes.

## Reprodução e publicação de dados

1. Baixar os quatro originais pelos links no manifesto; conferir SHA-256. Extrair os três ZIPs em diretório de trabalho, preservando arquivos.
2. `python -m pipeline.assistencia.capturar DIRETORIO_ORIGINAIS` produz seed gzip determinístico e manifesto com fontes e auditoria.
3. `python -m pipeline.assistencia.gold`: `padroniza.le` confere hash; `validacoes.valida` confere estados, fichas, chaves e cobertura; `gold.promove` chama o materializador Node após aprovação.
4. O build usa apenas Node stdlib (`scripts/materializar-assistencia.mjs`), com gate próprio antes de qualquer arquivo público. Python não é requerido no Vercel. Arquivos públicos são ignorados no git, reconstruídos da seed de hash fixado.
5. As agregações são feitas na materialização, não nos componentes de UI. Filtros escolhem recortes pré-calculados; gráfico e tabela compartilham a mesma medida e cobertura.

O XLSX original de centros-dia contém um controle XML 1.0 proibido (0x13) na coluna q0_1, nome da unidade não publicado. Apenas a cópia temporária para leitura remove esse byte; arquivo oficial, SHA-256 e respostas selecionadas são preservados. A biblioteca XLSX compartilhada não foi alterada. Algumas redações e contagens nos Leia-me divergem dos arquivos distribuídos; o gate usa os arquivos efetivos e chaves reconciliadas, sem ajustar números a descrições conflitantes.

## Escore e referências

Edição experimental v0.4: cesta fixa de cinco capítulos, com assistência. Contrato v0.3 e memória anterior preservados em `src/lib/eficiencia/escores/`. A v0.3 nunca teve valores calculados; não há série numérica a recalcular. Acesso, resposta e qualidade com pesos iguais e média geométrica permanecem proposta não validada. Ausência bloqueia; zero legítimo é preservado; não há reponderação. Valores contextuais de renda/benefícios não pontuam novamente.

A memória do capítulo registra faltas de demanda elegível, atendimento sem duplicidade, continuidade individual, encaminhamento concluído, qualidade/segurança e referências. Espera do Cadastro Único não é espera geral. Autodeclaração de acessibilidade não é inspeção. Plano declarado não comprova continuidade real. Recursos são contexto; satisfação requer pesquisa representativa de usuários e não atendidos.

Referências de desenho: OECD Serving Citizens (acesso, resposta, qualidade); ASCOF da Inglaterra (resultados relevantes para usuários e cuidadores). Não se transferem escores, pesos ou metas britânicas para municípios brasileiros. IDCRAS/IDCREAS ainda não integrados.

## Limites desta entrega

Sem microdados pessoais, estimativa de demanda, completude de envio RMA contra unidades ativas, usuários únicos, atribuição causal, fluxo pessoa a pessoa, despesa reconciliada, mapa com geometrias ou nota numérica validada. O cuidado publicado limita-se às modalidades selecionadas e não representa todo o sistema de cuidados. Dados de 2025 não são apresentados como atuais em 2026. Snapshot sem atualização automática.

Verificação de navegador indisponível neste ambiente: responsividade visual, teclado, leitor de tela e zoom manual permanecem não verificados. Não atribuímos notas estéticas sem essa evidência. Verificações de tipos, lint, build, HTML e reconciliação são registradas no fechamento da entrega.

## Verificação desta versão

- Gate Python: cinco testes, incluindo branco/zero/salto, ficheamento, chaves, originais RMA e relações entre subgrupos domiciliares; aprovados.
- Pipeline Educação executado sem validação reprovada; 41 testes existentes aprovados. Arquivos reserializados pelo pipeline não fazem parte desta mudança.
- Reextração dos quatro arquivos oficiais reproduziu a seed byte a byte (SHA-256 414f53344c2d61f6e3856de0347fc17073d14f29d3c93fe5e9fdde0dc6d7e3d0).
- TypeScript, lint e build de produção aprovados; 475 páginas geradas, incluindo as oito novas. Interface nova: first-load JavaScript entre 87,7 e 98,2 kB no build.
- Suíte completa com `EXIGIR_BUILD_HTML=1`: 179 arquivos, 4.383 testes aprovados e um ignorado. O gate inclui as oito páginas de assistência, gráfico/tabela derivados da mesma fonte, CSVs completos, UF/competência e edição de cinco capítulos sem reponderação.
- Navegador e tecnologias assistivas: não verificados, conforme limite acima. Não há alegação de aprovação visual ou conformidade integral.
