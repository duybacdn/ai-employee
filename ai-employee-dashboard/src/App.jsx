import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Conversations from "./pages/Conversations";
import Login from "./pages/Login";
import CandidateApproval from "./pages/CandidateApproval";
import KnowledgeManager from "./pages/KnowledgeManager";
import Employees from "./pages/Employees";
import Channels from "./pages/Channels";
import Layout from "./components/Layout";
import SelectFacebookPages from "./pages/SelectFacebookPages";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* PRIVATE */}
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/candidates" element={<CandidateApproval />} />
          <Route path="/knowledge" element={<KnowledgeManager />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/channels/select-pages" element={<SelectFacebookPages />} />
          
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;