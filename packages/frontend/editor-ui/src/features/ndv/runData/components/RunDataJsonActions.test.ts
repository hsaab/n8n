import { reactive, computed } from 'vue';
import { mock } from 'vitest-mock-extended';
import { createPinia, setActivePinia } from 'pinia';
import { WorkflowIdKey } from '@/app/constants/injectionKeys';
import { waitFor, cleanup, fireEvent, within, screen } from '@testing-library/vue';

import RunDataJsonActions from './RunDataJsonActions.vue';
import { nonExistingJsonPath, VIEWS } from '@/app/constants';
import type { IWorkflowDb } from '@/Interface';
import { useNDVStore } from '@/features/ndv/shared/ndv.store';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import {
	useWorkflowDocumentStore,
	createWorkflowDocumentId,
} from '@/app/stores/workflowDocument.store';
import { usePinnedData } from '@/app/composables/usePinnedData';

import { createComponentRenderer } from '@/__tests__/render';
import { setupServer } from '@/__tests__/server';
import { defaultNodeDescriptions, mockNodes } from '@/__tests__/mocks';
import { useI18n } from '@n8n/i18n';
import { createRunExecutionData, type INodeExecutionData } from 'n8n-workflow';

vi.mock('vue-router', () => {
	return {
		useRouter: () => ({}),
		useRoute: () => reactive({ meta: {} }),
		RouterLink: vi.fn(),
	};
});

const copy = vi.fn();
vi.mock('@/app/composables/useClipboard', () => ({
	useClipboard: () => ({
		copy,
	}),
}));

vi.mock('@/app/composables/usePinnedData', async (importOriginal) => {
	const actual = await importOriginal<{ usePinnedData: typeof usePinnedData }>();
	return { ...actual, usePinnedData: vi.fn(actual.usePinnedData) };
});

const i18n = useI18n();

async function createPiniaWithActiveNode(
	secondRunItems: INodeExecutionData[] = [{ json: { id: 3, name: 'Second run 1' } }],
) {
	const node = mockNodes[0];
	const workflow = mock<IWorkflowDb>({
		id: '1',
		name: 'Test Workflow',
		versionId: '1',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		active: true,
		connections: {},
		nodes: [node],
	});

	const pinia = createPinia();
	setActivePinia(pinia);

	const workflowsStore = useWorkflowsStore();
	const nodeTypesStore = useNodeTypesStore();
	const ndvStore = useNDVStore();

	nodeTypesStore.setNodeTypes(defaultNodeDescriptions);
	workflowsStore.setWorkflowId(workflow.id);
	const workflowDocumentStore = useWorkflowDocumentStore(createWorkflowDocumentId(workflow.id));
	workflowDocumentStore.addNode(node);
	workflowDocumentStore.initPristineNodeMetadata(node.name);
	workflowsStore.setWorkflowExecutionData({
		id: '1',
		finished: true,
		mode: 'trigger',
		status: 'success',
		createdAt: new Date(),
		startedAt: new Date(),
		workflowData: workflow,
		data: createRunExecutionData({
			resultData: {
				runData: {
					[node.name]: [
						{
							startTime: Date.now(),
							executionIndex: 0,
							executionTime: 1,
							data: {
								main: [
									[
										{
											json: {
												id: 1,
												name: 'First run 1',
											},
										},
										{
											json: {
												id: 2,
												name: 'First run 2',
											},
										},
									],
								],
							},
							source: [null],
						},
						{
							startTime: Date.now(),
							executionIndex: 1,
							executionTime: 1,
							data: {
								main: [secondRunItems],
							},
							source: [null],
						},
					],
				},
			},
		}),
	});

	ndvStore.setActiveNodeName(node.name, 'other');

	return {
		pinia,
		activeNode: ndvStore.activeNode,
	};
}

describe('RunDataJsonActions', () => {
	let server: ReturnType<typeof setupServer>;

	beforeEach(cleanup);

	beforeAll(() => {
		server = setupServer();
	});

	afterEach(() => {
		copy.mockReset();
		vi.clearAllMocks();
	});

	afterAll(() => {
		server.shutdown();
	});

	it('should copy unselected JSON output from latest run on click', async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'output',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: nonExistingJsonPath,
				jsonData: [
					{
						id: 3,
						name: 'Second run 1',
					},
				],
				outputIndex: 0,
				runIndex: 1,
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		const { getByTestId } = renderComponent({
			pinia,
		});

		await waitFor(() => expect(getByTestId('ndv-json-actions')).toBeInTheDocument());

		const button = within(getByTestId('ndv-json-actions')).getByRole('button');

		await fireEvent.click(button);

		expect(copy).toHaveBeenCalledWith(
			JSON.stringify(
				[
					{
						id: 3,
						name: 'Second run 1',
					},
				],
				null,
				2,
			),
		);
	});

	it('should copy unselected JSON output from selected previous run on click', async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'output',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: nonExistingJsonPath,
				jsonData: [
					{
						id: 3,
						name: 'Second run 1',
					},
				],
				outputIndex: 0,
				runIndex: 0,
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		const { getByTestId } = renderComponent({
			pinia,
		});

		await waitFor(() => expect(getByTestId('ndv-json-actions')).toBeInTheDocument());

		const button = within(getByTestId('ndv-json-actions')).getByRole('button');

		await fireEvent.click(button);

		expect(copy).toHaveBeenCalledWith(
			JSON.stringify(
				[
					{
						id: 1,
						name: 'First run 1',
					},
					{
						id: 2,
						name: 'First run 2',
					},
				],
				null,
				2,
			),
		);
	});

	it("should copy selected JSON value on 'Copy Selection' click", async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'output',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: '[0].name',
				jsonData: [
					{
						id: 3,
						name: 'Second run 1',
					},
				],
				outputIndex: 0,
				runIndex: 1,
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		renderComponent({
			pinia,
		});

		await waitFor(() =>
			expect(screen.getByText(i18n.baseText('runData.copyValue'))).toBeInTheDocument(),
		);

		const option = screen.getByText(i18n.baseText('runData.copyValue'));

		await fireEvent.click(option);

		expect(copy).toHaveBeenCalledWith('Second run 1');
	});

	it("should copy selected JSON value's item path on 'Copy Item Path' click", async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'output',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: '[0].name',
				jsonData: [
					{
						id: 3,
						name: 'Second run 1',
					},
				],
				outputIndex: 0,
				runIndex: 1,
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		renderComponent({
			pinia,
		});

		await waitFor(() =>
			expect(screen.getByText(i18n.baseText('runData.copyItemPath'))).toBeInTheDocument(),
		);

		const option = screen.getByText(i18n.baseText('runData.copyItemPath'));

		await fireEvent.click(option);

		expect(copy).toHaveBeenCalledWith('{{ $item("0").$node["Manual Trigger"].json["name"] }}');
	});

	it("should copy selected JSON value's parameter path on 'Copy Parameter Path' click", async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'output',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: '[0].name',
				jsonData: [
					{
						id: 3,
						name: 'Second run 1',
					},
				],
				outputIndex: 0,
				runIndex: 1,
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		renderComponent({
			pinia,
		});

		await waitFor(() =>
			expect(screen.getByText(i18n.baseText('runData.copyParameterPath'))).toBeInTheDocument(),
		);

		const option = screen.getByText(i18n.baseText('runData.copyParameterPath'));

		await fireEvent.click(option);

		expect(copy).toHaveBeenCalledWith('{{ $node["Manual Trigger"].json["name"] }}');
	});

	it('should mask pinned items when copying with nothing selected', async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		useWorkflowDocumentStore(createWorkflowDocumentId('1')).pinNodeData(mockNodes[0].name, [
			{ json: { id: 9, name: 'Pinned', password: 'pinned-secret' } },
		]);
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'input',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: nonExistingJsonPath,
				jsonData: [
					{
						id: 9,
						name: 'Pinned',
						password: '***',
					},
				],
				outputIndex: 0,
				runIndex: 1,
				displayMaskedFieldNames: new Set(['password', 'token']),
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		const { getByTestId } = renderComponent({
			pinia,
		});

		await waitFor(() => expect(getByTestId('ndv-json-actions')).toBeInTheDocument());

		const button = within(getByTestId('ndv-json-actions')).getByRole('button');

		await fireEvent.click(button);

		expect(copy).toHaveBeenCalledWith(
			JSON.stringify(
				[
					{
						id: 9,
						name: 'Pinned',
						password: '***',
					},
				],
				null,
				2,
			),
		);
	});

	it('should mask a single pinned object when copying with nothing selected', async () => {
		const { pinia, activeNode } = await createPiniaWithActiveNode();
		const singleObject = { id: 1, password: 'pinned-secret', token: 'pinned-token' };
		vi.mocked(usePinnedData).mockReturnValueOnce({
			hasData: computed(() => true),
			data: computed(() => singleObject),
		} as unknown as ReturnType<typeof usePinnedData>);
		const renderComponent = createComponentRenderer(RunDataJsonActions, {
			props: {
				node: activeNode ?? undefined,
				paneType: 'input',
				pushRef: 'ref',
				distanceFromActive: 0,
				selectedJsonPath: nonExistingJsonPath,
				jsonData: [
					{
						id: 1,
						password: '***',
						token: '***',
					},
				],
				outputIndex: 0,
				runIndex: 1,
				displayMaskedFieldNames: new Set(['password', 'token']),
			},
			global: {
				provide: {
					[WorkflowIdKey as unknown as string]: computed(() => '1'),
				},
				mocks: {
					$route: {
						name: VIEWS.WORKFLOW,
					},
				},
			},
		});

		const { getByTestId } = renderComponent({
			pinia,
		});

		await waitFor(() => expect(getByTestId('ndv-json-actions')).toBeInTheDocument());

		const button = within(getByTestId('ndv-json-actions')).getByRole('button');

		await fireEvent.click(button);

		expect(copy).toHaveBeenCalledWith(
			JSON.stringify(
				{
					id: 1,
					password: '***',
					token: '***',
				},
				null,
				2,
			),
		);
	});

	it.each([
		['masked key', '[0].password', '***'],
		['nested object', '[0].creds', JSON.stringify({ token: '***' }, null, 2)],
		[
			'whole item',
			'[0]',
			JSON.stringify({ id: 3, username: 'ada', password: '***', creds: { token: '***' } }, null, 2),
		],
	])(
		'should copy the selected %s from the masked data on screen',
		async (_, selectedJsonPath, expected) => {
			const { pinia, activeNode } = await createPiniaWithActiveNode([
				{
					json: {
						id: 3,
						username: 'ada',
						password: 'demo-password-123',
						creds: { token: 'demo-token-456' },
					},
				},
			]);
			const renderComponent = createComponentRenderer(RunDataJsonActions, {
				props: {
					node: activeNode ?? undefined,
					paneType: 'input',
					pushRef: 'ref',
					distanceFromActive: 0,
					selectedJsonPath,
					jsonData: [{ id: 3, username: 'ada', password: '***', creds: { token: '***' } }],
					outputIndex: 0,
					runIndex: 1,
					displayMaskedFieldNames: new Set(['password', 'token']),
				},
				global: {
					provide: {
						[WorkflowIdKey as unknown as string]: computed(() => '1'),
					},
					mocks: {
						$route: {
							name: VIEWS.WORKFLOW,
						},
					},
				},
			});

			renderComponent({
				pinia,
			});

			await waitFor(() =>
				expect(screen.getByText(i18n.baseText('runData.copyValue'))).toBeInTheDocument(),
			);

			await fireEvent.click(screen.getByText(i18n.baseText('runData.copyValue')));

			expect(copy).toHaveBeenCalledWith(expected);
			expect(copy).not.toHaveBeenCalledWith(
				expect.stringMatching(/demo-password-123|demo-token-456/),
			);
		},
	);
});
