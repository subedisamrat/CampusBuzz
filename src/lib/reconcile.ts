import Event from '@/models/Event';
import Registration from '@/models/Registration';
import mongoose from 'mongoose';

export async function reconcileEventCount(eventId: string): Promise<void> {
  const trueCount = await Registration.countDocuments({ eventId });
  await Event.findByIdAndUpdate(eventId, { registeredCount: trueCount });
}

export async function reconcileAllEvents(): Promise<void> {
  const events = await Event.find({ isActive: true }, '_id').lean();
  await Promise.allSettled(
    events.map(e => reconcileEventCount((e._id as mongoose.Types.ObjectId).toString()))
  );
  console.log(`[Reconcile] Synced registeredCount for ${events.length} events`);
}
