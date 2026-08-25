import type { InsightsAnalystHighlight } from '@n8n/api-types';
import { createTestingPinia } from '@pinia/testing';
import { within } from '@testing-library/vue';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { VIEWS } from '@/app/constants';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

import InsightsAnalystHighlights from './InsightsAnalystHighlights.vue';

/**
 * This suite does not load `en.json`, so `baseText` echoes the key. It also echoes the
 * interpolated values, otherwise a metric could never be proven to reach the template.
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
 * A neutral anchor that exposes the route it was handed. Labelling every link as an
 * insights link would hide the difference between a workflow-editor link, which the
 * analyst page is allowed to render, and a licensed `/insights/<type>` link, which it isn't.
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

const renderComponent = createComponentRenderer(InsightsAnalystHighlights, {
	global: { stubs: { RouterLink: routerLinkStub } },
});

const IMPACT_MINUTES = 8100;
const EFFICIENCY_MINUTES_PER_RUN = 4;
const ATTENTION_FAILURES = 12;

const highlights: InsightsAnalystHighlight[] = [
	{
		workflowId: 'insights-demo-ap-invoice-ingestion',
		kind: 'impact',
		workflowName: 'AP invoice ingestion',
		blurb: 'Saved the most time this month',
		metricValue: IMPACT_MINUTES,
	},
	{
		workflowId: 'insights-demo-inventory-sync',
		kind: 'efficiency',
		workflowName: 'Inventory sync',
		blurb: 'Runs constantly but saves little each time',
		metricValue: EFFICIENCY_MINUTES_PER_RUN,
	},
	{
		workflowId: 'insights-demo-lead-enrichment',
		kind: 'attention',
		workflowName: 'Lead enrichment',
		blurb: 'Failed more often than any other workflow',
		metricValue: ATTENTION_FAILURES,
	},
];

describe('InsightsAnalystHighlights', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('field engineer sees one highlight card per kind, each with its own heading and blurb', () => {
		const { getByTestId } = renderComponent({ props: { highlights } });

		const section = getByTestId('insights-analyst-highlights');
		expect(section).toBeInTheDocument();
		expect(section.querySelectorAll('article')).toHaveLength(3);

		const impact = getByTestId('insights-analyst-highlight-impact');
		expect(within(impact).getByText('insights.analyst.highlights.impact')).toBeInTheDocument();
		expect(within(impact).getByText('Saved the most time this month')).toBeInTheDocument();

		const efficiency = getByTestId('insights-analyst-highlight-efficiency');
		expect(
			within(efficiency).getByText('insights.analyst.highlights.efficiency'),
		).toBeInTheDocument();
		expect(
			within(efficiency).getByText('Runs constantly but saves little each time'),
		).toBeInTheDocument();

		const attention = getByTestId('insights-analyst-highlight-attention');
		expect(
			within(attention).getByText('insights.analyst.highlights.attention'),
		).toBeInTheDocument();
		expect(
			within(attention).getByText('Failed more often than any other workflow'),
		).toBeInTheDocument();
	});

	it('words each metric for its own unit: total time, time per run, and a failure count', () => {
		const { getByTestId } = renderComponent({ props: { highlights } });

		expect(getByTestId('insights-analyst-highlight-impact')).toHaveTextContent(
			formatInsightsTimeSavedLabel(IMPACT_MINUTES),
		);
		expect(getByTestId('insights-analyst-highlight-efficiency')).toHaveTextContent(
			`insights.analyst.perRun ${formatInsightsTimeSavedLabel(EFFICIENCY_MINUTES_PER_RUN)}`,
		);
		expect(getByTestId('insights-analyst-highlight-attention')).toHaveTextContent(
			`insights.analyst.highlights.attentionMetric ${ATTENTION_FAILURES}`,
		);
	});

	it('a workflow saving 8100 minutes reads in hours rather than raw minutes', () => {
		const { getByTestId } = renderComponent({ props: { highlights } });

		const impact = getByTestId('insights-analyst-highlight-impact');
		expect(impact).toHaveTextContent(formatInsightsTimeSavedLabel(IMPACT_MINUTES));
		expect(impact).not.toHaveTextContent(String(IMPACT_MINUTES));
	});

	it('every card links to the workflow editor and none to a licensed insights route', () => {
		const { getAllByTestId, container } = renderComponent({ props: { highlights } });

		const links = getAllByTestId('insights-analyst-workflow-link');
		expect(links).toHaveLength(highlights.length);

		links.forEach((link, index) => {
			expect(link).toHaveTextContent('insights.analyst.openWorkflow');
			expect(link).toHaveAttribute('data-route-name', VIEWS.WORKFLOW);
			expect(link).toHaveAttribute(
				'data-route-params',
				JSON.stringify({ workflowId: highlights[index].workflowId }),
			);
		});

		expect(licensedInsightsLinks(container)).toEqual([]);
	});
});
