export type LocalClock = () => number;

export const browserClock: LocalClock = () =>
  performance.timeOrigin + performance.now();

export const clockOffset = (serverNow: number, localNow: number) =>
  serverNow - localNow;

export const serverTime = (offset: number, localNow: number) =>
  localNow + offset;
