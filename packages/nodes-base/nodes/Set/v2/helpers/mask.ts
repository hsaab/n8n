import type { IDataObject } from 'n8n-workflow';

export const MASKED_VALUE = '***';

export const DEFAULT_FIELDS_TO_MASK = 'password, token';

export function parseFieldsToMask(_fieldsToMask: string | undefined): Set<string> {
	return new Set();
}

export function maskFields(json: IDataObject, _fields: Set<string>): IDataObject {
	return { ...json };
}
