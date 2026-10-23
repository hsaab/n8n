import { z } from 'zod';

import { Z } from '../../zod-class';

export class InsightsAnalystDashboardQueryDto extends Z.class({
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
}) {}
