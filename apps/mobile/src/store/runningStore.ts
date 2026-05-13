export type RunningState = {
  isRunning: boolean;
  distance: number;
};

export const initialRunningState: RunningState = {
  isRunning: false,
  distance: 0,
};
