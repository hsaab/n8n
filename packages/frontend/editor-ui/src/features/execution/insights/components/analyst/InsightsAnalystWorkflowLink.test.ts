import { createTestingPinia } from '@pinia/testing';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { VIEWS } from '@/app/constants';

import InsightsAnalystWorkflowLink from './InsightsAnalystWorkflowLink.vue';

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
 * A neutral anchor that exposes the route it was handed, so the target can be checked
 * without pre-judging it as an insights link or a workflow link.
 */
const routerLinkStub = {
	props: ['to'],
	template: `<a
		:data-route-name="typeof to === 'string' ? to : (to && to.name) || ''"
		:data-route-params="JSON.stringify((to && to.params) || {})"
	><slot /></a>`,
};

const renderComponent = createComponentRenderer(InsightsAnalystWorkflowLink, {
	global: { stubs: { RouterLink: routerLinkStub } },
});

const WORKFLOW_ID = 'insights-demo-ap-invoice-ingestion';

describe('InsightsAnalystWorkflowLink', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('field engineer opens the workflow editor from an analyst card', () => {
		const { getByTestId } = renderComponent({ props: { workflowId: WORKFLOW_ID } });

		const link = getByTestId('insights-analyst-workflow-link');
		expect(link).toHaveTextContent('insights.analyst.openWorkflow');
		expect(link).toHaveAttribute('data-route-name', VIEWS.WORKFLOW);
		expect(link).toHaveAttribute('data-route-params', JSON.stringify({ workflowId: WORKFLOW_ID }));
	});

	it('never targets a licensed insights route even when the workflow id mentions insights', () => {
		const { getByTestId } = renderComponent({ props: { workflowId: WORKFLOW_ID } });

		const link = getByTestId('insights-analyst-workflow-link');
		expect(link.getAttribute('data-route-name')).not.toBe(VIEWS.INSIGHTS);
		expect(link.getAttribute('data-route-params')).not.toContain('insightType');
		expect(link).not.toHaveAttribute('href');
	});
});
