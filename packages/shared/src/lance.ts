import * as lancedb from "@lancedb/lancedb";

export interface CorpusTableOptions {
  dbPath: string;
  tableName: string;
}

/**
 * Membuka tabel LanceDB (embedded, berbasis file). Tidak ada server;
 * cukup arahkan ke folder `data/lancedb`.
 */
export async function openCorpusTable(
  options: CorpusTableOptions,
) {
  const db = await lancedb.connect(options.dbPath);

  return db.openTable(options.tableName);
}

export { lancedb };
