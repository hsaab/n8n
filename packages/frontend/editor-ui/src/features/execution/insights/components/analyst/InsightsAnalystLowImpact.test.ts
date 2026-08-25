import type { InsightsAnalystLowImpact as InsightsAnalystLowImpactRow } from '@n8n/api-types';
import { createTestingPinia } from '@pinia/testing';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

import InsightsAnalystLowImpact from './InsightsAnalystLowImpact.vue';

vi.mock('@n8n/i18n', async (importOriginal) => {
	const original = await importOriginal<typeof import('@n8n/i18n')>();
	return {
		...original,
		useI18n: () => ({
			baseText: (key: string) => key,
		}),
	};
});

const renderComponent = createComponentRenderer(InsightsAnalystLowImpact, {
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

const lowImpact: InsightsAnalystLowImpactRow[] = [
	{
		workflowId: 'insights-demo-inventory-sync',
		name: 'Inventory sync',
		blurb: 'Low time saved per run',
		timeSavedPerRunLabel: formatInsightsTimeSavedLabel(4),
	},
];

describe('InsightsAnalystLowImpact', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('field engineer sees low-impact workflows without licensed insight links', () => {
		const { getByTestId, getByText, queryAllByTestId, container } = renderComponent({
			props: { lowImpact },
		});

		expect(getByTestId('insights-analyst-low-impact')).toBeInTheDocument();
		expect(getByText('Inventory sync')).toBeInTheDocument();
		expect(getByText('Low time saved per run')).toBeInTheDocument();
		expect(getByText(formatInsightsTimeSavedLabel(4))).toBeInTheDocument();
		expect(queryAllByTestId('insights-summary-link')).toHaveLength(0);
		expect(container.querySelector('a[href*="timeSaved"]')).toBeNull();
		expect(container.querySelector('a[href*="/insights/"]')).toBeNull();
	});
});
