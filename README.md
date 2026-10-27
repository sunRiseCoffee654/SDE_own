# SDE Orbit — Mobile-first SDE preparation tracker

A mobile-first React + TypeScript app project with a Material UI light theme, floating pill navigation inspired by the supplied reference, animated task and topic states, Framer Motion transitions, GSAP entrance choreography, notes, tasks, focus timer, and reason-based reminder check-ins.

## What's included

- `src/`: React/TypeScript app source.
- `src/data/syllabus.ts`: 12-phase syllabus with main topics only.
- `src/lib/notifications.ts`: Capacitor local reminder scheduling, plus a browser notification fallback.
- `src/lib/supabase.ts`: Supabase client setup (publishable key only).
- `supabase/migrations/20261026000000_sde_orbit_app_state.sql`: RLS-protected per-account cloud state table.
- `.env.example`: required public client configuration placeholders.
- `preview.html`: offline, clickable UI prototype for quick inspection; its data is device-local and is not the cloud-connected app.

## Cloud setup required

The connected Supabase workspace currently has a project called `VaultWire` whose existing tables are banking/ledger-related. This project is intentionally **not** configured as SDE Orbit's database. Use a new, dedicated Supabase project for SDE Orbit.

1. Create a new Supabase project in your chosen organization.
2. Open the project's Connect dialog / API Keys settings and copy the Project URL and **publishable** key (`sb_publishable_...`). Never use a secret or `service_role` key in the app.
3. Copy `.env.example` to `.env.local` and set:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

4. Apply `supabase/migrations/20261026000000_sde_orbit_app_state.sql` to that dedicated project's database.
5. Enable the desired email/password sign-in method in Supabase Auth. If email confirmation is enabled, configure native deep links before expecting email confirmation links to open the installed Android app.

When these values are absent, the React app intentionally starts in demo mode and stores data in local browser/app storage. This is not uninstall-safe cloud storage. Cloud persistence becomes available only after the new project, migration, and environment configuration are set up.

## Run the web development version

```bash
npm install
npm run dev
```

## Build the Android app

Install Android Studio and a compatible Android SDK/JDK, then:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Build and run the Android project from Android Studio. `npx cap add android` only needs to be run once. For subsequent web changes, use `npm run build && npx cap sync android`.

## Reminders and platform limits

- The native build uses Capacitor Local Notifications to schedule reminders on-device.
- Android 13+ requires notification permission; newer Android versions may impose exact-alarm restrictions. Reminder delivery is therefore subject to OS settings and manufacturer battery policies.
- Clearing a system notification cannot be prevented reliably by a normal app. Clearing it does not complete a task; closing a check-in from inside the app is designed to require a reason.
- The web fallback can notify only while the browser runtime is alive; mobile-native testing is needed for reliable background delivery.

## Notes on this implementation stage

This repository contains the initial interactive application foundation and the cloud schema. It has not been built here because the execution environment could not reach the npm registry to download dependencies. Install dependencies and run `npm run build` in a network-enabled development environment to verify and produce the Android build. The cloud backend has not been provisioned for this app yet.
