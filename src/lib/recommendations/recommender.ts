import Registration from '@/models/Registration';
import Event, { IEvent } from '@/models/Event';
import mongoose from 'mongoose';
import { RECOMMENDATION_CONFIG } from '@/lib/constants';

export interface RecommendationResult {
  event: IEvent;
  score: number;
  reason: string;
}

async function buildMatrix(): Promise<{
  userEvents: Map<string, Set<string>>;
  eventUserCount: Map<string, number>;
  totalUsers: number;
}> {
  const registrations = await Registration.find({}, 'userId eventId').lean();

  const userEvents = new Map<string, Set<string>>();
  const eventUserCount = new Map<string, number>();

  for (const reg of registrations) {
    const uid = reg.userId.toString();
    const eid = reg.eventId.toString();

    if (!userEvents.has(uid)) userEvents.set(uid, new Set());
    userEvents.get(uid)!.add(eid);

    eventUserCount.set(eid, (eventUserCount.get(eid) ?? 0) + 1);
  }

  return { userEvents, eventUserCount, totalUsers: userEvents.size };
}

function computeIDF(userCount: number, totalUsers: number): number {
  return Math.log(totalUsers / (userCount + 1)) + 1;
}

function cosineSimilarity(
  eventsA: Set<string>,
  eventsB: Set<string>,
  idfWeights: Map<string, number>
): number {
  const allEvents = new Set([...eventsA, ...eventsB]);

  let dot = 0, magA = 0, magB = 0;

  for (const eid of allEvents) {
    const idf = idfWeights.get(eid) ?? 1;
    const a = eventsA.has(eid) ? idf : 0;
    const b = eventsB.has(eid) ? idf : 0;
    dot  += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function getRecommendations(
  userId: string,
  topK = RECOMMENDATION_CONFIG.TOP_K
): Promise<RecommendationResult[]> {
  const { userEvents, eventUserCount, totalUsers } = await buildMatrix();

  const targetEvents = userEvents.get(userId);

  if (!targetEvents || targetEvents.size === 0) {
    return getTrendingEvents(topK);
  }

  const idfWeights = new Map<string, number>();
  for (const [eid, count] of eventUserCount.entries()) {
    idfWeights.set(eid, computeIDF(count, totalUsers));
  }

  const similarities: Array<{ uid: string; sim: number }> = [];
  for (const [uid, events] of userEvents.entries()) {
    if (uid === userId) continue;
    const sim = cosineSimilarity(targetEvents, events, idfWeights);
    if (sim > 0) similarities.push({ uid, sim });
  }

  similarities.sort((a, b) => b.sim - a.sim);
  const neighbours = similarities.slice(0, 10);

  if (neighbours.length === 0) return getTrendingEvents(topK);

  const candidateScores = new Map<string, number>();
  for (const { uid, sim } of neighbours) {
    const neighbourEvents = userEvents.get(uid)!;
    for (const eid of neighbourEvents) {
      if (targetEvents.has(eid)) continue;
      const idf = idfWeights.get(eid) ?? 1;
      const currentScore = candidateScores.get(eid) ?? 0;
      candidateScores.set(eid, currentScore + sim * idf);
    }
  }

  if (candidateScores.size === 0) return getTrendingEvents(topK);

  const sorted = [...candidateScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);

  const eventIds = sorted.map(([eid]) => eid);
  const events = await Event.find({
    _id: { $in: eventIds },
    isActive: true,
    date: { $gte: new Date() },
  }).lean();

  const eventMap = new Map(events.map(e => [(e._id as any).toString(), e]));

  return sorted
    .filter(([eid]) => eventMap.has(eid))
    .map(([eid, score]) => {
      const neighbourCount = neighbours.filter(n =>
        userEvents.get(n.uid)?.has(eid)
      ).length;
      return {
        event: eventMap.get(eid)! as unknown as IEvent,
        score: Math.round(score * 1000) / 1000,
        reason: `${neighbourCount} student${neighbourCount > 1 ? 's' : ''} with similar interests attended`,
      };
    });
}

async function getTrendingEvents(topK: number): Promise<RecommendationResult[]> {
  const events = await Event.find({
    isActive: true,
    date: { $gte: new Date() },
  })
    .sort({ registeredCount: -1 })
    .limit(topK)
    .lean();

  return events.map(event => ({
    event: event as unknown as IEvent,
    score: 0,
    reason: 'Trending on campus',
  }));
}
