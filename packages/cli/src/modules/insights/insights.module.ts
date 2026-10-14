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
		await import('./analyst/insights-analyst.controller');

		const { InsightsService } = await import('./insights.service');
		await Container.get(InsightsService).init();

		const { InstanceSettings } = await import('n8n-core');
		if (Container.get(InstanceSettings).instanceType !== 'main') return;

		try {
			const { InsightsAnalystSeedService } = await import(
				'./analyst/insights-analyst-seed.service'
			);
			await Container.get(InsightsAnalystSeedService).seed();
		} catch (error) {
			const { Logger } = await import('@n8n/backend-common');
			Container.get(Logger).error('Insights analyst seed failed', {
				errorName: error instanceof Error ? error.name : 'unknown',
			});
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
