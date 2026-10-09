"""SIOPE (FNDE): indicadores financeiros e educacionais municipais, EXAMINADOS e não adotados.

O relatório gerencial público do SIOPE (https://www.fnde.gov.br/siope/relatorio-gerencial/dist/) oferece
indicadores oficiais por aluno (grupo 4, "Investimento educacional por aluno") para os municípios. Esta
coleta registra o que a fonte devolve, para que o exame seja reproduzível:

* uma consulta por capital (a consulta de vários municípios devolve a média aritmética simples, não
  os valores individuais);
* indicadores 44, 45, 46, 53, 54, 55, 56, 57, 84 e 85 (por aluno) e indicadores de composição, 2021 a 2025.

Resultado do exame (docs/obee/COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md): a fórmula, o universo de matrículas
e o estágio da despesa dos indicadores não constam de documentação pública encontrada, e os valores não se
reproduzem a partir da DCA, da MSC e do Censo Escolar. Por isso o painel não os adota como despesa por matrícula.
Nada daqui entra em indicador publicado, só na evidência do exame.
"""
import json
import os
import time
import urllib.request

from pipeline.eficiencia import base, entes

URL = "https://www.fnde.gov.br/siope/relatorioGerencialIndicador.do?metodo=relatorio"
PAGINA = "https://www.fnde.gov.br/siope/relatorio-gerencial/dist/"
INDICADORES = {
    57: "Investimento educacional por aluno", 56: "Investimento educacional por aluno da educação básica",
    44: "Investimento educacional por aluno da educação infantil", 84: "Investimento educacional por aluno da educação infantil, creche",
    85: "Investimento educacional por aluno da educação infantil, pré-escola", 45: "Investimento educacional por aluno do ensino fundamental",
    46: "Investimento educacional por aluno do ensino médio", 53: "Investimento educacional por aluno da educação de jovens e adultos",
    54: "Investimento educacional por aluno da educação especial", 55: "Investimento educacional por aluno da educação profissional",
    58: "Despesa com professores por aluno da educação básica", 59: "Despesas com profissionais não docentes por aluno da educação básica",
}
ANOS = [2021, 2022, 2023, 2024, 2025]


def coleta():
    capturado_em = base.agora_utc()
    registros, shas = [], {}
    for cod, nome, _ in entes.CAPITAIS:
        corpo = {"coEsferaAdm": 2, "sgRegiao": [], "codUF": [], "coMesoregiaoIbge": [], "coMicroregiaoIbge": [], "codMuni": [cod // 10],
                 "codFaixaPopulacao": 0, "tpPeriodo": "A", "numAno": ANOS, "numPeri": [], "codGrupIndi": 4, "indicadores": list(INDICADORES)}
        req = urllib.request.Request(URL, data=json.dumps(corpo).encode(), headers={"Content-Type": "application/json"})
        espera, bruto = 2, None
        for _ in range(4):
            try:
                bruto = urllib.request.urlopen(req, timeout=120).read()
                d = json.loads(bruto)
                break
            except Exception:
                time.sleep(espera)
                espera *= 2
        else:
            raise RuntimeError(f"SIOPE indisponível para {nome}")
        shas[str(cod)] = base.sha256_bytes(bruto)
        for x in d.get("content") or []:
            registros.append({"cod": cod, "ano": x["numAno"], "indicador": x["codIndi"], "valor": x["valIndi"]})
    registros.sort(key=lambda r: (r["cod"], r["ano"], r["indicador"]))
    destino = os.path.join(base.SEED, "siope_examinado", "indicadores_municipais.json.gz")
    sha = base.grava_json_gz(destino, registros)
    base.registra_captura("siope_examinado", {
        "instituicao": "Fundo Nacional de Desenvolvimento da Educação (FNDE), SIOPE",
        "conjunto": "Relatório gerencial de indicadores municipais: investimento por aluno (examinado e não adotado)",
        "pagina": PAGINA, "url": URL, "capturado_em": capturado_em,
        "parametros": "uma consulta por capital, indicador anual, 2021 a 2025; codMuni com 6 dígitos do código IBGE; indicadores " + ", ".join(f"{k} ({v})" for k, v in INDICADORES.items()),
        "sha256_respostas_por_capital": shas, "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "linhas_recorte": len(registros),
        "notas_da_fonte": ["Sistema declaratório: a responsabilidade pelas informações é do ente (FNDE, Mais sobre o Siope).",
                           "Fórmula e universo de matrículas dos indicadores não encontrados em documentação pública (nota técnica do SIOPE vazia em 08/10/2026)."],
    })
    return len(registros)
