import type { InsightsAnalystOverview, InsightsDateFilterDto } from '@n8n/api-types';
import { useRootStore } from '@n8n/stores/useRootStore';
import { ref } from 'vue';

import { fetchInsightsAnalystOverview } from '../insights.api';

export function useInsightsAnalystOverview() {
	const rootStore = useRootStore();
	const overview = ref<InsightsAnalystOverview | null>(null);
	const loading = ref(false);

	async function fetchOverview(filter: InsightsDateFilterDto) {
		loading.value = true;
		try {
			overview.value = await fetchInsightsAnalystOverview(rootStore.restApiContext, filter);
		} finally {
			loading.value = false;
		}
	}

	return {
		overview,
		loading,
		fetchOverview,
	};
}
