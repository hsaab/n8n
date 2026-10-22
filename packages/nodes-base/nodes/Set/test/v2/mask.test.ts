import get from 'lodash/get';
import { constructExecutionMetaData } from 'n8n-core';
import {
	deepCopy,
	type IDataObject,
	type IExecuteFunctions,
	type IGetNodeParameterOptions,
	type INode,
	type INodeExecutionData,
	type INodeTypeBaseDescription,
} from 'n8n-workflow';

import { SetV2 } from '../../v2/SetV2.node';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'Set',
	name: 'set',
	icon: 'node:edit-fields',
	iconColor: 'blue',
	group: ['input'],
	description: 'Add or edit fields on an input item and optionally remove other fields',
};

const createNode = (typeVersion: number, parameters: IDataObject): INode => ({
	id: '11',
	name: 'Set Node',
	type: 'n8n-nodes-base.set',
	typeVersion,
	position: [42, 42],
	parameters: parameters as INode['parameters'],
});

const createMockExecuteFunction = (
	items: INodeExecutionData[],
	nodeParameters: IDataObject,
	typeVersion: number,
	continueOnFail: boolean = false,
) => {
	const node = createNode(typeVersion, nodeParameters);
	const fakeExecuteFunction = {
		getInputData() {
			return items;
		},
		getNodeParameter(
			parameterName: string,
			_itemIndex: number,
			fallbackValue?: IDataObject,
			options?: IGetNodeParameterOptions,
		) {
			const parameter = options?.extractValue ? `${parameterName}.value` : parameterName;
			return get(nodeParameters, parameter, fallbackValue);
		},
		getNode() {
			return node;
		},
		getWorkflowSettings() {
			return {};
		},
		helpers: { constructExecutionMetaData },
		continueOnFail: () => continueOnFail,
	} as unknown as IExecuteFunctions;
	return fakeExecuteFunction;
};

const runSet = async (
	items: INodeExecutionData[],
	nodeParameters: IDataObject,
	typeVersion: number,
) => {
	const setNode = new SetV2(baseDescription);
	const fakeExecuteFunction = createMockExecuteFunction(items, nodeParameters, typeVersion);
	const [output] = await setNode.execute.call(fakeExecuteFunction);
	return output;
};

const sensitiveJson = (): IDataObject => ({
	password: 'hunter2',
	Password: 'Hunter',
	TOKEN: 'abc',
	accessToken: 'keep',
	note: 'hello',
	user: { token: 'nested' },
	rows: [{ token: 'in-array' }],
});

const createInputItem = (json: IDataObject = sensitiveJson()): INodeExecutionData => ({
	json,
	binary: {
		data: {
			data: 'content',
			mimeType: 'image/jpg',
		},
	},
	pairedItem: { item: 0 },
});

const manualParameters = (options: IDataObject): IDataObject => ({
	mode: 'manual',
	includeOtherFields: true,
	include: 'all',
	assignments: {
		assignments: [
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
				name: 'extra',
				value: 'added',
				type: 'string',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
				name: 'token',
				value: 'fresh',
				type: 'string',
			},
		],
	},
	options,
});

const rawParameters = (options: IDataObject): IDataObject => ({
	mode: 'raw',
	includeOtherFields: false,
	jsonOutput: JSON.stringify({ ...sensitiveJson(), extra: 'added' }),
	options,
});

describe('Edit Fields (Set) v2, mask sensitive fields', () => {
	afterEach(() => jest.resetAllMocks());

	describe('user leaves the masking option off', () => {
		it('manual mode keeps the password and the nested token as they are', async () => {
			const output = await runSet([createInputItem()], manualParameters({}), 3.5);

			expect(output).toHaveLength(1);
			expect(output[0].json).toEqual({
				...sensitiveJson(),
				extra: 'added',
				token: 'fresh',
			});
		});

		it('JSON mode keeps the password and the nested token as they are', async () => {
			const output = await runSet([createInputItem()], rawParameters({}), 3.5);

			expect(output).toHaveLength(1);
			expect(output[0].json).toEqual({ ...sensitiveJson(), extra: 'added' });
		});
	});

	describe('user turns masking on and keeps the defaults', () => {
		const expectedMaskedJson = {
			password: '***',
			Password: '***',
			TOKEN: '***',
			accessToken: 'keep',
			note: 'hello',
			user: { token: '***' },
			rows: [{ token: '***' }],
			extra: 'added',
		};

		it('manual mode replaces password and token at every level with *** and keeps accessToken', async () => {
			const output = await runSet(
				[createInputItem()],
				manualParameters({ maskSensitiveFields: true }),
				3.5,
			);

			expect(output).toHaveLength(1);
			expect(output[0].json).toEqual({ ...expectedMaskedJson, token: '***' });
		});

		it('JSON mode replaces password and token at every level with *** and keeps accessToken', async () => {
			const output = await runSet(
				[createInputItem()],
				rawParameters({ maskSensitiveFields: true }),
				3.5,
			);

			expect(output).toHaveLength(1);
			expect(output[0].json).toEqual(expectedMaskedJson);
		});

		it('masks every item when several items pass through the node', async () => {
			const items = [
				createInputItem({ password: 'first', note: 'one' }),
				createInputItem({ password: 'second', note: 'two' }),
			];

			const output = await runSet(items, manualParameters({ maskSensitiveFields: true }), 3.5);

			expect(output).toHaveLength(2);
			expect(output[0].json).toEqual({
				password: '***',
				note: 'one',
				extra: 'added',
				token: '***',
			});
			expect(output[1].json).toEqual({
				password: '***',
				note: 'two',
				extra: 'added',
				token: '***',
			});
		});
	});

	describe('user picks their own field list and mask text', () => {
		it('replaces apiKey and secret with [redacted] and leaves password alone', async () => {
			const input = createInputItem({
				apiKey: 'key-123',
				secret: 'shh',
				password: 'hunter2',
				vault: { Secret: 'nested-shh', apiKeyId: 'keep-id' },
			});

			const output = await runSet(
				[input],
				manualParameters({
					maskSensitiveFields: true,
					maskFields: 'apiKey, secret',
					maskValue: '[redacted]',
				}),
				3.5,
			);

			expect(output[0].json).toEqual({
				apiKey: '[redacted]',
				secret: '[redacted]',
				password: 'hunter2',
				vault: { Secret: '[redacted]', apiKeyId: 'keep-id' },
				extra: 'added',
				token: 'fresh',
			});
		});
	});

	describe('workflow still uses Set version 3.4', () => {
		it('turning the option on does not change the password', async () => {
			const output = await runSet(
				[createInputItem()],
				manualParameters({ maskSensitiveFields: true }),
				3.4,
			);

			expect(output[0].json).toEqual({
				...sensitiveJson(),
				extra: 'added',
				token: 'fresh',
			});
		});
	});

	describe('item JSON points back at itself', () => {
		it('manual mode masks password and token and keeps the loop', async () => {
			const json: IDataObject = {
				name: 'ada',
				password: 'hunter2',
				profile: { token: 'secret-token', note: 'ok' },
			};
			json.self = json;

			const input = createInputItem(json);
			const output = await runSet([input], manualParameters({ maskSensitiveFields: true }), 3.5);

			expect(output).toHaveLength(1);
			const masked = output[0].json;
			expect(masked.name).toBe('ada');
			expect(masked.password).toBe('***');
			expect(masked.extra).toBe('added');
			expect(masked.token).toBe('***');
			expect(masked.profile).toEqual({ token: '***', note: 'ok' });
			expect(masked.self).toBe(masked);
			expect(input.json).toBe(json);
			expect(input.json.password).toBe('hunter2');
			expect(input.json.self).toBe(json);
		});
	});

	describe('masking does not damage anything else on the item', () => {
		it('leaves the input item untouched and keeps the binary file on the output item', async () => {
			const input = createInputItem();
			const inputSnapshot = deepCopy(input.json);
			const binarySnapshot = deepCopy(input.binary);

			const output = await runSet([input], manualParameters({ maskSensitiveFields: true }), 3.5);

			expect(output[0].json.password).toBe('***');
			expect(output[0].json.user).toEqual({ token: '***' });
			expect(input.json).toEqual(inputSnapshot);
			expect(output[0].binary).toEqual(binarySnapshot);
		});
	});

	describe('node description', () => {
		it('offers the masking option on version 3.5', () => {
			const setNode = new SetV2(baseDescription);
			const versions = setNode.description.version;

			expect(Array.isArray(versions) ? versions : [versions]).toContain(3.5);

			const optionsCollection = setNode.description.properties.find(
				(property) => property.name === 'options',
			);
			const optionNames = (optionsCollection?.options ?? []).map((option) => option.name);

			expect(optionNames).toEqual(
				expect.arrayContaining(['maskSensitiveFields', 'maskFields', 'maskValue']),
			);
		});
	});
});
