import type { InsightsAnalystRankingRow } from '@n8n/api-types';
import { createTestingPinia } from '@pinia/testing';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

import InsightsAnalystRanking from './InsightsAnalystRanking.vue';

vi.mock('@n8n/i18n', async (importOriginal) => {
	const original = await importOriginal<typeof import('@n8n/i18n')>();
	return {
		...original,
		useI18n: () => ({
			baseText: (key: string) => key,
		}),
	};
});

const renderComponent = createComponentRenderer(InsightsAnalystRanking, {
	global: {
		stubs: {
			RouterLink: {
				props: ['to'],
				template:
					'<a data-test-id="insights-summary-link" :data-insight-type="to && to.params && to.params.insightType"><slot /></a>',
			},
		},
	},
});

const ranking: InsightsAnalystRankingRow[] = [
	{
		rank: 1,
		workflowId: 'insights-demo-ap-invoice-ingestion',
		name: 'AP invoice ingestion',
		timeSavedLabel: formatInsightsTimeSavedLabel(180),
	},
	{
		rank: 2,
		workflowId: 'insights-demo-lead-enrichment',
		name: 'Lead enrichment',
		timeSavedLabel: formatInsightsTimeSavedLabel(45),
	},
];

describe('InsightsAnalystRanking', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('field engineer sees ranked demo workflows with time-saved labels and no licensed insight links', () => {
		const { getByTestId, getByText, queryAllByTestId, container } = renderComponent({
			props: { ranking },
		});

		expect(getByTestId('insights-analyst-ranking')).toBeInTheDocument();
		expect(getByText('AP invoice ingestion')).toBeInTheDocument();
		expect(getByText('Lead enrichment')).toBeInTheDocument();
		expect(getByText(formatInsightsTimeSavedLabel(180))).toBeInTheDocument();
		expect(getByText(formatInsightsTimeSavedLabel(45))).toBeInTheDocument();
		expect(queryAllByTestId('insights-summary-link')).toHaveLength(0);
		expect(container.querySelector('a[href*="timeSaved"]')).toBeNull();
		expect(container.querySelector('a[href*="/insights/"]')).toBeNull();
	});
});
