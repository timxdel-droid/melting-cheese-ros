import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './screens/Login.jsx'
import Shell from './components/Shell.jsx'
import Dashboard from './screens/Dashboard.jsx'
import Users from './screens/Users.jsx'
import Banners from './screens/Banners.jsx'
import BannerEdit from './screens/BannerEdit.jsx'
import Placeholder from './screens/Placeholder.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route element={<Shell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Users />} />
        <Route path="/promotions/banners" element={<Banners />} />
        <Route path="/promotions/banners/edit" element={<BannerEdit />} />

        {/* Screens pending Figma capture — routed so navigation works */}
        <Route path="/live-orders" element={<Placeholder title="Live Orders" />} />
        <Route path="/locations" element={<Placeholder title="Locations" />} />
        <Route path="/menu" element={<Placeholder title="Menu Manager" />} />
        <Route path="/inventory" element={<Placeholder title="Inventory" />} />
        <Route path="/staff" element={<Placeholder title="Staff & Roles" />} />
        <Route path="/trucks" element={<Placeholder title="Food Trucks" />} />
        <Route path="/kiosks" element={<Placeholder title="Kiosks" />} />
        <Route path="/emenu" element={<Placeholder title="eMenu (QR)" />} />
        <Route path="/analytics" element={<Placeholder title="Analytics & Reports" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="/support" element={<Placeholder title="Support" />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
