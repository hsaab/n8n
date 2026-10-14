import { Config, Env } from '@n8n/config';

@Config
export class InsightsAnalystConfig {
	/**
	 * API key for the Insights Analyst chat. When empty, the analyst answers
	 * from deterministic templates. Default: empty string.
	 */
	@Env('N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY')
	anthropicApiKey: string = '';

	/**
	 * Anthropic model id used when an API key is set.
	 * Default: claude-opus-4-7-20260101
	 */
	@Env('N8N_INSIGHTS_ANALYST_MODEL')
	anthropicModel: string = 'claude-opus-4-7-20260101';
}
