import { createTestNode } from '@/__tests__/mocks';
import { SET_NODE_TYPE } from '@/app/constants';
import type { INodeUi } from '@/Interface';
import type { IDataObject, NodeParameterValueType } from 'n8n-workflow';
import { getMaskedFieldNames, isMaskedFieldName, isMaskedValue, maskFields } from './maskedValue';

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

describe('isMaskedFieldName', () => {
	const names: ReadonlySet<string> = new Set(['password', 'token']);

	it('hides a Fields to Set row named exactly like a masked field', () => {
		expect(isMaskedFieldName(names, 'password')).toBe(true);
	});

	it.each(['Password', 'TOKEN'])('ignores case in the row name "%s"', (name) => {
		expect(isMaskedFieldName(names, name)).toBe(true);
	});

	it('hides a dotted row name when one of its segments is masked', () => {
		expect(isMaskedFieldName(names, 'creds.token')).toBe(true);
	});

	it.each<{ description: string; name: string }>([
		{ description: 'a name that is not listed', name: 'username' },
		{ description: 'a name that only contains a listed name', name: 'passwordHint' },
		{ description: 'a dotted name with no listed segment', name: 'creds.tokenId' },
		{ description: 'a row that has no name yet', name: '' },
	])('does not hide $description', ({ name }) => {
		expect(isMaskedFieldName(names, name)).toBe(false);
	});

	it('does not hide anything when the node masks nothing', () => {
		expect(isMaskedFieldName(undefined, 'password')).toBe(false);
	});
});

describe('maskFields', () => {
	const names: ReadonlySet<string> = new Set(['password', 'token']);

	it('masks listed fields at any depth of nested objects', () => {
		const json = {
			username: 'ada',
			password: 'demo-password-123',
			profile: { nickname: 'Ada', session: { token: 'demo-token-456' } },
		};

		expect(maskFields(json, names)).toEqual({
			username: 'ada',
			password: '***',
			profile: { nickname: 'Ada', session: { token: '***' } },
		});
	});

	it('masks listed fields inside arrays of objects and leaves plain array values alone', () => {
		const json = {
			accounts: [
				{ name: 'work', token: 'demo-token-1' },
				{ name: 'home', token: 'demo-token-2' },
			],
			tags: ['password', 'token'],
		};

		expect(maskFields(json, names)).toEqual({
			accounts: [
				{ name: 'work', token: '***' },
				{ name: 'home', token: '***' },
			],
			tags: ['password', 'token'],
		});
	});

	it('matches field names case-insensitively', () => {
		const json = { Password: 'demo-password-123', TOKEN: 'demo-token-456', Username: 'ada' };

		expect(maskFields(json, names)).toEqual({ Password: '***', TOKEN: '***', Username: 'ada' });
	});

	it('masks the whole value when a listed field holds an object or an array', () => {
		const json = {
			token: { access: 'demo-access', refresh: 'demo-refresh' },
			password: ['old-password', 'new-password'],
		};

		expect(maskFields(json, names)).toEqual({ token: '***', password: '***' });
	});

	it('leaves the original item untouched', () => {
		const json: IDataObject = {
			password: 'demo-password-123',
			creds: { token: 'demo-token-456' },
			accounts: [{ token: 'demo-token-789' }],
		};
		const before = structuredClone(json);

		const masked = maskFields(json, names);

		expect(json).toEqual(before);
		expect(masked).not.toBe(json);
	});
});
