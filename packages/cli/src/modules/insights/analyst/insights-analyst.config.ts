import { Config, Env } from '@n8n/config';

@Config
export class InsightsAnalystConfig {
	/**
	 * Anthropic API key for Insights Analyst chat.
	 * When empty, the analyst answers from deterministic templates.
	 * Default: empty string.
	 */
	@Env('N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY')
	anthropicApiKey: string = '';

	/**
	 * Anthropic model id used by Insights Analyst chat.
	 * Default: claude-opus-4-7-20260101
	 */
	@Env('N8N_INSIGHTS_ANALYST_MODEL')
	anthropicModel: string = 'claude-opus-4-7-20260101';
}
