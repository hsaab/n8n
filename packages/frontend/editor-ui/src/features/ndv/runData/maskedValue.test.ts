import { createTestNode } from '@/__tests__/mocks';
import { SET_NODE_TYPE } from '@/app/constants';
import type { INodeUi } from '@/Interface';
import { isMaskedValue } from './maskedValue';

const maskedSetNode = createTestNode({
	name: 'Edit Fields',
	type: SET_NODE_TYPE,
	typeVersion: 3.5,
	parameters: { options: { maskSensitiveFields: true } },
});

describe('isMaskedValue', () => {
	it.each<{ description: string; node: INodeUi }>([
		{ description: 'Edit Fields 3.5 with masking on', node: maskedSetNode },
		{
			description: 'a newer Edit Fields version with masking on',
			node: { ...maskedSetNode, typeVersion: 3.6 },
		},
	])('treats "***" from $description as masked', ({ node }) => {
		expect(isMaskedValue(node, '***')).toBe(true);
	});

	it.each<{ description: string; value: unknown }>([
		{ description: 'a regular string', value: 'secret' },
		{ description: 'a shorter run of asterisks', value: '**' },
		{ description: 'a number', value: 3 },
		{ description: 'a missing value', value: undefined },
	])('does not treat $description as masked', ({ value }) => {
		expect(isMaskedValue(maskedSetNode, value)).toBe(false);
	});

	it.each<{ description: string; node: INodeUi | null | undefined }>([
		{
			description: 'masking is turned off',
			node: { ...maskedSetNode, parameters: { options: { maskSensitiveFields: false } } },
		},
		{
			description: 'the node has no options set',
			node: { ...maskedSetNode, parameters: { mode: 'manual' } },
		},
		{
			description: 'the options value is not an object',
			node: { ...maskedSetNode, parameters: { options: 'maskSensitiveFields' } },
		},
		{
			description: 'the node has no parameters',
			node: { ...maskedSetNode, parameters: {} },
		},
		{
			description: 'the Edit Fields version predates masking',
			node: { ...maskedSetNode, typeVersion: 3.4 },
		},
		{
			description: 'the value comes from a different node type',
			node: { ...maskedSetNode, type: 'n8n-nodes-base.code' },
		},
		{ description: 'there is no node', node: null },
		{ description: 'the node is unknown', node: undefined },
	])('does not treat "***" as masked when $description', ({ node }) => {
		expect(isMaskedValue(node, '***')).toBe(false);
	});
});
