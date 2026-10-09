"""Pipeline do módulo Saúde nas capitais do OBEE (Observatório Brasileiro de Eficiência Estatal).

Pacote irmão de `pipeline.eficiencia` (Educação): reaproveita infraestrutura comum (hashes, escrita determinística,
universo de entes, populações e IPCA do IBGE) e isola o que é da Saúde: fontes, seed, manifesto, observações, validações,
gold e séries. Nenhum arquivo de Educação é alterado por este pacote.
"""
