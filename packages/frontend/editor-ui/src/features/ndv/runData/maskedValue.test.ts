import { SET_NODE_TYPE } from '@/app/constants';
import type { INodeUi } from '@/Interface';

import { isMaskedValue, isMaskingEnabled } from './maskedValue';

const createNode = (overrides: Partial<INodeUi> = {}): INodeUi => ({
	id: '1',
	name: 'Edit Fields',
	type: SET_NODE_TYPE,
	typeVersion: 3.5,
	position: [0, 0],
	parameters: {},
	...overrides,
});

describe('isMaskingEnabled', () => {
	it('should return true for an Edit Fields node with masking on', () => {
		const node = createNode({ parameters: { options: { maskSensitiveFields: true } } });

		expect(isMaskingEnabled(node)).toBe(true);
	});

	it('should return false when masking is off or not set', () => {
		expect(isMaskingEnabled(createNode({ parameters: { options: {} } }))).toBe(false);
		expect(
			isMaskingEnabled(createNode({ parameters: { options: { maskSensitiveFields: false } } })),
		).toBe(false);
		expect(isMaskingEnabled(createNode())).toBe(false);
	});

	it('should return false for other node types', () => {
		const node = createNode({
			type: 'n8n-nodes-base.code',
			parameters: { options: { maskSensitiveFields: true } },
		});

		expect(isMaskingEnabled(node)).toBe(false);
	});

	it('should return false for a missing node', () => {
		expect(isMaskingEnabled(undefined)).toBe(false);
	});
});

describe('isMaskedValue', () => {
	it('should only flag *** when masking is enabled', () => {
		expect(isMaskedValue(true, '***')).toBe(true);
		expect(isMaskedValue(false, '***')).toBe(false);
		expect(isMaskedValue(true, 'hunter2')).toBe(false);
	});
});
