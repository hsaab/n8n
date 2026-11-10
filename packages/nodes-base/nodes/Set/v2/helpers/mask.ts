import type { IDataObject } from 'n8n-workflow';

export const MASKED_VALUE = '***';

export const DEFAULT_FIELDS_TO_MASK = 'password, token';

export function parseFieldsToMask(fieldsToMask: string | undefined): Set<string> {
	return new Set(
		(fieldsToMask ?? DEFAULT_FIELDS_TO_MASK)
			.split(',')
			.map((field) => field.trim().toLowerCase())
			.filter((field) => field !== ''),
	);
}

function isPlainObject(value: unknown): value is IDataObject {
	if (typeof value !== 'object' || value === null) return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function maskValue(value: IDataObject[string], fields: Set<string>): IDataObject[string] {
	if (Array.isArray(value)) {
		return value.map((element: IDataObject[string]) => maskValue(element, fields));
	}
	return isPlainObject(value) ? maskFields(value, fields) : value;
}

// Object.fromEntries keeps keys such as '__proto__' from parsed JSON as own data properties.
export function maskFields(json: IDataObject, fields: Set<string>): IDataObject {
	return Object.fromEntries(
		Object.entries(json).map(([key, value]) => [
			key,
			fields.has(key.toLowerCase()) ? MASKED_VALUE : maskValue(value, fields),
		]),
	);
}
