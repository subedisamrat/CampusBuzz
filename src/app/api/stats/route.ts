import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Registration from '@/models/Registration';
import User from '@/models/User';

export async function GET() {
  try {
    await dbConnect();
    
    const eventsHosted = await Event.countDocuments();
    const studentsRegistered = await Registration.countDocuments();
    
    const checkedInCount = await Registration.countDocuments({ checkedIn: true });
    const checkInRate = studentsRegistered > 0 ? Math.round((checkedInCount / studentsRegistered) * 100) : 0;
    
    // Fallbacks to 0 or 15+ 
    let departments = 15;
    try {
      const depts = await User.distinct('department');
      if (depts && depts.length > 0) {
        departments = depts.length;
      }
    } catch {
       // ignore
    }

    return NextResponse.json({
      stats: [
        { val: `${eventsHosted > 50 ? eventsHosted + '+' : eventsHosted}`, label: "Events Hosted" },
        { val: `${studentsRegistered > 100 ? studentsRegistered + '+' : studentsRegistered}`, label: "Students Registered" },
        { val: `${checkInRate}%`, label: "Check-in Rate" },
        { val: `${departments}+`, label: "Departments" },
      ]
    });
  } catch (err) {
    console.error('[API /stats]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
