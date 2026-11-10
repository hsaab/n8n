import get from 'lodash/get';
import {
	NodeHelpers,
	jsonParse,
	type IDataObject,
	type IExecuteFunctions,
	type IGetNodeParameterOptions,
	type INode,
	type INodeExecutionData,
	type INodeParameters,
	type INodeProperties,
	type INodeTypeBaseDescription,
} from 'n8n-workflow';

import { Set as SetNode } from '../../Set.node';
import { maskFields, parseFieldsToMask } from '../../v2/helpers/mask';
import { SetV2 } from '../../v2/SetV2.node';

const MASKED = '***';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'Set',
	name: 'set',
	icon: 'node:edit-fields',
	group: ['input'],
	description: 'Add or edit fields on an input item and optionally remove other fields',
};

type ExecuteSetup = {
	typeVersion: number;
	parameters: INodeParameters;
	items: INodeExecutionData[];
};

const createMockExecuteFunction = ({ typeVersion, parameters, items }: ExecuteSetup) => {
	const node: INode = {
		id: '11',
		name: 'Edit Fields',
		type: 'n8n-nodes-base.set',
		typeVersion,
		position: [42, 42],
		parameters,
	};

	const fakeExecuteFunction = {
		getInputData() {
			return items;
		},
		getNodeParameter(
			parameterName: string,
			_itemIndex: number,
			fallbackValue?: unknown,
			options?: IGetNodeParameterOptions,
		) {
			const parameter = options?.extractValue ? `${parameterName}.value` : parameterName;
			return get(parameters, parameter, fallbackValue);
		},
		getNode() {
			return node;
		},
		getMode() {
			return 'manual';
		},
		getWorkflowSettings() {
			return {};
		},
		continueOnFail: () => false,
	} as unknown as IExecuteFunctions;
	return fakeExecuteFunction;
};

const runSetNode = async (setup: ExecuteSetup) => {
	const [output] = await new SetV2(baseDescription).execute.call(createMockExecuteFunction(setup));
	return output;
};

const manualParameters = (
	options: INodeParameters,
	extra: INodeParameters = {},
): INodeParameters => ({
	mode: 'manual',
	assignments: { assignments: [] },
	includeOtherFields: true,
	include: 'all',
	options,
	...extra,
});

const createInputItems = (): INodeExecutionData[] => [
	{
		json: {
			name: 'Ada',
			password: 'hunter2',
			token: 'abc123',
			accessToken: 'keep-me',
			user: { password: 'nested-secret', profile: { Token: 'profile-token', city: 'London' } },
			sessions: [{ id: 1, token: 'session-token' }, 'legacy'],
		},
		binary: {
			file: { data: 'ZGF0YQ==', mimeType: 'text/plain', fileName: 'notes.txt' },
		},
		pairedItem: { item: 0 },
	},
];

describe('test Set2, mask sensitive fields', () => {
	describe('parseFieldsToMask', () => {
		it('should use the default list when fieldsToMask is undefined', () => {
			expect(parseFieldsToMask(undefined)).toEqual(new Set(['password', 'token']));
		});

		it('should trim, lowercase and drop empty entries', () => {
			expect(parseFieldsToMask(' apiKey , Secret ,')).toEqual(new Set(['apikey', 'secret']));
		});

		it('should return an empty list for an empty or whitespace-only string', () => {
			expect(parseFieldsToMask('')).toEqual(new Set());
			expect(parseFieldsToMask('   ')).toEqual(new Set());
			expect(parseFieldsToMask(' , ')).toEqual(new Set());
		});
	});

	describe('maskFields', () => {
		const defaultFields = new Set(['password', 'token']);

		it('should mask top-level password and token and keep other fields', () => {
			const input = { name: 'Ada', password: 'hunter2', token: 'abc123', age: 36 };

			expect(maskFields(input, defaultFields)).toEqual({
				name: 'Ada',
				password: MASKED,
				token: MASKED,
				age: 36,
			});
		});

		it('should mask matching keys in nested objects and in arrays of objects', () => {
			const input = {
				user: { name: 'Ada', password: 'p1', profile: { Token: 't1', city: 'London' } },
				sessions: [{ id: 1, token: 's1' }, { id: 2 }, 'legacy', 7],
				matrix: [[{ token: 'm1', id: 1 }], ['plain']],
			};

			expect(maskFields(input, defaultFields)).toEqual({
				user: { name: 'Ada', password: MASKED, profile: { Token: MASKED, city: 'London' } },
				sessions: [{ id: 1, token: MASKED }, { id: 2 }, 'legacy', 7],
				matrix: [[{ token: MASKED, id: 1 }], ['plain']],
			});
		});

		it('should replace the whole value whatever its type', () => {
			const input = {
				password: { hash: 'x', salt: 'y' },
				token: ['a', 'b'],
				secret: 42,
				pin: null,
				apikey: true,
				name: 'Ada',
			};

			expect(maskFields(input, new Set(['password', 'token', 'secret', 'pin', 'apikey']))).toEqual({
				password: MASKED,
				token: MASKED,
				secret: MASKED,
				pin: MASKED,
				apikey: MASKED,
				name: 'Ada',
			});
		});

		it('should match key names exactly and case-insensitively', () => {
			const input = {
				Token: 'a',
				TOKEN: 'b',
				accessToken: 'c',
				token_type: 'bearer',
				'user.password': 'd',
				user: { password: 'e' },
			};

			expect(maskFields(input, new Set(['token', 'user.password']))).toEqual({
				Token: MASKED,
				TOKEN: MASKED,
				accessToken: 'c',
				token_type: 'bearer',
				'user.password': MASKED,
				user: { password: 'e' },
			});
		});

		it('should not add keys that are not present', () => {
			const input = { name: 'Ada', token: 'abc123', user: { id: 1 } };

			expect(maskFields(input, defaultFields)).toStrictEqual({
				name: 'Ada',
				token: MASKED,
				user: { id: 1 },
			});
		});

		it('should not modify the input object', () => {
			const input = { password: 'p', user: { token: 't' }, sessions: [{ token: 's' }] };
			const before = structuredClone(input);

			const result = maskFields(input, defaultFields);

			expect(result).toEqual({
				password: MASKED,
				user: { token: MASKED },
				sessions: [{ token: MASKED }],
			});
			expect(input).toEqual(before);
		});

		it('should preserve all own keys including special names', () => {
			const input = jsonParse<IDataObject>('{"__proto__": {"password": "p"}, "x": 1}');

			const result = maskFields(input, defaultFields);

			expect(Object.keys(result)).toEqual(['__proto__', 'x']);
			expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toEqual({
				password: MASKED,
			});
			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
		});
	});

	describe('SetV2.execute', () => {
		it('should mask default fields on 3.5 when the option is on and no list is set', async () => {
			const items = createInputItems();

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({ maskSensitiveFields: true }),
				items,
			});

			expect(output).toHaveLength(1);
			expect(output[0].json).toEqual({
				name: 'Ada',
				password: MASKED,
				token: MASKED,
				accessToken: 'keep-me',
				user: { password: MASKED, profile: { Token: MASKED, city: 'London' } },
				sessions: [{ id: 1, token: MASKED }, 'legacy'],
			});
			expect(output[0].binary).toEqual(items[0].binary);
			expect(output[0].pairedItem).toEqual({ item: 0 });
		});

		it('should leave output unchanged on 3.5 when the option is off', async () => {
			const items = createInputItems();

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({ maskSensitiveFields: false, fieldsToMask: 'name' }),
				items,
			});

			expect(output[0].json).toEqual(createInputItems()[0].json);
		});

		it('should mask a custom list case-insensitively and leave other fields', async () => {
			const items: INodeExecutionData[] = [
				{
					json: { name: 'Ada', apiKey: 'k-1', SECRET: 's-1', password: 'hunter2' },
					pairedItem: { item: 0 },
				},
			];

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({ maskSensitiveFields: true, fieldsToMask: 'apiKey, Secret' }),
				items,
			});

			expect(output[0].json).toEqual({
				name: 'Ada',
				apiKey: MASKED,
				SECRET: MASKED,
				password: 'hunter2',
			});
		});

		it('should mask a field set in Fields to Set', async () => {
			const items: INodeExecutionData[] = [{ json: { name: 'Ada' }, pairedItem: { item: 0 } }];
			// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-type-options-password-missing
			const assignment = { id: '1', name: 'token', value: 'fresh', type: 'string' };

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters(
					{ maskSensitiveFields: true },
					{ assignments: { assignments: [assignment] } },
				),
				items,
			});

			expect(output[0].json).toEqual({ name: 'Ada', token: MASKED });
		});

		it('should leave output unchanged on 3.4 even when the option is set', async () => {
			const items = createInputItems();

			const output = await runSetNode({
				typeVersion: 3.4,
				parameters: manualParameters({ maskSensitiveFields: true, fieldsToMask: 'name, password' }),
				items,
			});

			expect(output[0].json).toEqual(createInputItems()[0].json);
		});

		it('should not modify input items when including selected fields', async () => {
			const items = createInputItems();

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters(
					{ maskSensitiveFields: true },
					{ include: 'selected', includeFields: 'user' },
				),
				items,
			});

			expect(output[0].json).toEqual({
				user: { password: MASKED, profile: { Token: MASKED, city: 'London' } },
			});
			expect(items[0].json).toEqual(createInputItems()[0].json);
		});

		it('should mask every duplicated item', async () => {
			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters(
					{ maskSensitiveFields: true },
					{ duplicateItem: true, duplicateCount: 2 },
				),
				items: createInputItems(),
			});

			expect(output).toHaveLength(3);
			for (const item of output) {
				expect(item.json.password).toBe(MASKED);
				expect(item.json.token).toBe(MASKED);
				expect(item.json.name).toBe('Ada');
			}
		});

		it.each(['', ' , '])('should mask nothing when Fields to Mask is %p', async (fieldsToMask) => {
			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({ maskSensitiveFields: true, fieldsToMask }),
				items: createInputItems(),
			});

			expect(output[0].json).toEqual(createInputItems()[0].json);
		});

		it('should trim and ignore case in a hand-typed Fields to Mask list', async () => {
			const items: INodeExecutionData[] = [
				{
					json: {
						Password: 'p-1',
						TOKEN: 't-1',
						accessToken: 'keep-me',
						settings: { apikey: 'k-1' },
					},
					pairedItem: { item: 0 },
				},
			];

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({
					maskSensitiveFields: true,
					fieldsToMask: '  PASSWORD ,token,, ApiKey  ',
				}),
				items,
			});

			expect(output[0].json).toEqual({
				Password: MASKED,
				TOKEN: MASKED,
				accessToken: 'keep-me',
				settings: { apikey: MASKED },
			});
		});

		it.each([[42], [null], [['apiKey']]])(
			'should fall back to the default list when Fields to Mask resolves to %p',
			async (fieldsToMask) => {
				const items: INodeExecutionData[] = [
					{
						json: { name: 'Ada', password: 'hunter2', token: 'abc123', apiKey: 'k-1' },
						pairedItem: { item: 0 },
					},
				];

				const output = await runSetNode({
					typeVersion: 3.5,
					parameters: manualParameters({ maskSensitiveFields: true, fieldsToMask }),
					items,
				});

				expect(output[0].json).toEqual({
					name: 'Ada',
					password: MASKED,
					token: MASKED,
					apiKey: 'k-1',
				});
			},
		);

		it('should mask listed Fields to Set values of every type', async () => {
			const items: INodeExecutionData[] = [{ json: { id: 1 }, pairedItem: { item: 0 } }];
			/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
			const assignments = [
				{ id: '1', name: 'pin', value: 1234, type: 'number' },
				{ id: '2', name: 'isAdmin', value: true, type: 'boolean' },
				{ id: '3', name: 'profile', value: '{"ssn":"x"}', type: 'object' },
				{ id: '4', name: 'roles', value: '["admin"]', type: 'array' },
				{ id: '5', name: 'name', value: 'Ada', type: 'string' },
			];
			/* eslint-enable n8n-nodes-base/node-param-display-name-miscased */

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters(
					{ maskSensitiveFields: true, fieldsToMask: 'pin, isAdmin, profile, roles' },
					{ assignments: { assignments } },
				),
				items,
			});

			expect(output[0].json).toEqual({
				id: 1,
				pin: MASKED,
				isAdmin: MASKED,
				profile: MASKED,
				roles: MASKED,
				name: 'Ada',
			});
		});

		it('should mask listed keys five levels deep inside arrays of objects', async () => {
			const items: INodeExecutionData[] = [
				{
					json: {
						org: {
							teams: [
								{ members: [{ profile: { auth: { token: 'member-token', id: 7 } } }, 'guest'] },
							],
						},
						matrix: [[{ password: 'matrix-secret' }]],
						apiToken: 'keep-me',
					},
					pairedItem: { item: 0 },
				},
			];
			const before = structuredClone(items[0].json);

			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({ maskSensitiveFields: true }),
				items,
			});

			expect(output[0].json).toEqual({
				org: {
					teams: [{ members: [{ profile: { auth: { token: MASKED, id: 7 } } }, 'guest'] }],
				},
				matrix: [[{ password: MASKED }]],
				apiToken: 'keep-me',
			});
			expect(items[0].json).toEqual(before);
		});

		it('should mask output built in JSON mode', async () => {
			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters(
					{ maskSensitiveFields: true },
					{
						mode: 'raw',
						jsonOutput: '{"apiKey":"k","nested":{"password":"p"}}',
						includeOtherFields: false,
					},
				),
				items: createInputItems(),
			});

			expect(output[0].json).toEqual({ apiKey: 'k', nested: { password: MASKED } });
		});

		it.each([3, 3.1, 3.2, 3.3])(
			'should leave output unchanged on version %p even when the option is set',
			async (typeVersion) => {
				const output = await runSetNode({
					typeVersion,
					parameters: manualParameters({
						maskSensitiveFields: true,
						fieldsToMask: 'password, token',
					}),
					items: createInputItems(),
				});

				expect(output[0].json.password).toBe('hunter2');
				expect(output[0].json.token).toBe('abc123');
				expect(JSON.stringify(output[0].json)).not.toContain(MASKED);
			},
		);

		it('should not treat a dotted Fields to Mask entry as a path', async () => {
			const output = await runSetNode({
				typeVersion: 3.5,
				parameters: manualParameters({ maskSensitiveFields: true, fieldsToMask: 'user.password' }),
				items: createInputItems(),
			});

			expect(output[0].json).toEqual(createInputItems()[0].json);
		});

		it.each([
			{ description: 'the list names it', fieldsToMask: 'creds.token', expected: MASKED },
			{ description: 'the default list is used', fieldsToMask: undefined, expected: 'tok-1' },
		])(
			'should match a dotted row name literally when dot notation is off and $description',
			async ({ fieldsToMask, expected }) => {
				const items: INodeExecutionData[] = [{ json: {}, pairedItem: { item: 0 } }];
				// eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
				const assignment = { id: '1', name: 'creds.token', value: 'tok-1', type: 'string' };

				const output = await runSetNode({
					typeVersion: 3.5,
					parameters: manualParameters(
						{ maskSensitiveFields: true, dotNotation: false, fieldsToMask },
						{ assignments: { assignments: [assignment] } },
					),
					items,
				});

				expect(output[0].json).toEqual({ 'creds.token': expected });
			},
		);
	});

	describe('description', () => {
		const getMaskOptions = () => {
			const { description } = new SetV2(baseDescription);
			const optionsCollection = description.properties.find(
				(property) => property.name === 'options' && property.type === 'collection',
			);
			const collectionOptions = (optionsCollection?.options ?? []) as INodeProperties[];
			return {
				description,
				maskSensitiveFields: collectionOptions.find(
					(option) => option.name === 'maskSensitiveFields',
				),
				fieldsToMask: collectionOptions.find((option) => option.name === 'fieldsToMask'),
			};
		};

		it('should default to version 3.5', () => {
			const setNode = new SetNode();

			expect(setNode.description.defaultVersion).toBe(3.5);
			expect(setNode.nodeVersions[3.5]).toBeInstanceOf(SetV2);
			expect(setNode.nodeVersions[3.5].description.version).toContain(3.5);
		});

		it('should expose maskSensitiveFields and fieldsToMask gated to 3.5', () => {
			const { maskSensitiveFields, fieldsToMask } = getMaskOptions();

			expect(maskSensitiveFields).toMatchObject({
				displayName: 'Mask Sensitive Fields',
				type: 'boolean',
				default: false,
			});
			expect(maskSensitiveFields?.displayOptions).toEqual({
				show: { '@version': [{ _cnd: { gte: 3.5 } }] },
			});
			expect(fieldsToMask).toMatchObject({
				displayName: 'Fields to Mask',
				type: 'string',
				default: 'password, token',
			});
			expect(fieldsToMask?.displayOptions).toEqual({
				show: { '@version': [{ _cnd: { gte: 3.5 } }], maskSensitiveFields: [true] },
			});
		});

		it('should show fieldsToMask only when masking is on for version 3.5 and up', () => {
			const { description, fieldsToMask } = getMaskOptions();
			expect(fieldsToMask).toBeDefined();

			const isShown = (typeVersion: number, maskSensitiveFields: boolean) => {
				const options = { maskSensitiveFields };
				return NodeHelpers.displayParameter(
					options,
					fieldsToMask as INodeProperties,
					{ typeVersion },
					description,
					{ mode: 'manual', includeOtherFields: true, options },
				);
			};

			expect(isShown(3.5, true)).toBe(true);
			expect(isShown(3.5, false)).toBe(false);
			expect(isShown(3.4, true)).toBe(false);
		});
	});
});
