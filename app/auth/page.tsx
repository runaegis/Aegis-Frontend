import { redirect } from 'next/navigation';

function readSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = readSingleParam(params.next);

  if (next) {
    redirect(`/auth/signin?next=${encodeURIComponent(next)}`);
  }

  redirect('/auth/signin');
}

