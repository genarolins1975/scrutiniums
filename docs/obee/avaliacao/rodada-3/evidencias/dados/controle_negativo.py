"""Controle negativo: perturba um valor no esperado (só em memória) e confirma que o conferidor acusa divergência."""
import sys, runpy
sys.path.insert(0, "/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados")
import esperado as E
o = E.IDX[("edu.despesa.por_habitante", 2611606, 2025, None, "nominal")]
o["valor"] = o["valor"] + 25.0   # Recife 2025 + R$ 25
sys.argv = ["confere_exploracao.py", sys.argv[1], sys.argv[2]]
runpy.run_path("/home/user/scrutiniums/docs/obee/avaliacao/rodada-3/evidencias/dados/confere_exploracao.py", run_name="__main__")
