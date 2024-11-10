import { PGlite, IdbFs } from "@electric-sql/pglite";
// Yes, this is relative to the project root instead of this file. Yes, this is terrible.:w
// @ts-ignore
import wasmModule from "./node_modules/@electric-sql/pglite/dist/postgres.wasm";
// @ts-ignore
import fsBundle from "./node_modules/@electric-sql/pglite/dist/postgres.data";
// @ts-ignore
import vectorURL from "./node_modules/@electric-sql/pglite/dist/vector.tar.gz";

export enum DatabaseState {
	UNINITIALIZED = "UNINITIALIZED",
	INITIALIZING = "INITIALIZING",
	READY = "READY",
	ERROR = "ERROR",
}

export class DatabaseManager {
	db: PGlite | null = null;
	state: DatabaseState = DatabaseState.UNINITIALIZED;

	async initialize(): Promise<void> {
		if (this.state === DatabaseState.INITIALIZING) {
			throw new Error("Database is already initializing");
		}
		if (this.state === DatabaseState.READY) {
			return;
		}

		this.state = DatabaseState.INITIALIZING;

		try {
			const compiledWasm = await wasmModule;
			if (!compiledWasm) {
				throw new Error("Failed to download WASM module");
			}

			this.db = new PGlite({
				wasmModule: compiledWasm,
				fsBundle: new Blob([fsBundle]),
				extensions: {
					vector: vectorURL,
				},
			});

			// Handle the process/window hack for extension loading
			const originalProcess = window.process;
			// @ts-ignore
			window.process = undefined;

			try {
				await this.db.exec("CREATE EXTENSION IF NOT EXISTS vector;");
				await this.db.exec(`
                    CREATE TABLE IF NOT EXISTS test (
                        id SERIAL PRIMARY KEY,
                        name TEXT,
                        vec vector(3)
                    );
                `);
				this.state = DatabaseState.READY;
			} finally {
				// @ts-ignore
				window.process = originalProcess;
			}
		} catch (error) {
			this.state = DatabaseState.ERROR;
			console.error("Failed to initialize database:", error);
			throw error;
		}
	}

	async dropAllTables(): Promise<void> {
		if (this.state !== DatabaseState.READY) {
			throw new Error(
				`Cannot drop tables - database is in state: ${this.state}`,
			);
		}

		await this.db!.exec(`DROP TABLE IF EXISTS test CASCADE;`);
	}
}
