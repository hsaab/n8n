import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { InsightsAnalystChatResponse, InsightsAnalystDashboard } from '@n8n/api-types';
import { useRootStore } from '@n8n/stores/useRootStore';

import * as insightsAnalystApi from '@/features/execution/insights/insights-analyst.api';

export type InsightsAnalystChatMessage = {
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
	const messages = ref<InsightsAnalystChatMessage[]>([]);

	async function loadDashboard(range: { startDate: Date; endDate: Date }) {
		loading.value = true;
		try {
			dashboard.value = await insightsAnalystApi.fetchInsightsAnalystDashboard(
				rootStore.restApiContext,
				range,
			);
		} finally {
			loading.value = false;
		}
	}

	async function sendMessage(message: string, range: { startDate: Date; endDate: Date }) {
		const trimmed = message.trim();
		if (!trimmed || chatPending.value) return;

		messages.value.push({
			id: `user-${messages.value.length}`,
			role: 'user',
			text: trimmed,
		});
		chatPending.value = true;
		try {
			const response = await insightsAnalystApi.sendInsightsAnalystMessage(
				rootStore.restApiContext,
				trimmed,
				range,
			);
			messages.value.push({
				id: `assistant-${messages.value.length}`,
				role: 'assistant',
				text: response.answer,
				response,
			});
		} finally {
			chatPending.value = false;
		}
	}

	return {
		dashboard,
		loading,
		chatPending,
		messages,
		loadDashboard,
		sendMessage,
	};
});
