"""Testes do módulo Leilões (ACR e transmissão) com recortes reais, sem rede.

Recortes em pipeline/tests/dados/energia_leiloes/:
- leiloes_geracao_recorte.csv: 18 linhas originais de resultado-leiloes-geracao.csv (ANEEL, gerado
  em 01/10/2026, bytes e codificação Windows-1252 preservados, CRLF): Costa Pinto (1º LEN, deságio
  ",72"), Quirinópolis (energia vendida acima da garantia física), Pecém II (garantia física 0 e
  ato de revogação de 2023, hoje em operação no SIGA), as duas linhas de Salto Pilão (mesmo CEG e
  potência, vencedoras diferentes), Santo Antônio, Jirau e Belo Monte (estruturantes; vencedora
  "CHESF – ..." com o byte 0x96), MC2 Macaíba (fora do SIGA e sem ato), Paraúna (preço 0, sem CEG),
  Icaraí I e II (CEG repetido), Santo Antônio do Jari 2012 (investimento 0), três PCH do 39º LEN
  (2025, uma delas Jambo, revogada em 2019 e de novo em construção), Ventos de Santo Antônio 05 e
  São Fernando (revogada em 2016);
- siga_recorte.csv, encerramentos_recorte.csv: as mesmas usinas em expansao_usinas_siga.csv e
  expansao_encerramentos_outorga.csv publicados pelo módulo Expansão (SIGA de 30/09/2026);
- ativos_recorte.csv, cadeia_recorte.json, grupos_recorte.csv: proprietários, cadeia de controle e
  grupos dessas usinas e de Glória (núcleo 1034, sem proprietário majoritário) publicados pelo
  módulo Empresas;
- sidra_ipca_recorte.json: número-índice do IPCA (SIDRA 1737, variável 2266) de 13 meses;
- bcb_sgs433_2006_2026.json: variação mensal do IPCA na série 433 do SGS do Banco Central, de
  jan/2006 a set/2026 (caminho independente para o fator de correção);
- transmissao_2024_recorte.csv: os 18 lotes de 2024 de expansao_leiloes_transmissao.csv.
"""
import csv
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import metricas  # noqa: E402
from pipeline.energia.fontes import aneel_leiloes as al  # noqa: E402
from pipeline.energia.fontes import ibge_pld  # noqa: E402
from pipeline.energia.modulos import leiloes as ml  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_leiloes")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GOLD = os.path.join(RAIZ, "public", "energia", "gold", "leiloes.json")
GOLD_EXP = os.path.join(RAIZ, "public", "energia", "gold", "expansao.json")


def _caminho(nome):
    return os.path.join(DADOS, nome)


def _regs():
    with open(_caminho("leiloes_geracao_recorte.csv"), encoding=al.ENCODING, newline="") as f:
        return al.le_linhas(csv.DictReader(f, delimiter=";"))


def _por_nome(regs, nome):
    return [r for r in regs if r["empreendimento"] == nome]


def _ipca():
    with open(_caminho("sidra_ipca_recorte.json"), encoding="utf-8") as f:
        return {ref: v for _, ref, v in ibge_pld.parse_ipca_sidra(f.read())}


def _cruzados():
    regs = _regs()
    siga = {int(x["nucleo_ceg"]): {"fase": x["fase"], "entrada": x["entrada_operacao"] or None}
            for x in ml._le_csv(_caminho("siga_recorte.csv"))}
    enc = {int(x["nucleo_ceg"]) for x in ml._le_csv(_caminho("encerramentos_recorte.csv"))}
    controle = al.controle_atual(ml._le_csv(_caminho("ativos_recorte.csv")))
    with open(_caminho("cadeia_recorte.json"), encoding="utf-8") as f:
        nos = json.load(f)["nos"]
    nomes = {x["grupo_cnpj"]: x["nome"] for x in ml._le_csv(_caminho("grupos_recorte.csv"))}
    return ml.cruza(regs, siga, enc, {}, controle, nos, nomes, _ipca(), "2026-09")


class Leitura(unittest.TestCase):
    def test_linhas_e_codificacao(self):
        regs = _regs()
        self.assertEqual(len(regs), 18)
        bm = _por_nome(regs, "Belo Monte")[0]
        # o travessão é o byte 0x96 do Windows-1252; em Latin-1 viraria um caractere de controle
        self.assertEqual(bm["vencedora"], "Companhia Hidro Elétrica do São Francisco – CHESF")
        self.assertEqual(bm["categoria"], "uhe")
        self.assertEqual(bm["tipo"], "Estruturante")
        self.assertEqual(bm["nome_leilao"], "3º Estruturante")
        self.assertIsNone(bm["antecedencia"])

    def test_unidades_conferidas_nos_estruturantes(self):
        regs = _regs()
        # energia vendida ao ACR em MWmédio, como nos resultados dos leilões estruturantes
        self.assertEqual(_por_nome(regs, "Belo Monte")[0]["energia_mwmed"], 3199.0)
        self.assertEqual(_por_nome(regs, "Jirau")[0]["energia_mwmed"], 1382.0)
        self.assertEqual(_por_nome(regs, "Santo Antônio")[0]["energia_mwmed"], 1552.0)
        self.assertEqual(_por_nome(regs, "Belo Monte")[0]["gf_mwmed"], 4571.0)

    def test_desagio_em_percentual_sem_zero_a_esquerda(self):
        cp = _por_nome(_regs(), "Costa Pinto (AMPLIAÇÃO)")[0]
        self.assertEqual((cp["preco_teto"], cp["preco"], cp["desagio_pct"]), (140.0, 138.99, 0.72))
        self.assertTrue(al.desagio_confere(cp))
        self.assertEqual(cp["antecedencia"], 5)

    def test_zeros_marcadores_viram_ausencia(self):
        regs = _regs()
        pa = _por_nome(regs, "Paraúna")[0]
        self.assertIsNone(pa["preco"])
        self.assertIsNone(pa["desagio_pct"])
        self.assertTrue(pa["preco_zero_na_fonte"])
        self.assertIsNone(pa["nucleo"])
        self.assertIsNone(_por_nome(regs, "Pecém II")[0]["gf_mwmed"])
        jari = [r for r in _por_nome(regs, "Santo Antônio do Jari") if r["ano"] == "2012"][0]
        self.assertIsNone(jari["investimento_rs"])

    def test_tipo_de_geracao_com_espaco_e_ceg_repetido(self):
        regs = _regs()
        ic = _por_nome(regs, "Icaraí I")[0]
        self.assertEqual(ic["tipo_geracao"], "EOL")
        self.assertEqual(ic["categoria"], "eolica")
        rep = {(x["leilao"], x["nucleo"]) for x in al.repetidos_no_leilao(regs)}
        self.assertEqual(rep, {("2006/4", 28564), ("2009/3", 30356)})
        sp = _por_nome(regs, "Salto Pilão")
        self.assertEqual(len({r["chave"] for r in sp}), 2)
        self.assertEqual(sorted(r["vencedora"] for r in sp), ["Camargo Corrêa", "DME Energética S.A."])

    def test_categorias(self):
        self.assertEqual(al.categoria("Hidro", "PCH"), "pch")
        self.assertEqual(al.categoria("Hidro", "CGH"), "pch")
        self.assertEqual(al.categoria("Hidro", "UHE"), "uhe")
        self.assertEqual(al.categoria("Resíduos Sólidos Urbanos", "UTE"), "biomassa")
        self.assertEqual(al.categoria("Gás", "UTE"), "gas")
        self.assertIsNone(al.categoria("Nuclear", "UTN"))

    def test_validacao_recusa_energia_ausente(self):
        regs = _regs()
        regs[0] = {**regs[0], "energia_mwmed": None}
        criticos, _ = al.validar(regs)
        self.assertTrue(criticos)
        self.assertEqual(al.validar(_regs())[0], [])


class Ipca(unittest.TestCase):
    def test_fator_confere_com_variacoes_do_banco_central(self):
        """Caminho independente: produto das variações mensais da série 433 do SGS (BCB) de
        jan/2006 a set/2026 contra I(set/2026) ÷ I(dez/2005) do IBGE."""
        f = al.fator_ipca(_ipca(), "2005-12", "2026-09")
        with open(_caminho("bcb_sgs433_2006_2026.json"), encoding="utf-8") as fh:
            vs = json.load(fh)
        self.assertEqual(len(vs), 249)
        p = 1.0
        for x in vs:
            p *= 1 + float(x["valor"]) / 100
        self.assertAlmostEqual(f, 7695.82 / 2535.40, places=9)
        # variações publicadas com 2 casas: tolerância de 0,05% sobre o fator
        self.assertLess(abs(f - p) / p, 0.0005)

    def test_sem_mes_nao_ha_fator(self):
        self.assertIsNone(al.fator_ipca(_ipca(), "2001-01", "2026-09"))


class Situacao(unittest.TestCase):
    def test_situacao_atual(self):
        rs = {r["empreendimento"]: r for r in _cruzados()}
        self.assertEqual(rs["Belo Monte"]["situacao"], "operacao")
        self.assertEqual(rs["MC2 Macaíba"]["situacao"], "sem_registro")
        self.assertEqual(rs["São Fernando"]["situacao"], "encerrada")
        self.assertEqual(rs["Paraúna"]["situacao"], "sem_ceg")
        self.assertEqual(rs["Edgard de Souza"]["situacao"], "nao_iniciada")
        # ato de revogação de 2019 e usina de novo no SIGA: a fase do SIGA prevalece
        self.assertEqual(rs["Jambo"]["situacao"], "construcao")
        self.assertTrue(rs["Jambo"]["ato_encerramento"])
        self.assertEqual(rs["Pecém II"]["situacao"], "operacao")
        self.assertTrue(rs["Pecém II"]["ato_encerramento"])

    def test_entrada_contra_o_ano_a(self):
        rs = {r["empreendimento"]: r for r in _cruzados()}
        # usina de 1977 que vendeu ampliação no 1º LEN
        self.assertEqual(rs["Costa Pinto (AMPLIAÇÃO)"]["entrada_vs_ano_a"], "antes_do_leilao")
        # 2º LEN (A-3, 2006): ano A = 2009; Pecém II entrou em 2024
        self.assertEqual(rs["Pecém II"]["ano_a"], 2009)
        self.assertEqual(rs["Pecém II"]["entrada_vs_ano_a"], "depois_ano_a")
        # 3º LEN (A-5, 2006): ano A = 2011; Salto Pilão entrou em 2009
        self.assertEqual(rs["Salto Pilão"]["entrada_vs_ano_a"], "ate_ano_a")
        self.assertIsNone(rs["Belo Monte"]["entrada_vs_ano_a"])
        self.assertIsNone(rs["Jambo"]["entrada_vs_ano_a"])
        self.assertEqual(al.entrada_vs_produto("2010-01-01", 2015, None), "sem_data")

    def test_situacoes_exaustivas(self):
        rs = _cruzados()
        ids = {s for s, _, _ in al.SITUACOES}
        self.assertTrue(all(r["situacao"] in ids for r in rs))


class ControleAtual(unittest.TestCase):
    def test_grupo_pelo_proprietario_majoritario(self):
        rs = {r["empreendimento"]: r for r in _cruzados()}
        cp = rs["Costa Pinto (AMPLIAÇÃO)"]
        self.assertEqual(cp["controle"], "controlada")
        self.assertEqual(cp["grupo_cnpj"], "33453598000123")
        self.assertEqual(cp["grupo_nome"], "RAIZEN S.A.")
        self.assertEqual(cp["cadeia"][0], "08070508000178")
        self.assertEqual(cp["cadeia"][-1], "33453598000123")
        # Santo Antônio: hoje no grupo AXIA (a vencedora publicada é Furnas)
        sa = rs["Santo Antônio"]
        self.assertEqual(sa["grupo_cnpj"], "00001180000126")
        self.assertEqual(sa["vencedora"], "Furnas Centrais Elétricas S.A.")
        self.assertEqual(rs["MC2 Macaíba"]["controle"], "fora_do_cadastro")
        self.assertEqual(rs["Paraúna"]["controle"], "sem_ceg")

    def test_sem_majoritario_nao_vira_grupo(self):
        ctl = al.controle_atual(ml._le_csv(_caminho("ativos_recorte.csv")))
        # Glória: 70,07% somados de três empresas do mesmo grupo, nenhuma com mais de 50%
        self.assertEqual(ctl[1034]["estado"], "sem_majoritario")
        self.assertIsNone(ctl[1034]["grupo_cnpj"])
        self.assertEqual(ctl[28564]["grupo_cnpj"], "61194148000107")

    def test_bloco_de_grupos_separa_o_sem_vinculo(self):
        b = ml._bloco_grupos(_cruzados())
        total = sum(g["energia_mwmed"] for g in b["maiores"]) + b["demais"]["energia_mwmed"] + sum(x["energia_mwmed"] for x in b["sem_vinculo"])
        self.assertAlmostEqual(total, sum(r["energia_mwmed"] for r in _regs()), places=1)
        self.assertNotIn("todos", ml._bloco_vencedoras(_cruzados()))

    def test_cadeia_para_em_ciclo(self):
        nos = {"A": ["a", "B", None], "B": ["b", "A", None]}
        self.assertEqual(al.cadeia_de_controle("A", nos), ["A", "B"])


class Agregacao(unittest.TestCase):
    def test_preco_ponderado_pela_energia(self):
        rs = [r for r in _cruzados() if r["leilao"] == "2025/3"]
        a = ml.agrega(rs)
        # três PCH do 39º LEN: energia e preço lidos do arquivo por outro caminho
        with open(_caminho("leiloes_geracao_recorte.csv"), encoding="cp1252", newline="") as f:
            linhas = [x for x in csv.reader(f, delimiter=";") if x and x[3] == "2025/3"]
        e = [float(x[14].replace(",", ".")) for x in linhas]
        p = [float(x[16].replace(",", ".")) for x in linhas]
        self.assertAlmostEqual(a["energia_mwmed"], round(sum(e), 1), places=6)
        self.assertAlmostEqual(a["preco_medio"], round(sum(x * y for x, y in zip(p, e)) / sum(e), 2), places=6)

    def test_linha_sem_preco_fica_fora_da_media(self):
        rs = [r for r in _cruzados() if r["leilao"] == "2008/3"]
        a = ml.agrega(rs)
        self.assertEqual(a["sem_preco"], 1)
        macaiba = [r for r in rs if r["empreendimento"] == "MC2 Macaíba"][0]
        self.assertEqual(a["preco_medio"], macaiba["preco"])

    def test_transmissao_2024(self):
        t = ml._transmissao(ml._le_csv(_caminho("transmissao_2024_recorte.csv")), _ipca(), "2026-09")
        self.assertEqual(t["lotes_contratados"], 18)
        a = t["por_ano"][0]
        with open(_caminho("transmissao_2024_recorte.csv"), encoding="utf-8") as f:
            ls = [x for x in csv.DictReader(f, delimiter=";") if x["contratado"] == "sim"]
        rv = sum(float(x["rap_vencedor_rs"]) for x in ls)
        re_ = sum(float(x["rap_edital_rs"]) for x in ls)
        self.assertAlmostEqual(a["rap_vencedora_rs_mi"], round(rv / 1e6, 1), places=6)
        self.assertAlmostEqual(a["desagio_agregado_pct"], round(100 * (1 - rv / re_), 2), places=6)
        self.assertGreater(a["rap_vencedora_real_rs_mi"], a["rap_vencedora_rs_mi"])


class Contrato(unittest.TestCase):
    def test_registro_e_metricas(self):
        self.assertEqual(ml.REGISTRO["gold"], "leiloes.json")
        self.assertGreater(ml.REGISTRO["ordem"], 60)  # depois de Expansão (30) e Empresas (60)
        ids = {m["id"] for m in metricas.todas()}
        self.assertIn("leiloes_preco_medio", ids)
        for url in ml.DOWNLOADS.values():
            self.assertIn(url, ml.REGISTRO["arquivos"])

    @unittest.skipUnless(os.path.exists(GOLD), "gold não gerada")
    def test_gold_publicada(self):
        with open(GOLD, encoding="utf-8") as f:
            g = json.load(f)
        if not g.get("disponivel"):
            self.skipTest("gold indisponível")
        t = g["totais"]
        self.assertEqual(sum(x["empreendimentos"] for x in g["entrega"]["total"].values()), t["empreendimentos"])
        self.assertAlmostEqual(sum(x["energia_mwmed"] for x in g["entrega"]["total"].values()), t["energia_mwmed"], delta=0.5)
        self.assertAlmostEqual(sum(a["energia_mwmed"] for a in g["por_ano"]), t["energia_mwmed"], delta=0.5)
        self.assertAlmostEqual(sum(x["energia_mwmed"] for x in g["por_categoria"]), t["energia_mwmed"], delta=0.5)
        self.assertEqual(len(g["desagio"]["valores"]), len(g["desagio"]["categorias"]))
        self.assertLess(os.path.getsize(GOLD), 400 * 1024)
        # CSV publicado tem o cabeçalho declarado no REGISTRO
        cam = os.path.join(RAIZ, "public", ml.DOWNLOADS["empreendimentos"].lstrip("/"))
        with open(cam, encoding="utf-8") as f:
            cab = next(csv.reader(f, delimiter=";"))
        self.assertEqual(cab, [n for n, _ in ml.COLUNAS["empreendimentos"]])

    @unittest.skipUnless(os.path.exists(GOLD) and os.path.exists(GOLD_EXP), "golds não geradas")
    def test_transmissao_reconcilia_com_expansao(self):
        """Mesma soma nominal da RAP vencedora por ano calculada pelo módulo Expansão (outro código)."""
        with open(GOLD, encoding="utf-8") as f:
            g = json.load(f)
        with open(GOLD_EXP, encoding="utf-8") as f:
            e = json.load(f)
        if not (g.get("disponivel") and e.get("disponivel")):
            self.skipTest("gold indisponível")
        exp = {x["ano"]: x for x in e["transmissao"]["leiloes"]["por_ano"]}
        self.assertEqual(g["transmissao"]["lotes_contratados"], e["transmissao"]["leiloes"]["lotes_contratados"])
        for x in g["transmissao"]["por_ano"]:
            self.assertAlmostEqual(x["rap_vencedora_rs_mi"], exp[x["ano"]]["rap_vencedor_rs_mi"], delta=0.11, msg=x["ano"])


if __name__ == "__main__":
    unittest.main()
