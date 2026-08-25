import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';

import { VIEWS } from '@/app/constants';
import { InsightsModule } from '@/features/execution/insights/module.descriptor';

vi.mock('@/features/execution/insights/insights.store', () => ({
	useInsightsStore: () => ({
		isInsightsEnabled: true,
	}),
}));

function insightsParentRoute() {
	const parent = InsightsModule.routes?.[0];
	if (!parent) {
		throw new Error('Insights module has no parent route');
	}
	return parent;
}

function stubInsightsRoutes(): RouteRecordRaw[] {
	// Swapping in stub components loses the discriminant of the RouteRecordRaw union.
	return (InsightsModule.routes ?? []).map(
		(route) =>
			({
				...route,
				component: { template: '<router-view />' },
				children: (route.children ?? []).map((child) => ({
					...child,
					component: { template: '<div data-test-id="matched-insights-child" />' },
				})),
			}) as RouteRecordRaw,
	);
}

async function openInsightsPath(path: string) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			...stubInsightsRoutes(),
			{
				path: '/404',
				name: VIEWS.NOT_FOUND,
				component: { template: '<div data-test-id="not-found" />' },
			},
		],
	});

	await router.push(path);
	await router.isReady();
	return router;
}

describe('Insights analyst routes', () => {
	it('/insights/analyst opens with insights:list and no demo flag', () => {
		const parent = insightsParentRoute();
		const children = parent.children ?? [];
		const analystChild = children.find((child) => child.path === 'analyst');

		expect(parent.meta?.middleware).toEqual(['authenticated', 'rbac']);
		expect(parent.meta?.middlewareOptions).toEqual({
			rbac: {
				scope: ['insights:list'],
			},
		});
		expect(analystChild).toBeDefined();
		expect(analystChild?.meta).not.toEqual(
			expect.objectContaining({
				featureFlag: expect.anything(),
			}),
		);
		expect(JSON.stringify({ meta: parent.meta, childMeta: analystChild?.meta })).not.toMatch(
			/N8N_DEMO|demoFeature|DEMO_INSIGHTS/i,
		);
		// Compared against the literal rather than the constant, so renaming the
		// constant fails here instead of quietly agreeing with itself.
		expect(analystChild?.name).toBe('InsightsAnalyst');
		expect(VIEWS.INSIGHTS_ANALYST).toBe('InsightsAnalyst');
	});

	it('/insights/analyst is registered before :insightType? and is not captured as insightType', async () => {
		const children = insightsParentRoute().children ?? [];

		expect(children[0]?.path).toBe('analyst');
		expect(children[1]?.path).toBe(':insightType?');

		const router = await openInsightsPath('/insights/analyst');

		expect(router.currentRoute.value.name).toBe('InsightsAnalyst');
		expect(router.currentRoute.value.params.insightType).not.toBe('analyst');
	});

	it('/insights/timeSaved still hits the existing param route', async () => {
		const router = await openInsightsPath('/insights/timeSaved');

		expect(router.currentRoute.value.name).toBe(VIEWS.INSIGHTS);
		expect(router.currentRoute.value.params.insightType).toBe('timeSaved');
	});
});
