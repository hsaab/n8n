import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useRootStore } from '@n8n/stores/useRootStore';
import type { InsightsAnalystChatResponse, InsightsAnalystDashboard } from '@n8n/api-types';

import {
	fetchInsightsAnalystDashboard,
	postInsightsAnalystChat,
} from '@/features/execution/insights/analyst/insights-analyst.api';

export type AnalystChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	text: string;
	response?: InsightsAnalystChatResponse;
};

export const useInsightsAnalystStore = defineStore('insightsAnalyst', () => {
	const rootStore = useRootStore();
	const dashboard = ref<InsightsAnalystDashboard | null>(null);
	const loading = ref(false);
	const chatPending = ref(false);
	const messages = ref<AnalystChatMessage[]>([]);

	async function load(filter?: { startDate?: Date; endDate?: Date }) {
		loading.value = true;
		try {
			dashboard.value = await fetchInsightsAnalystDashboard(rootStore.restApiContext, filter);
		} finally {
			loading.value = false;
		}
	}

	async function ask(message: string) {
		messages.value = [...messages.value, { id: crypto.randomUUID(), role: 'user', text: message }];
		chatPending.value = true;
		try {
			const response = await postInsightsAnalystChat(rootStore.restApiContext, message);
			messages.value = [
				...messages.value,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					text: response.answer,
					response,
				},
			];
		} finally {
			chatPending.value = false;
		}
	}

	return { dashboard, loading, chatPending, messages, load, ask };
});
