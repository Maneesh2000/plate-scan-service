import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { getSubdomain } from "./utils/subdomain.js";
import Navbar from "./components/Navbar.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import CasesPage from "./pages/CasesPage.jsx";
import CaseDetailPage from "./pages/CaseDetailPage.jsx";
import PortalLandingPage from "./pages/PortalLandingPage.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading…</p>;
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  const { user } = useAuth();
  const subdomain = getSubdomain();

  // Root domain (localhost:3000) displays the Agency Portal Directory
  if (!subdomain) {
    return <PortalLandingPage />;
  }

  // Subdomain (e.g. alpha.localhost:3000 or beta.localhost:3000) runs the tenant dashboard
  return (
    <>
      {user && <Navbar />}
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <CasesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/cases/:caseId"
            element={
              <PrivateRoute>
                <CaseDetailPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}
