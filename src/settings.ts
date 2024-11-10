import { App, Setting, PluginSettingTab } from "obsidian";
import SemanticSearchPlugin from "./main";

export interface SemanticSearchPluginSettings {
	embeddingsEndpoint: string;
	embeddingsApiKey?: string;
	embeddingsModel?: string;
	useLocalEmbeddings: boolean;
	totalTokensProcessed: number; // For cost tracking
}

export const DEFAULT_SETTINGS: SemanticSearchPluginSettings = {
	embeddingsEndpoint: "https://api.openai.com/v1",
	embeddingsModel: "text-embedding-3-small",
	useLocalEmbeddings: false,
	totalTokensProcessed: 0,
};

export class SemanticSearchSettingTab extends PluginSettingTab {
	plugin: SemanticSearchPlugin;

	constructor(app: App, plugin: SemanticSearchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Privacy notice at the top
		const privacyEl = containerEl.createEl("div", {
			cls: "semantic-search-privacy-notice",
		});
		privacyEl.createEl("h3", { text: "🔒 Privacy & Data Flow" });
		privacyEl.createEl("p", {
			text: "Your notes never leave your device unless explicitly sent to the embedding/LLM providers configured below. All indexes and vectors are stored locally on your machine.",
		});

		containerEl.createEl("h3", { text: "Embedding Configuration" });

		// Local vs Remote toggle
		new Setting(containerEl)
			.setName("Use local embeddings")
			.setDesc(
				"Process everything locally. Slower but completely private. Requires local embedding server.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useLocalEmbeddings)
					.onChange(async (value) => {
						this.plugin.settings.useLocalEmbeddings = value;
						await this.plugin.saveSettings();
						// Force refresh to show/hide relevant settings
						this.display();
					}),
			);

		if (!this.plugin.settings.useLocalEmbeddings) {
			// Remote API settings
			new Setting(containerEl)
				.setName("Embeddings API endpoint")
				.setDesc("API must be OpenAI-compatible")
				.setClass("semantic-search-indent")
				.addText((text) =>
					text
						.setPlaceholder("https://api.openai.com/v1")
						.setValue(this.plugin.settings.embeddingsEndpoint)
						.onChange(async (value) => {
							this.plugin.settings.embeddingsEndpoint = value;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("API Key")
				.setDesc("Your OpenAI or compatible API key")
				.setClass("semantic-search-indent")
				.addText((text) =>
					text
						.setPlaceholder("sk-...")
						.setValue(this.plugin.settings.embeddingsApiKey || "")
						.onChange(async (value) => {
							this.plugin.settings.embeddingsApiKey = value;
							await this.plugin.saveSettings();
						}),
				)
				.then((setting) => {
					setting.controlEl.querySelector("input")!.type = "password";
				});

			new Setting(containerEl)
				.setName("Model name")
				.setDesc(
					"Embedding model to use (e.g., text-embedding-3-small)",
				)
				.setClass("semantic-search-indent")
				.addText((text) =>
					text
						.setPlaceholder("text-embedding-3-small")
						.setValue(this.plugin.settings.embeddingsModel || "")
						.onChange(async (value) => {
							this.plugin.settings.embeddingsModel = value;
							await this.plugin.saveSettings();
						}),
				);

			// Usage stats
			const tokenCount = this.plugin.settings.totalTokensProcessed;
			const estimatedCost = (tokenCount / 1000) * 0.0001; // Example rate

			new Setting(containerEl)
				.setName("Usage Statistics")
				.setDesc(
					`Total tokens processed: ${tokenCount.toLocaleString()}
                         \nEstimated cost: $${estimatedCost.toFixed(4)}`,
				)
				.setClass("semantic-search-usage-stats");
		} else {
			// Local embedding server settings
			new Setting(containerEl)
				.setName("Local server endpoint")
				.setDesc("Your local embedding server address")
				.setClass("semantic-search-indent")
				.addText((text) =>
					text
						.setPlaceholder("http://localhost:8080")
						.setValue(this.plugin.settings.embeddingsEndpoint)
						.onChange(async (value) => {
							this.plugin.settings.embeddingsEndpoint = value;
							await this.plugin.saveSettings();
						}),
				);

			// Help text for local setup
			const localHelpEl = containerEl.createEl("div", {
				cls: "semantic-search-local-help",
			});
			localHelpEl.createEl("h4", { text: "📚 Running Local Embeddings" });
			localHelpEl.createEl("p", {
				text: "To use local embeddings, you'll need to run an embedding server. We recommend:",
			});
			localHelpEl.createEl("ul").innerHTML = `
                <li>Ollama (easiest): Download from ollama.ai</li>
                <li>LocalAI: More configurable but requires more setup</li>
            `;
		}

		// Database management section
		containerEl.createEl("h3", { text: "Database Management" });

		new Setting(containerEl)
			.setName("Reset Database")
			.setDesc(
				"⚠️ Warning: This will delete all indexed embeddings. You'll need to reindex your notes.",
			)
			.addButton((button) =>
				button
					.setButtonText("Reset Database")
					.setWarning()
					.onClick(() => {
						const confirmMessage =
							"Are you sure you want to reset the database? This cannot be undone.";
						if (confirm(confirmMessage)) {
							// Call your drop tables method here
							this.plugin.dbManager.dropAllTables();
						}
					}),
			);
	}
}
