import { insightsAnalystOverviewSchema } from '@n8n/api-types';
import { mockInstance } from '@n8n/backend-test-utils';
import { ControllerRegistryMetadata } from '@n8n/decorators';
import { Container } from '@n8n/di';
import { DateTime } from 'luxon';

import { InsightsAnalystController } from '@/modules/insights/insights-analyst.controller';
import { INSIGHTS_DEMO_WORKFLOW_IDS } from '@/modules/insights/insights-analyst-seed-data';
import { InsightsModule } from '@/modules/insights/insights.module';
import { Telemetry } from '@/telemetry';

import { createAdmin, createMember, createOwner } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import * as utils from '../shared/utils';

mockInstance(Telemetry);

const agents: Record<string, SuperAgentTest> = {};
const testServer = utils.setupTestServer({
	endpointGroups: ['insights'],
	enabledFeatures: ['feat:insights:viewSummary'],
	quotas: { 'quota:insights:maxHistoryDays': 3 },
	modules: ['insights'],
});

function expectPopulatedOverview(value: unknown) {
	const overview = insightsAnalystOverviewSchema.parse(value);
	expect(overview.summary.total.value).toBeGreaterThan(0);
	expect(overview.highlights.map((highlight) => highlight.kind).sort()).toEqual([
		'attention',
		'efficiency',
		'impact',
	]);
	expect(overview.chart.length).toBeGreaterThanOrEqual(20);
	expect(overview.chart.every((point) => 'succeeded' in point && 'failed' in point)).toBe(true);
	expect(overview.citationAllowlist.map((row) => row.workflowId)).toEqual(
		expect.arrayContaining(INSIGHTS_DEMO_WORKFLOW_IDS),
	);
	return overview;
}

beforeAll(async () => {
	const owner = await createOwner();
	const admin = await createAdmin();
	const member = await createMember();
	agents.owner = testServer.authAgentFor(owner);
	agents.admin = testServer.authAgentFor(admin);
	agents.member = testServer.authAgentFor(member);
});

describe('GET /insights/analyst/overview', () => {
	test.each(['owner', 'admin'] as const)(
		'An %s without the enterprise dashboard entitlement gets a populated 30-day overview',
		async (agentName) => {
			const response = await agents[agentName].get('/insights/analyst/overview').expect(200);

			expectPopulatedOverview(response.body.data);
		},
	);

	test('Changing the date window changes the aggregates', async () => {
		const defaultResponse = await agents.owner.get('/insights/analyst/overview').expect(200);
		const weekResponse = await agents.owner
			.get('/insights/analyst/overview')
			.query({
				startDate: DateTime.utc().minus({ days: 7 }).toISO(),
				endDate: DateTime.utc().toISO(),
			})
			.expect(200);

		const defaultOverview = expectPopulatedOverview(defaultResponse.body.data);
		const weekOverview = insightsAnalystOverviewSchema.parse(weekResponse.body.data);

		expect(weekOverview.summary.total.value).not.toBe(defaultOverview.summary.total.value);
		expect(weekOverview.summary.total.value).toBeLessThan(defaultOverview.summary.total.value);
	});

	test('A caller without insights:list is denied', async () => {
		await agents.member.get('/insights/analyst/overview').expect(403);
	});

	test('A community user is never asked for an Insights dashboard license', async () => {
		const byWorkflow = await agents.owner.get('/insights/by-workflow');
		const byTime = await agents.owner.get('/insights/by-time');
		const overview = await agents.owner.get('/insights/analyst/overview');

		expect(byWorkflow.status).toBe(403);
		expect(byWorkflow.body.message).toBe('Plan lacks license for this feature');
		expect(byTime.status).toBe(403);
		expect(byTime.body.message).toBe('Plan lacks license for this feature');
		expect(overview.status).toBe(200);
		expect(overview.body.message).not.toBe('Plan lacks license for this feature');
		expect(overview.body.message).not.toBe(
			'The selected date range exceeds the maximum history allowed by your license',
		);
		expectPopulatedOverview(overview.body.data);
	});

	test('no @Licensed decorator on the analyst overview route', () => {
		const routes = Container.get(ControllerRegistryMetadata).getControllerMetadata(
			InsightsAnalystController,
		).routes;
		const overviewRoute = [...routes.values()].find((route) => route.path.includes('overview'));

		expect(overviewRoute).toBeDefined();
		expect(overviewRoute?.licenseFeature).toBeUndefined();
		expect(overviewRoute?.accessScope).toEqual({ scope: 'insights:list', globalOnly: true });
	});

	test('InsightsModule.init imports insights-analyst.controller', async () => {
		const controllerPath = require.resolve('@/modules/insights/insights-analyst.controller');
		delete require.cache[controllerPath];

		await Container.get(InsightsModule).init();

		expect(require.cache[controllerPath]).toBeDefined();
	});
});
