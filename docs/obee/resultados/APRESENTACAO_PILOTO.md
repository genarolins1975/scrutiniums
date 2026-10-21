# Apresentação do piloto de cinco dimensões

Entrega de 12/10/2026. Rota: `/eficiencia-estatal`, seção `#atlas-piloto`.

## Contrato de exibição

O piloto é exibido somente quando `VERCEL_ENV=preview` ou quando não existe `VERCEL_ENV` e `NODE_ENV=development`. Produção e ambientes desconhecidos ficam fechados por padrão. A prop `showPilot` conecta a decisão do servidor ao Atlas. Não há parâmetro de URL que habilite esse bloco em produção.

A apresentação lê diretamente a saída congelada `piloto-2022-v2.json`: não recalcula nem altera pesos, percentis, elegibilidade ou referências. `publication_ready=false` e `is_full_obee_score=false` permanecem inalterados. O rótulo “piloto experimental” acompanha escore, período, universo e limitações. A nota integral dos 16 capítulos continua indisponível. O modelo de escores dos serviços é identificado como contrato distinto.

## Leitura e interação

- Escore da capital e comparador, escala de 0 a 100, referência fixa de 2022.
- Distribuição das 26 capitais com seleção identificada por forma e cor; altura dos pontos não representa outra variável.
- Cinco indicadores com valores originais, unidade, direção, período, fonte e pontuação relativa. Pesos iguais de 20%.
- Tabela alfabética completa com seleção do comparador. A seleção atualiza o Atlas e preserva o endereço compartilhável já existente.
- Sensibilidade pré-calculada em 32 cenários de pesos, explicitamente distinta de intervalo de confiança.
- Saúde permanece fora do escore, com link para a decisão de elegibilidade. Regiões não recebem escore imputado.
- CSV contém 26 capitais, 130 valores originais, percentis, unidades, pesos, versão, ano e limites de sensibilidade. O escore de seis dimensões permanece vazio e o estado de Saúde explícito.

Preservados: mapa dos 16 temas, panorama de quatro perspectivas, comparação educacional por faixa etária/Saeb, catálogo com busca, fichas de cobertura e acessos aos capítulos.

## Verificação executada

**Dados e código:** seis testes novos e oito testes existentes do catálogo passaram no Vitest local (14/14). TypeScript passou para os componentes e módulos do Atlas em checkout focado. CSV efetivamente baixado pelo navegador: 26 códigos e escores, 130 valores brutos e ausência do escore de seis dimensões reconciliados contra o snapshot. Nenhuma nova dependência de produção.

**Navegador:** os componentes React reais foram montados em uma página local de revisão com os módulos CSS e os tokens do Atlas. O adaptador local de `next/link` produz âncoras; esta montagem não equivale a uma compilação/execução completa do Next. Inspecionados 320, 390, 768 e 1440 px, sem overflow horizontal da página. Ajustados os gráficos na faixa intermediária para preservar tamanho dos rótulos. Verificados seleção de Vitória, atualização do panorama, sensibilidade por Enter/foco visível, download, regiões sem piloto e restauração ao voltar. Verificado também o estado padrão sem a prop de revisão.

Axe no novo bloco: nenhuma violação reportada no estado verificado. Isso não constitui declaração de conformidade integral. Leitor de tela, zoom de 200%, toda a navegação Next e toda a aplicação não foram validados localmente.

Uma execução mais ampla dos testes do panorama encontrou dois arquivos de dados não trazidos para esse checkout focado; 30 testes daquele arquivo passaram, mas os dois testes de fixtures não foram concluídos localmente. A suíte final focada de 14 testes passou integralmente. O CI do repositório completo continua necessário.

## Avaliação editorial da seção

Autoavaliação, limitada à montagem local e aos estados descritos acima; não é revisão independente nem nota de toda a página inicial.

| Critério | Avaliação | Evidência / limite |
|---|---|---|
| Direção de arte | 8/10 | Identidade existente preservada; composição editorial e comparação por pontos. Ainda requer leitura integral no Next. |
| Hierarquia | 9/10 | Escore, universo e período separados da decomposição e da sensibilidade. |
| Tipografia e acabamento | 9/10 | Valores alinhados, unidades explícitas; gráficos adaptados no tablet. |
| Densidade e profundidade | 9/10 | Valores, referência, fontes, tabela integral e método acessíveis. |
| Didática visual | 9/10 | Distribuição e comparação por componente; distinção entre pontuação e valor original. |
| Comparabilidade | 9/10 | Mesma referência e cesta; ausência de Saúde e comparações internacionais declaradas. |
| Interação e acessibilidade | 8/10 | Teclado, foco e seleção conferidos; leitor de tela e 200% ainda não verificados. |
| Responsividade | 9/10 | Quatro larguras verificadas sem overflow na montagem local. |

## Pendência do CI anterior

No SHA `2c286cad4bb4bed6cc1d7999eb614baeb7a07394`, o job `testes` passou e o job `interface` falhou em `scripts/obee/oportunidades-auditoria.mjs`: “Avançar não restaurou o recorte limpo”. A falha ocorreu na navegação histórica do painel de oportunidades, depois de seus testes de layout nas quatro larguras. O log não estabelece se é defeito funcional ou sincronização do teste. Esse painel não foi alterado nesta entrega. Não atribuir esse resultado à nova seção nem declarar o CI completo verde antes de sua execução.

## Próxima etapa

Conferir a integração completa no preview Next e resolver qualquer falha confirmada do CI. Em seguida, revisar a leitura do conjunto da página e a validade de conteúdo/normalização antes de decidir sobre publicação oficial do piloto. A promoção é uma decisão explícita de metodologia e apresentação; não remover o bloqueio de produção apenas para exibir uma nota. A ampliação para Saúde e para os demais capítulos segue dependente de evidências e contratos próprios.
