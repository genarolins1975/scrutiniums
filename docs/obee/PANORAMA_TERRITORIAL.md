# Panorama territorial — etapa 1 revisada, 11/10/2026

## Entrega e limites

A entrada do Atlas passa a sintetizar quatro temas para as 26 capitais estaduais, com Recife e Curitiba como par inicial. Os seletores existentes atualizam todos os quatro temas e continuam preservados na URL e no histórico. A comparação regional de segurança alimentar e o aprofundamento de frequência/Saeb permanecem disponíveis. A seleção regional não recebe valores municipais transferidos ou estimados.

A abertura destaca medidas reais, com rótulos e períodos, e desloca o escore indisponível para uma posição secundária. O panorama apresenta dois territórios e mediana simples das capitais elegíveis, pontos conectados, tabela equivalente, notas materiais, fontes e CSV de 104 observações. Posições só podem ser comparadas dentro de uma mesma medida. O círculo de 16 temas continua sendo navegação temática, sem perfil quantitativo ou ranking.

| Tema | Medida | Referência | Natureza e ressalva |
|---|---|---|---|
| Educação | Frequência escolar aos 4–5 anos | Censo 2022, SIDRA 10056 | Condição dos moradores; inclui público e privado |
| Saúde | Cobertura potencial estimada da APS | Dezembro de 2025, Relatório APS | Capacidade teórica; não atendimento, pode exceder 100% |
| Trabalho e renda | Mediana da renda domiciliar mensal per capita | Julho de 2022, SIDRA 10295 | R$ nominais; amostra preliminar; não salário ou efeito de política |
| Mobilidade | Parcela com mais de uma hora até o trabalho | Censo 2022, SIDRA 10330 | Universo específico de trabalhadores; resíduo não redistribuído |

As quatro medidas não são contemporâneas, não esgotam seus capítulos e não compõem um escore. Não permitem concluir satisfação, qualidade global ou eficiência causal. Medianas são estatísticas descritivas das 26 capitais estaduais elegíveis, sem ponderação; não são meta nem agregado nacional. O Distrito Federal fica fora desse conjunto. As escalas fixas da edição são 0–100%, 0–125%, R$ 0–2.500 e 0–100%, respectivamente; não se recorta cobertura APS em 100%.

## Proveniência e reprodução

Base de implementação: PR #149, commit `317c6decb95f33cfb2ed9f31a81d1da2eaa7e0f0`. Integração de snapshots existentes e seus contratos, sem nova captura oficial nesta entrega.

`python scripts/eficiencia/gerar-panorama-atlas.py`

O gerador lê os snapshots de Frequência e Saúde, a fonte canônica compactada de Trabalho e a gold de Mobilidade. Verifica integridade de Mobilidade e da resposta bruta de renda, recorte fixo da frequência, unicidade, domínio numérico e elegibilidade. Registra hash de cada entrada e consultas originais. Ausência e inelegibilidade não viram zero. A referência exclui observações inelegíveis.

Saídas: `src/lib/eficiencia/panorama-atlas.json` e `public/eficiencia/atlas/panorama-capitais.csv`. Mudanças nas fontes exigem regeneração e revisão do resumo; não há atualização automática nesta entrega.

## Aprofundamento

- Educação: abre a comparação de frequência com idade 4–5; par territorial preservado.
- Saúde: preserva ambas as capitais usando os identificadores próprios do painel, indicador e dezembro de 2025.
- Trabalho e renda: preserva capital, mediana, 2022, sexo/grupo totais. Esse explorador não recebe segundo território.
- Mobilidade: preserva a capital na distribuição de tempo do Censo 2022.

## Aceite

Testes focados confrontam as 104 células com as bases dos capítulos, hashes, denominadores de mobilidade, mediana e escala; percorrem as 26 capitais, verificam zero/ausência/inelegibilidade, exportação integral, renderização e URLs de aprofundamento. Evidências finais de tipos, lint, build e CI ficam no PR.

Inspeção visual/interações, quatro larguras e zoom 200% pendentes na nova composição. O acesso à prévia Vercel segue exigindo autenticação, recusada na tentativa anterior. Não se atribui nota estética nem conformidade integral de acessibilidade. Nenhuma publicação ou escore real integra esta etapa.
