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

function maskNestedValue(
	value: unknown,
	fieldNames: Set<string>,
	maskValue: string,
	seen: WeakMap<object, unknown>,
): unknown {
	if (Array.isArray(value)) {
		if (seen.has(value)) {
			return seen.get(value);
		}

		const copy: unknown[] = [];
		seen.set(value, copy);

		for (const entry of value) {
			copy.push(maskNestedValue(entry, fieldNames, maskValue, seen));
		}

		return copy;
	}

	if (isPlainObject(value)) {
		return maskObject(value, fieldNames, maskValue, seen);
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

function maskObject(
	json: IDataObject,
	fieldNames: Set<string>,
	maskValue: string,
	seen: WeakMap<object, unknown>,
): IDataObject {
	const existing = seen.get(json);
	if (isPlainObject(existing)) {
		return existing;
	}

	const result: IDataObject = {};
	seen.set(json, result);

	for (const [key, value] of Object.entries(json)) {
		if (fieldNames.has(key.toLowerCase())) {
			result[key] = maskValue;
			continue;
		}

		const next = maskNestedValue(value, fieldNames, maskValue, seen);
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
	return maskObject(
		json,
		new Set(fieldNames.map((name) => name.toLowerCase())),
		maskValue,
		new WeakMap(),
	);
}
