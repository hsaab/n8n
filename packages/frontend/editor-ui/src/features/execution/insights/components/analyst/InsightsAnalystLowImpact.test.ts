import type { InsightsAnalystLowImpact as InsightsAnalystLowImpactRow } from '@n8n/api-types';
import { createTestingPinia } from '@pinia/testing';
import { within } from '@testing-library/vue';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { VIEWS } from '@/app/constants';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

import InsightsAnalystLowImpact from './InsightsAnalystLowImpact.vue';

/**
 * This suite does not load `en.json`, so `baseText` echoes the key. It also echoes the
 * interpolated values, otherwise the per-run figure could never be proven to reach
 * the template.
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

const licensedInsightsLinks = (container: Element) =>
	Array.from(container.querySelectorAll('a')).filter(
		(anchor) =>
			anchor.getAttribute('data-route-name') === VIEWS.INSIGHTS ||
			(anchor.getAttribute('data-route-params') ?? '').includes('insightType') ||
			/\/insights\//.test(anchor.getAttribute('href') ?? ''),
	);

const renderComponent = createComponentRenderer(InsightsAnalystLowImpact);

const lowImpact: InsightsAnalystLowImpactRow[] = [
	{
		workflowId: 'insights-demo-inventory-sync',
		name: 'Inventory sync',
		blurb: 'Low time saved per run',
		timeSavedPerRunMinutes: 4,
	},
	{
		workflowId: 'insights-demo-shipment-tracker',
		name: 'Shipment tracker',
		blurb: 'Runs hourly for a small gain',
		timeSavedPerRunMinutes: 6,
	},
	{
		workflowId: 'insights-demo-ticket-triage',
		name: 'Ticket triage',
		blurb: 'Barely faster than doing it by hand',
		timeSavedPerRunMinutes: 9,
	},
];

describe('InsightsAnalystLowImpact', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	/**
	 * This section used to render empty because a server-side filter dropped every row,
	 * so the card count is the client-side regression guard.
	 */
	it('field engineer sees a card for every low-impact workflow, not an empty section', () => {
		const { getByTestId, getByText } = renderComponent({ props: { lowImpact } });

		const section = getByTestId('insights-analyst-low-impact');
		expect(section).toBeInTheDocument();
		expect(getByText('insights.analyst.lowImpact.title')).toBeInTheDocument();
		expect(section.querySelectorAll('article')).toHaveLength(lowImpact.length);

		lowImpact.forEach((row) => {
			const card = getByText(row.name).closest('article') as HTMLElement;
			expect(within(card).getByText(row.blurb)).toBeInTheDocument();
			expect(card).toHaveTextContent(
				`insights.analyst.perRun ${formatInsightsTimeSavedLabel(row.timeSavedPerRunMinutes)}`,
			);
		});
	});

	it('does not link to a licensed insights route', () => {
		const { container } = renderComponent({ props: { lowImpact } });

		expect(licensedInsightsLinks(container)).toEqual([]);
	});
});
