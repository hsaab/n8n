<script setup lang="ts">
import ChatInputBase from '@/features/ai/shared/components/ChatInputBase.vue';
import ChatTypingIndicator from '@/features/ai/chatHub/components/ChatTypingIndicator.vue';
import type { InsightsAnalystChatMessage } from '@/features/execution/insights/insights-analyst.store';
import { formatAnalystCitation } from '@/features/execution/insights/insights-analyst.utils';
import { useI18n } from '@n8n/i18n';
import { computed, ref } from 'vue';

const props = defineProps<{
	messages: InsightsAnalystChatMessage[];
	pending: boolean;
}>();

const emit = defineEmits<{
	send: [message: string];
}>();

const i18n = useI18n();
const draft = ref('');

const prompts = computed(() => [
	i18n.baseText('insights.analyst.chat.prompt.timeSaved'),
	i18n.baseText('insights.analyst.chat.prompt.failures'),
	i18n.baseText('insights.analyst.chat.prompt.overview'),
]);

const canSubmit = computed(() => draft.value.trim().length > 0 && !props.pending);

function submit(message = draft.value) {
	const trimmed = message.trim();
	if (!trimmed || props.pending) return;
	emit('send', trimmed);
	draft.value = '';
}
</script>

<template>
	<aside :class="$style.rail" data-test-id="insights-analyst-chat">
		<header :class="$style.header">
			<h2>{{ i18n.baseText('insights.analyst.chat.title') }}</h2>
		</header>
		<div :class="$style.messages">
			<p v-if="messages.length === 0" :class="$style.empty">
				{{ i18n.baseText('insights.analyst.chat.empty') }}
			</p>
			<article
				v-for="message in messages"
				:key="message.id"
				:class="message.role === 'user' ? $style.user : $style.assistant"
				data-test-id="insights-analyst-message"
			>
				<p>{{ message.text }}</p>
				<span
					v-if="message.response?.mode === 'llm'"
					:class="$style.badge"
					data-test-id="insights-analyst-llm-badge"
				>
					{{ i18n.baseText('insights.analyst.chat.poweredByClaude') }}
				</span>
				<ul v-if="message.response?.citations.length" :class="$style.citations">
					<li
						v-for="citation in message.response.citations"
						:key="`${citation.workflowId}-${citation.metric}`"
						data-test-id="insights-analyst-citation"
					>
						<strong>{{ citation.workflowName }}</strong>
						<span>{{ formatAnalystCitation(citation) }}</span>
					</li>
				</ul>
			</article>
			<ChatTypingIndicator v-if="pending" />
		</div>
		<div :class="$style.composer">
			<div :class="$style.prompts">
				<button
					v-for="prompt in prompts"
					:key="prompt"
					type="button"
					:class="$style.prompt"
					data-test-id="insights-analyst-prompt"
					@click="submit(prompt)"
				>
					{{ prompt }}
				</button>
			</div>
			<ChatInputBase
				v-model="draft"
				:is-streaming="false"
				:can-submit="canSubmit"
				:disabled="pending"
				:placeholder="i18n.baseText('insights.analyst.chat.placeholder')"
				@submit="submit()"
			/>
		</div>
	</aside>
</template>

<style lang="scss" module>
@use '@/features/ai/shared/styles/prompt-suggestion-buttons' as promptSuggestions;

.rail {
	display: flex;
	flex-direction: column;
	min-height: var(--spacing--5xl);
	max-height: calc(100vh - var(--spacing--4xl));
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
	position: sticky;
	top: var(--spacing--md);
}

.header {
	padding: var(--spacing--sm) var(--spacing--sm) 0;

	h2 {
		margin: 0;
		color: var(--color--text);
		font-size: var(--font-size--sm);
	}
}

.messages {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: var(--spacing--xs);
	min-height: 0;
	overflow: auto;
	padding: var(--spacing--sm);
}

.empty {
	margin: 0;
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
}

.user,
.assistant {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	max-width: 100%;
	padding: var(--spacing--xs) var(--spacing--sm);
	border-radius: var(--radius--lg);

	p {
		margin: 0;
	}
}

.user {
	align-self: flex-end;
	background: var(--background--subtle);
	color: var(--color--text);
}

.assistant {
	align-self: flex-start;
	background: var(--background--surface);
	border: var(--border);
	color: var(--color--text);
}

.badge {
	align-self: flex-start;
	padding: var(--spacing--5xs) var(--spacing--2xs);
	border-radius: var(--radius--full);
	background: var(--background--subtle);
	color: var(--color--text--tint-1);
	font-size: var(--font-size--3xs);
}

.citations {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	margin: 0;
	padding: 0;
	list-style: none;

	li {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing--xs);
		padding: var(--spacing--2xs) var(--spacing--xs);
		border-radius: var(--radius--sm);
		background: var(--background--subtle);
	}
}

.composer {
	position: sticky;
	bottom: 0;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding: var(--spacing--xs) var(--spacing--sm) var(--spacing--sm);
	background: var(--background--surface);
}

.prompts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--4xs);
}

.prompt {
	@include promptSuggestions.prompt-suggestion-button;
}
</style>
