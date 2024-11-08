import {
	App,
	Editor,
	MarkdownView,
	SuggestModal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { PGlite, IdbFs } from "@electric-sql/pglite";
// Yes, this is importing directly from node_modules. Yes, this is cursed.
// No, we don't have a better solution because:
// 1. The files aren't in package.json "exports"
// 2. The library needs them but won't expose them
// 3. Everything is terrible
// @ts-ignore
import wasmModule from "./node_modules/@electric-sql/pglite/dist/postgres.wasm";
// @ts-ignore
import fsBundle from "./node_modules/@electric-sql/pglite/dist/postgres.data";
// @ts-ignore
import vectorURL from "./node_modules/@electric-sql/pglite/dist/vector.tar.gz";

// Remember to rename these classes and interfaces!
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class SemanticSearchPlugin extends Plugin {
	settings: MyPluginSettings;
	db: PGlite | null = null;

	async onload() {
		await this.loadSettings();
		const compiledWasm = await wasmModule;
		if (wasmModule === null) {
			throw "Could not download WASM from jsdelivr";
		}

		const db = new PGlite({
			wasmModule: compiledWasm,
			fsBundle: new Blob([fsBundle]),
			extensions: {
				vector: vectorURL,
			},
		});
		this.db = db;
		console.log("DB instance created");
		// Dirty hack to initialize extensions:
		// PGLite checks that we're in node using the window prop: https://github.com/electric-sql/pglite/blob/ad83951c4d4ecb696bff01ab9c07a48580633232/packages/pglite/src/utils.ts#L6
		// if it does, it tries importing FS to load the bundle, which will crash the extension due to Electron security: https://github.com/electric-sql/pglite/blob/ad83951c4d4ecb696bff01ab9c07a48580633232/packages/pglite/src/extensionUtils.ts#L10
		const originalProcess = window.process;
		// @ts-ignore
		window.process = undefined;
		await db.exec("CREATE EXTENSION IF NOT EXISTS vector;");
		// Restore process
		// @ts-ignore
		window.process = originalProcess;
		console.log("Vector extension loaded");
		await db.exec(`
		  CREATE TABLE IF NOT EXISTS test (
		    id SERIAL PRIMARY KEY,
		    name TEXT,
		    vec vector(3)
		  );
		`);
		await db.exec(
			"INSERT INTO test (name, vec) VALUES ('test1', '[1,2,3]');",
		);
		await db.exec(
			"INSERT INTO test (name, vec) VALUES ('test2', '[4,5,6]');",
		);
		await db.exec(
			"INSERT INTO test (name, vec) VALUES ('test3', '[7,8,9]');",
		);

		const res = await db.exec(`
  SELECT * FROM test;
`);
		console.log(res);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			},
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends SuggestModal<string> {
	private plugin: SemanticSearchPlugin;

	constructor(plugin: SemanticSearchPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	async getSuggestions(query: string): Promise<string[]> {
		const { contentEl } = this;
		if (this.plugin.db !== null) {
			const ret = await this.plugin.db.query(`
			  SELECT * from todo WHERE id = 1;
			`);
			console.log(ret.rows);
			contentEl.setText("Woah!");
			return ["foobar"];
		} else {
			return [];
		}
	}

	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("p", {
			text: item,
		});
	}

	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent): void {
		console.log(`chose ${item}`);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: SemanticSearchPlugin;

	constructor(app: App, plugin: SemanticSearchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
