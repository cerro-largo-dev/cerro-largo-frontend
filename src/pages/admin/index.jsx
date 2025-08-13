import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RouteGuard from '../../components/admin/RouteGuard';
import Dashboard from './Dashboard';
import Login from './Login';

const AdminPanel = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/*" 
        element={
          <RouteGuard requiredRoles={['ADMIN', 'ALCALDE']}>
            <Dashboard />
          </RouteGuard>
        } 
      />
    </Routes>
  );
};

export default AdminPanel;

