import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletConnectPage from './pages/WalletConnectPage';
import SwapPage from './pages/SwapPage';

function App() {

  return (
    <Router>
     <Routes>
        <Route path="/" element={<WalletConnectPage />} />
        
        <Route path="/connect" element={<WalletConnectPage />} />
        <Route path="/swap" element={<SwapPage />} />
      </Routes>
    </Router>
  );
}

export default App
