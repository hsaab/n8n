import { Config, Env } from '@n8n/config';

@Config
export class InsightsAnalystConfig {
	/**
	 * Whether to seed the Insights Analyst demo project, workflows, executions
	 * and aggregates on startup. Default: false.
	 */
	@Env('N8N_INSIGHTS_ANALYST_DEMO')
	demoEnabled: boolean = false;

	/**
	 * API key for the Insights Analyst chat. When empty, the analyst answers
	 * from deterministic templates. Default: empty string.
	 */
	@Env('N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY')
	anthropicApiKey: string = '';

	/**
	 * Anthropic model id used when an API key is set.
	 * Default: claude-sonnet-4-5-20250929
	 */
	@Env('N8N_INSIGHTS_ANALYST_MODEL')
	anthropicModel: string = 'claude-sonnet-4-5-20250929';
}
