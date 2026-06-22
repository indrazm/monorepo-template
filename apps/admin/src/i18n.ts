import { createFrontendI18n, type Resource } from "@repo/i18n";

const resources = {
  en: {
    common: {
      language: {
        label: "Language",
        options: {
          en: "English",
          id: "Bahasa Indonesia",
        },
      },
      nav: {
        brand: "Admin",
        overview: "Overview",
        login: "Login",
      },
      auth: {
        login: {
          title: "Admin login",
          email: "Email",
          password: "Password",
          submit: "Login",
          pending: "Logging in...",
          fallbackError: "Authentication failed.",
        },
      },
      dashboard: {
        title: "Admin dashboard",
        description: "Protected admin page.",
        session: "Session",
        email: "Email",
        logout: "Logout",
        logoutPending: "Logging out...",
        forbidden: {
          title: "Forbidden",
          description: "Your account cannot access Admin.",
        },
      },
    },
  },
  id: {
    common: {
      language: {
        label: "Bahasa",
        options: {
          en: "English",
          id: "Bahasa Indonesia",
        },
      },
      nav: {
        brand: "Admin",
        overview: "Ikhtisar",
        login: "Masuk",
      },
      auth: {
        login: {
          title: "Masuk Admin",
          email: "Email",
          password: "Kata sandi",
          submit: "Masuk",
          pending: "Sedang masuk...",
          fallbackError: "Autentikasi gagal.",
        },
      },
      dashboard: {
        title: "Dasbor admin",
        description: "Halaman admin yang dilindungi.",
        session: "Sesi",
        email: "Email",
        logout: "Keluar",
        logoutPending: "Sedang keluar...",
        forbidden: {
          title: "Dilarang",
          description: "Akun Anda tidak dapat mengakses Admin.",
        },
      },
    },
  },
} satisfies Resource;

export const i18n = createFrontendI18n({
  appName: "admin",
  defaultNamespace: "common",
  resources,
});
