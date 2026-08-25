import type { InsightsAnalystHighlight } from '@n8n/api-types';
import { createTestingPinia } from '@pinia/testing';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

import InsightsAnalystHighlights from './InsightsAnalystHighlights.vue';

vi.mock('@n8n/i18n', async (importOriginal) => {
	const original = await importOriginal<typeof import('@n8n/i18n')>();
	return {
		...original,
		useI18n: () => ({
			baseText: (key: string) => key,
		}),
	};
});

const renderComponent = createComponentRenderer(InsightsAnalystHighlights, {
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

const highlights: InsightsAnalystHighlight[] = [
	{
		workflowId: 'insights-demo-ap-invoice-ingestion',
		title: 'AP invoice ingestion',
		blurb: 'Saved the most time this month',
		metric: formatInsightsTimeSavedLabel(180),
	},
];

describe('InsightsAnalystHighlights', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('field engineer sees overview highlight cards without licensed insight links', () => {
		const { getByTestId, getByText, queryAllByTestId, container } = renderComponent({
			props: { highlights },
		});

		expect(getByTestId('insights-analyst-highlights')).toBeInTheDocument();
		expect(getByText('AP invoice ingestion')).toBeInTheDocument();
		expect(getByText('Saved the most time this month')).toBeInTheDocument();
		expect(getByText(formatInsightsTimeSavedLabel(180))).toBeInTheDocument();
		expect(queryAllByTestId('insights-summary-link')).toHaveLength(0);
		expect(container.querySelector('a[href*="timeSaved"]')).toBeNull();
		expect(container.querySelector('a[href*="/insights/"]')).toBeNull();
	});
});
