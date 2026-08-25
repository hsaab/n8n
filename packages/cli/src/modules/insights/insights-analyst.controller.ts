import type { InsightsAnalystOverview } from '@n8n/api-types';
import { InsightsDateFilterDto } from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Get, GlobalScope, Query, RestController } from '@n8n/decorators';

import { InsightsAnalystOverviewService } from './insights-analyst-overview.service';

@RestController('/insights/analyst')
export class InsightsAnalystController {
	constructor(private readonly overviewService: InsightsAnalystOverviewService) {}

	@Get('/overview')
	@GlobalScope('insights:list')
	async getOverview(
		_req: AuthenticatedRequest,
		_res: Response,
		@Query query: InsightsDateFilterDto = {},
	): Promise<InsightsAnalystOverview> {
		return await this.overviewService.getOverview(query);
	}
}
