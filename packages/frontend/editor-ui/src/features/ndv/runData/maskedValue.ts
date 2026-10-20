import { SET_NODE_TYPE } from '@/app/constants';
import type { INodeUi } from '@/Interface';

/** Placeholder the Edit Fields (Set) node writes when "Mask Sensitive Fields" is on. */
export const MASKED_VALUE = '***';

export function isMaskingEnabled(node: INodeUi | null | undefined): boolean {
	if (node?.type !== SET_NODE_TYPE) return false;

	const options = node.parameters?.options;
	if (typeof options !== 'object' || options === null || Array.isArray(options)) return false;

	return 'maskSensitiveFields' in options && options.maskSensitiveFields === true;
}

export function isMaskedValue(maskingEnabled: boolean, value: unknown): boolean {
	return maskingEnabled && value === MASKED_VALUE;
}
