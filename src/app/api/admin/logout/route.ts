import { NextResponse } from 'next/server';
import { endSession } from '@/lib/server/admin';

export async function POST() {
  await endSession();
  return NextResponse.json({ success: true });
}
