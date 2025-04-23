import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletConnectPage from './WalletConnectPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/connect" element={<WalletConnectPage />} />
        <Route path="/" element={<WalletConnectPage />} />
      </Routes>
    </Router>
  );
}

export default App;