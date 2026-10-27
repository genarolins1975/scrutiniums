import { unstable_cache } from "next/cache";
import { lerDoDisco } from "@/lib/conta/metadados";
import { quadro } from "./modelo";

/** O deploy fixa os arquivos. Cache curto evita reler as bases em cada navegação do ADM. */
export const lerQuadro = unstable_cache(async () => quadro(lerDoDisco), ["quadro-operacional-v1"], { revalidate: 300 });
