import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import type { InsightsAnalystChatResponse, InsightsAnalystDashboard } from '@n8n/api-types';

function serializeRange(filter?: { startDate?: Date; endDate?: Date }) {
	if (!filter) return undefined;
	return {
		...(filter.startDate ? { startDate: filter.startDate.toISOString() } : {}),
		...(filter.endDate ? { endDate: filter.endDate.toISOString() } : {}),
	};
}

export const fetchInsightsAnalystDashboard = async (
	context: IRestApiContext,
	filter?: { startDate?: Date; endDate?: Date },
): Promise<InsightsAnalystDashboard> =>
	await makeRestApiRequest(context, 'GET', '/insights/analyst', serializeRange(filter));

export const postInsightsAnalystChat = async (
	context: IRestApiContext,
	message: string,
): Promise<InsightsAnalystChatResponse> =>
	await makeRestApiRequest(context, 'POST', '/insights/analyst/chat', { message });
