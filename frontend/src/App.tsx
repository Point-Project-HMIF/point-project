import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminPanel } from "./pages/AdminPanel";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { RegistrationPage } from "./pages/RegistrationPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/daftar" element={<RegistrationPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pengumuman" element={<AnnouncementsPage />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Layout>
  );
}

