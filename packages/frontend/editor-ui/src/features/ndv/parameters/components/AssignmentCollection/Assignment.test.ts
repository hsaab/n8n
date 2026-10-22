import { defaultSettings } from '@/__tests__/defaults';
import { createTestNode } from '@/__tests__/mocks';
import { createComponentRenderer, type RenderOptions } from '@/__tests__/render';
import { getTooltip, hoverTooltipTrigger } from '@/__tests__/utils';
import * as workflowHelpers from '@/app/composables/useWorkflowHelpers';
import { SET_NODE_TYPE } from '@/app/constants';
import { STORES } from '@n8n/stores';
import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { cleanup, screen, waitFor, within } from '@testing-library/vue';
import merge from 'lodash/merge';
import Assignment from './Assignment.vue';
import { flushPromises } from '@vue/test-utils';

vi.mock('vue-router');

const DEFAULT_SETUP: RenderOptions<typeof Assignment> = {
	pinia: createTestingPinia({
		initialState: { [STORES.SETTINGS]: { settings: merge({}, defaultSettings) } },
	}),
	props: {
		path: 'parameters.fields.0',
		modelValue: {
			id: '1',
			name: '',
			type: 'string',
			value: '',
		},
		issues: [],
	},
};

const renderComponent = createComponentRenderer(Assignment, DEFAULT_SETUP);

describe('Assignment.vue', () => {
	beforeEach(cleanup);

	afterEach(async () => {
		vi.clearAllMocks();
		await flushPromises();
	});

	it('can edit name, type and value', async () => {
		const { getByTestId, emitted } = renderComponent();

		const nameField = getByTestId('assignment-name').querySelector('input') as HTMLInputElement;
		const valueField = getByTestId('assignment-value').querySelector('input') as HTMLInputElement;

		expect(getByTestId('assignment')).toBeInTheDocument();
		expect(getByTestId('assignment-name')).toBeInTheDocument();
		expect(getByTestId('assignment-value')).toBeInTheDocument();
		expect(getByTestId('assignment-type-select')).toBeInTheDocument();

		await userEvent.type(nameField, 'New name');
		await userEvent.type(valueField, 'New value');

		const typeSelect = getByTestId('assignment-type-select');
		await userEvent.click(within(typeSelect).getByRole('button'));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Array' }));

		await waitFor(() =>
			expect(emitted('update:model-value')[0]).toEqual([
				{ id: '1', name: 'New name', type: 'array', value: 'New value' },
			]),
		);
	});

	it('can remove itself', async () => {
		const { getByTestId, emitted } = renderComponent();

		await userEvent.click(getByTestId('assignment-remove'));

		expect(emitted('remove')).toEqual([[]]);
	});

	it('should not display parameter input hint if expressionOutput is not set', () => {
		const { getByTestId } = renderComponent();

		// Check if the parameter input hint is not displayed
		expect(() => getByTestId('parameter-input-hint')).toThrow();
	});

	it('should show binary data tooltip when assignment type is binary', async () => {
		const { getByTestId } = renderComponent({
			props: {
				...DEFAULT_SETUP.props,
				modelValue: {
					id: '1',
					name: 'binaryField',
					type: 'binary',
					value: 'data',
				},
			},
		});

		const typeSelect = getByTestId('assignment-type-select');
		expect(typeSelect).toBeInTheDocument();

		// Hover and verify tooltip shows binary data access help
		await hoverTooltipTrigger(typeSelect);
		await waitFor(() =>
			expect(getTooltip()).toHaveTextContent('Specify the property name of the binary data'),
		);
	});

	it('should not auto-change type when disableType is true', async () => {
		const spy = vi.spyOn(workflowHelpers, 'resolveParameter').mockResolvedValue(42);

		const { emitted } = renderComponent({
			props: {
				...DEFAULT_SETUP.props,
				disableType: true,
			},
			global: {
				stubs: {
					ParameterInputFull: {
						setup(_props, { emit }) {
							emit('drop', '={{ 42 }}');
							emit('blur');
						},
						template: '<div></div>',
					},
				},
			},
		});

		const events = emitted('update:model-value');
		const lastEvent = events.at(-1);
		expect(lastEvent).not.toContainEqual(expect.objectContaining({ type: 'number' }));

		spy.mockRestore();
	});

	it('should auto-change type when dropping a value', async () => {
		const spy = vi.spyOn(workflowHelpers, 'resolveParameter').mockResolvedValue(42);

		const { emitted } = renderComponent({
			props: {
				...DEFAULT_SETUP.props,
				disableType: false,
			},
			global: {
				stubs: {
					ParameterInputFull: {
						setup(_props, { emit }) {
							emit('drop', '={{ 42 }}');
							emit('blur');
						},
						template: '<div></div>',
					},
				},
			},
		});

		// Wait for async type inference to complete
		await waitFor(() => {
			const events = emitted('update:model-value');
			const lastEvent = events.at(-1);
			expect(lastEvent).toContainEqual(expect.objectContaining({ type: 'number' }));
		});

		spy.mockRestore();
	});

	describe('Edit Fields with Mask Sensitive Fields', () => {
		const maskingEditFieldsNode = createTestNode({
			name: 'Edit Fields',
			type: SET_NODE_TYPE,
			typeVersion: 3.5,
			parameters: { options: { maskSensitiveFields: true } },
		});

		const getValueContainer = () => screen.getByTestId('assignment-value');
		const getValueInput = () => getValueContainer().querySelector('input');

		it('should hide the value when a dot segment of the name is masked', async () => {
			renderComponent({
				props: {
					node: maskingEditFieldsNode,
					modelValue: { id: '1', name: 'creds.token', type: 'string', value: 'demo-token-123' },
				},
			});

			expect(getValueInput()).toHaveAttribute('type', 'password');
			await waitFor(() => expect(getValueInput()).toHaveValue('demo-token-123'));
		});

		it('should match the field name case-insensitively', () => {
			renderComponent({
				props: {
					node: maskingEditFieldsNode,
					modelValue: { id: '1', name: 'Password', type: 'string', value: 'demo-password-123' },
				},
			});

			expect(getValueInput()).toHaveAttribute('type', 'password');
		});

		it('should hide the value once a masked name is typed', async () => {
			renderComponent({
				props: {
					node: maskingEditFieldsNode,
					modelValue: { id: '1', name: '', type: 'string', value: '' },
				},
			});

			expect(getValueInput()).toHaveAttribute('type', 'text');

			const nameField = screen.getByTestId('assignment-name').querySelector('input');
			await userEvent.type(nameField as HTMLInputElement, 'password');

			await waitFor(() => expect(getValueInput()).toHaveAttribute('type', 'password'));
		});

		it('should keep expression values in the expression input', async () => {
			renderComponent({
				props: {
					node: maskingEditFieldsNode,
					modelValue: {
						id: '1',
						name: 'password',
						type: 'string',
						value: '={{ $json.password }}',
					},
				},
			});

			await waitFor(() =>
				expect(
					within(getValueContainer()).getByTestId('inline-expression-editor-input'),
				).toHaveTextContent('{{ $json.password }}'),
			);
			expect(getValueContainer().querySelector('input[type="password"]')).toBeNull();
		});

		it('should keep number values visible', async () => {
			renderComponent({
				props: {
					node: maskingEditFieldsNode,
					modelValue: { id: '1', name: 'token', type: 'number', value: 42 },
				},
			});

			await waitFor(() => expect(getValueInput()).toHaveValue(42));
			expect(getValueInput()).toHaveAttribute('type', 'number');
		});

		it('should show the value without a node', async () => {
			renderComponent({
				props: {
					modelValue: { id: '1', name: 'password', type: 'string', value: 'demo-password-123' },
				},
			});

			await waitFor(() => expect(getValueInput()).toHaveValue('demo-password-123'));
			expect(getValueInput()).toHaveAttribute('type', 'text');
		});
	});
});
