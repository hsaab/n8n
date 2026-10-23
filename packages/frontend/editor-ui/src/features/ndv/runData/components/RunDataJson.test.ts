import { createTestingPinia } from '@pinia/testing';
import { screen, cleanup, within } from '@testing-library/vue';
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

const maskedSetNode: INodeUi = {
	parameters: { options: { maskSensitiveFields: true } },
	id: '5d2b7e1a-0c4f-4b8e-9a61-2f3c8d9e7b10',
	name: 'Edit Fields',
	type: SET_NODE_TYPE,
	typeVersion: 3.5,
	position: [380, 1060],
	disabled: false,
};

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

	it('marks listed keys inside an array of objects in any letter case', async () => {
		renderComponent({
			props: {
				node: maskedSetNode,
				inputData: [
					{
						json: {
							Password: '***',
							sessions: [
								{ id: 1, token: '***' },
								{ id: 2, token: '****' },
							],
						},
					},
				],
			},
			global: {
				plugins: [createTestingPinia()],
			},
		});
		await flushPromises();

		const markers = screen.getAllByTestId('ndv-masked-value');
		expect(markers).toHaveLength(2);

		const passwordLine = markers[0].closest('.vjs-tree-node');
		const tokenLine = markers[1].closest('.vjs-tree-node');
		expect(passwordLine).toHaveTextContent('"Password"');
		expect(passwordLine).toHaveTextContent('"***"');
		expect(tokenLine).toHaveTextContent('"token"');
		expect(tokenLine).toHaveTextContent('"***"');

		const userTokenLine = screen.getByText('"****"').closest<HTMLElement>('.vjs-tree-node');
		expect(
			within(userTokenLine as HTMLElement).queryByTestId('ndv-masked-value'),
		).not.toBeInTheDocument();
	});

	it('does not mark *** values when Mask Sensitive Fields is off', async () => {
		renderComponent({
			props: {
				node: { ...maskedSetNode, parameters: { options: { maskSensitiveFields: false } } },
				inputData: [{ json: { password: '***' } }],
			},
			global: {
				plugins: [createTestingPinia()],
			},
		});
		await flushPromises();

		expect(screen.getByText('"***"')).toBeInTheDocument();
		expect(screen.queryByTestId('ndv-masked-value')).not.toBeInTheDocument();
	});

	it('shows the "Masked" marker only for fields still listed in Fields to Mask', async () => {
		renderComponent({
			props: {
				node: {
					...maskedSetNode,
					parameters: { options: { maskSensitiveFields: true, fieldsToMask: 'password' } },
				},
				inputData: [{ json: { password: '***', token: '***', creds: { token: '***' } } }],
			},
			global: {
				plugins: [createTestingPinia()],
			},
		});
		await flushPromises();

		const markers = screen.getAllByTestId('ndv-masked-value');
		expect(markers).toHaveLength(1);
		expect(markers[0].closest('.vjs-tree-node')).toHaveTextContent('"password"');
	});

	it('should mark values masked for display', async () => {
		renderComponent({
			props: {
				displayMaskedFieldNames: new Set(['password', 'token']),
				inputData: [
					{ json: { username: 'ada', password: '***', apiKey: '***', creds: { token: '***' } } },
				],
			},
			global: {
				plugins: [createTestingPinia()],
			},
		});
		await flushPromises();

		const markers = screen.getAllByTestId('ndv-masked-value');
		expect(markers).toHaveLength(2);
		expect(markers[0].closest('.vjs-tree-node')).toHaveTextContent('"password"');
		expect(markers[1].closest('.vjs-tree-node')).toHaveTextContent('"token"');
	});
});
