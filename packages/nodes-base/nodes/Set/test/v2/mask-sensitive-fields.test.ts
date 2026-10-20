/* eslint-disable n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-type-options-password-missing */
import { mock } from 'jest-mock-extended';
import get from 'lodash/get';
import { constructExecutionMetaData } from 'n8n-core';
import type {
	IDataObject,
	IExecuteFunctions,
	IGetNodeParameterOptions,
	INode,
	INodeExecutionData,
	INodeTypeBaseDescription,
} from 'n8n-workflow';

import { maskSensitiveFields, parseSensitiveFieldNames } from '../../v2/helpers/utils';
import { SetV2 } from '../../v2/SetV2.node';

const node: INode = {
	id: '1',
	name: 'Edit Fields',
	type: 'n8n-nodes-base.set',
	typeVersion: 3.5,
	position: [0, 0],
	parameters: {},
};

const assignments = {
	assignments: [
		{ id: '1', name: 'user', value: 'alice', type: 'string' },
		{ id: '2', name: 'password', value: 'hunter2', type: 'string' },
		{ id: '3', name: 'token', value: 'abc123', type: 'string' },
	],
};

const createExecuteFunctions = (options: IDataObject, inputItems: INodeExecutionData[]) => {
	const nodeParameters: IDataObject = {
		mode: 'manual',
		duplicateItem: false,
		includeOtherFields: false,
		include: 'none',
		assignments,
		options,
	};

	return {
		getInputData: () => inputItems,
		getNodeParameter(
			parameterName: string,
			_itemIndex: number,
			fallbackValue?: unknown,
			_options?: IGetNodeParameterOptions,
		) {
			return get(nodeParameters, parameterName, fallbackValue);
		},
		getNode: () => node,
		getMode: () => 'manual',
		getWorkflowSettings: () => ({}),
		continueOnFail: () => false,
		helpers: { constructExecutionMetaData },
	} as unknown as IExecuteFunctions;
};

const runSetNode = async (options: IDataObject) => {
	const setNode = new SetV2(mock<INodeTypeBaseDescription>());
	const context = createExecuteFunctions(options, [{ json: {} }]);
	const [output] = await setNode.execute.call(context);
	return output[0].json;
};

describe('Set node v3.5, Mask Sensitive Fields option', () => {
	it('should replace listed field values with *** when masking is on', async () => {
		const json = await runSetNode({
			maskSensitiveFields: true,
			sensitiveFieldNames: 'password, token',
		});

		expect(json).toEqual({ user: 'alice', password: '***', token: '***' });
	});

	it('should mask password and token by default when no field list is set', async () => {
		const json = await runSetNode({ maskSensitiveFields: true });

		expect(json).toEqual({ user: 'alice', password: '***', token: '***' });
	});

	it('should only mask the fields in a custom field list', async () => {
		const json = await runSetNode({ maskSensitiveFields: true, sensitiveFieldNames: 'token' });

		expect(json).toEqual({ user: 'alice', password: 'hunter2', token: '***' });
	});

	it('should leave output unchanged when masking is off', async () => {
		const json = await runSetNode({ maskSensitiveFields: false, sensitiveFieldNames: 'password' });

		expect(json).toEqual({ user: 'alice', password: 'hunter2', token: 'abc123' });
	});

	it('should leave output unchanged when the option is not set', async () => {
		const json = await runSetNode({});

		expect(json).toEqual({ user: 'alice', password: 'hunter2', token: 'abc123' });
	});
});

describe('maskSensitiveFields', () => {
	it('should mask nested keys inside objects and arrays', () => {
		const input: IDataObject = {
			account: { password: 'secret', profile: { token: 't-1', name: 'bob' } },
			sessions: [{ token: 't-2' }, { token: 't-3', device: 'phone' }],
		};

		expect(maskSensitiveFields(input, ['password', 'token'])).toEqual({
			account: { password: '***', profile: { token: '***', name: 'bob' } },
			sessions: [{ token: '***' }, { token: '***', device: 'phone' }],
		});
	});

	it('should ignore listed fields that are missing from the item', () => {
		const input: IDataObject = { user: 'alice' };

		expect(maskSensitiveFields(input, ['password', 'token'])).toEqual({ user: 'alice' });
	});

	it('should not mutate the input object', () => {
		const input: IDataObject = { password: 'secret', nested: { token: 't' } };

		maskSensitiveFields(input, ['password', 'token']);

		expect(input).toEqual({ password: 'secret', nested: { token: 't' } });
	});
});

describe('parseSensitiveFieldNames', () => {
	it('should split, trim and drop empty names', () => {
		expect(parseSensitiveFieldNames(' password, token ,, apiKey ')).toEqual([
			'password',
			'token',
			'apiKey',
		]);
	});

	it('should return an empty list for undefined input', () => {
		expect(parseSensitiveFieldNames(undefined)).toEqual([]);
	});
});
