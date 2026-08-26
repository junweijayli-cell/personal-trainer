import { headers } from 'next/headers';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const PERCENT_ENCODED_UTF8 = 'percent-encoded-utf-8';

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get('oai-authenticated-user-id');
  const email = requestHeaders.get('oai-authenticated-user-email');
  if (!userId || !email) {
    if (process.env.NODE_ENV === 'development') {
      const localEmail = requestHeaders.get('x-relay-test-email') ?? 'seedy@sites.test';
      const localUserId = requestHeaders.get('x-relay-test-user') ?? 'local-sites-user';
      return { userId: localUserId, email: localEmail, fullName: 'Local Test User', displayName: 'Local Test User' };
    }
    return null;
  }

  const encodedFullName = requestHeaders.get('oai-authenticated-user-full-name');
  let fullName: string | null = null;
  if (encodedFullName && requestHeaders.get('oai-authenticated-user-full-name-encoding') === PERCENT_ENCODED_UTF8) {
    try {
      fullName = decodeURIComponent(encodedFullName);
    } catch {
      fullName = null;
    }
  }

  return { userId, email, fullName, displayName: fullName ?? email.split('@')[0] };
}
