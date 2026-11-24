"""Testes do pipeline do Varejo (pipeline/varejo/setor.py e empresas.py). Sem rede: funções puras e as duas golds publicadas.

Os casos sintéticos provam que cada validação retém a gravação: mês faltando, série que recua, UF ou atividade a
menos, companhia que some sem constar das saídas esperadas, exercício perdido e trimestre que volta no tempo. A
rotina agendada (.github/workflows/atualizar-varejo.yml, config/atualizacao/varejo.json) roda este arquivo antes de
publicar; a curadoria (pipeline/varejo/curadoria) é escrita à mão e fica fora dela.
"""
import contextlib
import copy
import datetime as dt
import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline.varejo import empresas, setor

RAIZ = Path(__file__).resolve().parents[2]


def gold_setor():
    return json.loads(setor.SAIDA.read_text(encoding="utf-8"))


def gold_empresas():
    return json.loads(empresas.SAIDA.read_text(encoding="utf-8"))


def hash_do_corpo(corpo: dict) -> str:
    return hashlib.sha256(json.dumps(corpo, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


class TestFuncoesPurasDoSetor(unittest.TestCase):
    def test_num_ausencia_nao_vira_zero(self):
        self.assertEqual(setor.num("4.58"), 4.58)
        self.assertEqual(setor.num("-0.12"), -0.12)
        self.assertEqual(setor.num(3), 3.0)
        self.assertEqual(setor.num("0"), 0.0)
        for sem_dado in ("...", "-", "X", "", None):
            self.assertIsNone(setor.num(sem_dado), repr(sem_dado))

    def test_mes(self):
        self.assertEqual(setor.mes("202609"), "2026-09")
        self.assertEqual(setor.mes("201801"), "2018-01")

    def test_calendario_vira_o_ano(self):
        self.assertEqual(setor.calendario("202511", 4), ["2025-11", "2025-12", "2026-01", "2026-02"])
        self.assertEqual(setor.calendario(setor.INICIO, 1), ["2018-01"])

    def test_cadastro_de_ufs_e_atividades(self):
        self.assertEqual(len(setor.UFS), 27)
        self.assertEqual(len(set(setor.UFS.values())), 27)
        self.assertEqual(len(setor.ATIVIDADES), 14)
        slugs = {a[0] for a in setor.ATIVIDADES.values()}
        self.assertEqual(len(slugs), 14)
        for slug, _nome, universo, pai in setor.ATIVIDADES.values():
            self.assertIn(universo, ("restrito", "ampliado", "detalhe"), slug)
            self.assertEqual(pai is not None, universo == "detalhe", slug)
            if pai:
                self.assertIn(pai, slugs, slug)


class TestGoldSetorPublicada(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = gold_setor()

    def test_passa_na_validacao_sozinha_e_contra_si_mesma(self):
        self.assertEqual(setor.validar(self.g), [])
        self.assertEqual(setor.validar(self.g, self.g), [])

    def test_chaves_e_proveniencia(self):
        g = self.g
        for chave in ("versao", "gerado_por", "capturado_em", "referencia", "notas", "fontes", "pmc", "pac", "macro", "hash_dados"):
            self.assertIn(chave, g)
        self.assertEqual(g["gerado_por"], "pipeline/varejo/setor.py")
        self.assertRegex(g["capturado_em"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        for nome, f in g["fontes"].items():
            for chave in ("orgao", "nome", "tabela", "url", "capturado_em"):
                self.assertTrue(f.get(chave), f"{nome}.{chave}")
            self.assertTrue(f["url"].startswith("https://"), nome)

    def test_meses_contiguos_e_referencia(self):
        meses = self.g["pmc"]["meses"]
        self.assertEqual(meses, setor.calendario(setor.INICIO, len(meses)))
        self.assertEqual(self.g["referencia"]["pmc"], meses[-1])
        self.assertGreaterEqual(len(meses), 105)  # jan/2018 a set/2026, a publicação de 24/11/2026

    def test_27_ufs_em_cada_recorte(self):
        siglas = set(setor.UFS.values())
        self.assertEqual(set(self.g["pmc"]["ufs"]), siglas)
        self.assertEqual(set(self.g["pmc"]["ufs_atividades"]["dados"]), siglas)
        self.assertEqual(set(self.g["pac"]["ufs_varejo"]), siglas)

    def test_14_atividades_com_a_serie_do_calendario(self):
        n = len(self.g["pmc"]["meses"])
        atividades = self.g["pmc"]["atividades"]
        self.assertEqual(set(atividades), {a[0] for a in setor.ATIVIDADES.values()})
        for slug, a in atividades.items():
            for tipo in ("volume", "receita"):
                self.assertEqual(set(a[tipo]), set(setor.VARS_PMC.values()), slug)
                for var, serie in a[tipo].items():
                    self.assertEqual(len(serie), n, f"{slug} {tipo}/{var}")

    def test_hash_dados_confere_com_o_corpo(self):
        g = self.g
        self.assertEqual(g["hash_dados"], hash_do_corpo({"pmc": g["pmc"], "pac": g["pac"], "macro": g["macro"]}))


class TestValidacaoDoSetorRetem(unittest.TestCase):
    def setUp(self):
        self.publicada = gold_setor()
        self.nova = copy.deepcopy(self.publicada)

    def reprova(self, trecho, anterior=True):
        problemas = setor.validar(self.nova, self.publicada if anterior else None)
        self.assertTrue(any(trecho in p for p in problemas), f"esperava '{trecho}' em {problemas}")

    def cortar_ultimo_mes(self):
        pmc = self.nova["pmc"]
        pmc["meses"].pop()
        for bloco in [*pmc["brasil"].values(), *(u for uf in pmc["ufs"].values() for u in uf.values()), *pmc["atividades"].values()]:
            for tipo in ("volume", "receita"):
                for serie in bloco[tipo].values():
                    serie.pop()
        self.nova["referencia"]["pmc"] = pmc["meses"][-1]
        pmc["ufs_atividades"]["mes"] = pmc["meses"][-1]

    def test_serie_mais_curta_que_a_publicada(self):
        self.cortar_ultimo_mes()
        self.assertEqual(setor.validar(self.nova), [])  # íntegra por si; o problema é o recuo
        self.reprova("menos que os")
        self.reprova("anterior ao publicado")

    def test_mes_faltando_no_meio(self):
        del self.nova["pmc"]["meses"][40]
        self.reprova("calendário contíguo", anterior=False)

    def test_uf_a_menos(self):
        del self.nova["pmc"]["ufs"]["AC"]
        self.reprova("26 de 27", anterior=False)

    def test_atividade_a_menos(self):
        del self.nova["pmc"]["atividades"]["farmacia"]
        self.reprova("13 de 14 atividades", anterior=False)

    def test_indice_do_brasil_ausente(self):
        self.nova["pmc"]["brasil"]["restrito"]["volume"]["indice"][-1] = None
        self.reprova("Brasil restrito, volume: índice ausente", anterior=False)

    def test_serie_com_comprimento_errado(self):
        self.nova["pmc"]["atividades"]["vestuario"]["receita"]["aa"].pop()
        self.reprova("atividade vestuario, receita/aa", anterior=False)

    def test_pac_sem_uf_e_sem_grupos(self):
        del self.nova["pac"]["ufs_varejo"]["SP"]
        self.nova["pac"]["grupos"] = {}
        self.reprova("PAC por UF: 26 de 27", anterior=False)
        self.reprova("PAC: nenhum grupo", anterior=False)

    def test_contexto_que_recua(self):
        valores = self.nova["macro"]["juros_credito_livre_pf"]["valores"]
        del valores[max(valores)]
        self.reprova("contexto, juros_credito_livre_pf")
        self.nova["macro"]["massa_renda_real"]["valores"] = {}
        self.reprova("contexto, massa_renda_real: série vazia", anterior=False)

    def test_validacao_reprovada_sai_com_codigo_1_e_nao_toca_o_arquivo(self):
        # a coleta devolve a série sem o último mês publicado: o script falha e a gold publicada fica como estava
        self.cortar_ultimo_mes()
        fim = self.nova["pmc"]["meses"][-1].replace("-", "")
        with tempfile.TemporaryDirectory() as d:
            saida = Path(d) / "setor.json"
            original = json.dumps(self.publicada)
            saida.write_text(original, encoding="utf-8")
            erro = io.StringIO()
            with mock.patch.object(setor, "SAIDA", saida), \
                    mock.patch.object(setor, "baixar", return_value={"periodicidade": {"fim": int(fim)}}), \
                    mock.patch.object(setor, "coletar_pmc", return_value=self.nova["pmc"]), \
                    mock.patch.object(setor, "coletar_pac", return_value=self.nova["pac"]), \
                    mock.patch.object(setor, "coletar_macro", return_value=self.nova["macro"]), \
                    contextlib.redirect_stderr(erro), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(setor.main(), 1)
            self.assertEqual(saida.read_text(encoding="utf-8"), original)
            self.assertEqual([p.name for p in Path(d).iterdir()], ["setor.json"])
            self.assertIn("NÃO gravado", erro.getvalue())
            self.assertIn("menos que os", erro.getvalue())

    def test_coleta_integra_grava_com_o_mesmo_hash(self):
        fim = self.publicada["pmc"]["meses"][-1].replace("-", "")
        with tempfile.TemporaryDirectory() as d:
            saida = Path(d) / "setor.json"
            saida.write_text(json.dumps(self.publicada), encoding="utf-8")
            with mock.patch.object(setor, "SAIDA", saida), \
                    mock.patch.object(setor, "baixar", return_value={"periodicidade": {"fim": int(fim)}}), \
                    mock.patch.object(setor, "coletar_pmc", return_value=self.publicada["pmc"]), \
                    mock.patch.object(setor, "coletar_pac", return_value=self.publicada["pac"]), \
                    mock.patch.object(setor, "coletar_macro", return_value=self.publicada["macro"]), \
                    contextlib.redirect_stdout(io.StringIO()):
                self.assertFalse(setor.main())
            gravada = json.loads(saida.read_text(encoding="utf-8"))
            self.assertEqual(gravada["hash_dados"], self.publicada["hash_dados"])
            self.assertEqual([p.name for p in Path(d).iterdir()], ["setor.json"])


class TestDerivar(unittest.TestCase):
    def base(self, **extra):
        return {"receita_liquida": 1000.0, "custo": -700.0, "lucro_bruto": 300.0, "despesas_operacionais": -200.0, "ebit": 100.0,
                "resultado_financeiro": -40.0, "ir_csll": -20.0, "lucro_liquido": 45.0, **extra}

    def test_ponte_de_100_reconcilia_ate_o_lucro(self):
        p = empresas.derivar(self.base())["ponte_100"]
        self.assertEqual(p, {"custo": -70.0, "despesas_operacionais": -20.0, "resultado_financeiro": -4.0, "ir_csll": -2.0,
                             "descontinuadas_e_outros": 0.5, "lucro_liquido": 4.5})
        partes = sum(v for k, v in p.items() if k != "lucro_liquido")
        self.assertAlmostEqual(100 + partes, p["lucro_liquido"], places=2)

    def test_ponte_ausente_quando_falta_rubrica_ou_receita(self):
        sem = self.base()
        del sem["ir_csll"]
        self.assertIsNone(empresas.derivar(sem)["ponte_100"])
        self.assertIsNone(empresas.derivar(self.base(receita_liquida=None))["ponte_100"])
        self.assertIsNone(empresas.derivar(self.base(receita_liquida=None))["margem_bruta_pct"])

    def test_margens(self):
        p = empresas.derivar(self.base())
        self.assertEqual((p["margem_bruta_pct"], p["margem_operacional_pct"], p["margem_liquida_pct"]), (30.0, 10.0, 4.5))

    def test_convenio_ignora_captacao_e_soma_pagamentos(self):
        linhas = [
            {"conta": "6.03.01", "descricao": "Captação de financiamentos fornecedores convênio", "valor": 146.0},
            {"conta": "6.03.02", "descricao": "Aumento (redução) de fornecedores - convênio", "valor": -30.0},
            {"conta": "6.03.03", "descricao": "Operações de risco sacado", "valor": -12.0},
            {"conta": "6.03.04", "descricao": "Dividendos pagos", "valor": -50.0},
        ]
        p = empresas.derivar(self.base(caixa_operacional=200.0, abre_financiamento=linhas))
        self.assertEqual(p["convenio_fornecedores_no_financiamento"], -42.0)
        self.assertEqual(p["caixa_operacional_apos_convenio"], 158.0)

    def test_so_captacao_nao_gera_ajuste(self):
        # caso da Vivara: a única linha de convênio é captação (entrada de dívida), não pagamento a fornecedor
        linhas = [{"conta": "6.03.08", "descricao": "Captação de financiamentos fornecedores convênio", "valor": 146.0}]
        p = empresas.derivar(self.base(caixa_operacional=200.0, abre_financiamento=linhas))
        self.assertIsNone(p["convenio_fornecedores_no_financiamento"])
        self.assertIsNone(p["caixa_operacional_apos_convenio"])

    def test_divida_liquida_sem_arrendamento(self):
        p = empresas.derivar(self.base(emprestimos_cp=100.0, emprestimos_lp=400.0, caixa=150.0, aplicacoes=50.0,
                                       arrendamento_cp=30.0, arrendamento_lp=70.0))
        self.assertEqual(p["divida_liquida_sem_arrendamento"], 300.0)
        self.assertEqual(p["passivo_arrendamento"], 100.0)
        # só uma das pontas informada: a outra conta como zero; nenhuma: ausência, não zero
        self.assertEqual(empresas.derivar(self.base(emprestimos_lp=400.0))["divida_liquida_sem_arrendamento"], 400.0)
        semdivida = empresas.derivar(self.base(caixa=150.0))
        self.assertIsNone(semdivida["divida_liquida_sem_arrendamento"])
        self.assertIsNone(semdivida["passivo_arrendamento"])


class TestGoldEmpresasPublicada(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = gold_empresas()

    def test_passa_na_validacao_sozinha_e_contra_si_mesma(self):
        self.assertEqual(empresas.validar(self.g), [])
        self.assertEqual(empresas.validar(self.g, self.g), [])

    def test_chaves_e_cadastro(self):
        g = self.g
        for chave in ("versao", "gerado_por", "capturado_em", "unidade", "fontes", "formulas", "empresas", "hash_dados"):
            self.assertIn(chave, g)
        self.assertEqual(g["gerado_por"], "pipeline/varejo/empresas.py")
        self.assertRegex(g["capturado_em"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        self.assertLessEqual(set(g["empresas"]), set(empresas.EMPRESAS))
        # toda companhia do cadastro está na gold, salvo saída esperada e registrada
        self.assertLessEqual(set(empresas.EMPRESAS) - set(g["empresas"]), set(empresas.SAIDAS_ESPERADAS))
        self.assertLessEqual(set(empresas.SAIDAS_ESPERADAS), set(empresas.EMPRESAS))
        for slug, e in g["empresas"].items():
            self.assertEqual(e["cd_cvm"], empresas.EMPRESAS[slug][0], slug)
            self.assertRegex(e["cnpj"], r"^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$", slug)
            for a in e["anuais"]:
                self.assertIn(a["exercicio"], empresas.ANOS_DFP, slug)
                self.assertEqual(a["data_base"], f"{a['exercicio']}-12-31", slug)
                self.assertTrue(a["documento"]["link"].startswith("https://"), slug)

    def test_ponte_publicada_fecha_em_cada_exercicio(self):
        vistas = 0
        for slug, e in self.g["empresas"].items():
            for a in e["anuais"]:
                p = a["ponte_100"]
                if p is None:
                    continue
                vistas += 1
                partes = sum(v for k, v in p.items() if k != "lucro_liquido")
                # cada parcela é arredondada a 2 casas; a soma fecha dentro do arredondamento
                self.assertAlmostEqual(100 + partes, p["lucro_liquido"], delta=0.03, msg=f"{slug} {a['exercicio']}")
        self.assertGreater(vistas, 50)

    def test_hash_dados_confere_com_o_corpo(self):
        self.assertEqual(self.g["hash_dados"], hash_do_corpo({"empresas": self.g["empresas"]}))


class TestValidacaoDasEmpresasRetem(unittest.TestCase):
    def setUp(self):
        self.publicada = gold_empresas()
        self.nova = copy.deepcopy(self.publicada)

    def problemas(self):
        return empresas.validar(self.nova, self.publicada)

    def test_companhia_que_some_reprova_com_mensagem_clara(self):
        del self.nova["empresas"]["magazine-luiza"]
        p = self.problemas()
        self.assertEqual(len(p), 1)
        self.assertIn("magazine-luiza: estava na gold publicada e sumiu", p[0])
        self.assertIn("SAIDAS_ESPERADAS", p[0])

    def test_saida_esperada_pode_sumir(self):
        self.assertIn("carrefour-brasil", empresas.SAIDAS_ESPERADAS)
        self.nova["empresas"].pop("carrefour-brasil", None)
        self.assertEqual(self.problemas(), [])

    def test_exercicio_perdido_e_trimestre_que_recua(self):
        e = self.nova["empresas"]["lojas-renner"]
        perdido = e["anuais"].pop()["exercicio"]
        e["ultimo_trimestre"]["data_base"] = "2025-03-31"
        p = self.problemas()
        self.assertTrue(any(f"lojas-renner: exercício(s) anual(is) {perdido}" in x for x in p), p)
        self.assertTrue(any("lojas-renner: último trimestre 2025-03-31, anterior ao publicado" in x for x in p), p)

    def test_sem_gold_anterior_exige_o_minimo_de_companhias(self):
        self.nova["empresas"] = dict(list(self.nova["empresas"].items())[:3])
        self.assertTrue(any("menos que o mínimo" in x for x in empresas.validar(self.nova)))

    def test_validacao_reprovada_sai_com_codigo_1_e_nao_toca_o_arquivo(self):
        # a CVM devolve arquivos sem nenhuma das companhias: nada é gravado por cima da gold publicada
        with tempfile.TemporaryDirectory() as d:
            saida = Path(d) / "empresas.json"
            original = json.dumps(self.publicada)
            saida.write_text(original, encoding="utf-8")
            erro = io.StringIO()
            with mock.patch.object(empresas, "SAIDA", saida), mock.patch.object(empresas, "ler", return_value={}), \
                    contextlib.redirect_stderr(erro), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(empresas.main(), 1)
            self.assertEqual(saida.read_text(encoding="utf-8"), original)
            self.assertEqual([p.name for p in Path(d).iterdir()], ["empresas.json"])
            self.assertIn("NÃO gravado", erro.getvalue())
            self.assertIn("sumiu", erro.getvalue())

    def test_aviso_de_janela_de_anos_vencida(self):
        self.assertEqual(empresas.janela_vencida(dt.date(2026, 11, 24)), [])
        self.assertEqual(empresas.janela_vencida(dt.date(max(empresas.ANOS_ITR) + 1, 3, 31)), [])
        self.assertFalse(any("ANOS_ITR" in a for a in empresas.janela_vencida(dt.date(max(empresas.ANOS_ITR) + 1, 4, 30))))
        self.assertTrue(any("ANOS_ITR" in a for a in empresas.janela_vencida(dt.date(max(empresas.ANOS_ITR) + 1, 5, 1))))
        self.assertTrue(any("ANOS_DFP" in a for a in empresas.janela_vencida(dt.date(max(empresas.ANOS_DFP) + 2, 4, 1))))


class TestRotinaAgendada(unittest.TestCase):
    """A configuração do motor (config/atualizacao/varejo.json): cada gold é o caminho de um grupo de fontes, o sinal de
    mudança é o hash_dados das duas e a curadoria manual fica fora do perímetro que a rotina publica."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(RAIZ / "scripts"))
        import atualizacao_por_grupo as A
        cls.A = A
        cls.cfg = A.carregar_config(RAIZ / "config/atualizacao/varejo.json")

    def test_cada_gold_e_o_caminho_de_um_grupo_e_o_sinal_e_o_hash(self):
        caminhos = [c for g in self.cfg["grupos"] for c in g["caminhos"]]
        self.assertEqual(sorted(caminhos), ["public/varejo/gold/empresas.json", "public/varejo/gold/setor.json"])
        comandos = [" ".join(c) for g in self.cfg["grupos"] for c in g["coleta"]]
        self.assertEqual(sorted(comandos), ["python3 -m pipeline.varejo.empresas", "python3 -m pipeline.varejo.setor"])
        self.assertEqual(sorted((r["arquivo"], r["json_chave"]) for r in self.cfg["sinal_de_mudanca"]),
                         [("public/varejo/gold/empresas.json", "hash_dados"), ("public/varejo/gold/setor.json", "hash_dados")])
        sinal = self.A.sinal(RAIZ, self.cfg["sinal_de_mudanca"])
        self.assertEqual(sinal["public/varejo/gold/setor.json#hash_dados"], gold_setor()["hash_dados"])
        self.assertEqual(sinal["public/varejo/gold/empresas.json#hash_dados"], gold_empresas()["hash_dados"])

    def test_curadoria_manual_fora_do_perimetro_publicado(self):
        for c in self.A.caminhos_dominio(self.cfg):
            self.assertFalse(c.startswith("pipeline/varejo/curadoria"), c)
            self.assertFalse(c.endswith("curadoria.json"), c)
        self.assertIn("curadoria", self.cfg["descricao"])
        self.assertIn("manual", self.cfg["descricao"])

    def test_roda_este_arquivo_e_os_contratos_da_interface(self):
        comandos = [" ".join(t["comando"]) for t in self.cfg["testes"]]
        self.assertTrue(any("pipeline.tests.test_varejo" in c for c in comandos))
        self.assertTrue(any("src/tests/varejo.test.ts" in c and "src/tests/varejo-grupos.test.ts" in c for c in comandos))


if __name__ == "__main__":
    unittest.main()
