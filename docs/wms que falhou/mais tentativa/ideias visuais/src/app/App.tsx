import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { useApp } from "../context/AppContext";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { AuditPage } from "../pages/AuditPage";
import { BlindCountPage } from "../pages/BlindCountPage";
import { DocksPage } from "../pages/DocksPage";
import { LayoutEditorPage } from "../pages/LayoutEditorPage";
import { LoginPage } from "../pages/LoginPage";
import { MapPage } from "../pages/MapPage";
import { OverviewPage } from "../pages/OverviewPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ReceivingPage } from "../pages/ReceivingPage";
import { SecurityPage } from "../pages/SecurityPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ValidationPage } from "../pages/ValidationPage";

export function App() {
  const { currentUser } = useApp();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/overview" replace /> : <LoginPage />} />
      <Route element={currentUser ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/layout-editor" element={<LayoutEditorPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/docks" element={<DocksPage />} />
        <Route path="/receiving" element={<ReceivingPage />} />
        <Route path="/blind-count" element={<BlindCountPage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
