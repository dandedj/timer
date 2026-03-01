import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LibraryPage } from './pages/LibraryPage';
import { BuilderPage } from './pages/BuilderPage';
import { DisplayPage } from './pages/DisplayPage';
import { CheatsheetPage } from './pages/CheatsheetPage';
import { StorageProvider } from './storage/storageContext';

export default function App() {
  return (
    <StorageProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/builder" element={<BuilderPage />} />
            <Route path="/builder/:timerId" element={<BuilderPage />} />
          </Route>
          <Route path="/display/:timerId" element={<DisplayPage />} />
          <Route path="/cheatsheet/:timerId" element={<CheatsheetPage />} />
        </Routes>
      </BrowserRouter>
    </StorageProvider>
  );
}
