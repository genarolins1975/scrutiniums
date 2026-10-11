# Saneamento — SINISA 2025, referência 2024

Sete rotas em `/eficiencia-estatal/saneamento`: panorama, água, esgoto, resíduos, drenagem, recursos e métodos. 29 indicadores; 768 observações. Água, esgoto e recursos: 33 territórios (Brasil, cinco regiões, 27 UFs). Resíduos e drenagem: seis agregados dos relatórios, sem inferência municipal.

## Contrato

- Indicadores consolidados oficiais são preservados, incluindo nulos e valores superiores a 100%. Fórmulas e elegibilidade acompanham cada indicador.
- `R-SE` identifica Sudeste, `SE` identifica Sergipe. Não há colisão entre níveis.
- Totais financeiros vêm das planilhas de gestão administrativa e financeira. Investimentos = prestador + Estado; nunca despesa + investimento.
- Razões OBEE por residente usam DFE0001 da planilha financeira do respectivo módulo, não população atendida nem população nacional completa. Informações financeiras não declaradas podem afetar essas razões.
- Cobertura de coleta em esgoto no relatório (173.640.502 residentes) diverge da população consolidada técnica/financeira (188.255.906). Não conciliar silenciosamente.
- IRS3002: Norte 55,0%; Nordeste 33,1%; Sudeste 11,9%; Sul 2,3%; Centro-Oeste 48,7%. Ordem conferida no gráfico renderizado, não na ordem do texto extraído.
- IGR0002 usa contagens de desabrigados ou desalojados registradas no S2ID (GAP2212) mais as não registradas (GAP2213), divididas pela população urbana. Não é todo afetado, indivíduo deduplicado ou total do S2ID.
- Fontes financeiras publicadas em planilhas podem diferir em centavos dos totais arredondados do relatório. Usar a planilha, preservando precisão de entrada.

## Reprodução

`python pipeline/saneamento/capturar.py` usa apenas stdlib, sem rede. Lê `fontes.json.gz`, extração das seis planilhas consolidadas com nomes, linhas e abas metodológicas, e hashes dos quatro relatórios originais. As transcrições regionais estão explicitadas no código, com localizador; `excertos.json.gz` guarda a evidência textual de suporte. A transcrição de gráficos exige conferência visual: texto extraído pode alterar a ordem das categorias ou incluir camadas ocultas.

As URLs oficiais e hashes dos originais estão em `public/eficiencia/saneamento/fontes.json`. Para atualizar, baixar os ZIPs e PDFs dessa lista, conferir hashes/retificações, reextrair as abas, revisar a elegibilidade e as transcrições, depois regenerar e executar os testes. Não concatenar dados SNIS sem estudo de compatibilidade.

`python -m unittest pipeline.tests.test_saneamento` verifica reprodução byte a byte, cardinalidade, ausência e totais financeiros. `npx vitest run src/tests/obee-saneamento.test.ts` verifica universos, códigos territoriais, bases e exportação.

Após build: `SANEAMENTO_PLAYWRIGHT=/caminho/node_modules/playwright node scripts/obee/saneamento-verificacao.mjs`. O script abre as sete rotas em 320/390/768/1440, testa texto ampliado, axe, URLs, histórico, teclado, exportação e downloads. Não comprova conformidade WCAG integral.
