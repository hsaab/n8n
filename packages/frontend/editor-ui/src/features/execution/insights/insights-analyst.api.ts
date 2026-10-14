import { makeRestApiRequest } from '@n8n/rest-api-client';
import type { IRestApiContext } from '@n8n/rest-api-client';
import type { InsightsAnalystChatResponse, InsightsAnalystDashboard } from '@n8n/api-types';

type AnalystRange = {
	startDate: Date;
	endDate: Date;
};

function serializeRange(range: AnalystRange) {
	return {
		startDate: range.startDate.toISOString(),
		endDate: range.endDate.toISOString(),
	};
}

export async function fetchInsightsAnalystDashboard(
	context: IRestApiContext,
	range: AnalystRange,
): Promise<InsightsAnalystDashboard> {
	return await makeRestApiRequest(context, 'GET', '/insights/analyst', serializeRange(range));
}

export async function sendInsightsAnalystMessage(
	context: IRestApiContext,
	message: string,
	range: AnalystRange,
): Promise<InsightsAnalystChatResponse> {
	return await makeRestApiRequest(context, 'POST', '/insights/analyst/chat', {
		message,
		...serializeRange(range),
	});
}
