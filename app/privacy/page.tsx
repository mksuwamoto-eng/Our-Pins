export const metadata = { title: 'Privacy Policy — Our Pins' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 font-serif text-3xl text-[var(--fg)]">Privacy Policy</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">Last updated: July 5, 2026</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--fg)]">
        <section>
          <h2 className="mb-2 font-serif text-xl">Who we are</h2>
          <p>
            Our Pins is a private, invite-only community map for members of the Greek community
            in Japan. It is run by community volunteers, not a company. This page explains what
            personal data we collect and how we use it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Sign-in information</strong>: your email address and, depending on the
              sign-in method you choose, your name and profile picture from Google or LINE.
            </li>
            <li>
              <strong>Profile information you provide</strong>: display name, optional photo,
              optional full name, and optional social links.
            </li>
            <li>
              <strong>Content you post</strong>: places you pin, vouches, and comments.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">Sign-in with LINE</h2>
          <p>
            When you sign in with LINE, we receive your LINE user ID, display name, profile
            picture, and — with your consent — your <strong>email address</strong>. We use your
            email address only to identify your account, to link your LINE sign-in with an
            existing Our Pins account registered under the same email, and for community admins
            to contact you about your membership. We do not use your email address for
            advertising or marketing, and we never sell it or share it with third parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">How we use your data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To verify that you are an invited member and keep the community private.</li>
            <li>To show your profile and contributions to other members.</li>
            <li>To let admins manage invitations and membership.</li>
          </ul>
          <p className="mt-2">
            Your email address is visible only to community admins, never to other members. We
            do not send marketing emails and we do not sell or share your data with third
            parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">Where your data is stored</h2>
          <p>
            Data is stored with Supabase (hosted in Tokyo, Japan) and the app is served by
            Vercel. Map data is provided by Google Maps. Pin and vouch text may be processed by
            Anthropic&apos;s Claude API to provide translations and answer member questions;
            this content is not used to train AI models.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-xl">Your choices</h2>
          <p>
            You can edit your profile at any time in Settings, and you can delete your account
            and its data from Settings → Danger zone. For any questions or data requests,
            contact a community admin.
          </p>
        </section>
      </div>
    </main>
  );
}
