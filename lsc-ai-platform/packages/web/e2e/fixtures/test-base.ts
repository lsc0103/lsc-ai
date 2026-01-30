import { test as base } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';

type TestFixtures = {
  api: ApiHelper;
};

export const test = base.extend<TestFixtures>({
  api: async ({ request }, use) => {
    const api = new ApiHelper(request);
    await api.login();
    await use(api);
  },
});

export { expect } from '@playwright/test';
