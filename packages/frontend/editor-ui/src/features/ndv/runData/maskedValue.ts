import type { INodeUi } from '@/Interface';
import { SET_NODE_TYPE } from '@/app/constants';
import { isObj } from '@/app/utils/typeGuards';

export const MASKED_VALUE = '***';

/**
 * Mirrors the Edit Fields (Set) `maskSensitiveFields` option: from version 3.5 that node
 * replaces sensitive values with `***`, so only that exact value from such a node counts.
 */
export function isMaskedValue(node: INodeUi | null | undefined, value: unknown): boolean {
	if (value !== MASKED_VALUE || !node) return false;
	if (node.type !== SET_NODE_TYPE || node.typeVersion < 3.5) return false;

	const options = node.parameters.options;
	return isObj(options) && 'maskSensitiveFields' in options && options.maskSensitiveFields === true;
}
