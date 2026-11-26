import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ToastProvider } from '@/components/ui/Toast';
import { AiInput } from '@/pages/AiInput';
import { Bills } from '@/pages/Bills';
import { Calendar } from '@/pages/Calendar';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/Login';
import { NotFound } from '@/pages/NotFound';
import { Register } from '@/pages/Register';
import { Settings } from '@/pages/Settings';
import { Stats } from '@/pages/Stats';
import { Subscriptions } from '@/pages/Subscriptions';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="ai" element={<AiInput />} />
            <Route path="bills" element={<Bills />} />
            <Route path="stats" element={<Stats />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  );
}
