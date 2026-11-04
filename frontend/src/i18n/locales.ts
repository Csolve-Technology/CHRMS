export type Locale = "en" | "am" | "om";

export const LOCALE_STORAGE_KEY = "chrms_locale";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  am: "አማርኛ",
  om: "Afaan Oromoo",
};

/** Flat message keys used across shell + login */
export type MessageKey =
  | "app.title"
  | "app.subtitle"
  | "nav.dashboard"
  | "nav.properties"
  | "nav.tenants"
  | "nav.rentals"
  | "nav.sales"
  | "nav.payments"
  | "nav.reports"
  | "nav.admin"
  | "nav.userManagement"
  | "nav.systemSettings"
  | "header.searchPlaceholder"
  | "header.notifications"
  | "header.markAllRead"
  | "header.viewAllNotifications"
  | "header.help"
  | "header.profile"
  | "header.settings"
  | "header.logout"
  | "theme.label"
  | "theme.light"
  | "theme.dark"
  | "theme.system"
  | "lang.label"
  | "login.subtitle"
  | "login.signIn"
  | "login.cardDescription"
  | "login.demoAccounts"
  | "login.admin"
  | "login.officer"
  | "login.email"
  | "login.password"
  | "login.emailPlaceholder"
  | "login.passwordPlaceholder"
  | "login.signingIn"
  | "login.orContinue"
  | "login.noAccount"
  | "login.footer";

export const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    "app.title": "CHRMS",
    "app.subtitle": "Chiro City Housing",
    "nav.dashboard": "Dashboard",
    "nav.properties": "Properties",
    "nav.tenants": "Tenants",
    "nav.rentals": "Rent / Sell",
    "nav.sales": "Sales",
    "nav.payments": "Payments",
    "nav.reports": "Reports",
    "nav.admin": "Admin",
    "nav.userManagement": "User Management",
    "nav.systemSettings": "System Settings",
    "header.searchPlaceholder": "Search properties, tenants, rentals…",
    "header.notifications": "Notifications",
    "header.markAllRead": "Mark all read",
    "header.viewAllNotifications": "View all notifications",
    "header.help": "Help",
    "header.profile": "Profile",
    "header.settings": "Settings",
    "header.logout": "Logout",
    "theme.label": "Theme",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    "lang.label": "Language",
    "login.subtitle": "Chiro City Housing & Rental Management — sign in",
    "login.signIn": "Sign In",
    "login.cardDescription":
      "Enter your credentials to access CHRMS (backend must be running)",
    "login.demoAccounts": "Demo accounts (after seed)",
    "login.admin": "Admin",
    "login.officer": "Officer",
    "login.email": "Email",
    "login.password": "Password",
    "login.emailPlaceholder": "Enter your email",
    "login.passwordPlaceholder": "Enter your password",
    "login.signingIn": "Signing in…",
    "login.orContinue": "Or continue with",
    "login.noAccount": "Don't have an account? Contact your administrator",
    "login.footer": "© Chiro City Administration — CHRMS",
  },
  am: {
    "app.title": "CHRMS",
    "app.subtitle": "የቺሮ ከተማ መኖሪያ",
    "nav.dashboard": "ዳሽቦርድ",
    "nav.properties": "ንብረቶች",
    "nav.tenants": "ተከራዮች",
    "nav.rentals": "ኪራይ / ሽያጭ",
    "nav.sales": "ሽያጮች",
    "nav.payments": "ክፍያዎች",
    "nav.reports": "ሪፖርቶች",
    "nav.admin": "አስተዳዳር",
    "nav.userManagement": "ተጠቃሚ አስተዳደር",
    "nav.systemSettings": "የስርዓት ቅንብሮች",
    "header.searchPlaceholder": "ንብረት፣ ተከራይ፣ ኪራይ ይፈልጉ…",
    "header.notifications": "ማስታወቂያዎች",
    "header.markAllRead": "ሁሉንም እንደተነበቡ ምልክት",
    "header.viewAllNotifications": "ሁሉንም ማስታወቂያዎች ይመልከቱ",
    "header.help": "እገዛ",
    "header.profile": "መገለጫ",
    "header.settings": "ቅንብሮች",
    "header.logout": "ውጣ",
    "theme.label": "ገጽታ",
    "theme.light": "ብርሃን",
    "theme.dark": "ጨለማ",
    "theme.system": "ስርዓት",
    "lang.label": "ቋንቋ",
    "login.subtitle": "የቺሮ ከተማ መኖሪያ እና ኪራይ አስተዳደር — ግባ",
    "login.signIn": "ግባ",
    "login.cardDescription": "ወደ CHRMS ለመድረስ የመግቢያ መረጃዎን ያስገቡ",
    "login.demoAccounts": "ማሳያ መለያዎች (seed በኋላ)",
    "login.admin": "አስተዳዳር",
    "login.officer": "ኦፊሰር",
    "login.email": "ኢሜይል",
    "login.password": "የይለፍ ቃል",
    "login.emailPlaceholder": "ኢሜይልዎን ያስገቡ",
    "login.passwordPlaceholder": "የይለፍ ቃልዎን ያስገቡ",
    "login.signingIn": "በመግባት ላይ…",
    "login.orContinue": "ወይም በዚህ ይቀጥሉ",
    "login.noAccount": "መለያ የሎዎት? አስተዳዳርዎን ያግኙ",
    "login.footer": "© የቺሮ ከተማ አስተዳደር — CHRMS",
  },
  om: {
    "app.title": "CHRMS",
    "app.subtitle": "Magaalaa Chiroos Jireenyaa",
    "nav.dashboard": "Gabatee",
    "nav.properties": "Qabeenya manaa",
    "nav.tenants": "Fudhattoota",
    "nav.rentals": "Kuufama / Gurgurtaa",
    "nav.sales": "Gurgurtaa",
    "nav.payments": "Kaffaltiwwan",
    "nav.reports": "Gabaasawwan",
    "nav.admin": "Bulchiinsa",
    "nav.userManagement": "Bulchiinsa fayyadamaa",
    "nav.systemSettings": "Qindaa'ina sirnaa",
    "header.searchPlaceholder": "Qabeenya, fudhataa, kuufama barbaadi…",
    "header.notifications": "Beeksisa",
    "header.markAllRead": "Hunda dubbifamee agarsiisi",
    "header.viewAllNotifications": "Beeksisawwan hunda ilaali",
    "header.help": "Gargaarsa",
    "header.profile": "Ibsa namaa",
    "header.settings": "Qindaa'ina",
    "header.logout": "Ba'i",
    "theme.label": "Mata duree",
    "theme.light": "Ifaa",
    "theme.dark": "Dukkana",
    "theme.system": "Sirna",
    "lang.label": "Afaan",
    "login.subtitle": "Magaalaa Chiroos Jireenyaa fi Kuufama Bulchiinsa — seensi",
    "login.signIn": "Seensi",
    "login.cardDescription": "CHRMS fayyadamuuf odeeffannoo kee galchi",
    "login.demoAccounts": "Herregawwan demo (seed booda)",
    "login.admin": "Bulchaa",
    "login.officer": "Ogeessa",
    "login.email": "Imeelii",
    "login.password": "Jeecha icciitii",
    "login.emailPlaceholder": "Imeelii kee galchi",
    "login.passwordPlaceholder": "Jecha icciitii kee galchi",
    "login.signingIn": "Seenaa jira…",
    "login.orContinue": "Yookiin itti fufi",
    "login.noAccount": "Herrega hin qabduu? Bulchaa kee qunnamaa",
    "login.footer": "© Bulchiinsa Magaalaa Chiroos — CHRMS",
  },
};

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}
