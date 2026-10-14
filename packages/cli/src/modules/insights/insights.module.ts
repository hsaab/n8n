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

		const { InsightsAnalystConfig } = await import('./analyst/insights-analyst.config');
		const { InstanceSettings } = await import('n8n-core');
		if (
			Container.get(InsightsAnalystConfig).demoEnabled &&
			Container.get(InstanceSettings).isLeader
		) {
			const { InsightsAnalystSeed } = await import('./analyst/insights-analyst.seed');
			await Container.get(InsightsAnalystSeed).run();
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
