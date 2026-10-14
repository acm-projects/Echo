export type MockScenario = 'normal' | 'empty' | 'error' | 'slow';

export const dataConfig = {
  useMockData: true,
  scenario: 'normal' as MockScenario,
  slowDelayMs: 1500,
};
