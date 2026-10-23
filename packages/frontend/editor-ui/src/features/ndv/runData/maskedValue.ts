import type { IDataObject, INode } from 'n8n-workflow';
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

export function isMaskedFieldName(
	names: ReadonlySet<string> | undefined,
	fieldName: unknown,
): boolean {
	if (!names || typeof fieldName !== 'string' || fieldName === '') return false;

	const name = fieldName.toLowerCase();
	return names.has(name) || name.split('.').some((segment) => names.has(segment));
}

function isPlainObject(value: unknown): value is IDataObject {
	if (typeof value !== 'object' || value === null) return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function maskNestedValue(
	value: IDataObject[string],
	names: ReadonlySet<string>,
): IDataObject[string] {
	if (Array.isArray(value)) {
		return value.map((element: IDataObject[string]) => maskNestedValue(element, names));
	}
	return isPlainObject(value) ? maskFields(value, names) : value;
}

/**
 * Must mask exactly like `maskFields` in the Edit Fields node
 * (packages/nodes-base/nodes/Set/v2/helpers/mask.ts). Object.fromEntries keeps keys such as
 * '__proto__' from parsed JSON as own data properties.
 */
export function maskFields(json: IDataObject, names: ReadonlySet<string>): IDataObject {
	return Object.fromEntries(
		Object.entries(json).map(([key, value]) => [
			key,
			names.has(key.toLowerCase()) ? MASKED_VALUE : maskNestedValue(value, names),
		]),
	);
}
