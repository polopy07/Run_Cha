import { create } from 'zustand';
import { Coordinate, calculateDistanceInMeters } from '../utils/geoUtils';

type RunningState = {
  isRunning: boolean;
  distance: number;
  path: Coordinate[];
  startedAt: string | null;
  earnedPoints: number;

  startRunning: () => void;
  updatePosition: (coord: Coordinate) => void;
  finishRunning: () => { path: Coordinate[]; distance: number; startedAt: string | null; earnedPoints: number };
  resetRunning: () => void;
};

const useRunningStore = create<RunningState>((set, get) => ({
  isRunning: false,
  distance: 0,
  path: [],
  startedAt: null,
  earnedPoints: 0,

  startRunning: () => {
    set({
      isRunning: true,
      distance: 0,
      path: [],
      startedAt: new Date().toISOString(),
      earnedPoints: 0,
    });
  },

  updatePosition: (coord) => {
    const { path, distance } = get();
    let newDistance = distance;

    if (path.length > 0) {
      const lastCoord = path[path.length - 1];
      newDistance += calculateDistanceInMeters(lastCoord, coord);
    }

    set({
      path: [...path, coord],
      distance: newDistance,
    });
  },

  // TODO: earnedPoints는 서버 러닝 완료 API 연동 시 응답값으로 업데이트 예정
  finishRunning: () => {
    const { path, distance, startedAt, earnedPoints } = get();
    set({ isRunning: false });
    return { path, distance, startedAt, earnedPoints };
  },

  resetRunning: () => {
    set({
      isRunning: false,
      distance: 0,
      path: [],
      startedAt: null,
      earnedPoints: 0,
    });
  },
}));

export default useRunningStore;
