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

// Remember to rename these classes and interfaces!
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

async function downloadPGWasm(): Promise<WebAssembly.Module | null> {
	let wasmModule: WebAssembly.Module | null = null;
	const response = await fetch(
		"https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.2.12/dist/postgres.wasm",
	);
	console.log("WASM response status:", response.status);
	console.log("WASM response size:", response.headers.get("content-length"));
	wasmModule = await WebAssembly.compileStreaming(response);
	return wasmModule;
}

async function getFsBundle() {
	const response = await fetch(
		"https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.2.12/dist/postgres.data",
	);
	console.log("FS response status:", response.status);
	console.log("FS response size:", response.headers.get("content-length"));
	const buffer = await response.arrayBuffer();
	console.log("Actual FS buffer size:", buffer.byteLength);
	return buffer;
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	db: PGlite | null = null;

	async onload() {
		await this.loadSettings();
		// Convert base64 to binary
		// Create the module
		const wasmModule = await downloadPGWasm();
		if (wasmModule === null) {
			throw "Could not download WASM from jsdelivr";
		}

		const fsData = await getFsBundle();
		// Corrupt some bytes but keep the length same
		// const corruptData = fsData.slice(0);
		// new Uint8Array(corruptData).set([0xff, 0xff, 0xff], 0); // corrupt first few bytes
		// const emptyBuffer = new ArrayBuffer(0);

		const db = new PGlite({
			wasmModule,
			fsBundle: new Blob([new Uint8Array(fsData)]),
			debug: 5,
		});
		this.db = db;
		console.log("DB instance created");
		try {
			console.log("About to exec version query");
			await this.db.exec(`SELECT version();`);
			console.log("Query completed");
		} catch (e) {
			console.error("Query failed:", e);
			// Let's see if we can get more info about the error
			console.error("Error properties:", Object.getOwnPropertyNames(e));
			throw e;
		}
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
	private plugin: MyPlugin;

	constructor(plugin: MyPlugin) {
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
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
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
