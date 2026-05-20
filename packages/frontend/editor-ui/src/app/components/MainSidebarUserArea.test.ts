import { createComponentRenderer } from '@/__tests__/render';
import { createTestingPinia } from '@pinia/testing';
import { mockedStore } from '@/__tests__/utils';
import MainSidebarUserArea from '@/app/components/MainSidebarUserArea.vue';
import { useUIStore } from '@/app/stores/ui.store';
import { useUsersStore } from '@/features/settings/users/users.store';

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: vi.fn(),
	}),
}));

describe('MainSidebarUserArea', () => {
	const renderComponent = createComponentRenderer(MainSidebarUserArea, {
		pinia: createTestingPinia(),
		props: {
			fullyExpanded: true,
			isCollapsed: false,
		},
	});

	let uiStore: ReturnType<typeof mockedStore<typeof useUIStore>>;

	beforeEach(() => {
		uiStore = mockedStore(useUIStore);
		uiStore.theme = 'system';
		uiStore.setTheme = vi.fn((theme) => {
			uiStore.theme = theme;
		});

		const usersStore = mockedStore(useUsersStore);
		usersStore.currentUser = {
			id: '1',
			firstName: 'Test',
			lastName: 'User',
			fullName: 'Test User',
		} as ReturnType<typeof useUsersStore>['currentUser'];
	});

	it('should apply dark theme immediately from the user menu', async () => {
		const { getByTestId } = renderComponent();

		await getByTestId('main-sidebar-user-menu').click();
		await getByTestId('user-menu-item-theme-dark').click();

		expect(uiStore.setTheme).toHaveBeenCalledWith('dark');
	});

	it('should apply light theme immediately from the user menu', async () => {
		const { getByTestId } = renderComponent();

		await getByTestId('main-sidebar-user-menu').click();
		await getByTestId('user-menu-item-theme-light').click();

		expect(uiStore.setTheme).toHaveBeenCalledWith('light');
	});

	it('should apply system theme immediately from the user menu', async () => {
		const { getByTestId } = renderComponent();

		await getByTestId('main-sidebar-user-menu').click();
		await getByTestId('user-menu-item-theme-system').click();

		expect(uiStore.setTheme).toHaveBeenCalledWith('system');
	});
});
