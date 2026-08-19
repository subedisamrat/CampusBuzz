import { IsolationForest } from '@/lib/ml/isolationForest';

describe('IsolationForest', () => {
  test('isTrained is false before training', () => {
    const forest = new IsolationForest();
    expect(forest.isTrained).toBe(false);
  });

  test('trains successfully on sufficient data', () => {
    const forest = new IsolationForest(10, 32);
    const normalData = Array.from({ length: 50 }, () => [
      Math.random() * 2 + 8,
      Math.random() * 5 + 1,
      Math.random() * 10 + 5,
      Math.random() * 0.4 + 0.6,
      Math.random() * 30 - 15,
      Math.random() * 5,
    ]);
    forest.train(normalData);
    expect(forest.isTrained).toBe(true);
  });

  test('anomaly score for normal point is lower than for outlier', () => {
    const forest = new IsolationForest(100, 64);

    const normalData = Array.from({ length: 100 }, () => [
      9 + Math.random(),
      2 + Math.random() * 3,
      10 + Math.random() * 5,
      0.8 + Math.random() * 0.2,
      0 + Math.random() * 30,
      3 + Math.random() * 2,
    ]);
    forest.train(normalData);

    const normalPoint  = [9.5, 3,  12, 0.9,  15, 4];
    const anomalyPoint = [3,   0.001, 1, 0,  -180, 0];

    const normalScore  = forest.anomalyScore(normalPoint);
    const anomalyScore = forest.anomalyScore(anomalyPoint);

    expect(anomalyScore).toBeGreaterThan(normalScore);
    expect(anomalyScore).toBeGreaterThan(0.5);
  });

  test('score is between 0 and 1', () => {
    const forest = new IsolationForest(10, 32);
    const data = Array.from({ length: 30 }, () =>
      [Math.random() * 24, Math.random() * 7, Math.random() * 20,
       Math.random(), Math.random() * 120 - 60, Math.random() * 10]
    );
    forest.train(data);

    for (let i = 0; i < 20; i++) {
      const point = [Math.random() * 24, Math.random() * 7, Math.random() * 20,
                     Math.random(), Math.random() * 120 - 60, Math.random() * 10];
      const score = forest.anomalyScore(point);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
