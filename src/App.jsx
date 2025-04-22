import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletConnectPage from './pages/WalletConnectPage';

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/connect" element={<WalletConnectPage />} />
        <Route path="/" element={<div>Home Page (Future Web Version)</div>} />
      </Routes>
    </Router>
  );
}

export default App
