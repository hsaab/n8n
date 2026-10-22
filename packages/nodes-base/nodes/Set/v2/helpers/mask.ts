import type { IDataObject } from 'n8n-workflow';

const DEFAULT_MASK_FIELDS = ['password', 'token'];

export function parseMaskFields(raw: string | undefined): string[] {
	if (raw === undefined) {
		return [...DEFAULT_MASK_FIELDS];
	}

	const parsed = raw
		.split(',')
		.map((field) => field.trim().toLowerCase())
		.filter((field) => field !== '');

	return parsed.length === 0 ? [...DEFAULT_MASK_FIELDS] : parsed;
}

function isPlainObject(value: unknown): value is IDataObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function maskNestedValue(value: unknown, fieldNames: Set<string>, maskValue: string): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => maskNestedValue(entry, fieldNames, maskValue));
	}

	if (isPlainObject(value)) {
		return maskObject(value, fieldNames, maskValue);
	}

	return value;
}

function isJsonValue(value: unknown): value is IDataObject[string] {
	if (value === null || value === undefined) {
		return true;
	}

	switch (typeof value) {
		case 'string':
		case 'number':
		case 'boolean':
		case 'object':
			return true;
		default:
			return false;
	}
}

function maskObject(json: IDataObject, fieldNames: Set<string>, maskValue: string): IDataObject {
	const result: IDataObject = {};

	for (const [key, value] of Object.entries(json)) {
		if (fieldNames.has(key.toLowerCase())) {
			result[key] = maskValue;
			continue;
		}

		const next = maskNestedValue(value, fieldNames, maskValue);
		if (isJsonValue(next)) {
			result[key] = next;
		} else {
			result[key] = value;
		}
	}

	return result;
}

export function maskJsonValues(
	json: IDataObject,
	fieldNames: string[],
	maskValue: string,
): IDataObject {
	return maskObject(json, new Set(fieldNames.map((name) => name.toLowerCase())), maskValue);
}
