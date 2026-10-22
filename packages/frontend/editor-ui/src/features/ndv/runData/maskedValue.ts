import type { INode } from 'n8n-workflow';
import { SET_NODE_TYPE } from '@/app/constants';
import { isObj } from '@/app/utils/typeGuards';

export const MASKED_VALUE = '***';

const DEFAULT_FIELDS_TO_MASK = 'password, token';

/**
 * Must read Fields to Mask exactly like `parseFieldsToMask` in the Edit Fields node
 * (packages/nodes-base/nodes/Set/v2/helpers/mask.ts), or markers drift from what the node masked.
 */
export function getMaskedFieldNames(
	node: INode | null | undefined,
): ReadonlySet<string> | undefined {
	if (!node || node.type !== SET_NODE_TYPE || node.typeVersion < 3.5) return undefined;

	const options = node.parameters.options;
	if (!isObj(options) || !('maskSensitiveFields' in options)) return undefined;
	if (options.maskSensitiveFields !== true) return undefined;

	const fieldsToMask = 'fieldsToMask' in options ? options.fieldsToMask : undefined;
	if (typeof fieldsToMask === 'string' && fieldsToMask.startsWith('=')) return undefined;

	return new Set(
		(typeof fieldsToMask === 'string' ? fieldsToMask : DEFAULT_FIELDS_TO_MASK)
			.split(',')
			.map((field) => field.trim().toLowerCase())
			.filter((field) => field !== ''),
	);
}

export function isMaskedValue(
	names: ReadonlySet<string> | undefined,
	key: unknown,
	value: unknown,
): boolean {
	return value === MASKED_VALUE && typeof key === 'string' && !!names?.has(key.toLowerCase());
}
