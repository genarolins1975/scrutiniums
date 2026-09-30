"""Evidência "Comprove este número" (pipeline/energia/evidencia.py).

Sem rede e sem git: a versão é passada explicitamente. O que este teste protege:

* o objeto publicado tem todas as chaves do contrato, na ordem do tipo TypeScript
  (src/lib/energia/evidencia.ts), e é JSON estrito;
* a citação é o MESMO texto que a interface calcula (src/tests/energia-comp-
  evidencia.test.ts usa o mesmo exemplo e o mesmo texto esperado), com dia e ano
  no horário de Brasília a partir de carimbos UTC que viram o dia e o ano;
* a validação recusa, de uma vez e listando tudo, a evidência que não comprova:
  ausência exibida como número, número sem arquivo, sha256 ou captura com fuso,
  razão sem um dos termos, veredito fora de aprovado/ressalva/reprovado,
  tolerância sem unidade, PDF sem a conferência da extração, milhares de chaves
  sem manifesto, NaN;
* número ausente não exige arquivo, teste nem download (não há o que provar), mas
  continua exigindo o recorte, a fórmula e o tratamento de ausência.
"""
import copy
import json
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import evidencia as ev  # noqa: E402

SHA = "ab" * 32
VERSAO = {"pipeline": "energia-0.1.0", "codigo": "abc123def456", "publicacao": "2027-01-01T01:00:00Z"}
FONTE = {
    "orgao": "ANEEL", "conjunto": "Tarifas de aplicação", "recurso": "tarifas-vigentes.csv",
    "url": "https://dadosabertos.aneel.gov.br/dataset/tarifas", "arquivo": "bronze/aneel/tarifas/2026-09-30.csv.gz",
    "sha256": SHA, "capturado_em": "2026-10-01T01:30:00Z", "publicado_em": None,
}

# mesmo exemplo e mesmo texto de src/tests/energia-comp-evidencia.test.ts
CITACAO_TARIFA = (
    "SCRUTINIUMS. Tarifa residencial mediana: R$ 0,8123/kWh, distribuidoras com tarifa B1 vigente, 30/09/2026. "
    "Observatório Brasileiro do Setor Elétrico, 2026. "
    "Dados primários: ANEEL, Tarifas de aplicação (recurso tarifas-vigentes.csv, capturado em 30/09/2026). "
    "Versão energia-0.1.0, código abc123def456, publicada em 31/12/2026. "
    "Disponível em: https://scrutiniums.com/setor-eletrico."
)
CITACAO_CARGA = (
    "SCRUTINIUMS. Carga média: 123,46 MWmed, SIN, 30/09/2026 10:00 a 30/09/2026 18:00. "
    "Observatório Brasileiro do Setor Elétrico, 2026. "
    "Dados primários: ONS, Carga horária (recurso não identificado, capturado em 30/09/2026). "
    "Versão energia-0.1.0, código não registrado, publicada em 31/12/2026. "
    "Disponível em: https://scrutiniums.com/setor-eletrico/carga#media."
)


def kwargs(**troca):
    base = dict(
        indicador="Tarifa residencial mediana", valor_exibido="R$ 0,8123/kWh", valor_calculo=812.3456,
        unidade="R$/MWh", periodo={"inicio": "2026-09-30", "fim": "2026-09-30"},
        entidade="distribuidoras com tarifa B1 vigente", universo="105 distribuidoras",
        filtros=["subgrupo B1", "modalidade convencional"], fonte=copy.deepcopy(FONTE),
        chaves_origem=["tarifa|00394460000141|B1", "tarifa|04895728000180|B1"],
        formula="mediana(TE + TUSD) entre distribuidoras", exclusoes=["distribuidoras sem tarifa homologada vigente"],
        cobertura="105 de 108 distribuidoras", tratamento_ausencia="distribuidora sem tarifa vigente fica fora do universo",
        revisoes=0,
        testes=[ev.teste("TE e TUSD somam o total", "aprovado", "105 de 105"),
                ev.teste("Vigência sem sobreposição", "ressalva", "2 distribuidoras com vigência retroativa")],
        reconciliacao=ev.reconciliacao("Mediana recalculada pelo painel da ANEEL", "aprovado", "0,005 R$/MWh"),
        download=[{"rotulo": "Tarifas vigentes (CSV)", "url": "/energia/series/conta_tarifas.csv"}],
        reproducao="python3 pipeline/energia/executar_modulo.py conta --sem-coleta",
        versao=dict(VERSAO),
    )
    base.update(troca)
    return base


def problemas(**troca):
    """Problemas levantados pelo construtor; falha se a evidência inválida passar."""
    try:
        ev.construir(**kwargs(**troca))
    except ev.EvidenciaInvalida as e:
        return e.problemas
    raise AssertionError("evidência inválida foi aceita")


class TestContrato(unittest.TestCase):
    def test_objeto_completo_na_ordem_do_contrato_e_json_estrito(self):
        e = ev.construir(**kwargs())
        self.assertEqual(tuple(e.keys()), ev.CAMPOS)
        self.assertEqual(e["valor_calculo"], 812.3456)
        self.assertEqual(e["revisoes"], "Nenhuma revisão detectada entre as capturas integradas.")
        self.assertIsNone(e["numerador"])
        self.assertIsNone(e["chaves_total"])
        # a publicação pela fonte nunca é inventada
        self.assertIsNone(e["fonte"]["publicado_em"])
        json.dumps(e, allow_nan=False, ensure_ascii=False)
        self.assertEqual(ev.validar(e), [])

    def test_nao_altera_as_listas_e_dicionarios_do_chamador(self):
        k = kwargs()
        e = ev.construir(**k)
        e["filtros"].append("x")
        e["fonte"]["sha256"] = "0" * 64
        self.assertEqual(k["filtros"], ["subgrupo B1", "modalidade convencional"])
        self.assertEqual(k["fonte"]["sha256"], SHA)


class TestCitacao(unittest.TestCase):
    def test_mesmo_texto_da_interface(self):
        self.assertEqual(ev.construir(**kwargs())["citacao"], CITACAO_TARIFA)
        carga = ev.citacao(
            indicador="Carga média", valor_exibido="123,46", unidade="MWmed", entidade="SIN",
            periodo={"inicio": "2026-09-30T10:00", "fim": "2026-09-30T18:00"},
            fonte=dict(FONTE, orgao="ONS", conjunto="Carga horária", recurso=None),
            versao=dict(VERSAO, codigo=None), endereco="https://scrutiniums.com/setor-eletrico/carga#media")
        self.assertEqual(carga, CITACAO_CARGA)

    def test_sem_data_de_acesso_e_texto_proprio_preservado(self):
        e = ev.construir(**kwargs())
        self.assertNotIn("Acesso em", e["citacao"])
        proprio = ev.construir(**kwargs(citacao_texto="SCRUTINIUMS. Texto revisado pela curadoria."))
        self.assertEqual(proprio["citacao"], "SCRUTINIUMS. Texto revisado pela curadoria.")

    def test_publicacao_sem_data_vira_sd(self):
        c = ev.citacao(indicador="X", valor_exibido="1", unidade="MW", entidade="SIN",
                       periodo={"inicio": "2026", "fim": "2026"}, fonte=FONTE,
                       versao={"pipeline": "p", "codigo": "c", "publicacao": None})
        self.assertIn("Setor Elétrico, s.d.", c)
        self.assertIn("publicada em data não registrada", c)

    def test_periodo(self):
        self.assertEqual(ev.texto_periodo({"inicio": "2026-01", "fim": "2026-09"}), "01/2026 a 09/2026")
        self.assertEqual(ev.texto_periodo({"inicio": "2026-09-30T10:00", "fim": "2026-09-30T10:00"}), "30/09/2026 10:00")
        self.assertEqual(ev.texto_periodo({"inicio": None, "fim": "2026-09"}), "até 09/2026")
        self.assertEqual(ev.texto_periodo({}), "período não informado")


class TestValidacao(unittest.TestCase):
    def test_ausencia_nunca_vira_numero(self):
        p = problemas(valor_calculo=None, valor_exibido="0,0")
        self.assertTrue(any("ausência nunca vira número" in x for x in p), p)

    def test_numero_ausente_sem_arquivo_teste_ou_download_e_aceito(self):
        fonte = ev.fonte_de_vintage("ANEEL", "Tarifas de aplicação", "https://exemplo.gov.br", None)
        e = ev.construir(**kwargs(valor_calculo=None, valor_exibido=None, fonte=fonte, testes=[], download=[],
                                  chaves_origem=[], reconciliacao=None))
        self.assertEqual(e["valor_exibido"], "sem dado")
        self.assertIsNone(e["fonte"]["sha256"])
        self.assertIn("sem dado", e["citacao"])

    def test_numero_exibido_exige_prova_do_arquivo(self):
        fonte = ev.fonte_de_vintage("ANEEL", "Tarifas de aplicação", "https://exemplo.gov.br", None)
        p = problemas(fonte=fonte)
        self.assertTrue(any("fonte.sha256" in x for x in p), p)
        self.assertTrue(any("fonte.capturado_em" in x for x in p), p)
        self.assertTrue(any("fonte.arquivo nem fonte.recurso" in x for x in p), p)

    def test_hash_e_captura_malformados(self):
        p = problemas(fonte=dict(FONTE, sha256=SHA.upper(), capturado_em="2026-09-30"))
        self.assertTrue(any("sha256 hexadecimal minúsculo" in x for x in p), p)
        self.assertTrue(any("hora e fuso" in x for x in p), p)

    def test_todos_os_problemas_de_uma_vez(self):
        p = problemas(testes=[], download=[], chaves_origem=[], numerador={"descricao": "a", "valor": 1})
        for trecho in ("sem nenhum teste", "sem download", "sem chaves_origem nem consulta", "numerador e denominador"):
            self.assertTrue(any(trecho in x for x in p), (trecho, p))

    def test_consulta_substitui_as_chaves(self):
        e = ev.construir(**kwargs(chaves_origem=[], consulta="SELECT * FROM observacoes WHERE serie='x'"))
        self.assertEqual(e["chaves_origem"], [])

    def test_veredito_fora_do_dominio_e_tolerancia_sem_unidade(self):
        p = problemas(testes=[ev.teste("t", "falhou", "")],
                      reconciliacao={"descricao": "outro caminho", "resultado": "divergente", "tolerancia": 0.005})
        self.assertTrue(any("testes[0].resultado 'falhou'" in x for x in p), p)
        self.assertTrue(any("reconciliacao.resultado 'divergente'" in x for x in p), p)
        self.assertTrue(any("tolerancia é texto com unidade" in x for x in p), p)

    def test_razao_completa_e_valor_nao_finito(self):
        e = ev.construir(**kwargs(numerador={"descricao": "perdas", "valor": 12.5},
                                  denominador={"descricao": "energia injetada", "valor": None}))
        self.assertIsNone(e["denominador"]["valor"])
        p = problemas(valor_calculo=math.nan)
        self.assertTrue(any("NaN" in x for x in p), p)
        p = problemas(numerador={"descricao": "", "valor": "12"}, denominador={"descricao": "d", "valor": 1})
        self.assertTrue(any("numerador precisa de descricao" in x for x in p), p)

    def test_periodo_invertido(self):
        p = problemas(periodo={"inicio": "2026-09-30", "fim": "2026-01-01"})
        self.assertTrue(any("inicio depois do fim" in x for x in p), p)

    def test_pdf_exige_conferencia_da_extracao(self):
        fonte = dict(FONTE, recurso="relatorio-perdas-2025.pdf", arquivo="bronze/aneel/perdas/rel.pdf.gz")
        p = problemas(fonte=fonte)
        self.assertTrue(any("extracao_pdf" in x for x in p), p)
        e = ev.construir(**kwargs(fonte=fonte, extracao_pdf={
            "documento": "Relatório de perdas", "edicao": "2025", "pagina": "p. 14, tabela 3",
            "conferencia": "total da tabela confere com a soma das linhas"}))
        self.assertEqual(e["extracao_pdf"]["pagina"], "p. 14, tabela 3")

    def test_muitas_chaves_exigem_manifesto_e_sao_truncadas(self):
        chaves = [f"obs|{i}" for i in range(1234)]
        p = problemas(chaves_origem=chaves)
        self.assertTrue(any("publique consulta e manifesto" in x for x in p), p)
        e = ev.construir(**kwargs(chaves_origem=chaves, manifesto={"rotulo": "Manifesto (CSV)", "url": "/energia/m.csv"}))
        self.assertEqual(len(e["chaves_origem"]), ev.LIMITE_CHAVES)
        self.assertEqual(e["chaves_total"], 1234)
        self.assertEqual(e["chaves_origem"][0], "obs|0")

    def test_varios_arquivos(self):
        arquivos = [ev.arquivo_de_vintage({"recurso": "CMO_2025.csv", "arquivo": "a.gz", "sha256": "c" * 64,
                                           "capturado_em": "2026-01-02T03:00:00Z", "publicado_em": None}),
                    ev.arquivo_de_vintage({"recurso": "CMO_2026.csv", "arquivo": "b.gz", "sha256": None,
                                           "capturado_em": "2026-09-30T03:00:00Z", "publicado_em": None})]
        p = problemas(fonte=dict(FONTE, arquivos=arquivos))
        self.assertTrue(any("fonte.arquivos[1].sha256" in x for x in p), p)
        arquivos[1]["sha256"] = "d" * 64
        ev.construir(**kwargs(fonte=dict(FONTE, arquivos=arquivos)))

    def test_validar_objeto_sem_campos(self):
        p = ev.validar({"valor_exibido": "1"})
        self.assertTrue(p[0].startswith("campos ausentes: indicador"), p)
        self.assertEqual(ev.validar([]), ["evidência precisa ser um dicionário"])


class TestRevisoes(unittest.TestCase):
    def test_formatos_aceitos(self):
        self.assertEqual(ev.texto_revisoes(None), "Detecção de revisões não disponível para este número.")
        self.assertEqual(ev.texto_revisoes(1), "1 observação revisada pela fonte entre as capturas integradas.")
        self.assertEqual(ev.texto_revisoes(1500), "1.500 observações revisadas pela fonte entre as capturas integradas.")
        bloco = {"total": 2, "detectado_em": "2026-09-30T12:00:00Z",
                 "exemplos": [{"serie": "pld|SE", "ref": "2026-09-01"}, {"serie": "pld|S", "ref": "2026-09-02"}]}
        self.assertEqual(ev.texto_revisoes(bloco), "2 observações revisadas pela fonte entre as capturas integradas. "
                                                   "Mais recentes: pld|SE em 2026-09-01; pld|S em 2026-09-02. Verificação em 2026-09-30.")
        with self.assertRaises(ev.EvidenciaInvalida):
            ev.construir(**kwargs(revisoes=True))


if __name__ == "__main__":
    unittest.main()
