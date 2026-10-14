import { emphasizeWorkflowNames } from '@/features/execution/insights/analyst/insights-analyst.format';

describe('emphasizeWorkflowNames', () => {
	it('returns the whole text unemphasized when there are no names', () => {
		expect(emphasizeWorkflowNames('No citations here.', [])).toEqual([
			{ text: 'No citations here.', emphasized: false },
		]);
	});

	it('emphasizes cited workflow names and keeps surrounding text', () => {
		expect(
			emphasizeWorkflowNames('Support Triage saved the most time.', ['Support Triage']),
		).toEqual([
			{ text: 'Support Triage', emphasized: true },
			{ text: ' saved the most time.', emphasized: false },
		]);
	});

	it('prefers the longest name when one name contains another', () => {
		const segments = emphasizeWorkflowNames('Invoice Reminder (EU) failed.', [
			'Invoice Reminder',
			'Invoice Reminder (EU)',
		]);

		expect(segments).toEqual([
			{ text: 'Invoice Reminder (EU)', emphasized: true },
			{ text: ' failed.', emphasized: false },
		]);
	});
});
