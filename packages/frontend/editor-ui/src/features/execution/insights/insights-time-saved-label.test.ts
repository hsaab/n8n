import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

vi.mock('@n8n/i18n', () => ({
	useI18n: () => ({
		baseText: (key: string, options?: { interpolate?: { value?: string } }) => {
			const value = options?.interpolate?.value ?? '';
			if (key === 'insights.timeSaved.label.hours') return `${value}h`;
			return `${value}m`;
		},
	}),
}));

describe('formatInsightsTimeSavedLabel', () => {
	it('formats amounts under an hour in minutes', () => {
		expect(formatInsightsTimeSavedLabel(30)).toBe('30m');
	});

	it('formats amounts of an hour or more in hours', () => {
		expect(formatInsightsTimeSavedLabel(90)).toBe('2h');
	});

	it('keeps the sign for a negative deviation', () => {
		expect(formatInsightsTimeSavedLabel(-90)).toBe('-2h');
	});
});
