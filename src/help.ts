/** The admin Help page: plain-language answers for organizers, with a phone and a computer screenshot for each screen. */

import { escapeHtml } from "./helpers";

type Shot = {
  /** File stem in public/help, without the -desktop / -phone suffix. */
  name: string;
  alt: string;
  /** Address shown in the browser bar of the computer frame. */
  path: string;
  caption?: string;
  /** The top of the screenshot is dark, so the phone's status bar should be too. */
  dark?: boolean;
};

type Item = { id: string; q: string; a: string; shots?: Shot[] };
type Section = { id: string; title: string; blurb: string; items: Item[] };

const HOST = "tambayan.fsdac.app";
const DESKTOP_SIZE = { width: 2200, height: 1600 };
const PHONE_SIZE = { width: 804, height: 1600 };

const sections: Section[] = [
  {
    id: "start",
    title: "Getting started",
    blurb: "Signing in and finding your way around.",
    items: [
      {
        id: "sign-in",
        q: "How do I sign in?",
        a: `<ol>
          <li>Open the admin address your team gave you. It ends in <strong>/admin</strong>.</li>
          <li>Type your email and password.</li>
          <li>Tap <strong>Sign in</strong>.</li>
        </ol>
        <p>Only organizers who have been added can sign in. There is no sign-up button. If you need access, ask an organizer.</p>`,
        shots: [{ name: "login", alt: "The admin sign-in page", path: "/admin/login" }],
      },
      {
        id: "first-password",
        q: "It asks me to choose a new password when I first sign in. Why?",
        a: `<p>A new account starts with a temporary password. For safety, you choose your own before the rest of the admin opens.</p>
        <ol>
          <li>Type the temporary password in <strong>Current password</strong>.</li>
          <li>Type your new password in <strong>New password</strong> and again in <strong>Confirm new password</strong>.</li>
          <li>Tap <strong>Update password</strong>. The Dashboard opens.</li>
        </ol>
        <p>Use at least 10 characters, and pick something different from the temporary one.</p>`,
        shots: [{ name: "password-first", alt: "The password screen shown on first sign-in", path: "/admin/password" }],
      },
      {
        id: "navigate",
        q: "How do I move around the admin?",
        a: `<p>On a computer, the menu runs across the top: <strong>Dashboard, Events, Registrations, Reports, People, Gallery, Videos</strong>. The page you are on is underlined.</p>
        <p>On a phone, tap <strong>Menu</strong> at the top right to open the same list, and tap <strong>Close</strong> to hide it.</p>
        <p><strong>Account</strong> holds Activity, Password, Help, View site and Log out.</p>`,
        shots: [
          {
            name: "menu",
            alt: "The admin menu",
            path: "/admin",
            caption: "On a phone this is the Menu list. On a computer it is the Account menu.",
          },
        ],
      },
      {
        id: "dashboard",
        q: "What is on the Dashboard?",
        a: `<ul>
          <li><strong>Open for public</strong> is the event taking sign-ups right now, or <em>None</em>. Tap it to see that event's guest list.</li>
          <li><strong>Registrations</strong> is how many people are on that event's list.</li>
          <li><strong>Events</strong> is how many events exist in total.</li>
          <li><strong>Quick actions</strong> are shortcuts: add a walk-in, upload photos, add a short video, or preview the public Register page.</li>
          <li><strong>Recent activity</strong> shows the latest changes by organizers.</li>
        </ul>`,
        shots: [{ name: "dashboard", alt: "The Dashboard", path: "/admin" }],
      },
      {
        id: "dark-mode",
        q: "Can I use dark mode?",
        a: `<p>Yes. On a computer, tap the moon button at the top. On a phone, use the <strong>Dark mode</strong> switch in the Menu. The choice is remembered on that device.</p>`,
      },
    ],
  },
  {
    id: "events",
    title: "Events",
    blurb: "An event is one gathering, usually the last Sunday of the month. Guests, photos and reports all belong to an event.",
    items: [
      {
        id: "event-status",
        q: "What do Draft, Open and Closed mean?",
        a: `<ul>
          <li><strong>Draft</strong>: not taking sign-ups yet. It can appear on the home page as coming soon.</li>
          <li><strong>Open</strong>: guests can sign up on the Register page. Only one event can be open at a time, so opening a new one closes the old one.</li>
          <li><strong>Closed</strong>: guests can no longer sign up online. You can still add guests and photos yourself.</li>
        </ul>
        <p>A one-line reminder of this appears under the status choice on the event form.</p>`,
        shots: [{ name: "event-form", alt: "The event form with Status choices", path: "/admin/events", caption: "The status choice sits in the middle of the form." }],
      },
      {
        id: "event-create",
        q: "How do I create the next event?",
        a: `<ol>
          <li>Go to <strong>Events</strong>. The form is on the right, or just below the list on a phone.</li>
          <li>Tap <strong>Choose a date</strong> and pick the day.</li>
          <li>Set the time. It is Singapore time and starts at 2:00 PM.</li>
          <li>Choose a status. Leave it on <strong>Draft</strong> while you prepare, or pick <strong>Open</strong> to take sign-ups now.</li>
          <li>Check the venue. It is filled in for you.</li>
          <li>Tap <strong>Create event</strong>.</li>
        </ol>
        <p>The event name is made from the month you pick, for example <em>OFW Tambayan — October 2026</em>.</p>`,
        shots: [{ name: "event-date", alt: "Choosing a date on the new event form", path: "/admin/events" }],
      },
      {
        id: "event-find",
        q: "How do I find an event in a long list?",
        a: `<p>Above the list is a row of choices: <strong>All, Open, Closed, Draft</strong>. Tap one to show only those events. The title above the list follows your choice, for example <em>Closed events</em>.</p>
        <p>The list shows five events at a time, newest first. Use <strong>Previous</strong> and <strong>Next</strong> at the bottom to see older ones. Each event also shows a small badge with how many guests it has, or <em>No guests yet</em>.</p>
        <p>Tap an event to see its guest list. <strong>Edit</strong>, <strong>Open</strong>, <strong>Force close</strong> and the other buttons work as before.</p>`,
        shots: [{ name: "events-filter", alt: "The Events list filtered to Closed events, with the choices and page buttons circled", path: "/admin/events" }],
      },
      {
        id: "event-open",
        q: "How do I open sign-ups for an event?",
        a: `<ol>
          <li>Go to <strong>Events</strong> and find the event in the list. Use the <a href="#q-event-find">filter</a> if the list is long.</li>
          <li>Tap <strong>Open</strong> (for a Draft) or <strong>Reopen</strong> (for a Closed one).</li>
          <li>Tap OK when asked to confirm.</li>
        </ol>
        <p>The public Register page now takes sign-ups. If another event was open, it closes.</p>`,
        shots: [
          {
            name: "events-status",
            alt: "The events list with the Force close and Reopen buttons circled",
            path: "/admin/events",
          },
        ],
      },
      {
        id: "event-close",
        q: "How do I stop sign-ups early?",
        a: `<ol>
          <li>Go to <strong>Events</strong>.</li>
          <li>Tap <strong>Force close</strong> beside the open event, then confirm.</li>
        </ol>
        <p>Guests can no longer sign up online. You can still add guests yourself. To take sign-ups again, tap <strong>Reopen</strong>.</p>
        <p>You do not have to close an event by hand. Sign-ups also stop by themselves when the start time arrives.</p>`,
      },
      {
        id: "soft-closed",
        q: "Why does an event say “Open (soft-closed)”?",
        a: `<p>It is still marked Open, but the start time has passed, so online sign-ups have stopped by themselves. Tapping Reopen will not bring them back after the start time.</p>
        <p>To register someone who arrives late, use <a href="#q-add-guest">Add guest</a>.</p>`,
      },
      {
        id: "event-edit",
        q: "How do I change the date, time or venue?",
        a: `<ol>
          <li>Go to <strong>Events</strong> and tap <strong>Edit</strong> beside the event.</li>
          <li>Change what you need.</li>
          <li>Tap <strong>Save changes</strong>.</li>
        </ol>
        <p>The public pages update straight away. Guests who already signed up are not messaged, so let them know about any change.</p>`,
        shots: [{ name: "event-form", alt: "Editing an event", path: "/admin/events?id=…" }],
      },
      {
        id: "announcement",
        q: "How do I put an announcement on the home page?",
        a: `<ol>
          <li>Open the event with <strong>Edit</strong>, or start a new one.</li>
          <li>Tap <strong>Add an announcement</strong>.</li>
          <li>Type a <strong>Title</strong> (leave it empty to use the event name) and a <strong>Message</strong>.</li>
          <li>Tap <strong>Save changes</strong> or <strong>Create event</strong>.</li>
        </ol>
        <p>Guests see it at the top of the home page until the gathering starts.</p>`,
      },
      {
        id: "gospel-weekend-sync",
        q: "What is the “Gospel Weekend sync” field on the event form?",
        a: `<p>It only matters for a gathering whose date is also one day of the FSDAC Gospel Weekend. Leave it as <strong>Not part of Gospel Weekend</strong> for every ordinary month — it does nothing unless set.</p>
        <ol>
          <li>Open the event with <strong>Edit</strong>.</li>
          <li>Open <strong>Gospel Weekend sync</strong> and pick the matching day.</li>
          <li>Tap <strong>Save changes</strong>.</li>
        </ol>
        <p>From then on, a guest who signs up for this event is also registered for that same day on the Gospel Weekend site, without doing anything extra. Their address is not asked for or sent, and only that one day is marked there. If that site cannot be reached, the guest's Tambayan sign-up still goes through, and an organizer can see it in <a href="#q-activity">Activity</a> as something to check.</p>
        <p>Turn it back to <strong>Not part of Gospel Weekend</strong> for the next event, or simply leave it unset — a new event always starts with it off.</p>`,
        shots: [{ name: "event-gospel-weekend", alt: "The Gospel Weekend sync field on the event form", path: "/admin/events" }],
      },
      {
        id: "event-preview",
        q: "Can I see what the registration form looks like before I open it?",
        a: `<p>Yes — for a <strong>Draft</strong> event only, since an Open event's own <a href="/register" target="_blank">Register page</a> already shows this for real.</p>
        <ol>
          <li>Go to <strong>Events</strong> and find the Draft event.</li>
          <li>Tap <strong>Preview</strong>.</li>
        </ol>
        <p>A window opens showing the event's name, date, venue and the sign-up form exactly as a guest would see it. You can type into the fields to see how they behave, but the <strong>Register</strong> button is switched off — nothing you enter here is ever saved or sent anywhere. Tap the <strong>×</strong> to close it.</p>
        <p>The preview always shows what you last saved, so if you change anything afterward — the venue, the announcement — save first, then preview again to see the real result.</p>`,
        shots: [{ name: "event-preview", alt: "The registration form preview overlay for a Draft event", path: "/admin/events" }],
      },
      {
        id: "event-delete",
        q: "Can I delete an event?",
        a: `<p>Only an <strong>empty Draft</strong>: one that has no guests and no photos. That keeps guest lists and reports complete.</p>
        <ol>
          <li>Go to <strong>Events</strong> and tap <strong>Draft</strong> above the list.</li>
          <li>Tap the small bin beside the event, then confirm. The bin only appears when the event can be deleted.</li>
        </ol>
        <p>Deleting cannot be undone. It also changes what guests see. If that draft was showing as <em>Coming soon</em>, the home page moves on to the next upcoming event, or to your most recent one if there is none. The Register page changes from <em>Coming soon</em> to a closed message when nothing else is upcoming.</p>
        <p>An event with guests or photos cannot be deleted. Remove them first, or edit the event into your next real gathering instead.</p>`,
        shots: [{ name: "events-delete", alt: "The Draft events list with the delete bin circled", path: "/admin/events" }],
      },
      {
        id: "guest-view",
        q: "What do guests see when sign-ups are open or closed?",
        a: `<p>When an event is <strong>Open</strong>, the home page shows its date and a <strong>Register</strong> button, and the Register page shows the sign-up form.</p>
        <p>When nothing is open, the home page shows the next event as <strong>Coming soon</strong>, and the Register page says sign-up opens when the next gathering is published.</p>`,
        shots: [
          { name: "pub-home-open", alt: "The public home page while sign-ups are open", path: "/", caption: "Sign-ups open", dark: true },
          { name: "pub-home-closed", alt: "The public home page while nothing is open", path: "/", caption: "Nothing open", dark: true },
        ],
      },
    ],
  },
  {
    id: "guests",
    title: "Registrations",
    blurb: "The guest list for each event: who signed up, who came, and adding people at the door.",
    items: [
      {
        id: "guest-list",
        q: "Where do I see who signed up?",
        a: `<ol>
          <li>Go to <strong>Registrations</strong>.</li>
          <li>Pick an event at the top. The open event is chosen for you. Choose <strong>All events</strong> to see everyone.</li>
        </ol>
        <p>You can also tap an event on the <strong>Events</strong> page to jump straight to its guest list.</p>
        <p>The newest sign-ups come first, 20 to a page. Use <strong>Show</strong> at the bottom to see more per page. On a computer, tap a column heading such as <strong>Name</strong> to sort.</p>`,
        shots: [{ name: "registrations", alt: "The guest list", path: "/admin/registrations" }],
      },
      {
        id: "guest-search",
        q: "How do I find one guest?",
        a: `<p>Type in the search box. It looks at names, emails and mobile numbers, and the list shortens as you type. Tap the <strong>×</strong> to clear it.</p>`,
        shots: [{ name: "registrations-search", alt: "Searching the guest list", path: "/admin/registrations" }],
      },
      {
        id: "add-guest",
        q: "How do I add a walk-in guest?",
        a: `<ol>
          <li>Go to <strong>Registrations</strong> and tap <strong>Add guest</strong>. On the Dashboard you can tap <strong>Add a walk-in</strong> instead.</li>
          <li>Start typing the name. If the person has come before, pick them from the suggestions. This keeps their history together.</li>
          <li>For someone new, type their name and mobile number.</li>
          <li>Leave <strong>Here now</strong> switched on to mark them as attended straight away.</li>
          <li>Tap <strong>Add guest</strong>. You can add more people, then tap <strong>Done</strong>.</li>
        </ol>
        <p>If the person is already on the list, you will be told, and you can mark them as attended from that message.</p>
        <p><strong>Here now</strong> starts switched off when the event is still on a later day, and on for today or past events.</p>`,
        shots: [
          { name: "guest-suggest", alt: "Suggested people while typing a name", path: "/admin/registrations", caption: "Returning guests are suggested" },
          { name: "guest-add", alt: "Adding a new guest", path: "/admin/registrations", caption: "A new guest" },
        ],
      },
      {
        id: "mark-attendance",
        q: "How do I mark who came?",
        a: `<ol>
          <li>Go to <strong>Registrations</strong> and pick the event.</li>
          <li>Tap the guest's name.</li>
          <li>On the <strong>Attendance</strong> tab, tap <strong>Attended</strong>.</li>
        </ol>
        <p>A <strong>Here</strong> tag appears beside their name. Tap <strong>Not yet</strong> if you marked the wrong person.</p>
        <p>Marking attendance is what fills in the <a href="#q-report-terms">Came and Show-up</a> numbers in Reports.</p>`,
        shots: [{ name: "guest-attendance", alt: "The Attendance tab with the Attended button circled", path: "/admin/registrations" }],
      },
      {
        id: "edit-guest",
        q: "How do I fix a guest's name, mobile or other details?",
        a: `<ol>
          <li>Tap the guest's name.</li>
          <li>Open the <strong>Details</strong> tab.</li>
          <li>Change the name, email, mobile, birth date, date joined or carer.</li>
          <li>Tap <strong>Save details</strong>.</li>
        </ol>
        <p>These details belong to the person, so the fix shows up on every event they are on and on the People page.</p>`,
        shots: [{ name: "guest-details", alt: "The Details tab", path: "/admin/registrations" }],
      },
      {
        id: "move-guest",
        q: "A guest signed up for the wrong event. Can I move them?",
        a: `<ol>
          <li>Tap the guest's name and open the <strong>Details</strong> tab.</li>
          <li>Under <strong>Move to another event</strong>, pick the right event.</li>
          <li>Tap <strong>Save details</strong>.</li>
        </ol>
        <p>If the new event has not happened yet, their <em>attended</em> mark is cleared. You cannot move someone to an event whose list they are already on.</p>`,
      },
      {
        id: "remove-guest",
        q: "How do I remove a guest from an event?",
        a: `<ol>
          <li>Tap the guest's name. You are on the <strong>Attendance</strong> tab.</li>
          <li>Tap <strong>Remove from this event</strong> and confirm.</li>
        </ol>
        <p>This removes only that one sign-up. The person stays on the People page with their other events.</p>`,
        shots: [{ name: "guest-remove", alt: "The Remove from this event button", path: "/admin/registrations" }],
      },
      {
        id: "icons",
        q: "What do the small icons and tags next to names mean?",
        a: `<ul>
          <li>A <strong>gift</strong> icon: it is their birthday month.</li>
          <li>A <strong>warning</strong> triangle: the name may be a duplicate of someone else. Hover over it, or tap it, to see who. See <a href="#q-duplicates">possible duplicates</a>.</li>
          <li><strong>Walk-in</strong>: an organizer added this guest, they did not sign up online.</li>
          <li><strong>Here</strong>: marked as attended.</li>
        </ul>`,
        shots: [{ name: "duplicates", alt: "A possible duplicate explained on hover", path: "/admin/registrations" }],
      },
      {
        id: "export",
        q: "How do I download the guest list?",
        a: `<ol>
          <li>Go to <strong>Registrations</strong> and pick the event.</li>
          <li>Tap <strong>Export</strong>, then choose <strong>Excel</strong> or <strong>PDF</strong>.</li>
        </ol>
        <p>You get everyone on the list you are looking at, across all pages. If you typed in the search box, only the matching guests are included.</p>`,
        shots: [{ name: "export", alt: "The Export menu", path: "/admin/registrations" }],
      },
    ],
  },
  {
    id: "people",
    title: "People",
    blurb: "Everyone who has ever registered, one entry per person, no matter how many events they came to.",
    items: [
      {
        id: "people-page",
        q: "What is the People page for?",
        a: `<p>It shows each person once, with how many times they attended and when they last came. Use the search box to find someone, or the buttons <strong>A–Z</strong>, <strong>Most visits</strong> and <strong>Recent</strong> to sort.</p>`,
        shots: [{ name: "people", alt: "The People page", path: "/admin/people" }],
      },
      {
        id: "birthdays",
        q: "How do I see who has a birthday this month?",
        a: `<p>On <strong>People</strong>, open the <strong>Any birth month</strong> menu and pick a month. This month is labelled for you. Only people whose birth date has been recorded are included.</p>`,
        shots: [{ name: "people-birthdays", alt: "People filtered by birth month", path: "/admin/people" }],
      },
      {
        id: "profile",
        q: "How do I see one person's history?",
        a: `<p>Tap their name on the People page. Their profile shows their details and every event they signed up for, marked <em>Attended</em> or <em>Registered</em>. Tap <strong>Edit</strong> to change their details.</p>`,
        shots: [{ name: "person", alt: "A person's profile", path: "/admin/people?person=…" }],
      },
      {
        id: "duplicates",
        q: "What are “possible duplicates”, and what do I do with them?",
        a: `<p>Sometimes the same person is entered twice, for example with a small spelling difference. The People page warns you at the top, such as <em>2 possible duplicates to review</em>.</p>
        <ol>
          <li>Tap the warning, then tap <strong>Review</strong> beside a name.</li>
          <li>Compare the two profiles.</li>
          <li>If they are the same person, tap <strong>Merge into …</strong> and confirm. The fuller profile is kept and all sign-ups move across.</li>
          <li>If they are different people, tap <strong>Not the same</strong>. You will not be asked again.</li>
        </ol>
        <p><strong>Merging cannot be undone</strong>, so check the names and mobile numbers first. Merging matters because a duplicate can make one person look like two guests in Reports.</p>`,
        shots: [
          { name: "people-duplicates", alt: "The list of possible duplicates", path: "/admin/people", caption: "Tap Review" },
          { name: "person-merge", alt: "Merge or keep two profiles separate", path: "/admin/people?person=…", caption: "Merge or Not the same" },
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    blurb: "How gatherings are doing, one at a time and over time.",
    items: [
      {
        id: "report-overview",
        q: "What can I learn from Reports?",
        a: `<p>There are two tabs at the top.</p>
        <ul>
          <li><strong>One gathering</strong>: pick an event, or use the arrows to step through them, to see how many registered, how many came, and who was new.</li>
          <li><strong>Trends</strong>: compare gatherings over weeks, months or years.</li>
        </ul>`,
        shots: [{ name: "report-gathering", alt: "The report for one gathering", path: "/admin/reports" }],
      },
      {
        id: "report-terms",
        q: "What do Registered, Came and Show-up mean?",
        a: `<ul>
          <li><strong>Registered</strong>: everyone on the guest list.</li>
          <li><strong>Came</strong>: the guests you marked as attended.</li>
          <li><strong>Show-up</strong>: Came as a percentage of Registered.</li>
        </ul>
        <p>If you see dashes instead of numbers, attendance has not been marked yet. Open the guest list and <a href="#q-mark-attendance">mark who came</a>.</p>`,
      },
      {
        id: "report-older",
        q: "Why do older events only show a guest list?",
        a: `<p>Attendance was not taken for the earlier gatherings. Their lists were brought in from a spreadsheet, so the report shows how many were on the list, not a headcount. Show-up numbers begin with the first gathering where attendance was marked.</p>`,
        shots: [{ name: "report-older", alt: "A report for an older event", path: "/admin/reports?event_id=…" }],
      },
      {
        id: "report-signups",
        q: "What do Returning, First time, Online and Walk-in mean?",
        a: `<ul>
          <li><strong>Returning</strong>: on the list at an earlier gathering. <strong>First time</strong>: the first time we have seen them. On the very first gathering everyone looks new.</li>
          <li><strong>Online</strong>: signed up on the Register page. <strong>Walk-in</strong>: added by an organizer.</li>
          <li><strong>When they signed up</strong>: online sign-ups in the three weeks before the gathering, one bar a day.</li>
        </ul>`,
        shots: [{ name: "report-signups", alt: "Returning, online and timing charts", path: "/admin/reports" }],
      },
      {
        id: "trends",
        q: "How do I compare gatherings over time?",
        a: `<ol>
          <li>Open <strong>Reports</strong> and tap <strong>Trends</strong>.</li>
          <li>Pick a period such as <strong>Last 6 months</strong> or <strong>All time</strong>, or open <strong>Custom range</strong>.</li>
          <li>Choose <strong>Each gathering</strong>, <strong>By month</strong> or <strong>By year</strong>.</li>
          <li>Tap <strong>Export PowerPoint</strong> to download the numbers as slides. See <a href="#q-report-deck">what is in the deck</a>. A small <strong>CSV</strong> link beside it gives a spreadsheet file instead.</li>
        </ol>
        <p>Lower down, <strong>Regulars</strong> are people who came to at least 3 of the last 6 gatherings. <strong>Worth a check-in</strong> are people who came at least twice but not in the last 3.</p>`,
        shots: [
          { name: "trends", alt: "The Trends tab", path: "/admin/reports?view=trends" },
          { name: "trends-export", alt: "The Export PowerPoint button, the Include names tick and the CSV link", path: "/admin/reports?view=trends", caption: "Export options" },
          { name: "trends-people", alt: "Regulars and people worth a check-in", path: "/admin/reports?view=trends" },
        ],
      },
      {
        id: "report-deck",
        q: "How do I export a report as a PowerPoint?",
        a: `<ol>
          <li>Open <strong>Reports</strong> and tap <strong>Trends</strong>.</li>
          <li>Pick the period and how to group it. The deck follows what you see on screen.</li>
          <li>Tick <strong>Include names</strong> only if you want people listed by name. It is off by default, because decks get forwarded. Names appear on one slide only, <strong>Regulars and people worth a check-in</strong>. The other slides show numbers.</li>
          <li>Tap <strong>Export PowerPoint</strong>. The file downloads in a few seconds, named after the period, for example <em>ofw-tambayan-gathering-report-2026-04-to-2026-09.pptx</em>.</li>
        </ol>
        <p>The deck has a cover, <strong>At a glance</strong>, <strong>Guests on the list</strong>, <strong>Who actually came</strong>, <strong>Regulars and people worth a check-in</strong>, and a table of the numbers. Each slide has short speaker notes that spell out the numbers.</p>
        <p>The deck opens in PowerPoint, Keynote and other slide apps. You can change wording, colours and layout freely. The charts are drawn as shapes so they look the same everywhere, which means they are pictures of the numbers, not data charts. To change a number, export again.</p>
        <p>You need an internet connection to build it. If the button says the tool did not load, check your connection and try again.</p>`,
      },
    ],
  },
  {
    id: "media",
    title: "Gallery and Videos",
    blurb: "Photos and short videos for the public site.",
    items: [
      {
        id: "upload-photos",
        q: "How do I upload photos?",
        a: `<ol>
          <li>Go to <strong>Gallery</strong>, or tap <strong>Upload photos</strong> on the Dashboard.</li>
          <li>Choose the <strong>Event</strong>.</li>
          <li>Add a <strong>Caption</strong> if you like. One caption applies to every photo in that upload.</li>
          <li>Tap <strong>Choose photos</strong>, pick your pictures, then tap <strong>Upload</strong>.</li>
        </ol>
        <p>Photos can be JPEG, PNG or WebP, up to 5 MB each, 20 at a time, and 120 per event. You can upload to an event whether it is Draft, Open or Closed. The photos appear on that event's page in the public Gallery, except for Draft events.</p>`,
        shots: [
          { name: "gallery", alt: "The Gallery upload form", path: "/admin/gallery" },
          { name: "pub-gallery-event", alt: "How the photos look on the public site", path: "/gallery/…", caption: "What guests see" },
        ],
      },
      {
        id: "delete-photo",
        q: "How do I delete a photo?",
        a: `<p>On <strong>Gallery</strong>, choose the event, then tap the small bin in the corner of the photo. <strong>Deleting is permanent.</strong></p>`,
        shots: [{ name: "gallery-photos", alt: "The delete button on a photo", path: "/admin/gallery" }],
      },
      {
        id: "add-video",
        q: "How do I add a video?",
        a: `<ol>
          <li>Go to <strong>Videos</strong>.</li>
          <li>Type a <strong>Title</strong>.</li>
          <li>Paste the <strong>YouTube URL</strong>. A normal YouTube link or a Shorts link both work.</li>
          <li>Set <strong>Sort order</strong>. Lower numbers appear first on the public Shorts page.</li>
          <li>Tap <strong>Save video</strong>.</li>
        </ol>
        <p>To remove a video, tap the bin beside it. To change one, delete it and add it again.</p>`,
        shots: [{ name: "videos", alt: "The Videos page", path: "/admin/videos" }],
      },
    ],
  },
  {
    id: "account",
    title: "Your account",
    blurb: "Your password, signing out, and what the site records.",
    items: [
      {
        id: "change-password",
        q: "How do I change my password?",
        a: `<ol>
          <li>Tap <strong>Account</strong>, then <strong>Password</strong>.</li>
          <li>Enter your current password, then the new one twice.</li>
          <li>Tap <strong>Update password</strong>.</li>
        </ol>
        <p>Use at least 10 characters. You stay signed in.</p>`,
        shots: [{ name: "password", alt: "The Password page", path: "/admin/password" }],
      },
      {
        id: "sign-out",
        q: "How do I sign out?",
        a: `<p>Tap <strong>Account</strong>, then <strong>Log out</strong>. For safety, you are also signed out automatically after about 8 hours. On a shared phone or computer, always log out when you finish.</p>`,
      },
      {
        id: "activity",
        q: "What is the Activity page?",
        a: `<p>A record of sign-ins and changes made by organizers, newest first, with who did it and when. It helps everyone see what changed, for example who closed an event. It does not record which pages you look at.</p>
        <p>Find it under <strong>Account</strong>, then <strong>Activity</strong>. The last few entries also appear on the Dashboard.</p>`,
        shots: [{ name: "activity", alt: "The Activity page", path: "/admin/activity" }],
      },
    ],
  },
  {
    id: "trouble",
    title: "If something looks wrong",
    blurb: "Quick checks for the most common problems.",
    items: [
      {
        id: "cant-register",
        q: "Guests say they cannot register.",
        a: `<p>Check these in order.</p>
        <ol>
          <li>On the <strong>Dashboard</strong>, does <em>Open for public</em> show an event? If it says <em>None</em>, open one from <strong>Events</strong>.</li>
          <li>Is the event's start time still ahead? Once it passes, online sign-up stops by itself. See <a href="#q-soft-closed">soft-closed</a>.</li>
          <li>Tap <strong>Registration page</strong> in the Dashboard's Quick actions to see exactly what guests see.</li>
        </ol>`,
        shots: [{ name: "pub-register-closed", alt: "The Register page when nothing is open", path: "/register", caption: "What guests see when nothing is open" }],
      },
      {
        id: "cant-find-guest",
        q: "A guest says they registered, but I cannot find them.",
        a: `<ol>
          <li>On <strong>Registrations</strong>, check the event at the top. Try <strong>All events</strong>.</li>
          <li>Search by part of the name or the last digits of the mobile. They may have spelled their name differently.</li>
          <li>Look on the <strong>People</strong> page.</li>
          <li>If they are not there, add them with <a href="#q-add-guest">Add guest</a>.</li>
        </ol>`,
      },
      {
        id: "undo",
        q: "I made a mistake. Can I undo it?",
        a: `<p>Most things can simply be changed back: edit a guest's details, switch Attended back to Not yet, reopen or close an event, or edit an event.</p>
        <p>These <strong>cannot</strong> be undone:</p>
        <ul>
          <li>Merging two people.</li>
          <li>Deleting an empty draft event.</li>
          <li>Deleting a photo or a video.</li>
          <li>Removing a guest from an event. You can add them again, but not their attended mark.</li>
        </ul>`,
      },
      {
        id: "forgot-password",
        q: "I forgot my password.",
        a: `<p>There is no reset link on the sign-in page. Ask another organizer or the person who looks after the site to set a temporary password for you. You will choose your own when you sign in.</p>`,
      },
      {
        id: "stuck",
        q: "The page looks stuck or out of date.",
        a: `<p>Refresh the page. If it takes you back to the sign-in page, you were signed out automatically, so sign in again.</p>`,
      },
    ],
  },
];

// A plain status bar, so a phone screenshot reads as a phone. Purely decorative.
const STATUS_BAR = `<div class="hp-status" aria-hidden="true">
    <span class="hp-time">9:41</span>
    <span class="hp-island"></span>
    <span class="hp-icons">
      <svg viewBox="0 0 18 12" width="18" height="12"><path d="M1 9h2v2H1zM5 6.5h2V11H5zM9 4h2v7H9zM13 1h2v10h-2z" fill="currentColor"/></svg>
      <svg viewBox="0 0 16 12" width="16" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0M4 7a6 6 0 0 1 8 0"/><circle cx="8" cy="9.8" r="1" fill="currentColor" stroke="none"/></svg>
      <svg viewBox="0 0 26 12" width="26" height="12"><rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor"/><rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".45"/></svg>
    </span>
  </div>`;

function shotHtml(shot: Shot): string {
  const desktop = `/help/${shot.name}-desktop.webp`;
  const phone = `/help/${shot.name}-phone.webp`;
  return `<figure class="hp-shot">
    <button type="button" class="hp-zoom" aria-label="Enlarge: ${escapeHtml(shot.alt)}">
      <span class="hp-frame${shot.dark ? " is-dark" : ""}">
        <span class="hp-bar" aria-hidden="true"><i></i><i></i><i></i><span class="hp-url">${escapeHtml(HOST + shot.path)}</span></span>
        ${STATUS_BAR}
        <picture>
          <source media="(max-width: 720px)" srcset="${phone}" width="${PHONE_SIZE.width}" height="${PHONE_SIZE.height}">
          <img src="${desktop}" alt="${escapeHtml(shot.alt)}" width="${DESKTOP_SIZE.width}" height="${DESKTOP_SIZE.height}" loading="lazy" decoding="async">
        </picture>
        <span class="hp-home" aria-hidden="true"></span>
      </span>
    </button>
    ${shot.caption ? `<figcaption>${escapeHtml(shot.caption)}</figcaption>` : ""}
  </figure>`;
}

function itemHtml(item: Item): string {
  const shots = item.shots?.length
    ? `<div class="hp-shots${item.shots.length > 1 ? " is-pair" : " is-single"}">${item.shots.map(shotHtml).join("")}</div>`
    : "";
  return `<details class="hp-q" id="q-${item.id}">
    <summary><span>${escapeHtml(item.q)}</span></summary>
    <div class="hp-a"><div class="hp-text">${item.a}</div>${shots}</div>
  </details>`;
}

/** What an organizer's action changes on the public site. Kept short and in plain words. */
const guestEffects: [string, string][] = [
  ["Open an event", "The home page shows a Register button and the Register page takes sign-ups."],
  ["Close an event, or its start time passes", "Sign-up stops. The home page shows the next event as Coming soon."],
  ["Write an announcement", "It appears at the top of the home page until the gathering starts."],
  ["Delete an empty Draft", "If it was showing as Coming soon, the home page moves on to the next event."],
  ["Upload photos", "They appear in the public Gallery under that event, unless it is a Draft."],
  ["Add a video", "It appears on the public Shorts page, lowest sort order first."],
];

export function helpBody(): string {
  const jump = sections.map((s) => `<a href="#${s.id}">${escapeHtml(s.title)}</a>`).join("");
  const effects = guestEffects
    .map(([did, sees]) => `<li><strong>${escapeHtml(did)}</strong><span>${escapeHtml(sees)}</span></li>`)
    .join("");
  const body = sections
    .map(
      (s) => `<section class="admin-panel hp-section" id="${s.id}" aria-labelledby="${s.id}-title">
        <div class="hp-section-head">
          <h2 id="${s.id}-title">${escapeHtml(s.title)}</h2>
          <p>${escapeHtml(s.blurb)}</p>
        </div>
        <div class="hp-list">${s.items.map(itemHtml).join("")}</div>
      </section>`,
    )
    .join("");

  return `
    <div class="hp" id="hp">
      <header class="admin-pagehead">
        <h1>Help</h1>
        <p>Plain answers for organizers. Tap a question to open it.</p>
      </header>
      <div class="hp-tools">
        <div class="reg-filters hp-search">
          <label class="reg-search">
            <span class="visually-hidden">Search help</span>
            <svg class="reg-search-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
            <input id="hp-search" type="search" placeholder="Search the help" autocomplete="off" />
          </label>
        </div>
        <div class="hp-view" role="group" aria-label="Screenshots shown as">
          <span class="hp-view-label">Screenshots</span>
          <div class="segmented segmented--sm" role="radiogroup" aria-label="Screenshots shown as">
            <label><input type="radio" name="hp-view" value="auto" checked /><span>My screen</span></label>
            <label><input type="radio" name="hp-view" value="phone" /><span>Phone</span></label>
            <label><input type="radio" name="hp-view" value="desktop" /><span>Computer</span></label>
          </div>
        </div>
      </div>
      <nav class="hp-jump" aria-label="Help topics">${jump}</nav>
      <section class="admin-panel hp-effects" aria-labelledby="hp-effects-title">
        <h2 id="hp-effects-title">What guests see</h2>
        <p>Some things you do here change the public site straight away.</p>
        <ul>${effects}</ul>
      </section>
      <p id="hp-empty" class="notice" hidden>No answers match that search. Try one or two simple words.</p>
      ${body}
    </div>
    <dialog class="hp-lightbox" id="hp-lightbox" aria-label="Enlarged screenshot">
      <button type="button" class="hp-lightbox-close" aria-label="Close">Close</button>
      <img alt="" />
    </dialog>
    <script src="/admin/help.js" defer></script>`;
}
