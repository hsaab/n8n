import { InsightsModule } from '@/features/execution/insights/module.descriptor';

describe('InsightsModule analyst route', () => {
	it('registers /insights/analyst child behind insights module gate and insights:list rbac', () => {
		const insightsRoute = InsightsModule.routes[0];

		expect(insightsRoute).toMatchObject({
			path: '/insights',
			meta: {
				middleware: ['authenticated', 'rbac'],
				middlewareOptions: {
					rbac: {
						scope: ['insights:list'],
					},
				},
			},
		});
		expect(insightsRoute.beforeEnter).toEqual(expect.any(Function));

		const analystChild = insightsRoute.children?.find((child) => child.path === 'analyst');

		expect(analystChild).toBeDefined();
		expect(analystChild).toMatchObject({
			path: 'analyst',
			name: 'InsightsAnalyst',
		});
		expect(analystChild?.component).toEqual(expect.any(Function));
	});

	it('loads InsightsAnalystDashboard for the analyst child route', async () => {
		const analystChild = InsightsModule.routes[0].children?.find(
			(child) => child.path === 'analyst',
		);

		expect(analystChild?.component).toEqual(expect.any(Function));

		const loaded = await (analystChild?.component as () => Promise<{ default: unknown }>)();

		expect(loaded.default).toBeDefined();
		expect(
			(loaded.default as { __name?: string; name?: string }).__name ??
				(loaded.default as { name?: string }).name,
		).toMatch(/InsightsAnalystDashboard/);
	});
});
