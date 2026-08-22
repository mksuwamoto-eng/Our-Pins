import { describe, expect, it, vi } from 'vitest';

// The module pulls in the Supabase admin client at import time; the pure path
// helpers under test don't touch it.
vi.mock('../supabase/server', () => ({ createSupabaseAdminClient: () => ({}) }));

const { isOwnAvatarPath, ownAvatarPath, PENDING_AVATAR } = await import('./line-avatar');

const ME = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';

describe('isOwnAvatarPath', () => {
  it('accepts the caller’s own upload path', () => {
    expect(isOwnAvatarPath(ownAvatarPath(ME), ME)).toBe(true);
  });

  it('accepts the pending placeholder', () => {
    expect(isOwnAvatarPath(PENDING_AVATAR, ME)).toBe(true);
  });

  it('rejects another member’s avatar', () => {
    expect(isOwnAvatarPath(ownAvatarPath(OTHER), ME)).toBe(false);
  });

  it('rejects paths that merely start with the caller’s folder', () => {
    expect(isOwnAvatarPath(`avatars/${ME}/../${OTHER}/profile.jpg`, ME)).toBe(false);
    expect(isOwnAvatarPath(`avatars/${ME}/other.jpg`, ME)).toBe(false);
  });

  it('rejects arbitrary storage paths', () => {
    expect(isOwnAvatarPath('some-pin-id/photo.jpg', ME)).toBe(false);
    expect(isOwnAvatarPath('', ME)).toBe(false);
  });
});
