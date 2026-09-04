import { Logger } from '@n8n/backend-common';
import { mockLogger } from '@n8n/backend-test-utils';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';
import { InstanceSettings } from 'n8n-core';

import { InsightsAnalystSeedService } from '../insights-analyst-seed.service';
import { InsightsModule } from '../insights.module';
import { InsightsService } from '../insights.service';

describe('InsightsAnalystSeedService', () => {
	it('boot does not seed during tests so licensed Insights fixtures stay isolated', async () => {
		const ensureSeeded = jest.fn().mockRejectedValue(new Error('seed failed'));
		Container.set(InsightsAnalystSeedService, {
			ensureSeeded,
		} as unknown as InsightsAnalystSeedService);
		Container.set(InsightsService, mock<InsightsService>({ init: jest.fn() }));
		Container.set(Logger, mockLogger());
		Container.set(InstanceSettings, mock<InstanceSettings>({ instanceType: 'main' }));

		await expect(Container.get(InsightsModule).init()).resolves.toBeUndefined();
		expect(ensureSeeded).not.toHaveBeenCalled();
	});
});
