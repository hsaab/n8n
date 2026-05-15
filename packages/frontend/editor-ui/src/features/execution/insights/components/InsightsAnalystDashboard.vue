<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { N8nButton, N8nHeading, N8nSpinner, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import type {
	InsightsAnalystChatResponse,
	InsightsAnalystOverview,
	InsightsAnalystWorkflow,
	InsightsSummary,
} from '@n8n/api-types';

import { VIEWS } from '@/app/constants';
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import { useRootStore } from '@n8n/stores/useRootStore';
import {
	askInsightsAnalyst,
	fetchInsightsAnalystOverview,
} from '@/features/execution/insights/insights.api';

import InsightsAnalystPanel, { type AnalystMessage } from './InsightsAnalystPanel.vue';

const i18n = useI18n();
const rootStore = useRootStore();
const router = useRouter();

const overview = ref<InsightsAnalystOverview | null>(null);
const isLoading = ref(true);
const isAsking = ref(false);
const error = ref('');
const messages = ref<AnalystMessage[]>([
	{
		id: 'welcome',
		role: 'assistant',
		content: i18n.baseText('insights.analyst.panel.welcome'),
	},
]);

useDocumentTitle({
	title: i18n.baseText('insights.analyst.title'),
});

const summaryCards = computed(() => {
	if (!overview.value) return [];

	const summary = overview.value.summary;
	return [
		{
			id: 'total',
			label: i18n.baseText('insights.analyst.metric.totalRuns'),
			value: formatCount(summary.total.value),
			description: formatDeviation(summary.total.deviation, 'count'),
		},
		{
			id: 'failures',
			label: i18n.baseText('insights.analyst.metric.failures'),
			value: formatCount(summary.failed.value),
			description: formatDeviation(summary.failed.deviation, 'count'),
		},
		{
			id: 'failure-rate',
			label: i18n.baseText('insights.analyst.metric.failureRate'),
			value: formatPercent(summary.failureRate.value),
			description: formatDeviation(summary.failureRate.deviation, 'ratio'),
		},
		{
			id: 'runtime',
			label: i18n.baseText('insights.analyst.metric.averageRuntime'),
			value: formatRuntime(summary.averageRunTime.value),
			description: formatDeviation(summary.averageRunTime.deviation, 'millisecond'),
		},
		{
			id: 'time-saved',
			label: i18n.baseText('insights.analyst.metric.timeSaved'),
			value: formatMinutes(summary.timeSaved.value),
			description: formatDeviation(summary.timeSaved.deviation, 'minute'),
		},
	];
});

const highestImpactWorkflows = computed(() =>
	[...(overview.value?.workflows ?? [])].sort((a, b) => b.timeSaved - a.timeSaved).slice(0, 5),
);

const riskWorkflows = computed(() =>
	[...(overview.value?.workflows ?? [])].sort((a, b) => b.failureRate - a.failureRate).slice(0, 5),
);

const lowImpactWorkflows = computed(() =>
	[...(overview.value?.workflows ?? [])]
		.filter((workflow) => workflow.total > 0)
		.sort((a, b) => a.timeSaved / a.total - b.timeSaved / b.total)
		.slice(0, 4),
);

const recentTrend = computed(() => overview.value?.byTime.slice(-10) ?? []);
const maxTrendTotal = computed(() =>
	Math.max(...recentTrend.value.map((entry) => entry.values.total), 1),
);

async function loadOverview() {
	isLoading.value = true;
	error.value = '';

	try {
		overview.value = await fetchInsightsAnalystOverview(rootStore.restApiContext);
	} catch {
		error.value = i18n.baseText('insights.analyst.error.load');
	} finally {
		isLoading.value = false;
	}
}

async function askAnalyst(prompt: string) {
	if (isAsking.value) return;

	messages.value.push({
		id: `user-${Date.now()}`,
		role: 'user',
		content: prompt,
	});
	isAsking.value = true;

	try {
		const response = await askInsightsAnalyst(rootStore.restApiContext, { prompt });
		appendAssistantResponse(response);
	} catch {
		messages.value.push({
			id: `assistant-error-${Date.now()}`,
			role: 'assistant',
			content: i18n.baseText('insights.analyst.error.ask'),
		});
	} finally {
		isAsking.value = false;
	}
}

function appendAssistantResponse(response: InsightsAnalystChatResponse) {
	messages.value.push({
		id: `assistant-${Date.now()}`,
		role: 'assistant',
		content: response.answer,
		citations: response.citations,
	});
}

function workflowHref(workflowId: string) {
	return router.resolve({ name: VIEWS.WORKFLOW, params: { workflowId } }).href;
}

function riskLabel(riskLevel: InsightsAnalystWorkflow['riskLevel']) {
	return i18n.baseText(`insights.analyst.risk.${riskLevel}`);
}

function trendLabel(trend: InsightsAnalystWorkflow['trend']) {
	return i18n.baseText(`insights.analyst.trend.${trend}`);
}

function formatCount(value: number) {
	return Math.round(value).toLocaleString();
}

function formatPercent(value: number) {
	return `${Math.round(value * 1000) / 10}%`;
}

function formatRuntime(value: number) {
	return `${Math.round(value / 100) / 10}s`;
}

function formatMinutes(value: number) {
	if (Math.abs(value) < 60) return i18n.baseText('insights.analyst.minutes', { count: Math.round(value) });

	return i18n.baseText('insights.analyst.hours', {
		count: Math.round((value / 60) * 10) / 10,
	});
}

function formatDeviation(
	deviation: InsightsSummary[keyof InsightsSummary]['deviation'],
	unit: 'count' | 'ratio' | 'millisecond' | 'minute',
) {
	if (deviation === null) return i18n.baseText('insights.analyst.metric.noPreviousPeriod');

	const prefix = deviation > 0 ? '+' : '';
	if (unit === 'ratio') return `${prefix}${formatPercent(deviation)}`;
	if (unit === 'millisecond') return `${prefix}${formatRuntime(deviation)}`;
	if (unit === 'minute') return `${prefix}${formatMinutes(deviation)}`;
	return `${prefix}${formatCount(deviation)}`;
}

onMounted(async () => await loadOverview());
</script>

<template>
	<div :class="$style.page" data-test-id="insights-analyst-dashboard">
		<header :class="$style.hero">
			<div>
				<N8nHeading tag="h1" size="2xlarge">
					{{ i18n.baseText('insights.analyst.title') }}
				</N8nHeading>
				<N8nText tag="p" color="text-base">
					{{ i18n.baseText('insights.analyst.subtitle') }}
				</N8nText>
			</div>
			<N8nButton variant="subtle" :disabled="isLoading" @click="loadOverview">
				{{ i18n.baseText('insights.analyst.refresh') }}
			</N8nButton>
		</header>

		<div v-if="isLoading" :class="$style.loading">
			<N8nSpinner />
		</div>

		<N8nText v-else-if="error" tag="p" color="danger">{{ error }}</N8nText>

		<main v-else-if="overview" :class="$style.layout">
			<section :class="$style.analytics">
				<div :class="$style.summaryGrid">
					<article v-for="card in summaryCards" :key="card.id" :class="$style.card">
						<N8nText tag="p" color="text-base" size="small">{{ card.label }}</N8nText>
						<strong :class="$style.metricValue">{{ card.value }}</strong>
						<N8nText tag="p" color="text-light" size="small">{{ card.description }}</N8nText>
					</article>
				</div>

				<section :class="$style.card">
					<div :class="$style.sectionHeader">
						<N8nHeading tag="h2" size="large">
							{{ i18n.baseText('insights.analyst.trend.title') }}
						</N8nHeading>
						<N8nText tag="p" color="text-base" size="small">
							{{ i18n.baseText('insights.analyst.trend.description') }}
						</N8nText>
					</div>
					<div :class="$style.trendChart">
						<div v-for="point in recentTrend" :key="point.date" :class="$style.trendColumn">
							<div :class="$style.bars">
								<div
									:class="$style.failedBar"
									:style="{ height: `${(point.values.failed / maxTrendTotal) * 100}%` }"
								/>
								<div
									:class="$style.successBar"
									:style="{ height: `${(point.values.succeeded / maxTrendTotal) * 100}%` }"
								/>
							</div>
							<N8nText tag="span" size="xsmall" color="text-light">
								{{ new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
							</N8nText>
						</div>
					</div>
				</section>

				<div :class="$style.tables">
					<section :class="$style.card">
						<N8nHeading tag="h2" size="large">
							{{ i18n.baseText('insights.analyst.table.impact') }}
						</N8nHeading>
						<div :class="$style.workflowList">
							<a
								v-for="workflow in highestImpactWorkflows"
								:key="workflow.workflowId"
								:href="workflowHref(workflow.workflowId)"
								:class="$style.workflowRow"
							>
								<span>
									<N8nText tag="span" bold>{{ workflow.workflowName }}</N8nText>
									<N8nText tag="p" size="small" color="text-base">{{ workflow.story }}</N8nText>
								</span>
								<strong>{{ formatMinutes(workflow.timeSaved) }}</strong>
							</a>
						</div>
					</section>

					<section :class="$style.card">
						<N8nHeading tag="h2" size="large">
							{{ i18n.baseText('insights.analyst.table.risk') }}
						</N8nHeading>
						<div :class="$style.workflowList">
							<a
								v-for="workflow in riskWorkflows"
								:key="workflow.workflowId"
								:href="workflowHref(workflow.workflowId)"
								:class="$style.workflowRow"
							>
								<span>
									<N8nText tag="span" bold>{{ workflow.workflowName }}</N8nText>
									<N8nText tag="p" size="small" color="text-base">
										{{ riskLabel(workflow.riskLevel) }} · {{ trendLabel(workflow.trend) }}
									</N8nText>
								</span>
								<strong>{{ formatPercent(workflow.failureRate) }}</strong>
							</a>
						</div>
					</section>
				</div>

				<section :class="$style.card">
					<N8nHeading tag="h2" size="large">
						{{ i18n.baseText('insights.analyst.table.lowImpact') }}
					</N8nHeading>
					<div :class="$style.workflowList">
						<a
							v-for="workflow in lowImpactWorkflows"
							:key="workflow.workflowId"
							:href="workflowHref(workflow.workflowId)"
							:class="$style.workflowRow"
						>
							<span>
								<N8nText tag="span" bold>{{ workflow.workflowName }}</N8nText>
								<N8nText tag="p" size="small" color="text-base">
									{{ formatMinutes(workflow.timeSavedPerExecution) }}
									{{ i18n.baseText('insights.analyst.table.perRun') }}
								</N8nText>
							</span>
							<strong>{{ workflow.total }} {{ i18n.baseText('insights.analyst.table.runs') }}</strong>
						</a>
					</div>
				</section>
			</section>

			<InsightsAnalystPanel
				:suggested-prompts="overview.suggestedPrompts"
				:messages="messages"
				:is-loading="isAsking"
				@ask="askAnalyst"
			/>
		</main>
	</div>
</template>

<style lang="scss" module>
.page {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xl);
	padding: var(--spacing--xl);
}

.hero {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--lg);
}

.loading {
	display: flex;
	justify-content: center;
	padding: var(--spacing--3xl);
}

.layout {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 35%);
	gap: var(--spacing--lg);
	align-items: stretch;
}

.analytics {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--lg);
}

.summaryGrid {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: var(--spacing--md);
}

.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
}

.metricValue {
	font-size: var(--font-size--2xl);
	line-height: 1.1;
	color: var(--color--text);
}

.sectionHeader {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--spacing--md);
}

.trendChart {
	display: grid;
	grid-template-columns: repeat(10, minmax(0, 1fr));
	gap: var(--spacing--sm);
	min-height: calc(var(--spacing--xl) * 6);
	align-items: end;
}

.trendColumn {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing--2xs);
	min-height: calc(var(--spacing--xl) * 6);
}

.bars {
	display: flex;
	align-items: end;
	gap: var(--spacing--3xs);
	width: 100%;
	height: calc(var(--spacing--xl) * 5);
}

.successBar,
.failedBar {
	flex: 1;
	min-height: var(--spacing--2xs);
	border-radius: var(--radius--xs) var(--radius--xs) 0 0;
}

.successBar {
	background: var(--color--success);
}

.failedBar {
	background: var(--color--danger);
}

.tables {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--spacing--lg);
}

.workflowList {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}

.workflowRow {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--md);
	padding: var(--spacing--sm);
	border-radius: var(--radius);
	color: inherit;
	text-decoration: none;

	&:hover {
		background: var(--background--base);
	}
}

@media (max-width: 1200px) {
	.layout,
	.tables,
	.summaryGrid {
		grid-template-columns: 1fr;
	}
}
</style>
