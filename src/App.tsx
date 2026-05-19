import { Navigate, Route, Routes } from 'react-router-dom';
import { AppBackground } from './components/AppBackground';
import { OnboardingGate } from './components/OnboardingGate';
import { ProfileProvider } from './context/ProfileContext';
import { SessionProvider } from './context/SessionContext';
import { TarotBackSkinProvider } from './context/TarotBackSkinContext';
import { AppShell } from './layout/AppShell';
import { ProductPager } from './layout/ProductPager';

export default function App() {
  return (
    <SessionProvider>
      <TarotBackSkinProvider>
        <ProfileProvider>
        <div className="app-layout-root">
        <AppBackground />
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<ProductPager />} />
          </Route>
          <Route path="/moon" element={<Navigate to="/" replace />} />
          <Route path="/tarot" element={<Navigate to="/?panel=tarot" replace />} />
          <Route path="/horoscope" element={<Navigate to="/?panel=horoscope" replace />} />
          <Route path="/runes" element={<Navigate to="/?panel=consult" replace />} />
          <Route path="/consult" element={<Navigate to="/?panel=consult" replace />} />
          {/* Раздел обучения выключён: раньше было to="/?panel=learn" */}
          <Route path="/learn" element={<Navigate to="/" replace />} />
          <Route path="/education" element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<Navigate to="/?panel=profile" replace />} />
          <Route path="/cabinet" element={<Navigate to="/?panel=profile" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <OnboardingGate />
        </div>
        </ProfileProvider>
      </TarotBackSkinProvider>
    </SessionProvider>
  );
}
