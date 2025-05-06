import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import store, { useAppSelector } from './redux/store';

// Pages
import Home from './pages/Home';
import RecipeDetail from './pages/RecipeDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

// Components
import Layout from './components/common/Layout';

// Auth protection for routes
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get auth state from Redux store using hooks
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  
  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/register" element={<Layout><Register /></Layout>} />
          
          {/* Protected routes */}
          <Route 
            path="/recipe/:id" 
            element={
              <PrivateRoute>
                <Layout>
                  <RecipeDetail />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Layout>
                  <Profile />
                </Layout>
              </PrivateRoute>
            } 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Provider>
  );
};

export default App;