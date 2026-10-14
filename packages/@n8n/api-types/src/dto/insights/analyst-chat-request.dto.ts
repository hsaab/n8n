import { z } from 'zod';

import { Z } from '../../zod-class';

export class InsightsAnalystChatRequestDto extends Z.class({
	message: z.string().trim().min(1).max(2000),
}) {}
