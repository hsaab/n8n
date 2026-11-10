import { createTestingPinia } from '@pinia/testing';
import { within } from '@testing-library/vue';
import { createComponentRenderer } from '@/__tests__/render';
import MaskedValueMarker from './MaskedValueMarker.vue';

const { maskedLabel } = vi.hoisted(() => ({ maskedLabel: 'Maskiert' }));

vi.mock('@n8n/i18n', async (importOriginal) => ({
	...(await importOriginal()),
	useI18n: () => ({
		baseText: vi.fn((key: string) => (key === 'ndv.output.masked' ? maskedLabel : key)),
	}),
}));

const renderComponent = createComponentRenderer(MaskedValueMarker, {
	pinia: createTestingPinia(),
});

describe('MaskedValueMarker', () => {
	it('should show a lock icon before the Masked label', () => {
		const { getByTestId } = renderComponent();

		const marker = getByTestId('ndv-masked-value');
		const icons = marker.querySelectorAll('svg[data-icon="lock"]');
		expect(icons).toHaveLength(1);
		expect(icons[0]).toHaveAttribute('aria-hidden', 'true');

		const label = within(marker).getByText(maskedLabel);
		expect(icons[0].compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(marker.textContent?.trim()).toBe(maskedLabel);
	});

	it('should read its label from the ndv.output.masked translation', () => {
		const { getByTestId } = renderComponent();

		expect(getByTestId('ndv-masked-value')).toHaveTextContent(maskedLabel);
		expect(getByTestId('ndv-masked-value')).not.toHaveTextContent('Masked');
	});
});
