import type { InsightsAnalystChatRequest, InsightsAnalystChatResponse } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { useRootStore } from '@n8n/stores/useRootStore';
import { ref } from 'vue';

import { useToast } from '@/app/composables/useToast';

import { sendInsightsAnalystChat } from '../insights.api';

export type InsightsAnalystChatMessage =
	| { role: 'user'; text: string }
	| ({ role: 'assistant' } & InsightsAnalystChatResponse);

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		const abort = () => {
			reject(new DOMException('The operation was aborted.', 'AbortError'));
		};
		if (signal.aborted) {
			abort();
			return;
		}
		signal.addEventListener('abort', abort, { once: true });
	});
}

export function useInsightsAnalystChat() {
	const rootStore = useRootStore();
	const toast = useToast();
	const i18n = useI18n();
	const messages = ref<InsightsAnalystChatMessage[]>([]);
	const sending = ref(false);
	let abortController: AbortController | null = null;

	function stop() {
		abortController?.abort();
	}

	async function send(question: string, suggestedPromptId?: string): Promise<boolean> {
		const trimmed = question.trim();
		if (!trimmed || sending.value) {
			return false;
		}

		const controller = new AbortController();
		abortController = controller;
		sending.value = true;

		const userMessage: InsightsAnalystChatMessage = { role: 'user', text: trimmed };
		messages.value.push(userMessage);

		const body: InsightsAnalystChatRequest = suggestedPromptId
			? { question: trimmed, suggestedPromptId }
			: { question: trimmed };

		const request = sendInsightsAnalystChat(rootStore.restApiContext, body);

		try {
			const response = await Promise.race([request, rejectOnAbort(controller.signal)]);
			messages.value.push({ role: 'assistant', ...response });
			return true;
		} catch (error) {
			void request.catch(() => undefined);
			const index = messages.value.lastIndexOf(userMessage);
			if (index !== -1) {
				messages.value.splice(index, 1);
			}
			if (!isAbortError(error)) {
				toast.showError(
					error instanceof Error ? error : new Error(i18n.baseText('generic.unknownError')),
					i18n.baseText('insights.analyst.chat.sendFailed'),
				);
			}
			return false;
		} finally {
			sending.value = false;
			if (abortController === controller) {
				abortController = null;
			}
		}
	}

	return {
		messages,
		sending,
		send,
		stop,
	};
}
