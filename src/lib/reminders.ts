import connectDB from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import { sendConfirmationsForEvent } from '@/lib/confirmations';

export async function autoTriggerConfirmations(): Promise<void> {
  try {
    await connectDB();
    const now = new Date();
    const windowStart = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);

    const events = await Event.find({
      isActive:    true,
      isCancelled: { $ne: true },
      date:        { $gte: windowStart, $lte: windowEnd },
    }).select('_id title').lean();

    if (events.length === 0) return;

    for (const event of events) {
      const evt = event as unknown as { _id: import('mongoose').Types.ObjectId; title: string };

      const pendingCount = await Registration.countDocuments({
        eventId:               evt._id,
        confirmed:             false,
        confirmationEmailSent: false,
      });

      if (pendingCount === 0) continue;

      // Direct function call — no HTTP self-request, works in all environments
      try {
        const result = await sendConfirmationsForEvent(evt._id.toString());
        if (result.sent > 0) {
          console.log(`[AutoConfirm] ${result.sent} email${result.sent !== 1 ? 's' : ''} sent for "${evt.title}"`);
        }
      } catch (err) {
        console.error('[AutoConfirm] Failed for event', evt._id, err);
      }
    }
  } catch (err) {
    console.error('[AutoConfirm] Failed:', err);
  }
}

export async function sendPendingReminders(): Promise<void> {
  try {
    // Placeholder for future reminder logic
  } catch (err) {
    console.error('[Reminders] Failed:', err);
  }
}
