"""Recortes sociais da EBIA (pipeline/eficiencia_alimentar/ebia_social.py), tabelas SIDRA 9553 a 9562.

Sem rede. Cada teste cobre um erro plausível e reprova se a conferência correspondente for retirada: hífen
do SIDRA virando zero, classes da EBIA que não somam 100%, grupos que não somam o total de domicílios,
percentual de composição lido como se fosse do grupo, total diferente da tabela territorial 9552, tabela de
cor ou raça tratada como partição completa e original baixado sem pedido.
"""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline.eficiencia_alimentar import complementos, ebia_social as e

SEXO = e.RECORTES[0]


def _sidra(celulas, recorte=SEXO):
    """Monta a resposta do SIDRA no formato da API de valores: [(ano, grupo, classe_codigo, variavel, valor)]."""
    cab = {"NC": "Nível Territorial (Código)", "D1N": "Brasil", "D2N": "Variável", "D3N": "Ano", "D4N": recorte["dimensao"], "D5N": e.EBIA}
    rows = [cab]
    for ano, grupo, classe, var, v in celulas:
        rows.append({"NC": "1", "D1C": "1", "D1N": "Brasil", "D2C": var, "D3C": str(ano), "D4N": grupo, "D5C": classe, "V": v})
    return json.dumps(rows).encode()


def _linha(rec, recorte_id, ano, grupo, situacao="total"):
    r = next(r for r in rec["recortes"] if r["id"] == recorte_id)
    return next(l for l in r["linhas"] if l["ano"] == ano and l["grupo"] == grupo and l["situacao"] == situacao)


class LeitorTest(unittest.TestCase):
    def test_hifen_vira_ausencia_e_nao_zero(self):
        out = e.ler_tabela(_sidra([(2024, "Mulheres", "109102", "9784", "-"), (2024, "Mulheres", "109102", "162", "1447")]), SEXO)
        cel = out[0]["classes"]["grave"]
        self.assertIsNone(cel["pct"])
        self.assertEqual(cel["mil_domicilios"], 1447.0)
        for marca in ("X", "..", "..."):
            self.assertIsNone(e.numero_sidra(marca))

    def test_cabecalho_grupo_ou_classe_fora_do_revisado_reprova(self):
        with self.assertRaises(ValueError):
            e.ler_tabela(_sidra([(2024, "Mulheres", "109102", "9784", "1")]), e.RECORTES[1])  # cabeçalho de outra tabela
        with self.assertRaises(ValueError):
            e.ler_tabela(_sidra([(2024, "Outro sexo", "109102", "9784", "1")]), SEXO)
        with self.assertRaises(ValueError):
            e.ler_tabela(_sidra([(2024, "Mulheres", "109107", "9784", "1")]), SEXO)  # moderada ou grave só existe na 9558
        with self.assertRaises(ValueError):
            e.ler_tabela(_sidra([(2024, "Mulheres", "109102", "9784", "1"), (2024, "Mulheres", "109102", "9784", "2")]), SEXO)


class PortaoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rec, cls.manifesto = e.le_seed()

    def _reprova(self, rec):
        with self.assertRaises(ValueError):
            e.valida(rec)

    def test_seed_aprovado_com_as_conferencias_contadas(self):
        registro = e.valida(self.rec)
        self.assertEqual(registro["ausencias"], [])
        c = registro["conferencias"]
        self.assertEqual(c["classes_pct"], 18)  # 3 tabelas de distribuição × 3 grupos × 2 anos
        self.assertEqual(c["grupos_pct"], 90)  # 6 tabelas de composição, classes × anos × situações
        self.assertGreater(c["grupos_mil"], 100)

    def test_classes_que_nao_somam_100_reprovam(self):
        rec = copy.deepcopy(self.rec)
        _linha(rec, "menores_5", 2024, "Existe")["classes"]["segura"]["pct"] += 0.3
        self._reprova(rec)
        rec = copy.deepcopy(self.rec)
        _linha(rec, "idosos", 2023, "Não existe")["classes"]["grave"]["pct"] += 0.4  # leve + moderada + grave ≠ insegura
        self._reprova(rec)

    def test_arredondamento_dentro_da_tolerancia_declarada_passa(self):
        rec = copy.deepcopy(self.rec)
        linha = _linha(rec, "menores_18", 2024, "Existe")["classes"]
        linha["segura"]["pct"] = round(100 - linha["insegura"]["pct"] + 0.1, 1)  # 0,1 ponto: duas parcelas × 0,05
        e.valida(rec)

    def test_dominios_das_classes_que_nao_fecham_reprovam(self):
        rec = copy.deepcopy(self.rec)
        for grupo in ("Homens", "Total"):  # grupos continuam somando o total: só a conferência das classes reprova
            _linha(rec, "sexo", 2024, grupo)["classes"]["leve"]["mil_domicilios"] += 5
        self._reprova(rec)

    def test_grupos_que_nao_somam_o_total_reprovam(self):
        rec = copy.deepcopy(self.rec)
        for classe in ("grave", "insegura", "total"):  # as classes do grupo continuam fechando: só a soma dos grupos reprova
            _linha(rec, "instrucao", 2024, "Superior completo")["classes"][classe]["mil_domicilios"] += 10
        self._reprova(rec)
        rec = copy.deepcopy(self.rec)
        _linha(rec, "moradores", 2023, "4 a 6 moradores")["classes"]["grave"]["pct"] += 1.0  # grupos ≠ 100% na classe
        self._reprova(rec)
        rec = copy.deepcopy(self.rec)
        for classe in ("total", "segura"):
            _linha(rec, "renda", 2024, "Até ¼ salário mínimo", "rural")["classes"][classe]["mil_domicilios"] += 50
        self._reprova(rec)

    def test_cor_ou_raca_nao_e_particao_mas_nao_passa_do_total(self):
        cor = next(r for r in self.rec["recortes"] if r["id"] == "cor_raca")
        self.assertFalse(cor["particao"])
        soma = sum(_linha(self.rec, "cor_raca", 2024, g)["classes"]["total"]["mil_domicilios"] for g in cor["grupos"])
        self.assertLess(soma, _linha(self.rec, "cor_raca", 2024, "Total")["classes"]["total"]["mil_domicilios"])
        rec = copy.deepcopy(self.rec)
        for classe in ("total", "segura"):
            _linha(rec, "cor_raca", 2024, "Parda")["classes"][classe]["mil_domicilios"] += 2000
        self._reprova(rec)

    def test_percentual_fora_do_dominio_e_cobertura_incompleta_reprovam(self):
        rec = copy.deepcopy(self.rec)
        _linha(rec, "sexo", 2023, "Mulheres")["classes"]["grave"]["cv_pct"] = -1.0
        self._reprova(rec)
        rec = copy.deepcopy(self.rec)
        rec["recortes"][2]["linhas"].pop()
        self._reprova(rec)

    def test_ausencia_publicada_e_declarada_e_nao_zero(self):
        rec = copy.deepcopy(self.rec)
        _linha(rec, "ocupacao", 2024, "Empregador")["classes"]["grave"]["cv_pct"] = None
        registro = e.valida(rec)
        self.assertEqual(registro["ausencias"], [{"tabela": "9556", "ano": 2024, "grupo": "Empregador", "situacao": "total", "classe": "grave", "variavel": "cv_pct"}])


class GoldTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rec, cls.manifesto = e.le_seed()
        cls.comp, cls.man_comp = complementos.le_seed()
        cls.gold = e.agrega(cls.rec, cls.manifesto, cls.comp["ebia"])

    def test_valores_sentinela_publicados(self):
        mulheres = _linha(self.rec, "sexo", 2024, "Mulheres")["classes"]
        self.assertEqual((mulheres["grave"]["pct"], mulheres["total"]["pct"]), (57.6, 51.8))  # composição: % da classe
        self.assertEqual(_linha(self.rec, "cor_raca", 2024, "Parda")["classes"]["grave"]["pct"], 56.9)
        self.assertEqual(_linha(self.rec, "cor_raca", 2024, "Preta")["classes"]["grave"]["pct"], 16.9)
        self.assertEqual(_linha(self.rec, "menores_5", 2024, "Existe")["classes"]["insegura"]["pct"], 31.1)  # distribuição: % do grupo
        self.assertEqual(_linha(self.rec, "ocupacao", 2024, "Empregador")["classes"]["grave"]["cv_pct"], 28.7)

    def test_parcela_no_grupo_e_calculada_dos_domicilios_e_so_na_composicao(self):
        r = next(r for r in self.gold["recortes"] if r["id"] == "sexo")
        m = next(l for l in r["linhas"] if l["ano"] == 2024 and l["grupo"] == "Mulheres")["classes"]
        self.assertEqual(m["grave"]["pct_no_grupo_calculado"], round(100 * 1447 / 40565, 1))
        self.assertNotEqual(m["grave"]["pct_no_grupo_calculado"], m["grave"]["pct"])
        crianca = next(r for r in self.gold["recortes"] if r["id"] == "menores_5")
        self.assertTrue(all("pct_no_grupo_calculado" not in c for l in crianca["linhas"] for c in l["classes"].values()))

    def test_totais_iguais_a_9552_e_universo_menor_da_renda_declarado(self):
        self.assertEqual(self.gold["conferencias"]["totais_9552"], 104)
        self.assertEqual({d["tabela"] for d in self.gold["diferencas_9552"]}, {"9558"})
        self.assertTrue(all(d["mil_domicilios"] < d["mil_domicilios_9552"] for d in self.gold["diferencas_9552"]))
        rec = copy.deepcopy(self.rec)
        _linha(rec, "sexo", 2024, "Total")["classes"]["grave"]["mil_domicilios"] += 1
        _linha(rec, "sexo", 2024, "Homens")["classes"]["grave"]["mil_domicilios"] += 1  # fecha por dentro, diverge da 9552
        with self.assertRaises(ValueError):
            e.agrega(rec, self.manifesto, self.comp["ebia"])
        rec = copy.deepcopy(self.rec)
        _linha(rec, "renda", 2024, "Total")["classes"]["total"]["mil_domicilios"] = 78300.0  # universo menor nunca é maior
        with self.assertRaises(ValueError):
            e.confere_com_9552(rec, self.comp["ebia"])

    def test_gold_versionada_traz_o_bloco_social_do_mesmo_seed(self):
        gold = json.loads(complementos.GOLD.read_text())
        self.assertEqual(gold["ebia_social"], json.loads(json.dumps(self.gold)))
        self.assertEqual(gold["ebia_social"]["manifesto"]["seed_sha256"], self.manifesto["seed_sha256"])
        self.assertEqual(gold["ebia_social"]["tabela_ausente"]["tabela"], "9561")
        self.assertEqual(gold["ebia_social"]["limiar_cv"], 15.0)

    def test_portao_impede_publicar_com_recorte_social_quebrado(self):
        rec = copy.deepcopy(self.rec)
        _linha(rec, "menores_5", 2024, "Existe")["classes"]["segura"]["pct"] += 1
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "gold.json"
            with self.assertRaises(ValueError):
                complementos.promove(self.comp, self.man_comp, complementos.le_catalogo(), destino, social=(rec, self.manifesto))
            self.assertFalse(destino.exists())

    def test_fontes_com_hash_e_fichas_ligadas(self):
        self.assertEqual([f["id"] for f in self.manifesto["fontes"]], [f"sidra-{t}" for t in ("9553", "9554", "9555", "9556", "9557", "9558", "9559", "9562", "9560")])
        self.assertTrue(all(len(f["sha256"]) == 64 and f["url"].startswith("https://apisidra.ibge.gov.br/values/t/") for f in self.manifesto["fontes"]))
        cat = complementos.le_catalogo()
        fichas = [f for f in cat["indicadores"] if f["grupo"] == "EBIA por grupo social"]
        self.assertEqual(len(fichas), 3)
        self.assertFalse(any("9553" in n["base"] and "9562" in n["base"] for n in cat["nao_integrados"]))
        quebrado = copy.deepcopy(cat)
        next(f for f in quebrado["indicadores"] if f["id"] == "san.ebia.social.composicao")["fontes_adicionais"].append("sidra-9561")
        with self.assertRaises(ValueError):
            complementos.valida_catalogo(quebrado)


class OriginaisSemRedeTest(unittest.TestCase):
    def test_original_ausente_sem_coletar_nao_baixa(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(e, "_baixa") as baixa:
            with self.assertRaises(FileNotFoundError):
                e.confere_originais(d)
            baixa.assert_not_called()

    def test_edicao_diferente_reprova(self):
        with tempfile.TemporaryDirectory() as d:
            for f in e.FONTES:
                (Path(d) / f["arquivo"]).write_bytes(b"[]")
            with self.assertRaises(ValueError):
                e.confere_originais(d)


if __name__ == "__main__":
    unittest.main()
