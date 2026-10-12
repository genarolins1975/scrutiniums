# A9 — escala dos valores e comparação fiscal

Implementação em 12/10/2026, sobre `main` 2f990dd7f. Escopo: Contas Públicas Federais.

## Perguntas atendidas

- Quanto o agregado representa por habitante e em relação ao PIB?
- Qual a maior despesa primária do recorte?
- Que categoria teve a maior mudança em magnitude, na escala selecionada?

Execução: escala do pagamento de 2025, preservando dívida/refinanciamento e exclusão de RAP. Panorama: escala da despesa primária e saldo primário/PIB em 2024 e 2025; comparação dos quatro grupos em 2025 × 2024, com três escalas, ordenação, tabela e CSV. Em 2024 × 2023 e jan–jul/2026 × jan–jul/2025, a comparação continua nominal porque não há denominadores homologados para os dois anos completos. Não há anualização, imputação ou correção pela inflação.

## Homologação dos denominadores

Arquivos brutos imutáveis em `data/contas-publicas/escala-2026-10-12/`, com URLs, instantes de captura e hashes SHA-256 no manifesto. Respostas da API de agregados do IBGE: tabela 1846, variável 585, categoria 90707 (PIB a preços de mercado, milhões de reais correntes, sem ajuste sazonal); tabela 6579, variável 9324 (população residente estimada, pessoas). Território N1/1, Brasil. População referida a 1º de julho. As respostas não informam publicação, conservada como null.

| Ano | População estimada | PIB anual, R$ milhões correntes |
|---|---:|---:|
| 2024 | 212.583.750 | 11.779.251 |
| 2025 | 213.421.037 | 12.738.566 |

O PIB anual é a soma dos quatro trimestres da mesma extração. Conserva a precisão em milhões publicada na API, sem distribuir arredondamentos. Os dados podem ser revistos pelo IBGE. Não se denomina esta razão como a razão oficial publicada pelo Tesouro: é cálculo da Scrutiniums com o numerador RTN da edição julho/2026 e os denominadores IBGE capturados em 12/10/2026.

Fórmulas, antes do arredondamento: por habitante = valor em R$ milhões × 1.000.000 / população do próprio ano; % PIB = 100 × valor em R$ milhões / PIB do próprio ano. Diferença entre razões ao PIB em pontos percentuais. Variação nominal e por habitante calculada apenas com base anterior positiva. Ausência não é zero. Cada série comparada usa a mesma janela de meses.

Essas razões dimensionam agregados: não são benefício recebido pelo cidadão, custo por usuário de um serviço, produção atribuível ao governo ou evidência de eficiência. O saldo é acima da linha, não a apuração da meta fiscal. IPCA/séries reais permanecem para uma entrega posterior, com homologação própria.

## Reprodução

```sh
python3 scripts/contas-publicas/importar-escala.py --verificar
python3 -m unittest discover -s scripts/contas-publicas -p 'test_importar_escala.py'
npx vitest run src/tests/contas-publicas*.test.ts
```

O importador não depende da rede nem de bibliotecas adicionais. Rejeita alteração dos arquivos em relação ao manifesto, unidade ou território incompatíveis, valores inválidos e trimestre ausente antes de publicar atomicamente o snapshot. Uma revisão exige nova captura e manifesto, preservando esta edição.

## Verificação

- 47 testes do domínio aprovados, incluindo seis testes de escala, hashes, unidades, sinal, ausência, parcial, conciliação dos grupos e denominadores anuais próprios.
- Quatro testes Python aprovados: reprodução e rejeição de hash, trimestre, unidade/território incorretos.
- TypeScript e lint do domínio aprovados.
- Build de produção aprovado.
- Panorama: três escalas, duas ordenações e os três períodos conferidos no navegador. Em 2026, os meses de janeiro a julho são comparados com janeiro a julho de 2025 e as escalas sem denominador ficam indisponíveis. Em 2024, o resumo usa o denominador de 2024; a comparação com 2023 permanece nominal.
- Sem transbordamento horizontal em 320, 390, 768 e 1440 px. Controles novos com altura de 44 px.
- Leitor de tela e zoom de 200% não verificados. A revisão visual é uma autoavaliação, não independente.
