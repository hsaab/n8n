import { createTestNode, createTestWorkflow, mockNodeTypeDescription } from '@/__tests__/mocks';
import { createComponentRenderer } from '@/__tests__/render';
import InputPanel, { type Props } from './InputPanel.vue';
import { createTestingPinia } from '@pinia/testing';
import { waitFor } from '@testing-library/vue';
import {
	createRunExecutionData,
	NodeConnectionTypes,
	type IConnections,
	type IDataObject,
	type INode,
	type INodeExecutionData,
	type INodeTypeDescription,
	type IRunData,
} from 'n8n-workflow';
import { setActivePinia } from 'pinia';
import { computed, ref, shallowRef, type Component } from 'vue';
import { useElementSize } from '@vueuse/core';
import type { IRunDataDisplayMode } from '@/Interface';
import { CODE_NODE_TYPE, SET_NODE_TYPE } from '@/app/constants';
import { WorkflowIdKey } from '@/app/constants/injectionKeys';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';

import { useWorkflowState } from '@/app/composables/useWorkflowState';
import {
	injectWorkflowDocumentStore,
	useWorkflowDocumentStore,
	createWorkflowDocumentId,
} from '@/app/stores/workflowDocument.store';

vi.mock('@/app/stores/workflowDocument.store', async () => {
	const actual = await vi.importActual('@/app/stores/workflowDocument.store');
	return { ...actual, injectWorkflowDocumentStore: vi.fn() };
});

vi.mock('vue-router', () => {
	return {
		useRouter: () => ({}),
		useRoute: () => ({ meta: {} }),
		RouterLink: vi.fn(),
	};
});

vi.mock('@vueuse/core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@vueuse/core')>();
	return { ...actual, useElementSize: vi.fn(actual.useElementSize) };
});

const nodes = [
	createTestNode({ id: 'node1', name: 'Node 1' }),
	createTestNode({ id: 'node2', name: 'Node 2' }),
	createTestNode({ name: 'Agent' }),
	createTestNode({ name: 'Tool' }),
];

const render = (
	props: Partial<Props> = {},
	pinData?: INodeExecutionData[],
	runData?: IRunData,
	{
		workflowNodes = nodes,
		nodeTypes = [],
		stubs = {},
	}: {
		workflowNodes?: INode[];
		nodeTypes?: INodeTypeDescription[];
		stubs?: Record<string, Component>;
	} = {},
) => {
	const connections: IConnections = {
		[nodes[0].name]: {
			[NodeConnectionTypes.Main]: [
				[{ node: nodes[1].name, type: NodeConnectionTypes.Main, index: 0 }],
			],
		},
		[nodes[1].name]: {
			[NodeConnectionTypes.Main]: [
				[{ node: nodes[2].name, type: NodeConnectionTypes.Main, index: 0 }],
			],
		},
		[nodes[3].name]: {
			[NodeConnectionTypes.AiMemory]: [
				[{ node: nodes[2].name, type: NodeConnectionTypes.AiMemory, index: 0 }],
			],
		},
	};

	const pinia = createTestingPinia({
		stubActions: false,
	});
	setActivePinia(pinia);

	if (nodeTypes.length > 0) {
		useNodeTypesStore().setNodeTypes(nodeTypes);
	}

	const workflow = createTestWorkflow({ nodes: workflowNodes, connections });
	const workflowState = useWorkflowState();

	const workflowDocumentStore = useWorkflowDocumentStore(createWorkflowDocumentId(workflow.id));
	workflowDocumentStore.hydrate(workflow);

	vi.mocked(injectWorkflowDocumentStore).mockReturnValue(shallowRef(workflowDocumentStore));

	if (pinData) {
		workflowDocumentStore.setPinData(
			Object.fromEntries(workflowNodes.map((n) => [n.name, pinData])),
		);
	}

	if (runData) {
		workflowState.setWorkflowExecutionData({
			id: '',
			workflowData: {
				id: '',
				name: '',
				active: false,
				activeVersionId: null,
				isArchived: false,
				createdAt: '',
				updatedAt: '',
				nodes: workflowNodes,
				connections,
				versionId: '',
			},
			finished: false,
			mode: 'trigger',
			status: 'success',
			startedAt: new Date(),
			createdAt: new Date(),
			data: createRunExecutionData({
				resultData: { runData },
			}),
		});
	}

	return createComponentRenderer(InputPanel, {
		props: {
			pushRef: 'pushRef',
			runIndex: 0,
			currentNodeName: nodes[0].name,
			activeNodeName: nodes[1].name,
			displayMode: 'schema',
			focusedMappableInput: '',
			isMappingOnboarded: false,
		},
		global: {
			provide: {
				[WorkflowIdKey as unknown as string]: computed(() => workflow.id),
			},
			stubs: {
				InputPanelPinButton: { template: '<button data-test-id="ndv-pin-data"></button>' },
				...stubs,
			},
		},
	})({ props });
};

describe('InputPanel', () => {
	it('should render', async () => {
		const { container, queryByTestId } = render({}, [{ json: { name: 'Test' } }]);

		await waitFor(() => expect(queryByTestId('ndv-data-size-warning')).not.toBeInTheDocument());
		expect(container).toMatchSnapshot();
	});

	it("opens mapping tab by default if the node hasn't run yet", async () => {
		const { findByTestId } = render({ activeNodeName: 'Tool' });

		expect((await findByTestId('radio-button-mapping')).parentNode).toBeChecked();
		expect((await findByTestId('radio-button-debugging')).parentNode).not.toBeChecked();
	});

	it('opens debugging tab by default if the node has already run', async () => {
		const { findByTestId } = render({ activeNodeName: 'Tool' }, undefined, {
			Tool: [
				{
					startTime: 0,
					executionTime: 0,
					executionIndex: 0,
					source: [],
					data: {},
				},
			],
		});

		expect((await findByTestId('radio-button-mapping')).parentNode).not.toBeChecked();
		expect((await findByTestId('radio-button-debugging')).parentNode).toBeChecked();
	});

	describe('sensitive fields from the previous node', () => {
		const upstreamRunDataWith = (json: IDataObject): IRunData => ({
			[nodes[0].name]: [
				{
					startTime: 0,
					executionTime: 0,
					executionIndex: 0,
					source: [],
					data: { main: [[{ json }]] },
				},
			],
		});

		const upstreamRunData = upstreamRunDataWith({
			username: 'ada',
			password: 'demo-password-123',
			token: 'demo-token-456',
			creds: { token: 'demo-token-789' },
		});

		const editFieldsNode = (options: Record<string, boolean>) =>
			createTestNode({
				id: 'node2',
				name: nodes[1].name,
				type: SET_NODE_TYPE,
				typeVersion: 3.5,
				parameters: { options },
			});

		const DynamicScrollerStub = {
			props: {
				items: Array,
			},
			template:
				'<div><template v-for="item in items"><slot v-bind="{ item }"></slot></template></div>',
			methods: {
				scrollToItem: vi.fn(),
			},
		};

		const DynamicScrollerItemStub = {
			template: '<slot></slot>',
		};

		beforeEach(() => {
			// jsdom measures every element as 0px tall, and the virtualized JSON view only renders
			// the rows that fit its measured height.
			vi.mocked(useElementSize).mockReturnValue({
				width: ref(300),
				height: ref(500),
				stop: vi.fn(),
			});
		});

		afterEach(() => {
			vi.mocked(useElementSize).mockReset();
		});

		const renderWithActiveNode = (
			activeNode: INode,
			{
				displayMode = 'table',
				upstreamNode,
				runData = upstreamRunData,
			}: { displayMode?: IRunDataDisplayMode; upstreamNode?: INode; runData?: IRunData } = {},
		) =>
			render({ displayMode }, undefined, runData, {
				workflowNodes: nodes.map(
					(node) =>
						[activeNode, upstreamNode].find((override) => override?.name === node.name) ?? node,
				),
				nodeTypes: [
					mockNodeTypeDescription({ name: SET_NODE_TYPE, version: [1, 3.5] }),
					mockNodeTypeDescription({ name: CODE_NODE_TYPE }),
				],
				stubs: {
					DynamicScroller: DynamicScrollerStub,
					DynamicScrollerItem: DynamicScrollerItemStub,
				},
			});

		const shownAs = (displayMode: IRunDataDisplayMode, value: string) =>
			displayMode === 'json' ? `"${value}"` : value;

		it('should mask sensitive upstream fields when the active Edit Fields node masks them', async () => {
			const { findByText, queryByText, getAllByTestId, getAllByText } = renderWithActiveNode(
				editFieldsNode({ maskSensitiveFields: true }),
			);

			expect(await findByText('ada')).toBeInTheDocument();
			expect(queryByText('demo-password-123')).not.toBeInTheDocument();
			expect(queryByText('demo-token-456')).not.toBeInTheDocument();
			expect(queryByText('demo-token-789')).not.toBeInTheDocument();
			expect(getAllByText('***')).toHaveLength(3);
			expect(getAllByTestId('ndv-masked-value')).toHaveLength(3);
		});

		it('should show upstream values when masking is off', async () => {
			const { findByText, getByText, queryByTestId } = renderWithActiveNode(
				editFieldsNode({ maskSensitiveFields: false }),
			);

			expect(await findByText('demo-password-123')).toBeInTheDocument();
			expect(getByText('demo-token-456')).toBeInTheDocument();
			expect(queryByTestId('ndv-masked-value')).not.toBeInTheDocument();
		});

		it('should show upstream values when the active node is not Edit Fields', async () => {
			const { findByText, getByText, queryByTestId } = renderWithActiveNode(
				createTestNode({ id: 'node2', name: nodes[1].name, type: CODE_NODE_TYPE }),
			);

			expect(await findByText('demo-password-123')).toBeInTheDocument();
			expect(getByText('demo-token-456')).toBeInTheDocument();
			expect(queryByTestId('ndv-masked-value')).not.toBeInTheDocument();
		});

		it.each<IRunDataDisplayMode>(['json', 'schema'])(
			'should mask sensitive upstream fields in the %s view when the active Edit Fields node masks them',
			async (displayMode) => {
				const { findByText, queryByText, getAllByTestId, getAllByText } = renderWithActiveNode(
					editFieldsNode({ maskSensitiveFields: true }),
					{ displayMode },
				);

				expect(await findByText(shownAs(displayMode, 'ada'))).toBeInTheDocument();
				expect(queryByText(shownAs(displayMode, 'demo-password-123'))).not.toBeInTheDocument();
				expect(queryByText(shownAs(displayMode, 'demo-token-456'))).not.toBeInTheDocument();
				expect(queryByText(shownAs(displayMode, 'demo-token-789'))).not.toBeInTheDocument();
				expect(getAllByText(shownAs(displayMode, '***'))).toHaveLength(3);
				expect(getAllByTestId('ndv-masked-value')).toHaveLength(3);
			},
		);

		it.each<IRunDataDisplayMode>(['table', 'json', 'schema'])(
			'should mark values an upstream Edit Fields node masked in the %s view when the active node is not Edit Fields',
			async (displayMode) => {
				const { findByText, getByText, getAllByTestId } = renderWithActiveNode(
					createTestNode({ id: 'node2', name: nodes[1].name, type: CODE_NODE_TYPE }),
					{
						displayMode,
						upstreamNode: createTestNode({
							id: 'node1',
							name: nodes[0].name,
							type: SET_NODE_TYPE,
							typeVersion: 3.5,
							parameters: { options: { maskSensitiveFields: true } },
						}),
						runData: upstreamRunDataWith({ username: 'ada', password: '***' }),
					},
				);

				expect(await findByText(shownAs(displayMode, 'ada'))).toBeInTheDocument();
				expect(getByText(shownAs(displayMode, '***'))).toBeInTheDocument();
				expect(getAllByTestId('ndv-masked-value')).toHaveLength(1);
			},
		);

		it.each<IRunDataDisplayMode>(['table', 'schema'])(
			'should unmask a field in the %s view as soon as it is removed from Fields to Mask',
			async (displayMode) => {
				const { findByText, queryByText, getAllByTestId } = renderWithActiveNode(
					editFieldsNode({ maskSensitiveFields: true }),
					{ displayMode },
				);

				expect(await findByText(shownAs(displayMode, 'ada'))).toBeInTheDocument();
				expect(getAllByTestId('ndv-masked-value')).toHaveLength(3);

				injectWorkflowDocumentStore().value.setNodeParameters({
					name: nodes[1].name,
					value: { options: { maskSensitiveFields: true, fieldsToMask: 'password' } },
				});

				expect(await findByText(shownAs(displayMode, 'demo-token-456'))).toBeInTheDocument();
				expect(queryByText(shownAs(displayMode, 'demo-password-123'))).not.toBeInTheDocument();
				expect(getAllByTestId('ndv-masked-value')).toHaveLength(1);
			},
		);
	});
});
