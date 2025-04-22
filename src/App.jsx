import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletConnectPage from './pages/WalletConnectPage';

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<WalletConnectPage />} />
      </Routes>
    </Router>
  );
}

export default App
