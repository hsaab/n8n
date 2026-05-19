<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
	N8nButton,
	N8nHeading,
	N8nIcon,
	N8nIconButton,
	N8nSpinner,
	N8nText,
	N8nTooltip,
} from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import type {
	InsightsAnalystChatResponse,
	InsightsAnalystHighlight,
	InsightsAnalystOverview,
	InsightsAnalystWorkflow,
	InsightsSummaryType,
} from '@n8n/api-types';
import { parseDate, getLocalTimeZone } from '@internationalized/date';

import { VIEWS } from '@/app/constants';
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import { useRootStore } from '@n8n/stores/useRootStore';
import {
	askInsightsAnalyst,
	fetchInsightsAnalystOverview,
} from '@/features/execution/insights/insights.api';
import {
	formatDateRange,
	formatInsightsTimeSavedLabel,
	transformInsightsSummary,
} from '@/features/execution/insights/insights.utils';
import { INSIGHT_TYPES } from '@/features/execution/insights/insights.constants';

import InsightsSummary from './InsightsSummary.vue';
import InsightsAnalystPanel from './InsightsAnalystPanel.vue';

// Dynamically import chart components: matches what InsightsDashboard does
// and means a customer-demo bundle only loads the chart it actually shows.
const InsightsChartTotal = defineAsyncComponent(
	async () => await import('./charts/InsightsChartTotal.vue'),
);
const InsightsChartFailed = defineAsyncComponent(
	async () => await import('./charts/InsightsChartFailed.vue'),
);
const InsightsChartFailureRate = defineAsyncComponent(
	async () => await import('./charts/InsightsChartFailureRate.vue'),
);
const InsightsChartTimeSaved = defineAsyncComponent(
	async () => await import('./charts/InsightsChartTimeSaved.vue'),
);
const InsightsChartAverageRuntime = defineAsyncComponent(
	async () => await import('./charts/InsightsChartAverageRuntime.vue'),
);

type AnalystMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	citations?: InsightsAnalystChatResponse['citations'];
	mode?: InsightsAnalystChatResponse['mode'];
};

const i18n = useI18n();
const rootStore = useRootStore();
const router = useRouter();
const documentTitle = useDocumentTitle();

const overview = ref<InsightsAnalystOverview | null>(null);
const isLoading = ref(true);
const isAsking = ref(false);
const error = ref('');
const activeMetric = ref<InsightsSummaryType>(INSIGHT_TYPES.TIME_SAVED);
const messages = ref<AnalystMessage[]>([
	{
		id: 'welcome',
		role: 'assistant',
		content: i18n.baseText('insights.analyst.panel.welcome'),
	},
]);

const summaryDisplay = computed(() =>
	overview.value ? transformInsightsSummary(overview.value.summary) : [],
);

const highlights = computed<InsightsAnalystHighlight[]>(() => overview.value?.highlights ?? []);

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

const dateRangeLabel = computed(() => {
	if (!overview.value) return '';
	const start = parseIsoDateValue(overview.value.dateRange.startDate);
	const end = parseIsoDateValue(overview.value.dateRange.endDate);
	return formatDateRange({ start, end });
});

const startDateValue = computed(() =>
	overview.value ? parseIsoDateValue(overview.value.dateRange.startDate) : undefined,
);

const endDateValue = computed(() =>
	overview.value ? parseIsoDateValue(overview.value.dateRange.endDate) : undefined,
);

const granularity = computed<'hour' | 'day' | 'week'>(() => {
	if (!overview.value) return 'day';
	const days = overview.value.byTime.length;
	if (days <= 2) return 'hour';
	if (days <= 35) return 'day';
	return 'week';
});

const chartComponent = computed(() => {
	switch (activeMetric.value) {
		case INSIGHT_TYPES.TOTAL:
			return InsightsChartTotal;
		case INSIGHT_TYPES.FAILED:
			return InsightsChartFailed;
		case INSIGHT_TYPES.FAILURE_RATE:
			return InsightsChartFailureRate;
		case INSIGHT_TYPES.TIME_SAVED:
			return InsightsChartTimeSaved;
		case INSIGHT_TYPES.AVERAGE_RUN_TIME:
			return InsightsChartAverageRuntime;
		default:
			return InsightsChartTotal;
	}
});

/**
 * Convert an ISO timestamp from the API into a `DateValue`. We rely on the
 * date portion only because the picker components in design-system operate
 * on calendar dates rather than instants.
 */
function parseIsoDateValue(isoString: string) {
	try {
		return parseDate(isoString.slice(0, 10));
	} catch {
		// Fall back to today in the browser timezone if the API ever sends a
		// malformed value rather than crashing the whole dashboard render.
		return parseDate(new Date().toISOString().slice(0, 10));
	}
}

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
		messages.value.push({
			id: `assistant-${Date.now()}`,
			role: 'assistant',
			content: response.answer,
			citations: response.citations,
			mode: response.mode,
		});
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

function workflowHref(workflowId: string) {
	return router.resolve({ name: VIEWS.WORKFLOW, params: { workflowId } }).href;
}

function riskLabel(riskLevel: InsightsAnalystWorkflow['riskLevel']) {
	return i18n.baseText(`insights.analyst.risk.${riskLevel}`);
}

function trendLabel(trend: InsightsAnalystWorkflow['trend']) {
	return i18n.baseText(`insights.analyst.trend.${trend}`);
}

function trendIcon(trend: InsightsAnalystWorkflow['trend']) {
	if (trend === 'improving') return 'trending-up';
	if (trend === 'degrading') return 'trending-down';
	return 'minus';
}

function highlightIcon(tone: InsightsAnalystHighlight['tone']) {
	if (tone === 'positive') return 'trending-up';
	if (tone === 'warning') return 'triangle-alert';
	return 'sparkles';
}

function formatPercent(value: number) {
	return `${Math.round(value * 1000) / 10}%`;
}

function formatLowImpactSubtitle(workflow: InsightsAnalystWorkflow) {
	return i18n.baseText('insights.analyst.lowImpact.subtitle', {
		interpolate: {
			perRun: formatInsightsTimeSavedLabel(workflow.timeSavedPerExecution),
			runs: workflow.total.toLocaleString(),
		},
	});
}

onMounted(async () => {
	documentTitle.set(i18n.baseText('insights.analyst.title'));
	await loadOverview();
});

const localTimeZone = getLocalTimeZone();
// Touch the timezone so static-checkers don't drop the import; the picker
// components rely on it being established on the host.
void localTimeZone;
</script>

<template>
	<div :class="$style.insightsView" data-test-id="insights-analyst-dashboard">
		<div :class="$style.insightsContainer">
			<header :class="$style.hero">
				<div :class="$style.heroText">
					<N8nHeading bold tag="h1" size="xlarge">
						{{ i18n.baseText('insights.analyst.title') }}
					</N8nHeading>
					<N8nText tag="p" color="text-base">
						{{ i18n.baseText('insights.analyst.subtitle') }}
					</N8nText>
				</div>
				<div :class="$style.heroActions">
					<span v-if="dateRangeLabel" :class="$style.dateRange">
						<N8nIcon icon="calendar" size="small" />
						{{ dateRangeLabel }}
					</span>
					<N8nButton variant="subtle" :disabled="isLoading" @click="loadOverview">
						{{ i18n.baseText('insights.analyst.refresh') }}
					</N8nButton>
				</div>
			</header>

			<div v-if="isLoading" :class="$style.loading">
				<N8nSpinner />
			</div>

			<N8nText v-else-if="error" tag="p" color="danger">{{ error }}</N8nText>

			<main v-else-if="overview" :class="$style.layout">
				<section :class="$style.analytics">
					<section
						v-if="highlights.length"
						:class="$style.highlightsStrip"
						data-test-id="insights-analyst-highlights"
					>
						<article
							v-for="highlight in highlights"
							:key="highlight.id"
							:class="[$style.highlightCard, $style[`tone-${highlight.tone}`]]"
						>
							<div :class="$style.highlightHeader">
								<N8nIcon :icon="highlightIcon(highlight.tone)" />
								<N8nText tag="span" size="small" color="text-base">
									{{ highlight.title }}
								</N8nText>
							</div>
							<N8nHeading tag="p" size="medium" bold :class="$style.highlightValue">
								{{ highlight.value }}
							</N8nHeading>
							<N8nText tag="p" size="small" color="text-base">
								{{ highlight.description }}
							</N8nText>
						</article>
					</section>

					<InsightsSummary
						:summary="summaryDisplay"
						:start-date="startDateValue"
						:end-date="endDateValue"
						link-variant="static"
						:active-id="activeMetric"
						:class="$style.insightsBanner"
						@update:active="(id) => (activeMetric = id)"
					/>

					<div :class="$style.insightsContent">
						<div :class="$style.insightsChartWrapper">
							<component
								:is="chartComponent"
								:type="activeMetric"
								:data="overview.byTime"
								:granularity="granularity"
								:start-date="overview.dateRange.startDate"
								:end-date="overview.dateRange.endDate"
							/>
						</div>

						<div :class="$style.tablesGrid">
							<section :class="$style.rankingCard" data-test-id="insights-analyst-impact">
								<header :class="$style.rankingHeader">
									<N8nHeading tag="h2" size="medium">
										{{ i18n.baseText('insights.analyst.table.impact') }}
									</N8nHeading>
									<N8nText size="small" color="text-base">
										{{ i18n.baseText('insights.analyst.table.impact.subtitle') }}
									</N8nText>
								</header>
								<ol :class="$style.rankingList">
									<li
										v-for="(workflow, index) in highestImpactWorkflows"
										:key="workflow.workflowId"
										:class="$style.rankingRow"
									>
										<span :class="$style.rankBadge">{{ index + 1 }}</span>
										<div :class="$style.rankingBody">
											<N8nText tag="p" bold>{{ workflow.workflowName }}</N8nText>
											<N8nText tag="p" size="small" color="text-base">
												{{ workflow.story }}
											</N8nText>
										</div>
										<div :class="$style.rankingMetric">
											<strong>{{ formatInsightsTimeSavedLabel(workflow.timeSaved) }}</strong>
											<span :class="[$style.trendChip, $style[`trend-${workflow.trend}`]]">
												<N8nIcon :icon="trendIcon(workflow.trend)" size="xsmall" />
												{{ trendLabel(workflow.trend) }}
											</span>
										</div>
										<N8nTooltip :content="i18n.baseText('insights.analyst.table.openWorkflow')">
											<N8nIconButton
												:href="workflowHref(workflow.workflowId)"
												icon="arrow-up-right"
												type="tertiary"
												size="mini"
												:class="$style.openButton"
											/>
										</N8nTooltip>
									</li>
								</ol>
							</section>

							<section :class="$style.rankingCard" data-test-id="insights-analyst-risk">
								<header :class="$style.rankingHeader">
									<N8nHeading tag="h2" size="medium">
										{{ i18n.baseText('insights.analyst.table.risk') }}
									</N8nHeading>
									<N8nText size="small" color="text-base">
										{{ i18n.baseText('insights.analyst.table.risk.subtitle') }}
									</N8nText>
								</header>
								<ol :class="$style.rankingList">
									<li
										v-for="(workflow, index) in riskWorkflows"
										:key="workflow.workflowId"
										:class="$style.rankingRow"
									>
										<span :class="$style.rankBadge">{{ index + 1 }}</span>
										<div :class="$style.rankingBody">
											<N8nText tag="p" bold>{{ workflow.workflowName }}</N8nText>
											<N8nText tag="p" size="small" color="text-base">
												{{ riskLabel(workflow.riskLevel) }} ·
												{{ trendLabel(workflow.trend) }}
											</N8nText>
										</div>
										<div :class="$style.rankingMetric">
											<strong>{{ formatPercent(workflow.failureRate) }}</strong>
											<span :class="$style.metricCaption">
												{{ i18n.baseText('insights.analyst.table.risk.failureRate') }}
											</span>
										</div>
										<N8nTooltip :content="i18n.baseText('insights.analyst.table.openWorkflow')">
											<N8nIconButton
												:href="workflowHref(workflow.workflowId)"
												icon="arrow-up-right"
												type="tertiary"
												size="mini"
												:class="$style.openButton"
											/>
										</N8nTooltip>
									</li>
								</ol>
							</section>
						</div>

						<section :class="$style.rankingCard" data-test-id="insights-analyst-low-impact">
							<header :class="$style.rankingHeader">
								<N8nHeading tag="h2" size="medium">
									{{ i18n.baseText('insights.analyst.table.lowImpact') }}
								</N8nHeading>
								<N8nText size="small" color="text-base">
									{{ i18n.baseText('insights.analyst.table.lowImpact.subtitle') }}
								</N8nText>
							</header>
							<div :class="$style.lowImpactGrid">
								<a
									v-for="workflow in lowImpactWorkflows"
									:key="workflow.workflowId"
									:href="workflowHref(workflow.workflowId)"
									:class="$style.lowImpactCard"
								>
									<N8nText tag="p" bold>{{ workflow.workflowName }}</N8nText>
									<N8nText tag="p" size="small" color="text-base">
										{{ formatLowImpactSubtitle(workflow) }}
									</N8nText>
									<N8nText tag="p" size="xsmall" color="text-light" :class="$style.lowImpactFooter">
										{{ i18n.baseText('insights.analyst.lowImpact.recommendation') }}
									</N8nText>
								</a>
							</div>
						</section>
					</div>
				</section>

				<InsightsAnalystPanel
					:suggested-prompts="overview.suggestedPrompts"
					:messages="messages"
					:is-loading="isAsking"
					@ask="askAnalyst"
				/>
			</main>
		</div>
	</div>
</template>

<style lang="scss" module>
.insightsView {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xl);
	overflow: auto;
}

.insightsContainer {
	width: 100%;
	max-width: var(--content-container--width);
	padding: var(--spacing--lg) var(--spacing--2xl);
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--lg);
}

.hero {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: var(--spacing--lg);
	flex-wrap: wrap;
}

.heroText {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	max-width: 60ch;
}

.heroActions {
	display: flex;
	align-items: center;
	gap: var(--spacing--md);
}

.dateRange {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--3xs);
	color: var(--color--text--shade-1);
	font-size: var(--font-size--2xs);
	padding: var(--spacing--3xs) var(--spacing--xs);
	border: var(--border);
	border-radius: var(--radius--full);
	background: var(--background--surface);
}

.loading {
	display: flex;
	justify-content: center;
	padding: var(--spacing--3xl);
}

.layout {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(320px, 36%);
	gap: var(--spacing--lg);
	align-items: stretch;
}

.analytics {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--lg);
	min-width: 0;
}

.highlightsStrip {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: var(--spacing--md);
}

.highlightCard {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	padding: var(--spacing--md);
	border-radius: var(--radius--lg);
	border: var(--border);
	background: var(--background--surface);
	box-shadow: var(--shadow--xs);
	border-left-width: 3px;
}

.highlightHeader {
	display: flex;
	align-items: center;
	gap: var(--spacing--3xs);
	color: var(--color--text--shade-1);
}

.highlightValue {
	color: var(--color--text);
}

.tone-positive {
	border-left-color: var(--color--success);

	.highlightHeader {
		color: var(--color--success);
	}
}

.tone-warning {
	border-left-color: var(--color--warning);

	.highlightHeader {
		color: var(--color--warning);
	}
}

.tone-neutral {
	border-left-color: var(--color--primary);

	.highlightHeader {
		color: var(--color--primary);
	}
}

.insightsBanner {
	margin-bottom: 0;

	ul {
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}
}

.insightsContent {
	padding: var(--spacing--lg);
	border: var(--border);
	border-top: 0;
	border-bottom-left-radius: var(--radius--lg);
	border-bottom-right-radius: var(--radius--lg);
	background: var(--color--background--light-3);
	display: flex;
	flex-direction: column;
	gap: var(--spacing--lg);
}

.insightsChartWrapper {
	position: relative;
	height: 292px;
	background: var(--background--surface);
	border-radius: var(--radius--lg);
	padding: var(--spacing--md);
	border: var(--border);
}

.tablesGrid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--spacing--md);
}

.rankingCard {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	padding: var(--spacing--md);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
}

.rankingHeader {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.rankingList {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	list-style: none;
	padding: 0;
	margin: 0;
}

.rankingRow {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto auto;
	align-items: center;
	gap: var(--spacing--md);
	padding: var(--spacing--sm) var(--spacing--md);
	border-radius: var(--radius);

	&:hover {
		background: var(--background-hover);

		.openButton {
			opacity: 1;
		}
	}
}

.rankBadge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: var(--radius--full);
	background: var(--background--subtle);
	color: var(--color--text--shade-1);
	font-size: var(--font-size--2xs);
	font-weight: var(--font-weight--bold);
	font-family: var(--font-family--monospace);
}

.rankingBody {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--5xs);
	min-width: 0;
}

.rankingMetric {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: var(--spacing--5xs);
	color: var(--color--text);

	strong {
		font-size: var(--font-size--md);
	}
}

.trendChip {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--5xs);
	padding: var(--spacing--5xs) var(--spacing--2xs);
	border-radius: var(--radius--full);
	font-size: var(--font-size--3xs);
	font-weight: var(--font-weight--regular);
	background: var(--background--subtle);
	color: var(--color--text--tint-1);
}

.trend-improving {
	color: var(--color--success);
}

.trend-degrading {
	color: var(--color--danger);
}

.trend-stable {
	color: var(--color--text--tint-1);
}

.metricCaption {
	font-size: var(--font-size--3xs);
	color: var(--color--text--tint-1);
}

.openButton {
	opacity: 0;
	transition: opacity 0.15s ease-in-out;
}

.lowImpactGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: var(--spacing--md);
}

.lowImpactCard {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	padding: var(--spacing--md);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--subtle);
	color: inherit;
	text-decoration: none;
	transition: border-color 0.15s ease;

	&:hover {
		border-color: var(--color--primary);
	}
}

.lowImpactFooter {
	margin-top: var(--spacing--3xs);
}

@media (max-width: 1200px) {
	.layout,
	.tablesGrid {
		grid-template-columns: 1fr;
	}
}
</style>
