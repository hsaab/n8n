import { createTestingPinia } from '@pinia/testing';
import { screen, cleanup } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import RunDataJson from '@/features/ndv/runData/components/RunDataJson.vue';
import { createComponentRenderer } from '@/__tests__/render';
import { SET_NODE_TYPE } from '@/app/constants';
import type { INodeUi } from '@/Interface';
import { useElementSize } from '@vueuse/core'; // Import the composable to mock

vi.mock('@vueuse/core', async () => {
	const originalModule = await vi.importActual('@vueuse/core');

	return {
		...originalModule, // Keep all original exports
		useElementSize: vi.fn(), // Mock useElementSize
	};
});

(useElementSize as jest.Mock).mockReturnValue({
	height: 500, // Mocked height value
	width: 300, // Mocked width value
});

const renderComponent = createComponentRenderer(RunDataJson, {
	props: {
		mappingEnabled: true,
		editMode: { enabled: false },
		inputData: [
			{
				json: {
					list: [1, 2, 3],
					record: { name: 'Joe' },
					myNumber: 123,
					myStringNumber: '456',
					myStringText: 'abc',
					nil: null,
					d: undefined,
				},
			},
		],
		node: {
			parameters: {
				keepOnlySet: false,
				values: {},
				options: {},
			},
			id: '820ea733-d8a6-4379-8e73-88a2347ea003',
			name: 'Set',
			type: 'n8n-nodes-base.set',
			typeVersion: 1,
			position: [380, 1060],
			disabled: false,
		},
	},
});

describe('RunDataJson.vue', () => {
	beforeEach(cleanup);

	it('renders json values properly', async () => {
		const { container } = renderComponent({
			global: {
				plugins: [createTestingPinia()],
			},
		});
		// Resolve the defineAsyncComponent import to prevent EnvironmentTeardownError
		await flushPromises();

		expect(container).toMatchSnapshot();

		expect(screen.getByText('123')).toBeInTheDocument();
		expect(screen.getByText('"456"')).toBeInTheDocument();
		expect(screen.getByText('"abc"')).toBeInTheDocument();
		expect(screen.getByText('null')).toBeInTheDocument();
		expect(screen.queryByText('undefined')).not.toBeInTheDocument();
	});

	it('shows a "Masked" marker on the same line as a masked value', async () => {
		const maskedSetNode: INodeUi = {
			parameters: { options: { maskSensitiveFields: true } },
			id: '5d2b7e1a-0c4f-4b8e-9a61-2f3c8d9e7b10',
			name: 'Edit Fields',
			type: SET_NODE_TYPE,
			typeVersion: 3.5,
			position: [380, 1060],
			disabled: false,
		};

		renderComponent({
			props: {
				node: maskedSetNode,
				inputData: [{ json: { password: '***' } }],
			},
			global: {
				plugins: [createTestingPinia()],
			},
		});
		await flushPromises();

		const maskedLine = screen.getByText('"***"').closest<HTMLElement>('.vjs-tree-node');
		const marker = screen.getByTestId('ndv-masked-value');
		expect(maskedLine).toContainElement(marker);
		expect(marker).toHaveTextContent('Masked');
	});
});
