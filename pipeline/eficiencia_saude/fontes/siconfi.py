"""Siconfi (Tesouro Nacional): contas anuais e relatórios fiscais das capitais, função 10 (Saúde).

API de dados abertos: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/
Documentação: https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos

Papel de cada relatório:

* DCA, Anexo I-E (Despesa por Função): fonte da despesa liquidada na função 10 e da composição por subfunção.
* RREO do 6º bimestre, Anexo 02 (Despesa por Função/Subfunção): conferência cruzada do valor da DCA. Nunca é somado à DCA.
* RREO do 6º bimestre, Anexo 12 (Receitas de impostos e despesas próprias com Ações e Serviços Públicos de Saúde): referência
  normativa (percentual aplicado, mínimo da LC 141/2012) e separação entre recursos próprios e transferências.
* MSC (Matriz de Saldos Contábeis agregada de dezembro): terceira fonte de conferência e abertura por natureza da despesa.

A resposta da API é gravada no seed (JSON gzip determinístico) com o sha256 da resposta completa, para que qualquer
número possa ser refeito sem nova consulta. Só as linhas da função 10 e os totais são retidas (o anexo completo repete
todas as funções), e o sha256 da resposta integral permanece no manifesto.
"""
import json
import os
import time

from pipeline.eficiencia import entes
from pipeline.eficiencia.fontes import siconfi as S
from pipeline.eficiencia_saude import base

API = S.API
DOC = S.DOC

SUBFUNCOES_ROTULO = {
    "301": "Atenção básica",
    "302": "Assistência hospitalar e ambulatorial",
    "303": "Suporte profilático e terapêutico",
    "304": "Vigilância sanitária",
    "305": "Vigilância epidemiológica",
    "306": "Alimentação e nutrição",
    "122": "Administração geral",
    "FU10": "Demais subfunções (agregação da DCA)",
}

# nomes das linhas da função 10 no RREO Anexo 02 (sem código na linha)
RREO02_SAUDE = {
    "Saúde", "Atenção Básica", "Assistência Hospitalar e Ambulatorial", "Suporte Profilático e Terapêutico",
    "Vigilância Sanitária", "Vigilância Epidemiológica", "Alimentação e Nutrição", "FU10 - Administração Geral",
    "FU10 - Demais Subfunções",
}
RREO02_TOTAIS = {"DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)", "DESPESAS (INTRA-ORÇAMENTÁRIAS) (II)", "TOTAL (III) = (I + II)"}


def _sha_resposta(itens):
    return base.sha256_bytes(json.dumps(itens, ensure_ascii=False, sort_keys=True).encode("utf-8"))


def _relevante_dca(x):
    c = str(x.get("conta", ""))
    return c.startswith(("10 - ", "10.", "FU10 ")) or c in ("Despesas Exceto Intraorçamentárias", "Despesas Intraorçamentárias")


def coleta_dca(ano, cod_ibge):
    capturado_em = base.agora_utc()
    urls, itens = S._todas_paginas("dca", {"an_exercicio": ano, "no_anexo": "DCA-Anexo I-E", "id_ente": cod_ibge})
    filtrados = [x for x in itens if _relevante_dca(x)]
    destino = os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{cod_ibge}_{ano}.json.gz")
    sha = base.grava_json_gz(destino, filtrados)
    return {"url": urls[0], "capturado_em": capturado_em, "linhas_resposta": len(itens), "linhas": len(filtrados),
            "sha256_resposta_completa": _sha_resposta(itens), "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha}


def coleta_rreo02(ano, cod_ibge):
    capturado_em = base.agora_utc()
    urls, itens = S._todas_paginas("rreo", {
        "an_exercicio": ano, "nr_periodo": 6, "co_tipo_demonstrativo": "RREO",
        "no_anexo": "RREO-Anexo 02", "co_esfera": "M", "id_ente": cod_ibge,
    })
    filtrados = [x for x in itens if x.get("conta") in RREO02_SAUDE or x.get("conta") in RREO02_TOTAIS]
    destino = os.path.join(base.SEED, "siconfi", "rreo_anexo_02_b6", f"{cod_ibge}_{ano}.json.gz")
    sha = base.grava_json_gz(destino, filtrados)
    return {"url": urls[0], "capturado_em": capturado_em, "linhas_resposta": len(itens), "linhas": len(filtrados),
            "sha256_resposta_completa": _sha_resposta(itens), "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha}


def coleta(anos, pausa=0.4):
    """DCA I-E e RREO-02 (6º bimestre) das 26 capitais em cada ano."""
    dca, rreo = {}, {}
    for ano in anos:
        for cod, nome, uf in entes.CAPITAIS:
            chave = f"{cod}_{ano}"
            for destino, fn in ((dca, coleta_dca), (rreo, coleta_rreo02)):
                try:
                    destino[chave] = fn(ano, cod)
                except RuntimeError as e:
                    destino[chave] = {"erro": str(e), "capturado_em": base.agora_utc()}
                time.sleep(pausa)
    base.registra_captura("siconfi_dca_anexo_i_e", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Declaração de Contas Anuais (DCA), Anexo I-E: Despesa por Função (função 10, Saúde)",
        "pagina": DOC, "url": f"{API}/dca?an_exercicio=<ano>&no_anexo=DCA-Anexo%20I-E&id_ente=<código IBGE>",
        "parametros": f"exercícios {min(anos)} a {max(anos)}; 26 capitais; gravadas só as linhas da função 10 e os totais",
        "arquivos": dca,
    })
    base.registra_captura("siconfi_rreo_anexo_02_b6", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Relatório Resumido da Execução Orçamentária (RREO), 6º bimestre, Anexo 02: Despesa por Função/Subfunção (Saúde)",
        "pagina": DOC,
        "url": f"{API}/rreo?an_exercicio=<ano>&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&co_esfera=M&id_ente=<código IBGE>",
        "parametros": f"exercícios {min(anos)} a {max(anos)}; 26 capitais; gravadas só as linhas da função Saúde e os totais",
        "arquivos": rreo,
    })
    return dca, rreo


# ---------------------------------------------------------------- MSC (terceira fonte e abertura por natureza)

MSC_CONTAS_LIQUIDADO = ("6221303", "6221304", "6221307")
"""Contas de controle da execução da despesa (classe 6) que compõem o liquidado no exercício: 6.2.2.1.3.03 crédito
empenhado liquidado a pagar, .04 liquidado pago e .07 liquidado a pagar inscrito em restos a pagar processados (PCASP,
Manual de Contabilidade Aplicada ao Setor Público). As contas .05 e .06 (restos a pagar não processados) ficam fora."""


def coleta_msc_saude(cod_ibge, ano, mes=12):
    """MSC agregada de dezembro, classe 6, saldo final: grava as linhas da função 10 nas contas de despesa liquidada e de
    restos a pagar, com o sha256 da resposta completa. A natureza da despesa (grupo, modalidade, elemento) e a fonte de
    recursos vêm da própria linha."""
    capturado_em = base.agora_utc()
    urls, itens = S._todas_paginas("msc_orcamentaria", {
        "id_ente": cod_ibge, "an_referencia": ano, "me_referencia": mes, "co_tipo_matriz": "MSCC",
        "classe_conta": 6, "id_tv": "ending_balance",
    })
    filtrados = [x for x in itens if str(x.get("funcao")) == "10" and str(x.get("conta_contabil", ""))[:7] in MSC_CONTAS_LIQUIDADO + ("6221305", "6221306")]
    destino = os.path.join(base.SEED, "siconfi", "msc_funcao10", f"{cod_ibge}_{ano}_{mes:02d}.json.gz")
    sha = base.grava_json_gz(destino, filtrados)
    m = base.le_manifesto()["capturas"].get("siconfi_msc_funcao10", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Matriz de Saldos Contábeis (MSC) agregada, classe 6, saldo final de dezembro (função 10)",
        "pagina": DOC,
        "url": f"{API}/msc_orcamentaria?id_ente=<código IBGE>&an_referencia=<ano>&me_referencia=12&co_tipo_matriz=MSCC&classe_conta=6&id_tv=ending_balance",
        "parametros": "26 capitais, exercícios 2021 a 2025; gravadas as linhas da função 10 nas contas 6.2.2.1.3.03 a .07",
        "arquivos": {},
    })
    m["arquivos"][f"{cod_ibge}_{ano}"] = {
        "url": urls[0], "capturado_em": capturado_em, "linhas_resposta": len(itens), "linhas": len(filtrados),
        "sha256_resposta_completa": _sha_resposta(itens), "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha,
    }
    base.registra_captura("siconfi_msc_funcao10", m)
    return len(itens), len(filtrados)


def coleta_msc_todas(anos, pausa=0.3):
    for ano in anos:
        for cod, nome, uf in entes.CAPITAIS:
            destino = os.path.join(base.SEED, "siconfi", "msc_funcao10", f"{cod}_{ano}_12.json.gz")
            if os.path.exists(destino):
                continue  # retomada: o par já foi coletado
            try:
                n, f = coleta_msc_saude(cod, ano)
                print(f"MSC {nome} {ano}: {n} linhas na resposta, {f} da função 10", flush=True)
            except RuntimeError as e:
                print(f"MSC {nome} {ano}: ERRO {e}", flush=True)
            time.sleep(pausa)
