# Skemaka — App Store Connect Submission Pack

Paste-ready content for submitting the Skemaka iOS app (bundle `com.skemaka.app`, v1.0.0).
Grounded in the actual codebase as of June 2026. Sections marked **⚠️ HUMAN PREP** require action only you can take.

---

## 0. Human-prep checklist (do these before submitting)

- [ ] **Apple Developer Program** enrolled; **"Sign in with Apple" capability** enabled on App ID `com.skemaka.app`.
- [ ] Fill `eas.json` submit creds: `appleId`, `ascAppId`, `appleTeamId`.
- [ ] **Seed a Google demo MANAGER account** (e.g. `appreview@skemaka.app`) inside an org with realistic sample data: several employees, a published weekly schedule, a couple of pending availability + time-off requests. The reviewer must land in a *populated* manager view.
- [ ] **Publish/verify the Google OAuth consent screen** (or allowlist the demo email as a Test user) so "Continue with Google" isn't blocked for the reviewer.
- [ ] Put the demo creds in App Store Connect's structured **Sign-In Information** fields *and* the review-notes placeholders; set a **Support email/URL**.
- [ ] **Decide iPad:** capture iPad 13" screenshots **OR** set `supportsTablet: false` in `app.json` to drop the iPad requirement (app is phone-first).
- [ ] Confirm `/privacy` and `/terms` render publicly (no login wall) on the production domain.

---

## 1. App Review Notes

**Why it matters:** the whole app is behind login (no guest mode), and a brand-new Sign in with Apple/Google user has **no org** → lands on onboarding/empty state. The reviewer needs a **pre-seeded demo MANAGER account**, and should sign in with **Google** (Sign in with Apple can't be pre-seeded with credentials).

Paste into **App Review Information → Notes**:

```
WHAT SKEMAKA IS
Skemaka is a staff-scheduling app for restaurants. Managers build weekly
schedules and manage their team; employees view shifts, submit availability,
request time off, and clock in/out. It is a business/productivity tool — no
user-generated public content, no social feed, no ads.

ACCOUNT REQUIRED (full app is behind login)
The entire app requires sign-in; there is no guest mode. We have provided a
pre-seeded DEMO MANAGER account with sample data. Please sign in with the
credentials in the "Sign-In required" fields.

HOW TO SIGN IN (use Google — recommended)
1. On the login screen tap "Continue with Google".
2. An in-app browser opens our Google sign-in page. Enter:
     Email:    <<DEMO_EMAIL>>
     Password: <<DEMO_PASSWORD>>
3. You return to the app and land in the MANAGER view, pre-populated with
   employees, a weekly schedule, availability submissions, and time-off requests.

NOTE ON "Sign in with Apple"
Per Guideline 4.8 the app also offers native Sign in with Apple as an equivalent
login option. A freshly created Apple/Google account has no organization yet and
lands on onboarding with no data, so please use the provided Google demo manager
account above to review the populated experience.

WHERE TO FIND KEY FEATURES (as the demo manager)
- Shifts tab:       weekly manager schedule view.
- Availability tab: employee availability submissions.
- Time Off tab:     time-off requests (approve / deny).
- Team tab:         the org's employees (manager-only).
- Settings tab:     role switcher — toggle Manager/Employee views. In Employee
                    view, Shifts shows "My Shifts" with a clock in/out widget.
- Profile tab:      account details and Sign Out / Delete account.

CONTACT
Trouble signing in or reaching the demo data? Contact <<SUPPORT_EMAIL>> and we
will respond promptly.
```

⚠️ **HUMAN PREP:** set `<<DEMO_EMAIL>>`, `<<DEMO_PASSWORD>>`, `<<SUPPORT_EMAIL>>`; also enter the demo creds in the structured Sign-In Information fields.

---

## 2. Privacy Nutrition Label (App Store Connect → App Privacy)

Verified: **no analytics / advertising / attribution / crash SDKs**, no location, no ATT. Only device APIs used are Keychain + UserDefaults/file-timestamps (already declared in `app.json` privacy manifest).

**"Do you collect data from this app?"** → **Yes** · **"Used to track you?"** → **No (Data used to track you = None; NSPrivacyTracking = false)**

Declare exactly these (all **Linked = Yes**, **Tracking = No**):

| Category → Data Type | Purposes |
|---|---|
| Contact Info → **Name** | App Functionality, Account Management |
| Contact Info → **Email Address** | App Functionality, Account Management |
| Contact Info → **Phone Number** | App Functionality |
| Identifiers → **User ID** | App Functionality, Account Management |
| User Content → **Other User Content** (availability, time-off reason, clock notes) | App Functionality |

**Do NOT select** (verified not collected): Location, Financial, Health, Contacts, Photos/Videos, Audio, Browsing/Search History, Usage Data, Diagnostics/Crash, Advertising Data, Device IDs (IDFA/IDFV), Purchases.

---

## 3. Accessibility Nutrition Label

Accessibility hardening has been implemented in code (labels on all controls, decorative icons hidden, Dynamic Type reflow, `useReducedMotion` on modals, contrast tokens raised to WCAG AA). The following are **claimable once the on-device verification below passes** — claim them only after confirming on a real device:

- **Dark Interface** (already solid)
- **VoiceOver** · **Voice Control** (all interactive controls labelled; decorative elements hidden; state communicated)
- **Larger Text** (no `allowFontScaling={false}`; `numberOfLines` removed from content text so it reflows)
- **Reduced Motion** (slide-in modals fade when Reduce Motion is on)
- **Sufficient Contrast** (`ink.muted`/tab-inactive/chevron raised `#4A4A57` → `#6B6B7B`, ~4.7:1)
- **Differentiate Without Color** (every color-only signal paired with text)

Captions / Audio Descriptions = N/A (no media).

**⚠️ HUMAN PREP — verify on-device before claiming** (Settings → Accessibility):
- **VoiceOver on:** sweep every tab/screen; confirm each control is announced with a sensible name and no decorative icon/chevron is read.
- **Larger Text at max:** confirm shift cards, employee names/roles, settings rows, and the shift-detail header reflow without clipping/truncation.
- **Reduce Motion on:** confirm the Time-Off, Team detail, Shift form, and Time-Picker modals fade instead of slide.

---

## 4. Age Rating → **4+**

Business scheduling tool, no objectionable content. Answer **None** to all content questions (violence, profanity, sexual content, gambling, alcohol/drugs, horror, mature themes, medical). **Unrestricted Web Access = No** (only the scoped Google OAuth web view). **User-Generated Content shown to others = No** (availability/time-off seen only by the user's own manager, not public). **Messaging = No.** **Made for Kids = No.**

---

## 5. Export Compliance (Encryption)

Only standard HTTPS/TLS + iOS Keychain; no proprietary crypto. `app.json` already sets `ios.config.usesNonExemptEncryption: false`, which injects `ITSAppUsesNonExemptEncryption = NO` so uploads shouldn't prompt. If prompted:

- "Does your app use encryption?" → **Yes** (HTTPS + Keychain)
- "Qualify for exemptions?" → **Yes**
- "Proprietary / non-standard encryption?" → **No**
- → **Exempt** (US EAR §740.17(b)(1) / standard-OS-encryption exemption). No ERN report needed.

---

## 6. Product Page (drafts)

- **App Name (≤30):** `Skemaka` or `Skemaka: Staff Scheduling` (25)
- **Subtitle (≤30):** `Shift scheduling for teams` (26)
- **Promotional Text (≤170):** `Build weekly staff schedules, share shifts instantly, and let your team submit availability, request time off, and clock in — all from your phone.`
- **Keywords (≤100, no spaces):** `schedule,scheduling,shift,shifts,staff,roster,rota,restaurant,employee,timeoff,availability,clock,team`
- **Description:**

```
Skemaka is the simple way for restaurants and small teams to manage staff scheduling.

FOR MANAGERS
Build your weekly schedule, assign shifts to your team, and keep everyone in sync.
Review and approve availability and time-off requests, and manage your employees —
all from your phone.

FOR EMPLOYEES
See your upcoming shifts at a glance, submit the days and times you're available
to work, request time off, and clock in and out of your shifts right from the app.

ONE APP, BOTH ROLES
Managers can switch between the manager and employee views, so the whole team works
from the same place.

Sign in securely with Google or Sign in with Apple. Your manager invites you to get started.
```

- **Screenshots** (from the populated demo account): 1) Login, 2) Manager schedule, 3) Employee "My Shifts" + clock widget, 4) Availability, 5) Time Off, 6) Team. Sizes: **6.9" iPhone (required)**, 6.5" iPhone (fallback), **iPad 13" (required only because `supportsTablet: true` — see prep checklist).**
- **Privacy Policy URL:** `https://<your-domain>/privacy` · **Support URL:** `https://<your-domain>/terms` (or a `/support` page).

---

## 7. Apple references
- App privacy details: https://developer.apple.com/app-store/app-privacy-details/ · data types: `#data-types`
- Tracking / ATT: https://developer.apple.com/app-store/user-privacy-and-data-use/
- Accessibility Nutrition Labels: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/
- Age ratings: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- Encryption export: https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
