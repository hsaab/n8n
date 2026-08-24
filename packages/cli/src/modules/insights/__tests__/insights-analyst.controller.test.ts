import type { InsightsAnalystOverview } from '@n8n/api-types';
import { insightsAnalystOverviewSchema } from '@n8n/api-types';
import type { AuthenticatedRequest } from '@n8n/db';
import { ControllerRegistryMetadata, type Controller } from '@n8n/decorators';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';
import { DateTime } from 'luxon';

import { InsightsController } from '../insights.controller';
import { InsightsAnalystController } from '../insights-analyst.controller';
import type { InsightsAnalystOverviewService } from '../insights-analyst-overview.service';

const chartReadyOverview: InsightsAnalystOverview = {
	summary: {
		total: { deviation: 10, unit: 'count', value: 30 },
		failed: { deviation: 6, unit: 'count', value: 10 },
		failureRate: { deviation: 0.133, unit: 'ratio', value: 0.333 },
		averageRunTime: { deviation: null, unit: 'millisecond', value: 10 },
		timeSaved: { deviation: 5, unit: 'minute', value: 180 },
	},
	byTime: [
		{
			date: '2023-10-01T00:00:00.000Z',
			values: {
				total: 12,
				succeeded: 10,
				failed: 2,
				failureRate: 2 / 12,
				averageRunTime: 10 / 12,
				timeSaved: 18,
			},
		},
		{
			date: '2023-10-02T00:00:00.000Z',
			values: {
				total: 16,
				succeeded: 12,
				failed: 4,
				failureRate: 4 / 16,
				averageRunTime: 10 / 16,
				timeSaved: 24,
			},
		},
	],
	highlights: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			title: 'AP invoice ingestion',
			blurb: 'Saved the most time this month',
			metric: '180 min',
		},
	],
	ranking: [
		{
			rank: 1,
			workflowId: 'insights-demo-ap-invoice-ingestion',
			name: 'AP invoice ingestion',
			timeSavedLabel: '180 min',
		},
	],
	lowImpact: [
		{
			workflowId: 'insights-demo-inventory-sync',
			name: 'Inventory sync',
			blurb: 'Low time saved per run',
			timeSavedPerRunLabel: '4 min',
		},
	],
};

function overviewRoute() {
	const registry = Container.get(ControllerRegistryMetadata);
	const controllerMeta = registry.getControllerMetadata(InsightsAnalystController as Controller);

	for (const [handlerName, route] of controllerMeta.routes.entries()) {
		const fullPath = `${controllerMeta.basePath}${route.path}`.replaceAll(/\/{2,}/g, '/');
		if (route.method === 'get' && fullPath === '/insights/analyst/overview') {
			return { handlerName, route, basePath: controllerMeta.basePath };
		}
	}

	return undefined;
}

describe('InsightsAnalystController', () => {
	const overviewService = mock<InsightsAnalystOverviewService>();
	let controller: InsightsAnalystController;

	beforeEach(() => {
		jest.resetAllMocks();
		overviewService.getOverview.mockResolvedValue(chartReadyOverview);
		controller = new InsightsAnalystController(overviewService);
	});

	it('exposes GET /insights/analyst/overview on InsightsAnalystController', () => {
		const found = overviewRoute();

		expect(found).toBeDefined();
		expect(found?.route.method).toBe('get');
	});

	it('does not add the analyst overview onto InsightsController', () => {
		const registry = Container.get(ControllerRegistryMetadata);
		const production = registry.getControllerMetadata(InsightsController as Controller);
		const analystPaths = [...production.routes.values()].filter((route) =>
			`${production.basePath}${route.path}`.includes('analyst'),
		);

		expect(analystPaths).toEqual([]);
	});

	it('rejects anonymous callers and users without insights:list', () => {
		// Auth and GlobalScope run as HTTP middleware. Direct method calls do not 401.
		const found = overviewRoute();

		expect(found?.route.skipAuth).toBe(false);
		expect(found?.route.allowUnauthenticated).toBeFalsy();
		expect(found?.route.accessScope).toEqual({ scope: 'insights:list', globalOnly: true });
	});

	it('lets an insights:list user load a 30-day chart-ready overview without a dashboard license', async () => {
		const found = overviewRoute();
		const startDate = DateTime.now().minus({ days: 30 }).toJSDate();
		const endDate = DateTime.now().toJSDate();

		const response = await controller.getOverview(mock<AuthenticatedRequest>(), mock<Response>(), {
			startDate,
			endDate,
		});

		expect(found?.route.licenseFeature).toBeUndefined();
		expect(overviewService.getOverview).toHaveBeenCalled();
		expect(insightsAnalystOverviewSchema.safeParse(response).success).toBe(true);
		expect(response.byTime.length).toBeGreaterThan(0);
		expect(response.byTime[0]).toEqual(
			expect.objectContaining({
				date: expect.any(String),
				values: expect.objectContaining({
					total: expect.any(Number),
					succeeded: expect.any(Number),
					failed: expect.any(Number),
					timeSaved: expect.any(Number),
				}),
			}),
		);
		expect(response).toEqual(chartReadyOverview);
	});
});
