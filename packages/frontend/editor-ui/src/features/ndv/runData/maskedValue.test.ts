import { createTestNode } from '@/__tests__/mocks';
import { SET_NODE_TYPE } from '@/app/constants';
import type { INodeUi } from '@/Interface';
import type { NodeParameterValueType } from 'n8n-workflow';
import { getMaskedFieldNames, isMaskedValue } from './maskedValue';

const maskedSetNode = createTestNode({
	name: 'Edit Fields',
	type: SET_NODE_TYPE,
	typeVersion: 3.5,
	parameters: { options: { maskSensitiveFields: true } },
});

function withOptions(options: NodeParameterValueType): INodeUi {
	return { ...maskedSetNode, parameters: { options } };
}

describe('getMaskedFieldNames', () => {
	it('uses the default "password, token" list when Fields to Mask was never added', () => {
		expect(getMaskedFieldNames(maskedSetNode)).toEqual(new Set(['password', 'token']));
	});

	it('masks the same names on a newer Edit Fields version', () => {
		expect(getMaskedFieldNames({ ...maskedSetNode, typeVersion: 3.6 })).toEqual(
			new Set(['password', 'token']),
		);
	});

	it('reads Fields to Mask the way the Edit Fields node does: trimmed, lowercased, empties dropped', () => {
		const node = withOptions({ maskSensitiveFields: true, fieldsToMask: ' Password , ,TOKEN ' });

		expect(getMaskedFieldNames(node)).toEqual(new Set(['password', 'token']));
	});

	it('masks only the names left in Fields to Mask after the user removes one', () => {
		const node = withOptions({ maskSensitiveFields: true, fieldsToMask: 'password' });

		expect(getMaskedFieldNames(node)).toEqual(new Set(['password']));
	});

	it('masks nothing when the user clears Fields to Mask', () => {
		const node = withOptions({ maskSensitiveFields: true, fieldsToMask: '' });

		expect(getMaskedFieldNames(node)).toEqual(new Set());
	});

	it.each<{ description: string; node: INodeUi | null | undefined }>([
		{
			description: 'Mask Sensitive Fields is switched off',
			node: withOptions({ maskSensitiveFields: false }),
		},
		{
			description: 'Mask Sensitive Fields is an expression',
			node: withOptions({ maskSensitiveFields: '={{ true }}' }),
		},
		{
			description: 'Fields to Mask is an expression',
			node: withOptions({ maskSensitiveFields: true, fieldsToMask: '={{ $json.fields }}' }),
		},
		{ description: 'the node has no options set', node: { ...maskedSetNode, parameters: {} } },
		{ description: 'the options value is not an object', node: withOptions('maskSensitiveFields') },
		{
			description: 'the Edit Fields version predates masking',
			node: { ...maskedSetNode, typeVersion: 3.4 },
		},
		{
			description: 'the node is not Edit Fields',
			node: { ...maskedSetNode, type: 'n8n-nodes-base.code' },
		},
		{ description: 'there is no node', node: null },
		{ description: 'the node is unknown', node: undefined },
	])('returns undefined when $description', ({ node }) => {
		expect(getMaskedFieldNames(node)).toBeUndefined();
	});
});

describe('isMaskedValue', () => {
	const names: ReadonlySet<string> = new Set(['password', 'token']);

	it.each(['password', 'Password', 'TOKEN'])('treats "***" under the key "%s" as masked', (key) => {
		expect(isMaskedValue(names, key, '***')).toBe(true);
	});

	it('does not treat "***" as masked under a key that is not listed', () => {
		expect(isMaskedValue(names, 'apiKey', '***')).toBe(false);
	});

	it('does not treat an array element as masked, even when its index is listed', () => {
		expect(isMaskedValue(new Set(['0']), 0, '***')).toBe(false);
	});

	it.each<{ description: string; value: unknown }>([
		{ description: 'a regular string', value: 'secret' },
		{ description: 'a shorter run of asterisks', value: '**' },
		{ description: 'a number', value: 3 },
		{ description: 'a missing value', value: undefined },
	])('does not treat $description under a listed key as masked', ({ value }) => {
		expect(isMaskedValue(names, 'password', value)).toBe(false);
	});

	it('does not treat "***" as masked when the node masks nothing', () => {
		expect(isMaskedValue(undefined, 'password', '***')).toBe(false);
	});
});
