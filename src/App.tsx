/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import VotingPage from "./pages/VotingPage";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  return (
    <BrowserRouter basename="/asd-talent">
      <App />
      <Routes>
        <Route path="/" element={<VotingPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
