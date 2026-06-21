import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<div className="p-8 text-2xl font-bold">Pinlooply 🚀</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
