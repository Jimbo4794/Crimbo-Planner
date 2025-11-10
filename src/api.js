// API utility functions for communicating with the backend

const API_BASE = '/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// RSVPs API
export const fetchRSVPs = async () => {
  const response = await fetch(`${API_BASE}/rsvps`);
  return handleResponse(response);
};

export const saveRSVPs = async (rsvps) => {
  const response = await fetch(`${API_BASE}/rsvps`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rsvps }),
  });
  return handleResponse(response);
};

// Menu API
export const fetchMenu = async () => {
  const response = await fetch(`${API_BASE}/menu`);
  const data = await handleResponse(response);
  return data; // Returns null if no menu exists
};

export const saveMenu = async (menuCategories) => {
  const response = await fetch(`${API_BASE}/menu`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ menuCategories }),
  });
  return handleResponse(response);
};

// Config API
export const fetchConfig = async () => {
  const response = await fetch(`${API_BASE}/config`);
  return handleResponse(response);
};

export const saveConfig = async (tablesCount, seatsPerTable, tablePositions = null, customAreas = null, gridCols = null, gridRows = null, tableDisplayNames = null) => {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames }),
  });
  return handleResponse(response);
};

// Lift Sharing API
export const fetchLiftShares = async () => {
  const response = await fetch(`${API_BASE}/liftshares`);
  return handleResponse(response);
};

export const saveLiftShares = async (liftShares) => {
  const response = await fetch(`${API_BASE}/liftshares`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ liftShares }),
  });
  return handleResponse(response);
};

// Event Details API
export const fetchEventDetails = async () => {
  const response = await fetch(`${API_BASE}/event`);
  const data = await handleResponse(response);
  return data; // Returns null if no event details exist
};

export const saveEventDetails = async (eventDetails) => {
  const response = await fetch(`${API_BASE}/event`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventDetails }),
  });
  return handleResponse(response);
};

// Feedback API
export const fetchFeedback = async () => {
  const response = await fetch(`${API_BASE}/feedback`);
  return handleResponse(response);
};

export const saveFeedback = async (feedback) => {
  const response = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feedback }),
  });
  return handleResponse(response);
};

export const deleteFeedback = async (feedbackId) => {
  const response = await fetch(`${API_BASE}/feedback/${feedbackId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return handleResponse(response);
};

// Admin API
export const adminLogin = async (password) => {
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  return handleResponse(response);
};

export const adminLogout = async (sessionId) => {
  const response = await fetch(`${API_BASE}/admin/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-session': sessionId,
    },
  });
  return handleResponse(response);
};

export const checkAdminSession = async (sessionId) => {
  const response = await fetch(`${API_BASE}/admin/check`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-session': sessionId,
    },
  });
  return handleResponse(response);
};

