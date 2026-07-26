import { getSession } from '@/lib/session';

export async function GET(request) {
  const session = await getSession();

  if (session.role) {
    return Response.json(
      {
        role: session.role,
        username: session.username || null,
        assignedStation: session.assignedStation || null,
      },
      { status: 200 }
    );
  }

  return Response.json(
    { role: null, username: null, assignedStation: null },
    { status: 200 }
  );
}
