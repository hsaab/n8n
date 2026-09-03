import { inTest, Logger } from '@n8n/backend-common';
import type { ModuleInterface } from '@n8n/decorators';
import { BackendModule, OnShutdown } from '@n8n/decorators';
import { Container } from '@n8n/di';

/**
 * Only main- and webhook-type instances collect insights because
 * only they are informed of finished workflow executions.
 */
@BackendModule({ name: 'insights', instanceTypes: ['main', 'webhook'] })
export class InsightsModule implements ModuleInterface {
	async init() {
		await import('./insights.controller');
		await import('./insights-analyst.controller');

		const { InsightsService } = await import('./insights.service');
		await Container.get(InsightsService).init();

		// Licensed Insights tests boot this module after creating an owner. Seeding
		// here would insert Demo Operations workflows into GET /insights/by-workflow.
		// Analyst tests still seed from getOverview / answer.
		if (!inTest) {
			const { InsightsAnalystSeedService } = await import('./insights-analyst-seed.service');
			try {
				await Container.get(InsightsAnalystSeedService).ensureSeeded();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				Container.get(Logger).error(`Insights analyst seed failed: ${message}`);
			}
		}
	}

	async entities() {
		const { InsightsByPeriod } = await import('./database/entities/insights-by-period');
		const { InsightsMetadata } = await import('./database/entities/insights-metadata');
		const { InsightsRaw } = await import('./database/entities/insights-raw');

		return [InsightsByPeriod, InsightsMetadata, InsightsRaw];
	}

	async settings() {
		const { InsightsSettings } = await import('./insights.settings');

		return Container.get(InsightsSettings).settings();
	}

	@OnShutdown()
	async shutdown() {
		const { InsightsService } = await import('./insights.service');

		await Container.get(InsightsService).shutdown();
	}
}
