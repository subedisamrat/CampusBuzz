import { IsolationForest } from './isolationForest';
import { extractFeatures } from './checkinFeatures';
import Registration from '@/models/Registration';
import { ML_THRESHOLDS } from '@/lib/constants';

let model: IsolationForest | null = null;
let checkinsSinceRetrain = 0;
let trainingCount = 0;

export async function trainModel(): Promise<void> {
  const checkins = await Registration.find({
    checkedIn: true,
    adminOverride: { $ne: true },
  })
    .populate('eventId', 'category date isActive isCancelled')
    .lean();

  const featureVectors: number[][] = [];

  for (const reg of checkins) {
    try {
      const event = reg.eventId as any;
      if (!event || event.isCancelled || event.isActive === false) continue;
      const features = await extractFeatures({
        userId: reg.userId.toString(),
        eventId: reg.eventId.toString(),
        eventCategory: event.category,
        eventDate: event.date,
        registrationCreatedAt: reg.createdAt,
        checkinTime: reg.checkedInAt!,
      });
      featureVectors.push(features);
    } catch (err) {
      console.warn('[IsolationForest] Skipping malformed check-in record:', err);
    }
  }

  if (featureVectors.length < ML_THRESHOLDS.checkin.minTrainSamples) {
    console.warn(`[IsolationForest] Only ${featureVectors.length} valid samples — skipping training (need ${ML_THRESHOLDS.checkin.minTrainSamples})`);
    return;
  }

  model = new IsolationForest(ML_THRESHOLDS.checkin.numTrees, ML_THRESHOLDS.checkin.subsampleSize);
  model.train(featureVectors);
  trainingCount = featureVectors.length;
  checkinsSinceRetrain = 0;
  console.log(`[IsolationForest] Trained on ${featureVectors.length} samples`);
}

export async function ensureModelTraining(): Promise<void> {
  if (!model || !model.isTrained) {
    await trainModel();
  }
}

export async function getModel(): Promise<IsolationForest | null> {
  if (!model) await trainModel();
  return model;
}

export function isModelReady(): boolean {
  return model !== null && model.isTrained && trainingCount >= ML_THRESHOLDS.checkin.minTrainSamples;
}

export { ensureModelTraining as ensureCheckinModel };

export function recordCheckin(): void {
  checkinsSinceRetrain++;
  if (checkinsSinceRetrain >= ML_THRESHOLDS.checkin.retrainAfter) {
    trainModel().catch(err =>
      console.error('[IsolationForest] Retrain failed:', err)
    );
  }
}

export function getModelStats() {
  return {
    trained: isModelReady(),
    trainingCount,
    checkinsSinceRetrain,
  };
}
