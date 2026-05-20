import { applyThemeToBody, isValidTheme, isValidThemeOption } from '@/app/stores/ui.utils';

describe('ui.utils', () => {
	describe('isValidTheme', () => {
		it('should accept light and dark themes', () => {
			expect(isValidTheme('light')).toBe(true);
			expect(isValidTheme('dark')).toBe(true);
		});

		it('should reject system and invalid values', () => {
			expect(isValidTheme('system')).toBe(false);
			expect(isValidTheme(null)).toBe(false);
			expect(isValidTheme('invalid')).toBe(false);
		});
	});

	describe('isValidThemeOption', () => {
		it('should accept light, dark, and system themes', () => {
			expect(isValidThemeOption('light')).toBe(true);
			expect(isValidThemeOption('dark')).toBe(true);
			expect(isValidThemeOption('system')).toBe(true);
		});

		it('should reject invalid values', () => {
			expect(isValidThemeOption(null)).toBe(false);
			expect(isValidThemeOption('invalid')).toBe(false);
		});
	});

	describe('applyThemeToBody', () => {
		it('should set data-theme for explicit themes', () => {
			const documentBody = document.createElement('body');
			const windowMock = { document: { body: documentBody } } as Window;

			applyThemeToBody('dark', windowMock);
			expect(documentBody.getAttribute('data-theme')).toBe('dark');
		});

		it('should remove data-theme for system theme', () => {
			const documentBody = document.createElement('body');
			documentBody.setAttribute('data-theme', 'dark');
			const windowMock = { document: { body: documentBody } } as Window;

			applyThemeToBody('system', windowMock);
			expect(documentBody.getAttribute('data-theme')).toBeNull();
		});
	});
});
