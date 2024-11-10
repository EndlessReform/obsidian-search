import { Editor, MarkdownView, SuggestModal, Notice, Plugin } from "obsidian";
import { DatabaseManager } from "./db";
import {
	SemanticSearchPluginSettings,
	SemanticSearchSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";

export default class SemanticSearchPlugin extends Plugin {
	settings: SemanticSearchPluginSettings;
	dbManager = new DatabaseManager();

	async onload() {
		await this.loadSettings();
		await this.dbManager.initialize();
		if (this.dbManager.db !== null) {
			await this.dbManager.db.exec(
				"INSERT INTO test (name, vec) VALUES ('test1', '[1,2,3]');",
			);
			await this.dbManager.db.exec(
				"INSERT INTO test (name, vec) VALUES ('test2', '[4,5,6]');",
			);
			await this.dbManager.db.exec(
				"INSERT INTO test (name, vec) VALUES ('test3', '[7,8,9]');",
			);
			const res = await this.dbManager.db.exec(`
			  SELECT * FROM test;
			`);
			console.log(res);
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
		this.addSettingTab(new SemanticSearchSettingTab(this.app, this));

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

	async clearDB() {
		await this.dbManager.dropAllTables();
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
		if (this.plugin.dbManager.db !== null) {
			const ret = await this.plugin.dbManager.db.query(`
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
