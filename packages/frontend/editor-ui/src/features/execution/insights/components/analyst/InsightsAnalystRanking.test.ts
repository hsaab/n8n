import type { InsightsAnalystRankingRow } from '@n8n/api-types';
import { createTestingPinia } from '@pinia/testing';
import { within } from '@testing-library/vue';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { VIEWS } from '@/app/constants';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

import InsightsAnalystRanking from './InsightsAnalystRanking.vue';

/**
 * This suite does not load `en.json`, so `baseText` echoes the key. It also echoes the
 * interpolated values, otherwise the department and the time saved could never be proven
 * to reach the template.
 */
vi.mock('@n8n/i18n', async (importOriginal) => {
	const original = await importOriginal<typeof import('@n8n/i18n')>();
	return {
		...original,
		useI18n: () => ({
			baseText: (key: string, options?: { interpolate?: Record<string, string | number> }) =>
				options?.interpolate ? `${key} ${Object.values(options.interpolate).join(' ')}` : key,
		}),
	};
});

/**
 * A neutral anchor that exposes the route it was handed. The ranking legitimately links
 * to the workflow editor now, so a stub that labels every link as an insights link would
 * make the "no licensed insights route" guarantee unverifiable.
 */
const routerLinkStub = {
	props: ['to'],
	template: `<a
		:data-route-name="typeof to === 'string' ? to : (to && to.name) || ''"
		:data-route-params="JSON.stringify((to && to.params) || {})"
	><slot /></a>`,
};

const licensedInsightsLinks = (container: Element) =>
	Array.from(container.querySelectorAll('a')).filter(
		(anchor) =>
			anchor.getAttribute('data-route-name') === VIEWS.INSIGHTS ||
			(anchor.getAttribute('data-route-params') ?? '').includes('insightType') ||
			/\/insights\//.test(anchor.getAttribute('href') ?? ''),
	);

const renderComponent = createComponentRenderer(InsightsAnalystRanking, {
	global: { stubs: { RouterLink: routerLinkStub } },
});

const ranking: InsightsAnalystRankingRow[] = [
	{
		rank: 1,
		workflowId: 'insights-demo-ap-invoice-ingestion',
		name: 'AP invoice ingestion',
		department: 'Finance',
		timeSavedMinutes: 8100,
	},
	{
		rank: 2,
		workflowId: 'insights-demo-lead-enrichment',
		name: 'Lead enrichment',
		department: 'Sales',
		timeSavedMinutes: 45,
	},
	{
		rank: 3,
		workflowId: 'insights-demo-inventory-sync',
		name: 'Inventory sync',
		department: '',
		timeSavedMinutes: 30,
	},
];

describe('InsightsAnalystRanking', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('field engineer sees the ranked demo workflows under the ranking heading', () => {
		const { getByTestId, getByText, getAllByText } = renderComponent({ props: { ranking } });

		const section = getByTestId('insights-analyst-ranking');
		expect(section).toBeInTheDocument();
		expect(getByText('insights.analyst.ranking.title')).toBeInTheDocument();
		expect(section.querySelectorAll('li')).toHaveLength(ranking.length);

		ranking.forEach((row) => expect(getByText(String(row.rank))).toBeInTheDocument());
		expect(getAllByText('insights.analyst.ranking.trend')).toHaveLength(ranking.length);
	});

	it('ranks only the top five when the API returns every demo workflow', () => {
		const everyWorkflow: InsightsAnalystRankingRow[] = Array.from({ length: 8 }, (_, index) => ({
			rank: index + 1,
			workflowId: `insights-demo-workflow-${index + 1}`,
			name: `Workflow ${index + 1}`,
			department: 'Operations',
			timeSavedMinutes: 600 - index * 60,
		}));

		const { getByTestId } = renderComponent({ props: { ranking: everyWorkflow } });

		const section = getByTestId('insights-analyst-ranking');
		expect(section.querySelectorAll('li')).toHaveLength(5);
		expect(section).toHaveTextContent('Workflow 5');
		expect(section).not.toHaveTextContent('Workflow 6');
	});

	it('shows the owning department beside the workflow name', () => {
		const { getByText } = renderComponent({ props: { ranking } });

		expect(
			getByText('insights.analyst.ranking.workflowInDepartment AP invoice ingestion Finance'),
		).toBeInTheDocument();
		expect(
			getByText('insights.analyst.ranking.workflowInDepartment Lead enrichment Sales'),
		).toBeInTheDocument();
	});

	it('degrades to the bare workflow name when the department is empty', () => {
		const { getByText } = renderComponent({ props: { ranking } });

		const row = getByText('Inventory sync').closest('li');
		expect(row).not.toBeNull();
		expect(row).not.toHaveTextContent('workflowInDepartment');
	});

	it('reports time saved per row, reading 8100 minutes as hours', () => {
		const { getByTestId, getByText } = renderComponent({ props: { ranking } });

		expect(
			getByText(`insights.analyst.ranking.timeSaved ${formatInsightsTimeSavedLabel(8100)}`),
		).toBeInTheDocument();
		expect(
			getByText(`insights.analyst.ranking.timeSaved ${formatInsightsTimeSavedLabel(45)}`),
		).toBeInTheDocument();
		expect(getByTestId('insights-analyst-ranking')).not.toHaveTextContent('8100');
	});

	it('every row links to the workflow editor and none to a licensed insights route', () => {
		const { getByTestId, getAllByTestId, container } = renderComponent({ props: { ranking } });

		const links = getAllByTestId('insights-analyst-workflow-link');
		expect(links).toHaveLength(ranking.length);

		ranking.forEach((row) => {
			const rowElement = getByTestId('insights-analyst-ranking').querySelector(
				`li:nth-of-type(${row.rank})`,
			) as HTMLElement;
			const link = within(rowElement).getByTestId('insights-analyst-workflow-link');
			expect(link).toHaveAttribute('data-route-name', VIEWS.WORKFLOW);
			expect(link).toHaveAttribute(
				'data-route-params',
				JSON.stringify({ workflowId: row.workflowId }),
			);
		});

		expect(licensedInsightsLinks(container)).toEqual([]);
	});
});
