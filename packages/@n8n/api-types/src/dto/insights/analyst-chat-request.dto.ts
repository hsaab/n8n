import { z } from 'zod';

import { Z } from '../../zod-class';

export class InsightsAnalystChatRequestDto extends Z.class({
	prompt: z.string().min(1),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	projectId: z.string().optional(),
}) {}
