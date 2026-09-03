import { z } from 'zod';

import { Z } from '../../zod-class';

export class InsightsAnalystChatRequestDto extends Z.class({
	question: z.string().trim().min(1).max(2000),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
}) {}
