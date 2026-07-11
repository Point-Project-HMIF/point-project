import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminPanel } from "./pages/AdminPanel";
import { AnnouncementDetailPage } from "./pages/AnnouncementDetailPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { RegistrationPage } from "./pages/RegistrationPage";
import { WinnerDetailPage } from "./pages/WinnerDetailPage";

// root routing — semua halaman di-wrap Layout biar navbar & footer konsisten
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/daftar" element={<RegistrationPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pengumuman" element={<AnnouncementsPage />} />
        <Route path="/pengumuman/:eventId/berita/:announcementId" element={<AnnouncementDetailPage />} />
        <Route path="/pengumuman/:eventId/:teamSlug" element={<WinnerDetailPage />} />
        	<Route path="/X7pQm2Kf9vLzR4tN8wYbC1hJ6sD3aG5e" element={<AdminPanel />} />
      </Routes>
    </Layout>
  );
}
