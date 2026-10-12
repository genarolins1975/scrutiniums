# Revisão editorial e metodológica do piloto

12/10/2026. Revisão técnica interna; não constitui homologação independente.

## Tarefa da página

Permitir que o leitor compare condições dos moradores nas capitais, entenda os cinco indicadores que compõem o piloto e confira fontes, períodos e limitações. A nota não estima eficiência estatal, satisfação ou qualidade integral dos serviços.

## Ajustes desta entrega

- Ressalvas sobre posição relativa, compensação e incerteza agora precedem o número principal, sem depender da expansão metodológica.
- Decomposição assinada da diferença entre o território e o comparador, com cinco barras a partir de zero, escala fixa de −20 a +20 por indicador e valores tabulares equivalentes.
- Contribuição = peso congelado × diferença dos percentis. A soma reproduz a diferença dos escores; a apresentação usa duas casas e identifica o arredondamento.
- Comparador e URL existentes atualizam também essa leitura. Não há mudança de cesta, pesos, fontes, referência ou escore.

## Revisão dos contratos

| Aspecto | Achado e decisão |
|---|---|
| Construto | Condições dos moradores, com educação pública e privada; não atribuir os resultados ao Estado. |
| Referência | 26 capitais estaduais de 2022, sem DF. Não representa população brasileira ou conjunto de municípios. |
| Normalização | Percentil orientado com meio peso dos empates; distâncias monetárias/físicas são perdidas. Valores brutos continuam ao lado. |
| Agregação | Média ponderada aditiva, cinco pesos de 20%. Compensação total entre dimensões é hipótese normativa, não descoberta empírica. |
| Decomposição | Identidade aritmética, sem interpretação causal. Testada para todos os 676 pares incluindo autopares. |
| Incerteza | Sensibilidade de pesos não é intervalo de confiança. Erro amostral e incerteza do modelo de homicídios não propagados. |
| Temporalidade | Referência congelada; alteração da cesta não constitui evolução temporal. Não há série de tendência do escore. |
| Saúde | Continua sem elegibilidade e sem imputação no escore ampliado; auditoria de precisão não resolve cobertura. |
| Publicação | Continua experimental em preview, publication_ready=false. Revisão interna não aprova publicação oficial. |

## Evidências

16 testes focados e TypeScript incluindo o teste passaram. Conferência numérica dos 676 pares contra as notas congeladas; reversão de sinais e autopares zero; territórios não suportados retornam ausência. A nova seção foi conferida na montagem local React em 320, 390, 768 e 1440 px, sem overflow da página. Recife × Curitiba: −43,85 pontos; troca para Belém: −3,85 pontos, com sinais mistos e URL atualizada. A montagem local não equivale ao build Next integrado.

A prévia Next anterior foi inspecionada do início ao rodapé, incluindo fontes, composição, capítulos e separação entre o piloto e o modelo de serviços. No commit anterior 11abfea9, CI de interface aprovado; suíte geral ainda em andamento na conferência. O CI desta nova entrega deve ser acompanhado separadamente.

## Avaliação da seção alterada

Autoavaliação de escopo limitado, não nota de toda a página.

| Critério | Nota | Evidência / limite |
|---|---|---|
| Direção de arte | 8 | Tabela com barras alinhada à identidade; não houve revisão independente. |
| Hierarquia | 9 | Diferença total, contribuições e unidades explícitas. |
| Tipografia | 8 | Valores tabulares legíveis; gráficos curtos em 320 px. |
| Densidade | 8 | Explicação nova útil, mas a página completa permanece longa. |
| Didática | 9 | Sinais, zero e fórmula explicados; causalidade excluída explicitamente. |
| Comparabilidade | 9 | Cesta e escala fixas, universo e limitações presentes. |
| Acessibilidade | 8 | Tabela semântica e valores equivalentes; leitor de tela e zoom nativo 200% pendentes. |
| Responsividade | 8 | Quatro larguras sem overflow na montagem local; nova versão Next ainda pendente. |

## Próximas decisões

1. Conferir CI e a nova seção na prévia Next após a implantação.
2. Avaliar com usuários se a posição relativa e a compensação são compreendidas; revisar a extensão da página com essa evidência.
3. Revisão metodológica independente: relevância da cesta, redundância entre indicadores, justificativa dos pesos e impacto das incertezas das fontes. Não tratar normalização por percentis como validação do construto.
4. Somente após essas condições, decidir explicitamente sobre publicação do piloto. Ampliar cobertura territorial, períodos e capítulos exige novos contratos; não extrapolar o escore atual.
