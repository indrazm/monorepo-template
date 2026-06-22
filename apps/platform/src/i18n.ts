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
        brand: "Platform",
        dashboard: "Dashboard",
        login: "Login",
      },
      auth: {
        login: {
          title: "Platform login",
          email: "Email",
          password: "Password",
          submit: "Login",
          pending: "Logging in...",
          createAccount: "Create a user account",
          fallbackError: "Authentication failed.",
        },
        register: {
          title: "Create user account",
          name: "Name",
          email: "Email",
          password: "Password",
          submit: "Register",
          pending: "Creating...",
          loginLink: "Already have an account?",
          fallbackError: "Registration failed.",
        },
      },
      dashboard: {
        title: "Platform dashboard",
        description: "Protected dashboard page.",
        session: "Session",
        email: "Email",
        logout: "Logout",
        logoutPending: "Logging out...",
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
        brand: "Platform",
        dashboard: "Dasbor",
        login: "Masuk",
      },
      auth: {
        login: {
          title: "Masuk Platform",
          email: "Email",
          password: "Kata sandi",
          submit: "Masuk",
          pending: "Sedang masuk...",
          createAccount: "Buat akun pengguna",
          fallbackError: "Autentikasi gagal.",
        },
        register: {
          title: "Buat akun pengguna",
          name: "Nama",
          email: "Email",
          password: "Kata sandi",
          submit: "Daftar",
          pending: "Membuat...",
          loginLink: "Sudah punya akun?",
          fallbackError: "Pendaftaran gagal.",
        },
      },
      dashboard: {
        title: "Dasbor platform",
        description: "Halaman dasbor yang dilindungi.",
        session: "Sesi",
        email: "Email",
        logout: "Keluar",
        logoutPending: "Sedang keluar...",
      },
    },
  },
} satisfies Resource;

export const i18n = createFrontendI18n({
  appName: "platform",
  defaultNamespace: "common",
  resources,
});
