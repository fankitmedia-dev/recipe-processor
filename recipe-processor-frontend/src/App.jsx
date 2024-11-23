// src/App.jsx
import React from 'react';
import AIProcessor from './components/AIProcessor';
import './App.css';

function App() {
  return (
    <div className="app-container" style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#f0f2f5',
      padding: '20px 0',
      display: 'flex',
      justifyContent: 'center'
    }}>
      <AIProcessor />
    </div>
  );
}

export default App;